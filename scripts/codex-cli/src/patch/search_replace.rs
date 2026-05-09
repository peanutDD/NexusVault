use crate::patch::PatchError;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchReplaceBlock {
    pub search: String,
    pub replace: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum MatchLevel {
    Exact,
    TrimTrailingWhitespace,
    NormalizeIndent,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApplyOutcome {
    Applied { blocks: usize },
    AppliedWithFuzzyMatch { blocks: usize, level: MatchLevel },
}

pub fn parse_search_replace_blocks(
    text: &str,
    allowed_file: &str,
) -> Result<Vec<SearchReplaceBlock>, PatchError> {
    validate_file_header(text, allowed_file)?;

    let max_blocks = std::env::var("CODEX_SR_MAX_BLOCKS")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(5);

    let mut blocks = Vec::new();
    let mut state = ParserState::Outside;
    let mut search = String::new();
    let mut replace = String::new();

    for line in split_inclusive_lines(text) {
        let trimmed = line.trim();
        match state {
            ParserState::Outside if trimmed == "<<<<<<< SEARCH" => {
                search.clear();
                replace.clear();
                state = ParserState::Search;
            }
            ParserState::Outside => {}
            ParserState::Search if trimmed == "=======" => {
                state = ParserState::Replace;
            }
            ParserState::Search => search.push_str(line),
            ParserState::Replace if trimmed == ">>>>>>> REPLACE" => {
                blocks.push(SearchReplaceBlock {
                    search: search.clone(),
                    replace: replace.clone(),
                });
                if blocks.len() > max_blocks {
                    return Err(PatchError::new(format!(
                        "SEARCH/REPLACE block count {} exceeds max {}",
                        blocks.len(),
                        max_blocks
                    )));
                }
                state = ParserState::Outside;
            }
            ParserState::Replace => replace.push_str(line),
        }
    }

    match state {
        ParserState::Outside => {}
        ParserState::Search => {
            return Err(PatchError::new(
                "malformed SEARCH/REPLACE block: missing ======= separator",
            ));
        }
        ParserState::Replace => {
            return Err(PatchError::new(
                "malformed SEARCH/REPLACE block: missing >>>>>>> REPLACE marker",
            ));
        }
    }

    if blocks.is_empty() {
        return Err(PatchError::new("no SEARCH/REPLACE blocks found"));
    }

    Ok(blocks)
}

pub fn apply_search_replace_in(
    repo_root: &str,
    file_path: &str,
    text: &str,
) -> Result<ApplyOutcome, PatchError> {
    let blocks = parse_search_replace_blocks(text, file_path)?;
    let abs = Path::new(repo_root).join(file_path);
    let original = fs::read_to_string(&abs).map_err(|e| PatchError::new(e.to_string()))?;
    let mut current = original;
    let mut highest_level = MatchLevel::Exact;

    for block in &blocks {
        if block.search.is_empty() {
            current.push_str(&block.replace);
            continue;
        }

        let found = find_unique_match(&current, &block.search)?;
        highest_level = highest_level.max(found.level);
        current.replace_range(found.start..found.end, &block.replace);
    }

    fs::write(abs, current).map_err(|e| PatchError::new(e.to_string()))?;

    if highest_level == MatchLevel::Exact {
        Ok(ApplyOutcome::Applied {
            blocks: blocks.len(),
        })
    } else {
        Ok(ApplyOutcome::AppliedWithFuzzyMatch {
            blocks: blocks.len(),
            level: highest_level,
        })
    }
}

fn validate_file_header(text: &str, allowed_file: &str) -> Result<(), PatchError> {
    let Some(file) = text.lines().find_map(|line| {
        line.trim()
            .strip_prefix("### File:")
            .map(|value| value.trim())
    }) else {
        return Err(PatchError::new("missing SEARCH/REPLACE file header"));
    };

    if file != allowed_file {
        return Err(PatchError::new(format!(
            "SEARCH/REPLACE file `{}` does not match allowed file `{}`",
            file, allowed_file
        )));
    }

    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ParserState {
    Outside,
    Search,
    Replace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct MatchSpan {
    start: usize,
    end: usize,
    level: MatchLevel,
}

fn find_unique_match(haystack: &str, needle: &str) -> Result<MatchSpan, PatchError> {
    let exact = find_exact_spans(haystack, needle);
    match exact.len() {
        1 => {
            return Ok(MatchSpan {
                start: exact[0],
                end: exact[0] + needle.len(),
                level: MatchLevel::Exact,
            });
        }
        n if n > 1 => {
            return Err(PatchError::new(format!(
                "SEARCH block is ambiguous: {} exact matches",
                n
            )));
        }
        _ => {}
    }

    let trimmed = find_line_spans(haystack, needle, normalize_line_trim_end);
    match trimmed.len() {
        1 => Ok(MatchSpan {
            start: trimmed[0].0,
            end: trimmed[0].1,
            level: MatchLevel::TrimTrailingWhitespace,
        }),
        0 => {
            let normalized_indent =
                find_line_spans(haystack, needle, normalize_line_indent_and_trim_end);
            match normalized_indent.len() {
                1 => Ok(MatchSpan {
                    start: normalized_indent[0].0,
                    end: normalized_indent[0].1,
                    level: MatchLevel::NormalizeIndent,
                }),
                0 => Err(PatchError::new(
                    "SEARCH block was not found in the allowed file",
                )),
                n => Err(PatchError::new(format!(
                    "SEARCH block is ambiguous: {} normalized-indent matches",
                    n
                ))),
            }
        }
        n => Err(PatchError::new(format!(
            "SEARCH block is ambiguous: {} trimmed-line matches",
            n
        ))),
    }
}

fn find_exact_spans(haystack: &str, needle: &str) -> Vec<usize> {
    let mut out = Vec::new();
    let mut offset = 0;
    while let Some(pos) = haystack[offset..].find(needle) {
        let absolute = offset + pos;
        out.push(absolute);
        offset = absolute + needle.len().max(1);
    }
    out
}

fn find_line_spans(
    haystack: &str,
    needle: &str,
    normalize: fn(&str) -> String,
) -> Vec<(usize, usize)> {
    let hay_lines = indexed_lines(haystack);
    let needle_lines = split_inclusive_lines(needle)
        .into_iter()
        .map(normalize)
        .collect::<Vec<_>>();

    if needle_lines.is_empty() || hay_lines.len() < needle_lines.len() {
        return Vec::new();
    }

    let mut spans = Vec::new();
    for start in 0..=hay_lines.len() - needle_lines.len() {
        let matches = needle_lines
            .iter()
            .enumerate()
            .all(|(offset, needle)| normalize(hay_lines[start + offset].text) == *needle);
        if matches {
            let span_start = hay_lines[start].start;
            let span_end = hay_lines[start + needle_lines.len() - 1].end;
            spans.push((span_start, span_end));
        }
    }
    spans
}

#[derive(Debug, Clone, Copy)]
struct IndexedLine<'a> {
    text: &'a str,
    start: usize,
    end: usize,
}

fn indexed_lines(text: &str) -> Vec<IndexedLine<'_>> {
    let mut out = Vec::new();
    let mut start = 0;
    for line in split_inclusive_lines(text) {
        let end = start + line.len();
        out.push(IndexedLine {
            text: line,
            start,
            end,
        });
        start = end;
    }
    out
}

fn split_inclusive_lines(text: &str) -> Vec<&str> {
    if text.is_empty() {
        return Vec::new();
    }

    let mut lines = text.split_inclusive('\n').collect::<Vec<_>>();
    let consumed = lines.iter().map(|line| line.len()).sum::<usize>();
    if consumed < text.len() {
        lines.push(&text[consumed..]);
    }
    lines
}

fn normalize_line_trim_end(line: &str) -> String {
    let newline = if line.ends_with('\n') { "\n" } else { "" };
    format!(
        "{}{}",
        line.trim_end_matches([' ', '\t', '\r', '\n']),
        newline
    )
}

fn normalize_line_indent_and_trim_end(line: &str) -> String {
    normalize_line_trim_end(line).trim_start().to_string()
}
