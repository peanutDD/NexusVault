use std::fmt;

pub mod search_replace;

pub use search_replace::{
    ApplyOutcome, MatchLevel, SearchReplaceBlock, apply_search_replace_in,
    parse_search_replace_blocks,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PatchFormat {
    Empty,
    SearchReplace,
    UnifiedDiff,
    Mixed,
    Unknown,
}

pub fn detect_format(text: &str) -> PatchFormat {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return PatchFormat::Empty;
    }

    let has_search_replace = trimmed.contains("<<<<<<< SEARCH");
    let has_unified_diff = trimmed.contains("diff --git ");
    match (has_search_replace, has_unified_diff) {
        (true, true) => PatchFormat::Mixed,
        (true, false) => PatchFormat::SearchReplace,
        (false, true) => PatchFormat::UnifiedDiff,
        (false, false) => PatchFormat::Unknown,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatchError {
    message: String,
}

impl PatchError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for PatchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for PatchError {}
