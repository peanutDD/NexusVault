//! 文件读取（元数据 / 内容 / 流式读取）

use uuid::Uuid;

use crate::models::file::File;
use crate::services::storage::StorageReadStream;
use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn get_file(&self, file_id: Uuid, user_id: Uuid) -> Result<File, AppError> {
        let file = sqlx::query_as::<_, File>("SELECT * FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AppError::NotFound)?;

        Ok(file)
    }

    pub async fn get_file_data(&self, file: &File) -> Result<Vec<u8>, AppError> {
        self.storage.get_file(&file.file_path).await
    }

    pub async fn open_file_stream(&self, file: &File) -> Result<StorageReadStream, AppError> {
        self.storage.open_read_stream(&file.file_path).await
    }

    pub async fn open_file_stream_range(
        &self,
        file: &File,
        start: u64,
        end_inclusive: u64,
    ) -> Result<StorageReadStream, AppError> {
        self.storage
            .open_read_stream_range(&file.file_path, start, end_inclusive)
            .await
    }
}

