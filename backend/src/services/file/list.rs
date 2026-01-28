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
    ) -> Result<(Vec<FileResponse>, u64), AppError> {
        let (files, total) = crate::repositories::files::FilesRepo::new(&self.pool)
            .list_files(user_id, query)
            .await?;
        Ok((
            files.into_iter().map(FileResponse::from).collect(),
            total as u64,
        ))
    }
}
