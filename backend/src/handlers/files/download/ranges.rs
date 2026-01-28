//! Range 解析与规范化（支持多段 Range）。

use crate::utils::AppError;

pub type ByteRange = (u64, u64); // (start, end_inclusive)

const MAX_RANGES: usize = 8;

pub fn parse_ranges(
    range_header: Option<&str>,
    total_size: u64,
) -> Result<Option<Vec<ByteRange>>, AppError> {
    let Some(r) = range_header else {
        return Ok(None);
    };

    if total_size == 0 {
        return Err(AppError::Validation("空文件不支持 Range".to_string()));
    }

    let Some(rest) = r.strip_prefix("bytes=") else {
        return Err(AppError::Validation("无效的 Range".to_string()));
    };

    let mut ranges = Vec::<ByteRange>::new();
    for part in rest.split(',') {
        if ranges.len() >= MAX_RANGES {
            return Err(AppError::Validation("Range 段数过多".to_string()));
        }
        let part = part.trim();
        let Some((a, b)) = part.split_once('-') else {
            return Err(AppError::Validation("无效的 Range".to_string()));
        };
        let a = a.trim();
        let b = b.trim();

        let (start, mut end) = if a.is_empty() {
            // -suffix
            let suffix: u64 = b
                .parse()
                .map_err(|_| AppError::Validation("无效的 Range（suffix）".to_string()))?;
            let len = suffix.min(total_size);
            (total_size - len, total_size - 1)
        } else {
            let start: u64 = a
                .parse()
                .map_err(|_| AppError::Validation("无效的 Range（start）".to_string()))?;
            let end: u64 = if b.is_empty() {
                total_size - 1
            } else {
                b.parse()
                    .map_err(|_| AppError::Validation("无效的 Range（end）".to_string()))?
            };
            (start, end)
        };

        if start >= total_size {
            continue;
        }
        end = end.min(total_size - 1);
        if start > end {
            continue;
        }
        ranges.push((start, end));
    }

    if ranges.is_empty() {
        // 语义：存在 Range 头，但全部无效/越界 => 交由调用方返回 416
        return Ok(Some(vec![]));
    }

    // 规范化：排序并合并重叠/相邻区间，避免重复读
    ranges.sort_by_key(|(s, _)| *s);
    let mut merged = Vec::<ByteRange>::with_capacity(ranges.len());
    for (s, e) in ranges {
        if let Some(last) = merged.last_mut() {
            if s <= last.1.saturating_add(1) {
                last.1 = last.1.max(e);
                continue;
            }
        }
        merged.push((s, e));
    }

    Ok(Some(merged))
}
