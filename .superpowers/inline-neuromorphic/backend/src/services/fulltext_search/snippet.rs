pub(super) fn snippet<const N: usize>(query: &str, parts: [&str; N]) -> String {
    let query_lower = query.to_lowercase();
    for part in parts {
        if let Some(match_start) = case_insensitive_char_match_start(part, &query_lower) {
            let start = match_start.saturating_sub(48);
            return part
                .chars()
                .skip(start)
                .take(match_start - start + query.chars().count() + 96)
                .collect();
        }
    }
    parts
        .into_iter()
        .find(|part| !part.trim().is_empty())
        .unwrap_or("")
        .chars()
        .take(160)
        .collect()
}

pub(super) fn normalize_search_text(text: &str) -> String {
    let cleaned: String = text
        .chars()
        .filter(|ch| !ch.is_control() || matches!(ch, '\n' | '\r' | '\t'))
        .collect();
    if looks_garbled(&cleaned) {
        String::new()
    } else {
        cleaned
    }
}

fn case_insensitive_char_match_start(part: &str, query_lower: &str) -> Option<usize> {
    if query_lower.is_empty() {
        return Some(0);
    }
    let (part_lower, lower_char_to_original_char) = lower_with_original_char_positions(part);
    let byte_index = part_lower.find(query_lower)?;
    let lower_char_index = part_lower[..byte_index].chars().count();
    lower_char_to_original_char.get(lower_char_index).copied()
}

fn lower_with_original_char_positions(part: &str) -> (String, Vec<usize>) {
    let mut part_lower = String::with_capacity(part.len());
    let mut lower_char_to_original_char = Vec::with_capacity(part.chars().count());
    for (original_char_index, ch) in part.chars().enumerate() {
        for lower_ch in ch.to_lowercase() {
            part_lower.push(lower_ch);
            lower_char_to_original_char.push(original_char_index);
        }
    }
    (part_lower, lower_char_to_original_char)
}

pub(super) fn match_source(query: &str, filename: &str, ocr: &str, category: &str) -> String {
    let q = query.to_lowercase();
    if contains_case_insensitive(filename, &q) {
        "filename"
    } else if contains_case_insensitive(ocr, &q) {
        "ocr"
    } else if contains_case_insensitive(category, &q) {
        "category"
    } else {
        "content"
    }
    .to_string()
}

fn contains_case_insensitive(part: &str, query_lower: &str) -> bool {
    part.to_lowercase().contains(query_lower)
}

fn looks_garbled(text: &str) -> bool {
    let total = text.chars().count();
    if total == 0 {
        return false;
    }

    let replacement_count = text.chars().filter(|&ch| ch == '\u{fffd}').count();
    replacement_count >= 3 || replacement_count.saturating_mul(12) >= total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snippet_prefers_matching_text_and_falls_back_to_first_content() {
        assert!(snippet("zebra", ["", "invoice zebra-445"]).contains("zebra-445"));
        assert_eq!(snippet("missing", ["abcdef", ""]), "abcdef");
    }

    #[test]
    fn match_source_prefers_filename_then_ocr_then_category_then_content() {
        assert_eq!(
            match_source("report", "report.pdf", "report", "report"),
            "filename"
        );
        assert_eq!(match_source("scan", "file.pdf", "scan text", "scan"), "ocr");
        assert_eq!(match_source("tax", "file.pdf", "", "tax"), "category");
        assert_eq!(match_source("body", "file.pdf", "", ""), "content");
    }

    #[test]
    fn snippet_matches_case_insensitively_in_long_text() {
        let text = "prefix ".repeat(128) + "Receipt-445 tail";
        let result = snippet("receipt-445", [&text]);
        assert!(result.contains("Receipt-445"));
    }

    #[test]
    fn snippet_handles_unicode_casefold_expansion_without_panicking() {
        let text = "İstanbul cargo manifest";
        let result = snippet("i\u{307}stanbul", [text]);
        assert!(result.contains("İstanbul"));
    }

    #[test]
    fn normalize_search_text_drops_replacement_character_garbage() {
        assert_eq!(
            normalize_search_text("bad \u{fffd}\u{fffd}\u{fffd} token"),
            ""
        );
        assert_eq!(normalize_search_text("invoice 445"), "invoice 445");
    }
}
