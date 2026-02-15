//! 批量下载（ZIP）
//!
//! - **一次性缓冲**：`batch_download_zip` 在内存中完整生成 ZIP 后返回，适合小批量。
//! - **流式**：`prepare_batch_zip_entries` + 外部 channel 驱动，边打包边发送，适合大批量、大文件。

use std::collections::HashMap;
use std::io::{self, Seek, SeekFrom, Write};
use std::sync::mpsc;
use uuid::Uuid;

use crate::constants::{MAX_BATCH_ZIP_FILES, MAX_BATCH_ZIP_TOTAL_BYTES, ZIP_BUFFER_SIZE};
use crate::models::file::File;
use crate::utils::AppError;

use super::FileService;

/// 写入 channel 的 Writer：缓冲到约 64KB 再发送；实现 Seek 仅用于报告/更新已写字节数，满足 ZipWriter 要求。
struct ChannelWriter {
    buf: Vec<u8>,
    sender: mpsc::SyncSender<Vec<u8>>,
    cap: usize,
    pos: u64,
}

impl Write for ChannelWriter {
    fn write(&mut self, data: &[u8]) -> io::Result<usize> {
        self.buf.extend_from_slice(data);
        self.pos += data.len() as u64;
        if self.buf.len() >= self.cap {
            let chunk = std::mem::take(&mut self.buf);
            self.sender
                .send(chunk)
                .map_err(|_| io::Error::new(io::ErrorKind::BrokenPipe, "channel closed"))?;
        }
        Ok(data.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        if !self.buf.is_empty() {
            let chunk = std::mem::take(&mut self.buf);
            self.sender
                .send(chunk)
                .map_err(|_| io::Error::new(io::ErrorKind::BrokenPipe, "channel closed"))?;
        }
        Ok(())
    }
}

impl Seek for ChannelWriter {
    /// 流式写入无法真正回退。Current(0)/End(0) 报告当前偏移；Start(n) 若 n <= pos 则返回 Ok(pos) 不改变 pos，
    /// 满足 zip 在 finish_file 的 file_end >= stats.start，且 Drop 时的"回退再写"会得到当前 pos 从而继续写尾部的 central directory。
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        match pos {
            SeekFrom::Current(0) | SeekFrom::End(0) => Ok(self.pos),
            SeekFrom::Start(n) if n <= self.pos => Ok(self.pos), // 不把 pos 回退，避免 file_end < stats.start
            _ => Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "ChannelWriter only supports reporting current position (no forward seek)",
            )),
        }
    }
}

/// 为 ZIP 内条目生成唯一名称，重名时使用 "base (1).ext"、"base (2).ext" 等。
fn unique_zip_entry_name(name: &str, name_count: &mut HashMap<String, u32>) -> String {
    let n = name_count.entry(name.to_string()).or_insert(0);
    let count = *n;
    *n = n.saturating_add(1);

    if count == 0 {
        return name.to_string();
    }

    let (base, ext) = if let Some(dot) = name.rfind('.') {
        (&name[..dot], &name[dot + 1..])
    } else {
        (name, "")
    };

    if ext.is_empty() {
        format!("{} ({})", base, count)
    } else {
        format!("{} ({}).{}", base, count, ext)
    }
}

impl FileService {
    pub async fn batch_download_zip(
        &self,
        ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<Vec<u8>, AppError> {
        use std::collections::HashSet;
        use std::io::Write;
        use zip::write::ZipWriter;
        use zip::CompressionMethod;

        if ids.is_empty() {
            return Err(AppError::Validation("请选择要下载的文件".to_string()));
        }

        // 去重（保持原顺序）
        let mut seen = HashSet::<Uuid>::with_capacity(ids.len());
        let mut uniq_ids = Vec::<Uuid>::with_capacity(ids.len());
        for &id in ids {
            if seen.insert(id) {
                uniq_ids.push(id);
            }
        }

        if uniq_ids.len() > MAX_BATCH_ZIP_FILES {
            return Err(AppError::Validation(format!(
                "单次批量下载最多 {} 个文件（当前 {}）",
                MAX_BATCH_ZIP_FILES,
                uniq_ids.len()
            )));
        }

        // 先用数据库聚合校验总大小（避免提前读入所有文件数据）
        let (found_count, total_size) =
            self.files_repo.sum_size_for_ids(user_id, &uniq_ids).await?;

        if found_count <= 0 {
            return Err(AppError::Validation("没有可下载的文件".to_string()));
        }

        if total_size > MAX_BATCH_ZIP_TOTAL_BYTES {
            let total_mb = (total_size as f64 / 1_048_576.0).ceil() as i64;
            let limit_mb = (MAX_BATCH_ZIP_TOTAL_BYTES as f64 / 1_048_576.0).ceil() as i64;
            return Err(AppError::Validation(format!(
                "所选文件总大小约 {}MB，超过单次下载上限 {}MB，请缩小范围后重试",
                total_mb, limit_mb
            )));
        }

        // 一次性把文件记录取出来，避免 N+1 查询
        let files = self.files_repo.find_by_ids(user_id, &uniq_ids).await?;
        let mut file_by_id =
            std::collections::HashMap::<Uuid, crate::models::file::File>::with_capacity(
                files.len(),
            );
        for f in files {
            file_by_id.insert(f.id, f);
        }

        let mut buf = Vec::new();
        let mut zip = ZipWriter::new(std::io::Cursor::new(&mut buf));

        // 避免 ZIP 内重名：同名文件使用 "base (1).ext"、"base (2).ext" 等
        let mut name_count: HashMap<String, u32> = HashMap::with_capacity(uniq_ids.len());

        for &id in &uniq_ids {
            let Some(file) = file_by_id.get(&id) else {
                continue;
            };
            let data = self.get_file_data(file).await?;
            let entry_name = unique_zip_entry_name(&file.original_filename, &mut name_count);
            let options: zip::write::FileOptions<()> =
                zip::write::FileOptions::default().compression_method(CompressionMethod::Deflated);
            zip.start_file(&entry_name, options)
                .map_err(|e| AppError::File(format!("Failed to add file to zip: {}", e)))?;
            zip.write_all(&data)
                .map_err(|e| AppError::File(format!("Failed to write file to zip: {}", e)))?;
        }

        zip.finish()
            .map_err(|e| AppError::File(format!("Failed to finalize zip: {}", e)))?;

        Ok(buf)
    }

    /// 校验并返回待打包的 (File, ZIP 内条目名) 列表，供流式下载使用。
    /// 不做实际打包，仅做数量/总大小校验并生成唯一条目名。
    pub async fn prepare_batch_zip_entries(
        &self,
        ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<Vec<(File, String)>, AppError> {
        use std::collections::HashSet;

        if ids.is_empty() {
            return Err(AppError::Validation("请选择要下载的文件".to_string()));
        }

        let mut seen = HashSet::<Uuid>::with_capacity(ids.len());
        let mut uniq_ids = Vec::<Uuid>::with_capacity(ids.len());
        for &id in ids {
            if seen.insert(id) {
                uniq_ids.push(id);
            }
        }

        if uniq_ids.len() > MAX_BATCH_ZIP_FILES {
            return Err(AppError::Validation(format!(
                "单次批量下载最多 {} 个文件（当前 {}）",
                MAX_BATCH_ZIP_FILES,
                uniq_ids.len()
            )));
        }

        let (found_count, total_size) =
            self.files_repo.sum_size_for_ids(user_id, &uniq_ids).await?;

        if found_count <= 0 {
            return Err(AppError::Validation("没有可下载的文件".to_string()));
        }

        if total_size > MAX_BATCH_ZIP_TOTAL_BYTES {
            let total_mb = (total_size as f64 / 1_048_576.0).ceil() as i64;
            let limit_mb = (MAX_BATCH_ZIP_TOTAL_BYTES as f64 / 1_048_576.0).ceil() as i64;
            return Err(AppError::Validation(format!(
                "所选文件总大小约 {}MB，超过单次下载上限 {}MB，请缩小范围后重试",
                total_mb, limit_mb
            )));
        }

        let files = self.files_repo.find_by_ids(user_id, &uniq_ids).await?;
        let mut file_by_id = std::collections::HashMap::<Uuid, File>::with_capacity(files.len());
        for f in files {
            file_by_id.insert(f.id, f);
        }

        let mut name_count: HashMap<String, u32> = HashMap::with_capacity(uniq_ids.len());
        let mut entries = Vec::with_capacity(uniq_ids.len());
        for &id in &uniq_ids {
            let Some(file) = file_by_id.get(&id) else {
                continue;
            };
            let entry_name = unique_zip_entry_name(&file.original_filename, &mut name_count);
            entries.push((file.clone(), entry_name));
        }
        Ok(entries)
    }
}

/// 在独立线程中边打包边写入 output_tx；通过 input_rx 接收 (Option<条目名>, 文件数据)，None 表示结束。
pub fn run_zip_writer_thread(
    input_rx: mpsc::Receiver<(Option<String>, Vec<u8>)>,
    output_tx: mpsc::SyncSender<Vec<u8>>,
) {
    use std::io::Write;
    use zip::write::ZipWriter;
    use zip::CompressionMethod;

    let mut writer = ChannelWriter {
        buf: Vec::new(),
        sender: output_tx,
        cap: ZIP_BUFFER_SIZE, // 8KB 即发，首包更早；每文件后再 flush 一次，小文件也能立刻发出
        pos: 0,
    };
    // zip 及其循环放在块内，块结束时 zip 被 drop，对 writer 的借用结束，之后才能 writer.flush()
    {
        let mut zip = ZipWriter::new(&mut writer);
        while let Ok((name_opt, data)) = input_rx.recv() {
            if let Some(entry_name) = name_opt {
                let options: zip::write::FileOptions<()> = zip::write::FileOptions::default()
                    .compression_method(CompressionMethod::Deflated);
                if zip.start_file(&entry_name, options).is_err() {
                    break;
                }
                let _ = zip.write_all(&data);
                // 每写完一个文件就 flush，首包/小文件也能立刻发出，保存对话框更早出现
                let _ = zip.flush();
            } else {
                break;
            }
        }
        let _ = zip.finish();
    }
    let _ = writer.flush();
}
