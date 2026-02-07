//! 缩略图解码：统一入口，GIF 只解第一帧以节省时间和内存。

use std::io::Cursor;

use image::DynamicImage;

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
/// - 其他 image/*：按整图解码。
pub fn decode_image_for_thumbnail(data: &[u8], mime_type: &str) -> Result<DynamicImage, AppError> {
    let mime_lower = mime_type.to_lowercase();
    if mime_lower == "image/gif" {
        decode_gif_first_frame(data)
    } else {
        image::load_from_memory(data).map_err(|e| {
            AppError::File(format!("无法解码图片: {}", e))
        })
    }
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
