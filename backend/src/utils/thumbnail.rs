//! 缩略图解码：统一入口，GIF 只解第一帧以节省时间和内存。
//! 支持 Ugoira（ZIP）：解码失败且为 ZIP 时，提取首帧生成缩略图。

use std::io::Cursor;

use tracing::debug;

use image::DynamicImage;
use zip::ZipArchive;

use crate::utils::AppError;

/// 在阻塞线程中执行：解码 → 缩略图 → 编码 JPEG。
/// 供 handler 用 `spawn_blocking` 调用，避免长时间占用 async 工作线程导致超时或无法正确返回响应。
pub fn generate_thumbnail_jpeg(data: Vec<u8>, mime_type: String, w: u32) -> Result<Vec<u8>, AppError> {
    let img = decode_image_for_thumbnail(&data, &mime_type)?;
    let thumb = img.thumbnail(w, w);
    let mut b = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut b);
    thumb
        .write_to(&mut cursor, image::ImageFormat::Jpeg)
        .map_err(|e| AppError::File(format!("缩略图编码失败: {}", e)))?;
    Ok(b)
}

/// 从原始字节解码出用于生成缩略图的一帧图像。
/// - GIF：只解码第一帧，大 GIF 不整文件解码。
/// - Ugoira（ZIP）：提取首帧；任意 mime 解码失败且数据为 ZIP 时也尝试（兼容误标 mime）。
/// - 其他 image/*：按整图解码。
pub fn decode_image_for_thumbnail(data: &[u8], mime_type: &str) -> Result<DynamicImage, AppError> {
    let mime_lower = mime_type.to_lowercase();
    if mime_lower == "image/gif" {
        if let Ok(img) = decode_gif_first_frame(data) {
            return Ok(img);
        }
        if data.starts_with(b"PK") {
            if let Some(img) = extract_ugoira_first_frame(data) {
                return Ok(img);
            }
        }
        return Err(AppError::File("GIF 解码失败，且 Ugoira 首帧提取失败".to_string()));
    }
    match image::load_from_memory(data) {
        Ok(img) => Ok(img),
        Err(e) => {
            if let Some(img) = extract_ugoira_first_frame(data) {
                Ok(img)
            } else {
                let magic = data
                    .iter()
                    .take(8)
                    .map(|b| format!("{:02x}", b))
                    .collect::<Vec<_>>()
                    .join(" ");
                debug!(magic = %magic, len = data.len(), "图片解码失败，Ugoira 提取也未成功");
                if data.starts_with(b"PK") {
                    Err(AppError::File("Ugoira 首帧提取失败".to_string()))
                } else {
                    Err(AppError::File(format!("无法解码图片: {}", e)))
                }
            }
        }
    }
}

/// 从 Ugoira ZIP 提取首帧并解码为 DynamicImage。
fn extract_ugoira_first_frame(data: &[u8]) -> Option<DynamicImage> {
    let mut zip = ZipArchive::new(Cursor::new(data)).ok()?;
    let names: Vec<String> = zip.file_names().map(String::from).collect();

    let meta_name = names.iter().find(|n| n.to_lowercase() == "frames.json")?;
    let mut meta_file = zip.by_name(meta_name).ok()?;
    #[derive(serde::Deserialize)]
    struct Meta {
        frames: Vec<serde_json::Value>,
    }
    let meta: Meta = serde_json::from_reader(meta_file).ok()?;
    let first = meta.frames.first()?;
    let file_name: String = first
        .get("file")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| "0.png".to_string());
    drop(meta);

    let mut zip = ZipArchive::new(Cursor::new(data)).ok()?;
    let frame_name = names
        .iter()
        .find(|n| n.to_lowercase() == file_name.to_lowercase())?;
    let mut frame_file = zip.by_name(frame_name).ok()?;
    let mut buf = Vec::with_capacity(frame_file.size() as usize);
    std::io::copy(&mut frame_file, &mut buf).ok()?;
    image::load_from_memory(&buf).ok()
}

/// 只解码 GIF 第一帧，避免大文件整图解码。
fn decode_gif_first_frame(data: &[u8]) -> Result<DynamicImage, AppError> {
    let mut opts = gif::DecodeOptions::new();
    opts.set_color_output(gif::ColorOutput::RGBA);
    let mut decoder = opts
        .read_info(Cursor::new(data))
        .map_err(|e| AppError::File(format!("GIF 解码失败: {}", e)))?;

    let frame = decoder
        .read_next_frame()
        .map_err(|e| AppError::File(format!("GIF 读取第一帧失败: {}", e)))?
        .ok_or_else(|| AppError::File("GIF 无有效帧".to_string()))?;

    let w = frame.width;
    let h = frame.height;
    let buf = frame.buffer.to_vec();
    let expected = (w as usize) * (h as usize) * 4;
    if buf.len() != expected {
        return Err(AppError::File(format!(
            "GIF 第一帧 buffer 长度异常: {} != {}",
            buf.len(),
            expected
        )));
    }

    let img = image::ImageBuffer::from_raw(w as u32, h as u32, buf)
        .ok_or_else(|| AppError::File("GIF 第一帧转 ImageBuffer 失败".to_string()))?;
    Ok(DynamicImage::ImageRgba8(img))
}
