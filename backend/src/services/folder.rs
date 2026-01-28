//! # 文件夹服务模块
//!
//! 提供文件夹管理的核心业务逻辑，包括：
//!
//! - **文件夹创建**: 在指定位置创建新文件夹
//! - **文件夹查询**: 列出子文件夹、获取路径
//! - **文件夹操作**: 重命名、移动、删除
//! - **文件移动**: 将文件移动到指定文件夹

use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    models::folder::{
        CreateFolderRequest, Folder, FolderContentsResponse, FolderPathResponse, FolderResponse,
        MoveFolderRequest, RenameFolderRequest,
    },
    utils::AppError,
};

/// 文件夹服务
pub struct FolderService {
    pool: PgPool,
}

impl FolderService {
    /// 创建新的 FolderService 实例
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// 从 AppState 创建 FolderService（工厂方法）
    pub fn from_state(state: &crate::AppState) -> Self {
        Self::new(state.pool.clone())
    }

    /// 创建文件夹
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `req`: 创建请求（包含名称和父文件夹 ID）
    ///
    /// # 返回
    /// - `Ok(FolderResponse)`: 创建成功
    /// - `Err(AppError)`: 创建失败（名称冲突等）
    pub async fn create_folder(
        &self,
        user_id: Uuid,
        req: CreateFolderRequest,
    ) -> Result<FolderResponse, AppError> {
        // 验证文件夹名称
        let name = req.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("文件夹名称不能为空".to_string()));
        }
        if name.len() > 255 {
            return Err(AppError::Validation("文件夹名称过长".to_string()));
        }
        // 禁止特殊字符
        if name.contains('/') || name.contains('\\') || name.contains('\0') {
            return Err(AppError::Validation(
                "文件夹名称包含非法字符".to_string(),
            ));
        }

        // 如果指定了父文件夹，验证其存在且属于该用户
        if let Some(parent_id) = req.parent_id {
            sqlx::query_as::<_, (Uuid,)>("SELECT id FROM folders WHERE id = $1 AND user_id = $2")
                .bind(parent_id)
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?
                .ok_or_else(|| AppError::Validation("父文件夹不存在".to_string()))?;
        }

        // 检查同一父目录下是否已存在同名文件夹（使用 IS NOT DISTINCT FROM 统一处理 NULL）
        let existing: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM folders WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND name = $3",
        )
        .bind(user_id)
        .bind(req.parent_id)
        .bind(name)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(AppError::Validation("同名文件夹已存在".to_string()));
        }

        // 创建文件夹
        let folder: Folder = sqlx::query_as(
            r#"
            INSERT INTO folders (user_id, name, parent_id)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, name, parent_id, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(name)
        .bind(req.parent_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(folder.into())
    }

    /// 列出文件夹
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `parent_id`: 父文件夹 ID（None 表示根目录）
    ///
    /// # 返回
    /// - 文件夹列表
    pub async fn list_folders(
        &self,
        user_id: Uuid,
        parent_id: Option<Uuid>,
    ) -> Result<Vec<FolderResponse>, AppError> {
        // 使用 IS NOT DISTINCT FROM 统一处理 NULL 和非 NULL 的 parent_id
        let folders: Vec<Folder> = sqlx::query_as(
            r#"
            SELECT id, user_id, name, parent_id, created_at, updated_at
            FROM folders
            WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $2
            ORDER BY name ASC
            "#,
        )
        .bind(user_id)
        .bind(parent_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(folders.into_iter().map(Into::into).collect())
    }

    /// 获取文件夹详情
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `folder_id`: 文件夹 ID
    ///
    /// # 返回
    /// - 文件夹信息
    pub async fn get_folder(
        &self,
        user_id: Uuid,
        folder_id: Uuid,
    ) -> Result<FolderResponse, AppError> {
        sqlx::query_as::<_, Folder>(
            r#"
            SELECT id, user_id, name, parent_id, created_at, updated_at
            FROM folders
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .map(Into::into)
        .ok_or(AppError::NotFound)
    }

    /// 获取文件夹路径（面包屑导航）
    ///
    /// 返回从根目录到指定文件夹的完整路径。
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `folder_id`: 文件夹 ID
    ///
    /// # 返回
    /// - 路径列表（从根目录到当前文件夹）
    pub async fn get_folder_path(
        &self,
        user_id: Uuid,
        folder_id: Uuid,
    ) -> Result<FolderPathResponse, AppError> {
        // 使用递归 CTE 获取路径
        let path: Vec<Folder> = sqlx::query_as(
            r#"
            WITH RECURSIVE folder_path AS (
                -- 起点：当前文件夹
                SELECT id, user_id, name, parent_id, created_at, updated_at, 1 as depth
                FROM folders
                WHERE id = $1 AND user_id = $2
                
                UNION ALL
                
                -- 递归：向上查找父文件夹
                SELECT f.id, f.user_id, f.name, f.parent_id, f.created_at, f.updated_at, fp.depth + 1
                FROM folders f
                INNER JOIN folder_path fp ON f.id = fp.parent_id
            )
            SELECT id, user_id, name, parent_id, created_at, updated_at
            FROM folder_path
            ORDER BY depth DESC
            "#,
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        (!path.is_empty())
            .then(|| FolderPathResponse {
                path: path.into_iter().map(Into::into).collect(),
            })
            .ok_or(AppError::NotFound)
    }

    /// 获取文件夹内容（子文件夹 + 路径）
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `folder_id`: 文件夹 ID（None 表示根目录）
    ///
    /// # 返回
    /// - 当前文件夹信息、路径、子文件夹列表
    pub async fn get_folder_contents(
        &self,
        user_id: Uuid,
        folder_id: Option<Uuid>,
    ) -> Result<FolderContentsResponse, AppError> {
        // 使用 match 替代 if-let-else，更清晰地处理两种情况
        let (current, path) = match folder_id {
            Some(fid) => {
                let current = self.get_folder(user_id, fid).await?;
                let path_resp = self.get_folder_path(user_id, fid).await?;
                (Some(current), path_resp.path)
            }
            None => (None, vec![]),
        };

        let folders = self.list_folders(user_id, folder_id).await?;

        Ok(FolderContentsResponse {
            current,
            path,
            folders,
        })
    }

    /// 重命名文件夹
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `folder_id`: 文件夹 ID
    /// - `req`: 重命名请求
    ///
    /// # 返回
    /// - 更新后的文件夹信息
    pub async fn rename_folder(
        &self,
        user_id: Uuid,
        folder_id: Uuid,
        req: RenameFolderRequest,
    ) -> Result<FolderResponse, AppError> {
        let name = req.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("文件夹名称不能为空".to_string()));
        }
        if name.len() > 255 {
            return Err(AppError::Validation("文件夹名称过长".to_string()));
        }
        if name.contains('/') || name.contains('\\') || name.contains('\0') {
            return Err(AppError::Validation(
                "文件夹名称包含非法字符".to_string(),
            ));
        }

        // 获取当前文件夹信息
        let current = sqlx::query_as::<_, Folder>(
            "SELECT id, user_id, name, parent_id, created_at, updated_at FROM folders WHERE id = $1 AND user_id = $2",
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::NotFound)?;

        // 检查同级目录下是否已有同名文件夹（使用 IS NOT DISTINCT FROM 统一处理）
        let existing: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM folders WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND name = $3 AND id != $4",
        )
        .bind(user_id)
        .bind(current.parent_id)
        .bind(name)
        .bind(folder_id)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(AppError::Validation("同名文件夹已存在".to_string()));
        }

        // 更新文件夹名称
        let folder: Folder = sqlx::query_as(
            r#"
            UPDATE folders
            SET name = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
            RETURNING id, user_id, name, parent_id, created_at, updated_at
            "#,
        )
        .bind(name)
        .bind(folder_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(folder.into())
    }

    /// 移动文件夹
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `folder_id`: 要移动的文件夹 ID
    /// - `req`: 移动请求（目标父文件夹 ID）
    ///
    /// # 返回
    /// - 更新后的文件夹信息
    pub async fn move_folder(
        &self,
        user_id: Uuid,
        folder_id: Uuid,
        req: MoveFolderRequest,
    ) -> Result<FolderResponse, AppError> {
        // 不能移动到自身
        if req.parent_id == Some(folder_id) {
            return Err(AppError::Validation(
                "不能将文件夹移动到自身".to_string(),
            ));
        }

        // 获取当前文件夹信息
        let current = sqlx::query_as::<_, Folder>(
            "SELECT id, user_id, name, parent_id, created_at, updated_at FROM folders WHERE id = $1 AND user_id = $2",
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::NotFound)?;

        // 如果目标父文件夹不为空，验证其存在且不是当前文件夹的子文件夹
        if let Some(new_parent_id) = req.parent_id {
            // 验证目标文件夹存在
            sqlx::query_as::<_, (Uuid,)>("SELECT id FROM folders WHERE id = $1 AND user_id = $2")
                .bind(new_parent_id)
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?
                .ok_or_else(|| AppError::Validation("目标文件夹不存在".to_string()))?;

            // 检查目标文件夹是否是当前文件夹的子文件夹（防止循环）
            let is_descendant: Option<(i64,)> = sqlx::query_as(
                r#"
                WITH RECURSIVE descendants AS (
                    SELECT id FROM folders WHERE parent_id = $1
                    UNION ALL
                    SELECT f.id FROM folders f
                    INNER JOIN descendants d ON f.parent_id = d.id
                )
                SELECT 1 FROM descendants WHERE id = $2
                "#,
            )
            .bind(folder_id)
            .bind(new_parent_id)
            .fetch_optional(&self.pool)
            .await?;

            if is_descendant.is_some() {
                return Err(AppError::Validation(
                    "不能将文件夹移动到其子文件夹中".to_string(),
                ));
            }
        }

        // 检查目标位置是否已有同名文件夹（使用 IS NOT DISTINCT FROM 统一处理）
        let existing: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM folders WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND name = $3 AND id != $4",
        )
        .bind(user_id)
        .bind(req.parent_id)
        .bind(&current.name)
        .bind(folder_id)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(AppError::Validation(
                "目标位置已存在同名文件夹".to_string(),
            ));
        }

        // 移动文件夹
        let folder: Folder = sqlx::query_as(
            r#"
            UPDATE folders
            SET parent_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
            RETURNING id, user_id, name, parent_id, created_at, updated_at
            "#,
        )
        .bind(req.parent_id)
        .bind(folder_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(folder.into())
    }

    /// 删除文件夹
    ///
    /// 级联删除所有子文件夹和文件。
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `folder_id`: 文件夹 ID
    ///
    /// # 返回
    /// - 删除的文件数量
    pub async fn delete_folder(&self, user_id: Uuid, folder_id: Uuid) -> Result<u64, AppError> {
        // 验证文件夹存在
        sqlx::query_as::<_, (Uuid,)>("SELECT id FROM folders WHERE id = $1 AND user_id = $2")
            .bind(folder_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AppError::NotFound)?;

        // 获取所有需要删除的文件夹 ID（包括子文件夹）
        let folder_ids: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            WITH RECURSIVE all_folders AS (
                SELECT id FROM folders WHERE id = $1 AND user_id = $2
                UNION ALL
                SELECT f.id FROM folders f
                INNER JOIN all_folders af ON f.parent_id = af.id
            )
            SELECT id FROM all_folders
            "#,
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let ids: Vec<Uuid> = folder_ids.into_iter().map(|(id,)| id).collect();

        // 计算要删除的文件数量
        let file_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM files WHERE folder_id = ANY($1) AND user_id = $2",
        )
        .bind(&ids)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // 删除文件夹（级联删除会自动删除子文件夹，文件的 folder_id 会被设为 NULL）
        sqlx::query("DELETE FROM folders WHERE id = $1 AND user_id = $2")
            .bind(folder_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        Ok(file_count.0 as u64)
    }

    /// 批量移动文件到文件夹
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `file_ids`: 文件 ID 列表
    /// - `folder_id`: 目标文件夹 ID（None 表示移动到根目录）
    ///
    /// # 返回
    /// - 成功移动的文件数量
    pub async fn move_files_to_folder(
        &self,
        user_id: Uuid,
        file_ids: Vec<Uuid>,
        folder_id: Option<Uuid>,
    ) -> Result<u64, AppError> {
        if file_ids.is_empty() {
            return Ok(0);
        }

        // 如果目标文件夹不为空，验证其存在
        if let Some(fid) = folder_id {
            sqlx::query_as::<_, (Uuid,)>("SELECT id FROM folders WHERE id = $1 AND user_id = $2")
                .bind(fid)
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?
                .ok_or_else(|| AppError::Validation("目标文件夹不存在".to_string()))?;
        }

        // 更新文件的 folder_id
        let result = sqlx::query(
            "UPDATE files SET folder_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2) AND user_id = $3",
        )
        .bind(folder_id)
        .bind(&file_ids)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// 获取文件夹内所有文件 ID（递归）
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `folder_ids`: 文件夹 ID 列表
    ///
    /// # 返回
    /// - 所有文件 ID 列表
    pub async fn get_all_file_ids_in_folders(
        &self,
        user_id: Uuid,
        folder_ids: Vec<Uuid>,
    ) -> Result<Vec<Uuid>, AppError> {
        if folder_ids.is_empty() {
            return Ok(vec![]);
        }

        // 递归获取所有子文件夹 ID
        let all_folder_ids: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            WITH RECURSIVE all_folders AS (
                -- 起点：传入的文件夹
                SELECT id FROM folders WHERE id = ANY($1) AND user_id = $2
                UNION ALL
                -- 递归：获取所有子文件夹
                SELECT f.id FROM folders f
                INNER JOIN all_folders af ON f.parent_id = af.id
            )
            SELECT id FROM all_folders
            "#,
        )
        .bind(&folder_ids)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let all_folder_ids: Vec<Uuid> = all_folder_ids.into_iter().map(|(id,)| id).collect();

        if all_folder_ids.is_empty() {
            return Ok(vec![]);
        }

        // 获取这些文件夹内的所有文件 ID
        let file_ids: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM files WHERE folder_id = ANY($1) AND user_id = $2",
        )
        .bind(&all_folder_ids)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(file_ids.into_iter().map(|(id,)| id).collect())
    }
}
