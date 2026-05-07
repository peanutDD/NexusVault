use crate::types::{ReviewData, ReviewIssue, StructuredReview, StructuredReviewIssue};
use std::fs;
use std::path::Path;

#[derive(Debug, Default)]
struct PendingIssue {
    severity: String,
    file: String,
    line: Option<String>,
    rule: String,
    problem: String,
    expected: String,
    constraints: Vec<String>,
}

#[derive(Debug, Default)]
struct PendingInlineIssue {
    severity: String,
    file: String,
    line: u32,
    body_lines: Vec<String>,
    suggestion_lines: Vec<String>,
    in_suggestion: bool,
}

impl PendingIssue {
    fn is_actionable(&self) -> bool {
        !self.severity.trim().is_empty()
            && !self.file.trim().is_empty()
            && self
                .line
                .as_ref()
                .is_some_and(|line| !line.trim().is_empty())
            && !self.problem.trim().is_empty()
            && !self.expected.trim().is_empty()
    }

    fn into_structured(self) -> StructuredReviewIssue {
        StructuredReviewIssue {
            id: String::new(),
            severity: self.severity,
            file: self.file,
            line: self
                .line
                .as_deref()
                .unwrap_or_default()
                .trim()
                .parse::<u32>()
                .unwrap_or(0),
            rule: self.rule,
            problem: self.problem,
            expected: self.expected,
            constraints: self.constraints,
            acceptance: Vec::new(),
        }
    }
}

/// Parse standardized review Markdown into a deterministic JSON review model.
pub fn parse_structured_review(markdown: &str) -> StructuredReview {
    let mut issues = Vec::new();
    let mut current: Option<PendingIssue> = None;
    let mut in_constraints = false;

    for raw in markdown.lines() {
        let line = raw.trim_end();

        if let Some((key, value)) = parse_field(line) {
            match key.as_str() {
                "severity" => {
                    flush_issue(&mut current, &mut issues);
                    current = Some(PendingIssue {
                        severity: value,
                        ..PendingIssue::default()
                    });
                    in_constraints = false;
                }
                "file" => {
                    if let Some(issue) = current.as_mut() {
                        issue.file = value;
                    }
                    in_constraints = false;
                }
                "line" => {
                    if let Some(issue) = current.as_mut() {
                        issue.line = Some(value);
                    }
                    in_constraints = false;
                }
                "rule" => {
                    if let Some(issue) = current.as_mut() {
                        issue.rule = value;
                    }
                    in_constraints = false;
                }
                "problem" => {
                    if let Some(issue) = current.as_mut() {
                        issue.problem = value;
                    }
                    in_constraints = false;
                }
                "expected" => {
                    if let Some(issue) = current.as_mut() {
                        issue.expected = value;
                    }
                    in_constraints = false;
                }
                "constraints" => {
                    in_constraints = current.is_some();
                }
                _ => {
                    if !line.trim().is_empty() {
                        in_constraints = false;
                    }
                }
            }
            continue;
        }

        if in_constraints {
            if let Some(item) = parse_list_item(line) {
                if let Some(issue) = current.as_mut() {
                    issue.constraints.push(item);
                }
                continue;
            }

            if line.trim().is_empty() {
                continue;
            }
            in_constraints = false;
        }
    }

    flush_issue(&mut current, &mut issues);
    issues.extend(parse_inline_review_comments(markdown));

    for (index, issue) in issues.iter_mut().enumerate() {
        issue.id = format!("ISSUE-{:03}", index + 1);
    }

    StructuredReview {
        review_id: String::new(),
        summary: format!("{} actionable issues", issues.len()),
        issues,
    }
}

fn parse_inline_review_comments(markdown: &str) -> Vec<StructuredReviewIssue> {
    let mut issues = Vec::new();
    let mut current: Option<PendingInlineIssue> = None;

    for raw in markdown.lines() {
        let line = raw.trim_end();

        if let Some((file, line_number)) = parse_inline_heading(line) {
            flush_inline_issue(&mut current, &mut issues);
            current = Some(PendingInlineIssue {
                file,
                line: line_number,
                ..PendingInlineIssue::default()
            });
            continue;
        }

        let Some(issue) = current.as_mut() else {
            continue;
        };

        if let Some(severity) = parse_severity_badge(line) {
            issue.severity = severity;
            continue;
        }

        let trimmed = line.trim();
        if trimmed.starts_with("```suggestion") {
            issue.in_suggestion = true;
            continue;
        }
        if issue.in_suggestion && trimmed.starts_with("```") {
            issue.in_suggestion = false;
            continue;
        }

        if issue.in_suggestion {
            issue.suggestion_lines.push(line.to_string());
        } else if !trimmed.is_empty() && !trimmed.starts_with("```") {
            issue.body_lines.push(trimmed.to_string());
        }
    }

    flush_inline_issue(&mut current, &mut issues);
    issues
}

fn parse_inline_heading(line: &str) -> Option<(String, u32)> {
    let heading = line.trim().strip_prefix("### ")?;

    for (index, _) in heading.match_indices(':').rev() {
        let suffix = heading[index + 1..].trim_start();
        let digit_len = suffix
            .chars()
            .take_while(|char| char.is_ascii_digit())
            .map(char::len_utf8)
            .sum::<usize>();
        if digit_len == 0 {
            continue;
        }

        let rest = suffix[digit_len..].trim_start();
        if !rest.is_empty() && !rest.starts_with(':') {
            continue;
        }

        let file = heading[..index].trim();
        if file.is_empty() {
            continue;
        }

        let line_number = suffix[..digit_len].parse::<u32>().ok()?;
        return Some((file.to_string(), line_number));
    }

    None
}

fn parse_severity_badge(line: &str) -> Option<String> {
    let lower = line.to_ascii_lowercase();
    let start = lower.find("![")? + 2;
    let end = lower[start..].find(']')? + start;
    match lower[start..end].trim() {
        "critical" => Some("Critical".to_string()),
        "high" => Some("High".to_string()),
        "medium+" => Some("Medium+".to_string()),
        "medium" => Some("Medium".to_string()),
        "low" => Some("Low".to_string()),
        _ => None,
    }
}

fn flush_inline_issue(
    current: &mut Option<PendingInlineIssue>,
    issues: &mut Vec<StructuredReviewIssue>,
) {
    let Some(issue) = current.take() else {
        return;
    };

    if issue.severity.is_empty() || issue.file.is_empty() {
        return;
    }

    let problem = if issue.body_lines.is_empty() {
        "Actionable review comment has no body text; inspect the referenced line and apply the finding."
            .to_string()
    } else {
        issue.body_lines.join("\n")
    };
    let expected = if issue.suggestion_lines.is_empty() {
        "Address the review comment.".to_string()
    } else {
        issue.suggestion_lines.join("\n")
    };

    issues.push(StructuredReviewIssue {
        id: String::new(),
        severity: issue.severity,
        file: issue.file,
        line: issue.line,
        rule: "gemini-inline-comment".to_string(),
        problem,
        expected,
        constraints: Vec::new(),
        acceptance: Vec::new(),
    });
}

pub fn convert_review_file(
    input: &Path,
    output: &Path,
) -> Result<String, Box<dyn std::error::Error>> {
    let markdown = fs::read_to_string(input)?;
    let parsed = parse_structured_review(&markdown);
    let json = serde_json::to_string_pretty(&parsed)? + "\n";
    fs::write(output, &json)?;
    eprintln!(
        "ok: wrote {} with {} issues",
        output.display(),
        parsed.issues.len()
    );
    Ok(json)
}

pub fn read_review_data_file(input: &Path) -> Result<ReviewData, Box<dyn std::error::Error>> {
    let json = fs::read_to_string(input)?;
    let structured: StructuredReview = serde_json::from_str(&json)?;
    Ok(structured_review_to_review_data(structured))
}

pub fn structured_review_to_review_data(review: StructuredReview) -> ReviewData {
    ReviewData {
        summary: review.summary,
        issues: review
            .issues
            .into_iter()
            .map(structured_issue_to_review_issue)
            .collect(),
    }
}

fn structured_issue_to_review_issue(issue: StructuredReviewIssue) -> ReviewIssue {
    let mut suggestion = issue.expected;
    if !issue.constraints.is_empty() {
        suggestion.push_str("\n\nConstraints:\n");
        suggestion.push_str(
            &issue
                .constraints
                .iter()
                .map(|constraint| format!("- {}", constraint))
                .collect::<Vec<_>>()
                .join("\n"),
        );
    }

    let reason = [issue.id, issue.rule]
        .into_iter()
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" / ");

    ReviewIssue {
        file: issue.file,
        line: Some(issue.line),
        severity: issue.severity,
        description: issue.problem,
        suggestion,
        constraints: issue.constraints,
        reason: if reason.is_empty() {
            None
        } else {
            Some(reason)
        },
    }
}

fn flush_issue(current: &mut Option<PendingIssue>, issues: &mut Vec<StructuredReviewIssue>) {
    let Some(issue) = current.take() else {
        return;
    };

    if issue.is_actionable() {
        issues.push(issue.into_structured());
    }
}

fn parse_field(line: &str) -> Option<(String, String)> {
    let body = parse_list_item(line)?;
    let (key, value) = body.split_once(':')?;
    let key = key
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_ascii_lowercase();
    Some((key, value.trim().to_string()))
}

fn parse_list_item(line: &str) -> Option<String> {
    line.trim_start()
        .strip_prefix('-')
        .map(|rest| rest.trim().to_string())
        .filter(|item| !item.is_empty())
}
