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

    for (index, issue) in issues.iter_mut().enumerate() {
        issue.id = format!("ISSUE-{:03}", index + 1);
    }

    StructuredReview {
        review_id: String::new(),
        summary: format!("{} actionable issues", issues.len()),
        issues,
    }
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
