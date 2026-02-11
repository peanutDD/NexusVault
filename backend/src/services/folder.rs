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
        CreateFolderRequest, FolderContentsResponse, FolderPathResponse, FolderResponse,
        MoveFolderRequest, RenameFolderRequest,
    },
    repositories::FoldersRepo,
    services::storage::StorageBackend,
    utils::AppError,
};
use std::sync::Arc;

/// 文件夹服务
pub struct FolderService {
    pool: PgPool,
    storage: Option<Arc<dyn StorageBackend>>,
}

impl FolderService {
    /// 创建新的 `FolderService` 实例。
    ///
    /// 当前生产代码统一通过 `from_state` / `with_storage` 构造，
    /// 该 `new` 方法主要预留给单元测试或未来拆分模块单独注入 `PgPool` 的场景。
    #[allow(dead_code)]
    pub fn new(pool: PgPool) -> Self {
        Self { pool, storage: None }
    }

    /// 创建带存储后端的 FolderService 实例
    pub fn with_storage(pool: PgPool, storage: Arc<dyn StorageBackend>) -> Self {
        Self {
            pool,
            storage: Some(storage),
        }
    }

    /// 从 AppState 创建 FolderService（工厂方法）
    pub fn from_state(state: &crate::AppState) -> Self {
        Self::with_storage(state.pool.clone(), state.storage.clone())
    }

    // ========================================================================
    // 私有辅助方法
    // ========================================================================

    /// 验证文件夹名称
    fn validate_folder_name(name: &str) -> Result<String, AppError> {
        let name = name.trim();
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
        Ok(name.to_string())
    }

    // ========================================================================
    // 公开方法 - 创建
    // ========================================================================

    /// 创建文件夹
    pub async fn create_folder(
        &self,
        user_id: Uuid,
        req: CreateFolderRequest,
    ) -> Result<FolderResponse, AppError> {
        let name = Self::validate_folder_name(&req.name)?;
        let repo = FoldersRepo::new(&self.pool);

        // 如果指定了父文件夹，验证其存在
        if let Some(parent_id) = req.parent_id {
            if !repo.exists(parent_id, user_id).await? {
                return Err(AppError::Validation("父文件夹不存在".to_string()));
            }
        }

        // 检查同一父目录下是否已存在同名文件夹
        if repo
            .name_exists_in_parent(user_id, req.parent_id, &name, None)
            .await?
        {
            return Err(AppError::Validation("同名文件夹已存在".to_string()));
        }

        // 创建文件夹
        let folder = repo.create(user_id, &name, req.parent_id).await?;

        Ok(folder.into())
    }

    // ========================================================================
    // 公开方法 - 查询
    // ========================================================================

    /// 列出文件夹
    pub async fn list_folders(
        &self,
        user_id: Uuid,
        parent_id: Option<Uuid>,
    ) -> Result<Vec<FolderResponse>, AppError> {
        let repo = FoldersRepo::new(&self.pool);

        // 如果指定了父文件夹，验证其存在
        if let Some(pid) = parent_id {
            if !repo.exists(pid, user_id).await? {
                return Err(AppError::NotFound);
            }
        }

        let folders = repo.list_by_parent(user_id, parent_id).await?;

        Ok(folders.into_iter().map(|f| f.into()).collect())
    }

    /// 获取文件夹信息
    pub async fn get_folder(
        &self,
        user_id: Uuid,
        folder_id: Uuid,
    ) -> Result<FolderResponse, AppError> {
        let repo = FoldersRepo::new(&self.pool);

        let folder = repo
            .find_by_id(folder_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        Ok(folder.into())
    }

    /// 获取文件夹路径
    pub async fn get_folder_path(
        &self,
        user_id: Uuid,
        folder_id: Uuid,
    ) -> Result<FolderPathResponse, AppError> {
        let repo = FoldersRepo::new(&self.pool);

        // 验证文件夹存在
        if !repo.exists(folder_id, user_id).await? {
            return Err(AppError::NotFound);
        }

        let folders = repo.get_path(folder_id, user_id).await?;

        Ok(FolderPathResponse {
            path: folders.into_iter().map(|f| f.into()).collect(),
        })
    }

    /// 获取文件夹内容（子文件夹列表 + 路径）
    pub async fn get_folder_contents(
        &self,
        user_id: Uuid,
        folder_id: Option<Uuid>,
    ) -> Result<FolderContentsResponse, AppError> {
        let repo = FoldersRepo::new(&self.pool);

        // 获取当前文件夹信息和路径
        let (current, path) = if let Some(fid) = folder_id {
            let folder = repo.find_by_id(fid, user_id).await?.ok_or(AppError::NotFound)?;
            let path_folders = repo.get_path(fid, user_id).await?;
            (Some(folder.into()), path_folders.into_iter().map(|f| f.into()).collect())
        } else {
            (None, vec![])
        };

        // 获取子文件夹列表
        let folders = repo.list_by_parent(user_id, folder_id).await?;

        Ok(FolderContentsResponse {
            current,
            path,
            folders: folders.into_iter().map(|f| f.into()).collect(),
        })
    }

    // ========================================================================
    // 公开方法 - 修改
    // ========================================================================

    /// 重命名文件夹
    pub async fn rename_folder(
        &self,
        user_id: Uuid,
        folder_id: Uuid,
        req: RenameFolderRequest,
    ) -> Result<FolderResponse, AppError> {
        let name = Self::validate_folder_name(&req.name)?;
        let repo = FoldersRepo::new(&self.pool);

        // 获取当前文件夹信息
        let current = repo
            .find_by_id(folder_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        // 检查同级目录下是否已有同名文件夹
        if repo
            .name_exists_in_parent(user_id, current.parent_id, &name, Some(folder_id))
            .await?
        {
            return Err(AppError::Validation("同名文件夹已存在".to_string()));
        }

        // 更新文件夹名称
        let folder = repo.rename(folder_id, user_id, &name).await?;

        Ok(folder.into())
    }

    /// 移动文件夹
    pub async fn move_folder(
        &self,
        user_id: Uuid,
        folder_id: Uuid,
        req: MoveFolderRequest,
    ) -> Result<FolderResponse, AppError> {
        let repo = FoldersRepo::new(&self.pool);

        // 不能移动到自身
        if req.parent_id == Some(folder_id) {
            return Err(AppError::Validation(
                "不能将文件夹移动到自身".to_string(),
            ));
        }

        // 获取当前文件夹信息
        let current = repo
            .find_by_id(folder_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        // 如果目标父文件夹不为空，验证其存在且不是当前文件夹的子文件夹
        if let Some(new_parent_id) = req.parent_id {
            if !repo.exists(new_parent_id, user_id).await? {
                return Err(AppError::Validation("目标文件夹不存在".to_string()));
            }

            // 检查是否会造成循环
            if repo.is_descendant_of(folder_id, new_parent_id, user_id).await? {
                return Err(AppError::Validation(
                    "不能将文件夹移动到其子文件夹中".to_string(),
                ));
            }
        }

        // 检查目标位置是否已有同名文件夹
        if repo
            .name_exists_in_parent(user_id, req.parent_id, &current.name, Some(folder_id))
            .await?
        {
            return Err(AppError::Validation(
                "目标位置已存在同名文件夹".to_string(),
            ));
        }

        // 移动文件夹
        let folder = repo.move_to(folder_id, user_id, req.parent_id).await?;

        Ok(folder.into())
    }

    // ========================================================================
    // 公开方法 - 删除
    // ========================================================================

    /// 删除文件夹（级联删除所有子文件夹和文件）
    pub async fn delete_folder(&self, user_id: Uuid, folder_id: Uuid) -> Result<u64, AppError> {
        let repo = FoldersRepo::new(&self.pool);

        // 验证文件夹存在
        if !repo.exists(folder_id, user_id).await? {
            return Err(AppError::NotFound);
        }

        // 获取所有需要删除的文件夹 ID（包括子文件夹）
        let folder_ids = repo.get_all_descendant_ids(folder_id, user_id).await?;

        // 获取需要删除的文件路径（用于清理存储）
        let file_paths = repo.get_file_paths_in_folders(&folder_ids, user_id).await?;
        let file_count = file_paths.len() as u64;

        // 删除存储中的文件
        if let Some(storage) = &self.storage {
            for path in &file_paths {
                let _ = storage.delete_file(path).await;
            }
        }

        // 删除文件记录
        repo.delete_files_in_folders(&folder_ids, user_id).await?;

        // 删除文件夹
        repo.delete(&folder_ids, user_id).await?;

        Ok(file_count)
    }

    // ========================================================================
    // 公开方法 - 文件移动
    // ========================================================================

    /// 将文件移动到指定文件夹
    pub async fn move_files_to_folder(
        &self,
        user_id: Uuid,
        file_ids: Vec<Uuid>,
        folder_id: Option<Uuid>,
    ) -> Result<u64, AppError> {
        if file_ids.is_empty() {
            return Ok(0);
        }

        let repo = FoldersRepo::new(&self.pool);

        // 如果目标文件夹不为空，验证其存在
        if let Some(fid) = folder_id {
            if !repo.exists(fid, user_id).await? {
                return Err(AppError::Validation("目标文件夹不存在".to_string()));
            }
        }

        // 更新文件的 folder_id
        repo.move_files_to_folder(user_id, &file_ids, folder_id)
            .await
    }

    /// 获取文件夹内所有文件 ID（递归）
    pub async fn get_all_file_ids_in_folders(
        &self,
        user_id: Uuid,
        folder_ids: Vec<Uuid>,
    ) -> Result<Vec<Uuid>, AppError> {
        let repo = FoldersRepo::new(&self.pool);
        repo.get_all_file_ids_in_folders(user_id, &folder_ids).await
    }
}
