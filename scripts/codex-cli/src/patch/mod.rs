use std::fmt;

pub mod search_replace;
pub mod unified_diff;

pub use search_replace::{
    ApplyOutcome, MatchEngine, MatchLevel, MatchOutcome, SearchReplaceBlock, SearchReplaceParser,
    apply_search_replace_in, parse_search_replace_blocks,
};
pub use unified_diff::{
    apply_patch_safely, apply_patch_safely_in, apply_patch_with_details_in, classify_apply_failure,
    validate_unified_diff_for_file,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PatchFormat {
    Empty,
    SearchReplace,
    UnifiedDiff,
    Mixed,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatchApplyResult {
    pub applied: bool,
    pub stderr: String,
    pub fail_reason: Option<String>,
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

pub trait Patch {
    fn format(&self) -> PatchFormat;
    fn body(&self) -> &str;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawPatch {
    body: String,
    format: PatchFormat,
}

impl RawPatch {
    pub fn new(body: impl Into<String>) -> Self {
        let body = body.into();
        let format = detect_format(&body);
        Self { body, format }
    }
}

impl Patch for RawPatch {
    fn format(&self) -> PatchFormat {
        self.format
    }

    fn body(&self) -> &str {
        &self.body
    }
}

pub fn apply(
    repo_root: &str,
    file_path: &str,
    patch: &str,
) -> Result<PatchApplyResult, Box<dyn std::error::Error>> {
    match detect_format(patch) {
        PatchFormat::SearchReplace | PatchFormat::Mixed => {
            match apply_search_replace_in(repo_root, file_path, patch) {
                Ok(outcome) => Ok(PatchApplyResult {
                    applied: true,
                    stderr: format!("{:?}", outcome),
                    fail_reason: None,
                }),
                Err(e) => {
                    let stderr = e.to_string();
                    let fail_reason = if stderr.contains("missing")
                        || stderr.contains("malformed")
                        || stderr.contains("does not match allowed file")
                        || stderr.contains("no SEARCH/REPLACE")
                    {
                        "malformed_diff"
                    } else {
                        "context_mismatch"
                    };
                    Ok(PatchApplyResult {
                        applied: false,
                        stderr,
                        fail_reason: Some(fail_reason.to_string()),
                    })
                }
            }
        }
        PatchFormat::UnifiedDiff => apply_patch_with_details_in(repo_root, file_path, patch),
        PatchFormat::Empty | PatchFormat::Unknown => Ok(PatchApplyResult {
            applied: false,
            stderr: "model output did not contain SEARCH/REPLACE or unified diff".to_string(),
            fail_reason: Some("malformed_diff".to_string()),
        }),
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
