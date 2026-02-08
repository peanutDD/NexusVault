//! 超大视频 HLS 转码：超过阈值时生成 .m3u8 + .ts 供前端 hls.js 流式播放。
//!
//! 仅支持 local 存储；S3 需先下载到临时路径再转码（后续可扩展）。

use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

use crate::models::file::File;
use crate::utils::AppError;

use super::FileService;

const HLS_DIR: &str = ".hls";
const PLAYLIST_NAME: &str = "playlist.m3u8";

impl FileService {
    /// HLS 输出目录：`{storage_path}/.hls/{file_id}/`
    pub fn hls_output_dir(&self, file_id: Uuid) -> PathBuf {
        Path::new(&self.config.storage_path)
            .join(HLS_DIR)
            .join(file_id.to_string())
    }

    /// 判断是否应对该文件使用 HLS（视频且大于阈值）
    pub fn should_use_hls(&self, file: &File) -> bool {
        file.mime_type.starts_with("video/")
            && (file.file_size as u64) >= self.config.hls_threshold_bytes
    }

    /// 确保 HLS 已生成；若未生成则调用 FFmpeg 转码（仅支持 local 存储）。
    /// 返回 HLS 输出目录（内含 playlist.m3u8 与 segment*.ts）。
    pub async fn ensure_hls_ready(&self, file: &File) -> Result<PathBuf, AppError> {
        if !file.mime_type.starts_with("video/") {
            return Err(AppError::Validation("仅视频支持 HLS".to_string()));
        }
        if (file.file_size as u64) < self.config.hls_threshold_bytes {
            return Err(AppError::Validation(
                "文件未超过 HLS 阈值，请使用普通预览".to_string(),
            ));
        }
        if file.storage_backend != "local" {
            return Err(AppError::Validation(
                "HLS 转码当前仅支持本地存储".to_string(),
            ));
        }

        let out_dir = self.hls_output_dir(file.id);
        let playlist_path = out_dir.join(PLAYLIST_NAME);
        if tokio::fs::try_exists(&playlist_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            return Ok(out_dir);
        }

        let source_path = Path::new(&file.file_path);
        if !tokio::fs::try_exists(source_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            return Err(AppError::NotFound);
        }

        tokio::fs::create_dir_all(&out_dir)
            .await
            .map_err(|e| AppError::Storage(format!("创建 HLS 目录失败: {}", e)))?;

        let out_dir_str = out_dir.to_string_lossy().replace('\\', "/");
        let segment_pattern = format!("{}/segment%03d.ts", out_dir_str);
        let playlist_out = format!("{}/{}", out_dir_str, PLAYLIST_NAME);

        let source = source_path.to_string_lossy().replace('\\', "/");
        let result = tokio::task::spawn_blocking(move || {
            let status = Command::new("ffmpeg")
                .args([
                    "-y",
                    "-i",
                    &source,
                    "-c",
                    "copy",
                    "-hls_time",
                    "6",
                    "-hls_list_size",
                    "0",
                    "-hls_segment_filename",
                    &segment_pattern,
                    "-f",
                    "hls",
                    &playlist_out,
                ])
                .status();
            status
        })
        .await
        .map_err(|_e| AppError::Internal)?;

        if !result.map(|s| s.success()).unwrap_or(false) {
            let _ = tokio::fs::remove_dir_all(&out_dir).await;
            return Err(AppError::File(
                "FFmpeg 转码失败，请确认已安装 ffmpeg 且视频格式支持".to_string(),
            ));
        }
        if !tokio::fs::try_exists(&playlist_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            return Err(AppError::File("HLS 生成后未找到 playlist".to_string()));
        }
        Ok(out_dir)
    }

    /// 删除文件的 HLS 缓存目录（在删除文件时调用）
    pub async fn delete_hls(&self, file_id: Uuid) -> Result<(), AppError> {
        let out_dir = self.hls_output_dir(file_id);
        if tokio::fs::try_exists(&out_dir)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            tokio::fs::remove_dir_all(&out_dir)
                .await
                .map_err(|e| AppError::File(format!("删除 HLS 目录失败: {}", e)))?;
        }
        Ok(())
    }
}
