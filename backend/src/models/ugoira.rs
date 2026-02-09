//! Ugoira 动图模型：API 元数据结构与缓存条目（预解压后的 metadata + 全部帧）

use serde::{Deserialize, Serialize};

/// frames.json 中单帧描述
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UgoiraFrame {
    pub file: Option<String>,
    pub delay: u32,
}

/// frames.json 根结构，用于 API 返回
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UgoiraMetadata {
    pub frames: Vec<UgoiraFrame>,
}

/// 预解压后的缓存条目：一次 ZIP 解析得到 metadata + 全部帧字节，后续请求零解析
#[derive(Clone, Debug)]
pub struct UgoiraCacheEntry {
    pub metadata: UgoiraMetadata,
    /// 按帧索引 (body, mime)
    pub frames: Vec<(Vec<u8>, String)>,
}
