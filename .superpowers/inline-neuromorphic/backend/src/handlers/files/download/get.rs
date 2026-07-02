//! GET 响应构造（包含 body 传输）。

use axum::body::Body;
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::Response;

use crate::services::storage::StorageReadStream;
use crate::utils::{stream_file_response, AppError};

use super::headers::{apply_cache_headers, apply_range_headers, EntityHeaders};
use super::multipart::build_multipart_body;
use super::ranges::ByteRange;
use super::responses::range_not_satisfiable_response;

pub async fn build_get_response(
    state: &crate::AppState,
    file: &crate::models::file::File,
    mime_type: &str,
    inline: bool,
    total_size: u64,
    ranges: Option<Vec<ByteRange>>,
    entity_headers: &EntityHeaders,
) -> Result<Response, AppError> {
    use tokio::io::{AsyncReadExt, AsyncSeekExt};
    use tokio_util::io::ReaderStream;

    if let Some(ranges) = ranges {
        if ranges.is_empty() {
            return range_not_satisfiable_response(total_size, entity_headers);
        }

        if ranges.len() > 1 {
            let (body, boundary) = build_multipart_body(
                state.file_service.clone(),
                file.clone(),
                total_size,
                ranges,
                mime_type.to_string(),
            );

            let mut res =
                stream_file_response(body, &file.original_filename, mime_type, inline, None)
                    .map_err(|_| AppError::Internal)?;
            *res.status_mut() = StatusCode::PARTIAL_CONTENT;
            res.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_str(&format!("multipart/byteranges; boundary={}", boundary))
                    .map_err(|_| AppError::Internal)?,
            );
            apply_cache_headers(res.headers_mut(), entity_headers, inline);
            apply_range_headers(res.headers_mut());
            return Ok(res);
        }

        let (start, end) = ranges[0];
        if start >= total_size || start > end {
            return range_not_satisfiable_response(total_size, entity_headers);
        }

        let end = end.min(total_size.saturating_sub(1));
        let len = end - start + 1;

        let stream = state
            .file_service
            .open_file_stream_range(file, start, end)
            .await?;
        let body = match stream {
            StorageReadStream::Local(mut f) => {
                f.seek(std::io::SeekFrom::Start(start))
                    .await
                    .map_err(|e| AppError::File(format!("Failed to seek file: {}", e)))?;
                let reader = f.take(len);
                Body::from_stream(ReaderStream::new(reader))
            }
            StorageReadStream::S3(s) => {
                let reader = s.into_async_read();
                Body::from_stream(ReaderStream::new(reader))
            }
            StorageReadStream::Memory(mut cursor) => {
                cursor
                    .seek(std::io::SeekFrom::Start(start))
                    .await
                    .map_err(|e| AppError::File(format!("Failed to seek memory stream: {}", e)))?;
                let reader = cursor.take(len);
                Body::from_stream(ReaderStream::new(reader))
            }
        };

        let mut res =
            stream_file_response(body, &file.original_filename, mime_type, inline, Some(len))
                .map_err(|_| AppError::Internal)?;
        *res.status_mut() = StatusCode::PARTIAL_CONTENT;
        res.headers_mut().insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {}-{}/{}", start, end, total_size))
                .map_err(|_| AppError::Internal)?,
        );
        apply_cache_headers(res.headers_mut(), entity_headers, inline);
        apply_range_headers(res.headers_mut());
        // 记录下载指标（Range 请求）
        crate::middleware::metrics::record_file_operation("download", len, true);
        return Ok(res);
    }

    let stream = state.file_service.open_file_stream(file).await?;
    let body = match stream {
        StorageReadStream::Local(f) => Body::from_stream(ReaderStream::new(f)),
        StorageReadStream::S3(s) => {
            let reader = s.into_async_read();
            Body::from_stream(ReaderStream::new(reader))
        }
        StorageReadStream::Memory(cursor) => Body::from_stream(ReaderStream::new(cursor)),
    };

    let mut res = stream_file_response(
        body,
        &file.original_filename,
        mime_type,
        inline,
        Some(total_size),
    )
    .map_err(|_| AppError::Internal)?;
    apply_cache_headers(res.headers_mut(), entity_headers, inline);
    apply_range_headers(res.headers_mut());
    // 记录完整下载指标
    crate::middleware::metrics::record_file_operation("download", total_size, true);
    Ok(res)
}
