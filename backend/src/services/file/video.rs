//! GIF → 视频预览转码：将 GIF 源文件按需转成 mp4，供前端 `<video>` 流式播放。
//!
//! 设计原则：
//! - **懒转码**：只有当用户请求 GIF 视频预览时才触发 ffmpeg，一次生成，多次复用
//! - **仅本地存储**：与 HLS 一样，目前只支持 local backend，S3 后续再扩展
//! - **不新增 DB 记录**：派生 mp4 存放在 `.derived_videos/{file_id}.mp4`，对用户透明

use std::path::{Path, PathBuf};
use std::process::Command;

use crate::models::file::File;
use crate::utils::AppError;
use tokio::io::AsyncReadExt;
use uuid::Uuid;

use super::FileService;

const DERIVED_VIDEO_DIR: &str = ".derived_videos";

impl FileService {
    /// 派生 GIF 视频预览的输出路径：`{storage_path}/.derived_videos/{file_id}.mp4`
    pub fn derived_video_output_path(&self, file_id: Uuid) -> PathBuf {
        Path::new(&self.config.storage_path)
            .join(DERIVED_VIDEO_DIR)
            .join(format!("{}.mp4", file_id))
    }

    pub async fn delete_gif_preview_video(&self, file_id: Uuid) -> Result<(), AppError> {
        let out_path = self.derived_video_output_path(file_id);
        if tokio::fs::try_exists(&out_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            tokio::fs::remove_file(&out_path)
                .await
                .map_err(|e| AppError::File(format!("删除 GIF 预览视频失败: {}", e)))?;
        }
        Ok(())
    }

    pub async fn is_gif_file(&self, file: &File) -> bool {
        if file.mime_type.to_lowercase().starts_with("image/gif") {
            return true;
        }
        if file.original_filename.to_lowercase().ends_with(".gif") {
            return true;
        }
        if file.storage_backend != "local" {
            return false;
        }
        let Ok(mut f) = tokio::fs::File::open(&file.file_path).await else {
            return false;
        };
        let mut buf = [0u8; 6];
        if f.read_exact(&mut buf).await.is_err() {
            return false;
        }
        &buf == b"GIF87a" || &buf == b"GIF89a"
    }

    /// 执行 GIF → MP4 转码（供后台任务 Worker 调用）。
    ///
    /// 若目标文件已存在，则直接返回；否则调用 ffmpeg 生成。
    pub async fn transcode_gif_to_mp4(&self, file: &File) -> Result<PathBuf, AppError> {
        if !self.is_gif_file(file).await {
            return Err(AppError::Validation(
                "仅 GIF 支持视频预览，请直接使用普通预览".to_string(),
            ));
        }
        if file.storage_backend != "local" {
            return Err(AppError::Validation(
                "GIF 视频预览当前仅支持本地存储".to_string(),
            ));
        }

        let out_path = self.derived_video_output_path(file.id);
        // 已存在则直接复用
        if tokio::fs::try_exists(&out_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            return Ok(out_path);
        }

        // 检查源文件是否存在
        let source_path = Path::new(&file.file_path);
        if !tokio::fs::try_exists(source_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            return Err(AppError::NotFound);
        }

        // 创建输出目录
        if let Some(parent) = out_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Storage(format!("创建派生视频目录失败: {}", e)))?;
        }

        let source = source_path.to_string_lossy().replace('\\', "/");
        let out = out_path.to_string_lossy().replace('\\', "/");

        let status = tokio::task::spawn_blocking(move || {
            // 使用 H.264 + yuv420p，兼容性最好；+faststart 便于边下边播。
            // 注意：libx264 要求宽高为偶数，这里通过 scale 过滤器将尺寸截断为最接近的偶数，
            // 避免出现 “height not divisible by 2 (xxx x yyy)” 等编码错误。
            Command::new("ffmpeg")
                .args([
                    "-y",
                    "-i",
                    &source,
                    "-movflags",
                    "+faststart",
                    "-vf",
                    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "23",
                    &out,
                ])
                .status()
        })
        .await
        .map_err(|_e| AppError::Internal)?;

        if !status.map(|s| s.success()).unwrap_or(false) {
            let _ = tokio::fs::remove_file(&out_path).await;
            return Err(AppError::File(
                "FFmpeg 转码 GIF 为视频失败，请确认已安装 ffmpeg 且 GIF 格式支持".to_string(),
            ));
        }

        if !tokio::fs::try_exists(&out_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            return Err(AppError::File(
                "GIF 视频预览生成后未找到输出文件".to_string(),
            ));
        }

        Ok(out_path)
    }
}
