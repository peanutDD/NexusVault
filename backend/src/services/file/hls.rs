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
const MASTER_PLAYLIST_NAME: &str = "master.m3u8";

impl FileService {
    /// HLS 输出目录：`{storage_path}/.hls/{file_id}/`
    pub fn hls_output_dir(&self, file_id: Uuid) -> PathBuf {
        Path::new(&self.config.storage_path)
            .join(HLS_DIR)
            .join(file_id.to_string())
    }

    pub async fn should_use_hls(&self, file: &File) -> bool {
        let is_video = file.mime_type.starts_with("video/");
        let is_gif = self.is_gif_file(file).await;
        (is_video && (file.file_size as u64) >= self.config.hls_threshold_bytes) || is_gif
    }

    async fn hls_source_path(&self, file: &File) -> Result<PathBuf, AppError> {
        if file.mime_type.starts_with("video/") || self.is_gif_file(file).await {
            return Ok(PathBuf::from(&file.file_path));
        }
        Err(AppError::Validation("仅视频或 GIF 支持 HLS".to_string()))
    }

    /// 确保 HLS 已生成；若未生成则调用 FFmpeg 转码（仅支持 local 存储）。
    /// 返回 HLS 输出目录（内含 playlist.m3u8 与 segment*.ts）。
    pub async fn ensure_hls_ready(&self, file: &File) -> Result<PathBuf, AppError> {
        let is_video = file.mime_type.starts_with("video/");
        let is_gif = self.is_gif_file(file).await;
        if !is_video && !is_gif {
            return Err(AppError::Validation("仅视频或 GIF 支持 HLS".to_string()));
        }
        if is_video && (file.file_size as u64) < self.config.hls_threshold_bytes {
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
        let master_path = out_dir.join(MASTER_PLAYLIST_NAME);
        if tokio::fs::try_exists(&playlist_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
            || tokio::fs::try_exists(&master_path)
                .await
                .map_err(|e| AppError::File(e.to_string()))?
        {
            return Ok(out_dir);
        }

        let source_path = self.hls_source_path(file).await?;
        if !tokio::fs::try_exists(&source_path)
            .await
            .map_err(|e| AppError::File(e.to_string()))?
        {
            return Err(AppError::NotFound);
        }

        tokio::fs::create_dir_all(&out_dir)
            .await
            .map_err(|e| AppError::Storage(format!("创建 HLS 目录失败: {}", e)))?;

        let out_dir_str = out_dir.to_string_lossy().replace('\\', "/");
        let use_abr = self.config.hls_abr_max_variants > 1;
        let abr_variants: Vec<(u32, u32)> = self
            .config
            .hls_abr_variants
            .iter()
            .map(|v| (v.height, v.video_bitrate_kbps))
            .collect();
        let abr_n = if use_abr {
            self.config.hls_abr_max_variants.min(abr_variants.len())
        } else {
            1
        };

        let segment_pattern = if use_abr {
            format!("{}/v%v/segment%03d.ts", out_dir_str)
        } else {
            format!("{}/segment%03d.ts", out_dir_str)
        };
        let playlist_out = if use_abr {
            format!("{}/v%v/playlist.m3u8", out_dir_str)
        } else {
            format!("{}/{}", out_dir_str, PLAYLIST_NAME)
        };

        let source = source_path.to_string_lossy().replace('\\', "/");
        let is_gif_source = is_gif;

        if use_abr {
            for i in 0..abr_n {
                tokio::fs::create_dir_all(out_dir.join(format!("v{}", i)))
                    .await
                    .map_err(|e| AppError::Storage(format!("创建 HLS 目录失败: {}", e)))?;
            }
        }

        let result = tokio::task::spawn_blocking(move || {
            if !use_abr {
                if is_gif_source {
                    return Command::new("ffmpeg")
                        .args([
                            "-y",
                            "-i",
                            &source,
                            "-vf",
                            "fps=20,scale='min(1280,iw)':-2",
                            "-an",
                            "-c:v",
                            "libx264",
                            "-preset",
                            "ultrafast",
                            "-crf",
                            "28",
                            "-pix_fmt",
                            "yuv420p",
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
                }
                return Command::new("ffmpeg")
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
            }

            let has_audio = Command::new("ffprobe")
                .args([
                    "-v",
                    "error",
                    "-select_streams",
                    "a:0",
                    "-show_entries",
                    "stream=index",
                    "-of",
                    "csv=p=0",
                    &source,
                ])
                .output()
                .ok()
                .filter(|o| o.status.success())
                .map(|o| !o.stdout.is_empty())
                .unwrap_or(false);

            let mut filter = if is_gif_source {
                format!("[0:v]fps=20,split={}", abr_n)
            } else {
                format!("[0:v]split={}", abr_n)
            };
            for (i, _) in abr_variants.iter().enumerate().take(abr_n) {
                filter.push_str(&format!("[v{}]", i));
            }
            filter.push(';');
            for (i, (h, _)) in abr_variants.iter().enumerate().take(abr_n) {
                filter.push_str(&format!("[v{0}]scale=-2:{1}:flags=lanczos[v{0}out];", i, h));
            }
            if filter.ends_with(';') {
                filter.pop();
            }

            let mut args: Vec<String> = vec![
                "-y".to_string(),
                "-i".to_string(),
                source.clone(),
                "-filter_complex".to_string(),
                filter,
            ];

            for (i, _) in abr_variants.iter().enumerate().take(abr_n) {
                args.push("-map".to_string());
                args.push(format!("[v{}out]", i));
                if has_audio {
                    args.push("-map".to_string());
                    args.push("0:a:0".to_string());
                }
            }

            args.push("-c:v".to_string());
            args.push("libx264".to_string());
            args.push("-preset".to_string());
            args.push("veryfast".to_string());
            args.push("-profile:v".to_string());
            args.push("main".to_string());
            args.push("-pix_fmt".to_string());
            args.push("yuv420p".to_string());

            if has_audio {
                args.push("-c:a".to_string());
                args.push("aac".to_string());
                args.push("-ac".to_string());
                args.push("2".to_string());
                args.push("-b:a".to_string());
                args.push("128k".to_string());
            }

            for (i, (_, br)) in abr_variants.iter().enumerate().take(abr_n) {
                let maxrate = (*br as f64 * 1.07).round() as u32;
                let buf = (*br as f64 * 1.5).round() as u32;
                args.push(format!("-b:v:{}", i));
                args.push(format!("{}k", br));
                args.push(format!("-maxrate:v:{}", i));
                args.push(format!("{}k", maxrate));
                args.push(format!("-bufsize:v:{}", i));
                args.push(format!("{}k", buf));
            }

            args.push("-f".to_string());
            args.push("hls".to_string());
            args.push("-hls_time".to_string());
            args.push("6".to_string());
            args.push("-hls_list_size".to_string());
            args.push("0".to_string());
            args.push("-hls_flags".to_string());
            args.push("independent_segments".to_string());
            args.push("-hls_segment_filename".to_string());
            args.push(segment_pattern.clone());
            args.push("-master_pl_name".to_string());
            args.push(MASTER_PLAYLIST_NAME.to_string());

            let mut var_map = String::new();
            for (i, _) in abr_variants.iter().enumerate().take(abr_n) {
                if i > 0 {
                    var_map.push(' ');
                }
                if has_audio {
                    var_map.push_str(&format!("v:{},a:{}", i, i));
                } else {
                    var_map.push_str(&format!("v:{}", i));
                }
            }
            args.push("-var_stream_map".to_string());
            args.push(var_map);
            args.push(playlist_out.clone());

            Command::new("ffmpeg").args(args).status()
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
            && !tokio::fs::try_exists(&master_path)
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
