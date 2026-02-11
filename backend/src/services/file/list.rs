//! 文件列表查询（分页/过滤/搜索）

use uuid::Uuid;

use crate::models::file::{FileListQuery, FileResponse};
use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn list_files(
        &self,
        user_id: Uuid,
        query: FileListQuery,
    ) -> Result<(Vec<FileResponse>, Option<u64>, Option<String>), AppError> {
        let result = self.files_repo.list(user_id, query).await?;
        Ok((
            result.files.into_iter().map(FileResponse::from).collect(),
            result.total.map(|t| t as u64),
            result.next_cursor,
        ))
    }
}
