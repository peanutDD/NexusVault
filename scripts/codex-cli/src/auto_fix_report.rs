use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Debug, Deserialize)]
struct AutoFixRunRecord {
    #[serde(default)]
    files: Vec<String>,
    apply_fail_reason: Option<String>,
    #[serde(default)]
    fallback_used: bool,
    #[serde(default)]
    final_status: String,
    #[serde(default)]
    pending_explanations: Vec<String>,
}

#[derive(Debug, Eq, PartialEq, Ord, PartialOrd)]
struct FailureKey {
    reason: String,
    file: String,
    fallback_used: bool,
    final_status: String,
}

pub fn build_weekly_failure_report(input: &str) -> Result<String, Box<dyn std::error::Error>> {
    let records = parse_records(input)?;
    let mut groups: BTreeMap<FailureKey, usize> = BTreeMap::new();
    let mut failure_sample_count = 0usize;

    for record in &records {
        let Some(reason) = record.apply_fail_reason.as_deref() else {
            continue;
        };
        if reason.trim().is_empty() {
            continue;
        }

        let files = record_files(record);
        for file in files {
            failure_sample_count += 1;
            let key = FailureKey {
                reason: reason.to_string(),
                file,
                fallback_used: record.fallback_used,
                final_status: record.final_status.clone(),
            };
            *groups.entry(key).or_insert(0) += 1;
        }
    }

    let mut rows = groups.into_iter().collect::<Vec<_>>();
    rows.sort_by(|(left_key, left_count), (right_key, right_count)| {
        right_count
            .cmp(left_count)
            .then_with(|| left_key.reason.cmp(&right_key.reason))
            .then_with(|| left_key.file.cmp(&right_key.file))
            .then_with(|| left_key.final_status.cmp(&right_key.final_status))
    });

    let mut out = String::new();
    out.push_str("# Codex Auto-Fix Failure Samples Weekly Report\n\n");
    out.push_str(&format!("- Input records: {}\n", records.len()));
    out.push_str(&format!("- Failure samples: {}\n", failure_sample_count));
    out.push_str(
        "- Grouping: `apply_fail_reason` + file path + `fallback_used` + `final_status`\n",
    );
    out.push_str("- Policy: do not add `git apply --check` by default; revisit only after real failures show it would improve diagnostics.\n\n");

    if rows.is_empty() {
        out.push_str("No failure samples found.\n");
        return Ok(out);
    }

    out.push_str("| Count | apply_fail_reason | File | fallback_used | final_status |\n");
    out.push_str("|---:|---|---|---|---|\n");
    for (key, count) in rows.into_iter().take(5) {
        out.push_str(&format!(
            "| {} | {} | `{}` | {} | {} |\n",
            count, key.reason, key.file, key.fallback_used, key.final_status
        ));
    }

    Ok(out)
}

fn parse_records(input: &str) -> Result<Vec<AutoFixRunRecord>, Box<dyn std::error::Error>> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    if let Ok(records) = serde_json::from_str::<Vec<AutoFixRunRecord>>(trimmed) {
        return Ok(records);
    }
    if let Ok(record) = serde_json::from_str::<AutoFixRunRecord>(trimmed) {
        return Ok(vec![record]);
    }

    let mut records = Vec::new();
    for (idx, line) in input.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let record = serde_json::from_str::<AutoFixRunRecord>(line)
            .map_err(|e| format!("invalid JSON record at line {}: {}", idx + 1, e))?;
        records.push(record);
    }
    Ok(records)
}

fn record_files(record: &AutoFixRunRecord) -> Vec<String> {
    if !record.files.is_empty() {
        return record.files.clone();
    }

    let from_pending = record
        .pending_explanations
        .iter()
        .filter_map(|line| extract_backticked_file(line))
        .collect::<Vec<_>>();
    if from_pending.is_empty() {
        vec!["(unknown)".to_string()]
    } else {
        from_pending
    }
}

fn extract_backticked_file(line: &str) -> Option<String> {
    let start = line.find('`')?;
    let rest = &line[start + 1..];
    let end = rest.find('`')?;
    let value = rest[..end].trim();
    (!value.is_empty()).then(|| value.to_string())
}
