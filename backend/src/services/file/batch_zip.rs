//! 批量下载（ZIP）
//!
//! 注意：当前实现会把每个文件内容与最终 ZIP 都放在内存里（Vec<u8>），
//! 因此必须设置硬限制，避免 OOM / 超时 / 服务不稳定。

use std::collections::HashMap;
use uuid::Uuid;

use crate::utils::AppError;

use super::FileService;

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
        (name.as_ref(), "")
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

        if uniq_ids.len() > super::MAX_BATCH_ZIP_FILES {
            return Err(AppError::Validation(format!(
                "单次批量下载最多 {} 个文件（当前 {}）",
                super::MAX_BATCH_ZIP_FILES,
                uniq_ids.len()
            )));
        }

        // 先用数据库聚合校验总大小（避免提前读入所有文件数据）
        let (found_count, total_size) = crate::repositories::files::FilesRepo::new(&self.pool)
            .sum_size_for_ids(user_id, &uniq_ids)
            .await?;

        if found_count <= 0 {
            return Err(AppError::Validation("没有可下载的文件".to_string()));
        }

        if total_size > super::MAX_BATCH_ZIP_TOTAL_BYTES {
            let total_mb = (total_size as f64 / 1_048_576.0).ceil() as i64;
            let limit_mb = (super::MAX_BATCH_ZIP_TOTAL_BYTES as f64 / 1_048_576.0).ceil() as i64;
            return Err(AppError::Validation(format!(
                "所选文件总大小约 {}MB，超过单次下载上限 {}MB，请缩小范围后重试",
                total_mb, limit_mb
            )));
        }

        // 一次性把文件记录取出来，避免 N+1 查询
        let files = crate::repositories::files::FilesRepo::new(&self.pool)
            .get_files_by_ids(user_id, &uniq_ids)
            .await?;
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
}
