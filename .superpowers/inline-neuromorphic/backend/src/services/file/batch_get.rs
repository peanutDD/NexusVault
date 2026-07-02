//! 按 ID 批量查询文件元数据
//!
//! 供前端批量请求合并使用：一次请求返回多个文件详情，顺序与请求 ids 一致，未找到的为 null。

use uuid::Uuid;

use crate::constants::MAX_BATCH_GET_IDS;
use crate::models::file::FileResponse;
use crate::utils::AppError;

use super::FileService;

impl FileService {
    /// 按 ID 列表批量查询文件元数据。
    /// 返回顺序与 `ids` 一致；未找到或无权访问的项为 `None`。
    pub async fn get_files_by_ids(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
    ) -> Result<Vec<Option<FileResponse>>, AppError> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        if ids.len() > MAX_BATCH_GET_IDS {
            return Err(AppError::Validation(format!(
                "单次批量查询最多 {} 个 ID（当前 {}）",
                MAX_BATCH_GET_IDS,
                ids.len()
            )));
        }

        let files = self.files_repo.find_by_ids(user_id, ids).await?;
        let map: std::collections::HashMap<Uuid, FileResponse> = files
            .into_iter()
            .map(|f| (f.id, FileResponse::from(f)))
            .collect();
        let ordered: Vec<Option<FileResponse>> =
            ids.iter().map(|id| map.get(id).cloned()).collect();
        Ok(ordered)
    }
}
