//! multipart/byteranges（多段 Range）流式响应 body 构造。
//!
//! 说明：
//! - 这是多段 Range 的“慢路径”，但需要保持正确性与低内存占用。
//! - Local：seek + take 读取每个分段
//! - S3：每个分段走一次 `Range: bytes=start-end` 请求（简洁但会产生多次网络往返）

use std::sync::Arc;

use axum::body::Body;
use bytes::Bytes;
use uuid::Uuid;

use crate::services::file::FileService;
use crate::services::storage::StorageReadStream;

use super::ranges::ByteRange;

/// 构造 multipart/byteranges 流式 body。
///
/// 接收 `Arc<FileService>` 以便在 'static 流中安全使用，避免引用逃逸。
pub fn build_multipart_body(
    file_service: Arc<FileService>,
    file: crate::models::file::File,
    total_size: u64,
    ranges: Vec<ByteRange>,
) -> (Body, String) {
    use async_stream::try_stream;
    use tokio::io::{AsyncReadExt, AsyncSeekExt};
    use tokio_stream::StreamExt;
    use tokio_util::io::ReaderStream;

    let boundary = format!("BOUNDARY-{}", Uuid::new_v4());

    // move into stream
    let boundary_stream = boundary.clone();
    let mime_type = file.mime_type.clone();
    let stream = try_stream! {
        for (start, end) in ranges {
            let header_bytes = format!(
                "--{b}\r\nContent-Type: {mime}\r\nContent-Range: bytes {start}-{end}/{total}\r\n\r\n",
                b = boundary_stream,
                mime = mime_type,
                total = total_size
            );
            yield Bytes::from(header_bytes);

            let part_stream = file_service
                .open_file_stream_range(&file, start, end)
                .await
                .map_err(|e| std::io::Error::other(e.to_string()))?;

            match part_stream {
                StorageReadStream::Local(mut f) => {
                    f.seek(std::io::SeekFrom::Start(start)).await?;
                    let reader = f.take(end - start + 1);
                    let mut rs = ReaderStream::new(reader);
                    while let Some(chunk) = rs.next().await {
                        let chunk = chunk?;
                        yield chunk;
                    }
                }
                StorageReadStream::S3(s) => {
                    let reader = s.into_async_read();
                    let mut rs = ReaderStream::new(reader);
                    while let Some(chunk) = rs.next().await {
                        let chunk = chunk?;
                        yield chunk;
                    }
                }
            }

            yield Bytes::from_static(b"\r\n");
        }
        yield Bytes::from(format!("--{}--\r\n", boundary_stream));
    };

    // 显式标注 error 类型，避免推断歧义
    use std::pin::Pin;
    let stream: Pin<Box<dyn tokio_stream::Stream<Item = Result<Bytes, std::io::Error>> + Send>> =
        Box::pin(stream);

    (Body::from_stream(stream), boundary)
}
