use codex_cli::patch::{
    ApplyOutcome, MatchEngine, MatchLevel, Patch, PatchFormat, RawPatch, SearchReplaceParser,
    apply, apply_search_replace_in, detect_format, parse_search_replace_blocks,
};
use codex_cli::prompts::search_replace_system_prompt;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn patch_format_detection_test() {
    assert_eq!(
        detect_format("### File: src/lib.rs\n<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE"),
        PatchFormat::SearchReplace
    );
    assert_eq!(
        detect_format(
            "diff --git a/src/lib.rs b/src/lib.rs\n--- a/src/lib.rs\n+++ b/src/lib.rs\n@@ -1 +1 @@\n-old\n+new\n"
        ),
        PatchFormat::UnifiedDiff
    );
    assert_eq!(
        detect_format(
            "diff --git a/src/lib.rs b/src/lib.rs\n<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE"
        ),
        PatchFormat::Mixed
    );
    assert_eq!(detect_format("   \n"), PatchFormat::Empty);
    assert_eq!(detect_format("hello world"), PatchFormat::Unknown);
}

#[test]
fn raw_patch_implements_patch_trait() {
    let patch =
        RawPatch::new("### File: src/lib.rs\n<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE\n");

    assert_eq!(patch.format(), PatchFormat::SearchReplace);
    assert!(patch.body().contains("<<<<<<< SEARCH"));
}

#[test]
fn search_replace_parser_contract_alias_matches_free_function() {
    let text = "### File: src/lib.rs\n<<<<<<< SEARCH\none\n=======\ntwo\n>>>>>>> REPLACE\n";

    let via_struct = SearchReplaceParser::parse(text, "src/lib.rs").unwrap();
    let via_free_function = parse_search_replace_blocks(text, "src/lib.rs").unwrap();

    assert_eq!(via_struct, via_free_function);
}

#[test]
fn match_engine_returns_public_match_outcome() {
    let outcome = MatchEngine::find("fn value() {\n    1\n}\n", "fn value() {\n  1\n}\n").unwrap();

    assert_eq!(outcome.start, 0);
    assert_eq!(outcome.level, MatchLevel::NormalizeIndent);
}

#[test]
fn sr_parser_accepts_multiple_blocks_and_rejects_wrong_file() {
    let text = "### File: src/lib.rs\n<<<<<<< SEARCH\none\n=======\ntwo\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nthree\n=======\nfour\n>>>>>>> REPLACE\n";

    let blocks = parse_search_replace_blocks(text, "src/lib.rs").unwrap();
    assert_eq!(blocks.len(), 2);
    assert_eq!(blocks[0].search, "one\n");
    assert_eq!(blocks[0].replace, "two\n");

    let err = parse_search_replace_blocks(text, "src/main.rs").unwrap_err();
    assert!(err.to_string().contains("does not match allowed file"));
}

#[test]
fn sr_parser_reports_malformed_blocks_and_max_block_limit() {
    let missing_separator = "### File: src/lib.rs\n<<<<<<< SEARCH\none\n>>>>>>> REPLACE\n";
    let err = parse_search_replace_blocks(missing_separator, "src/lib.rs").unwrap_err();
    assert!(err.to_string().contains("missing ======="));

    let missing_end = "### File: src/lib.rs\n<<<<<<< SEARCH\none\n=======\ntwo\n";
    let err = parse_search_replace_blocks(missing_end, "src/lib.rs").unwrap_err();
    assert!(err.to_string().contains("missing >>>>>>> REPLACE"));

    let missing_header = "<<<<<<< SEARCH\none\n=======\ntwo\n>>>>>>> REPLACE\n";
    let err = parse_search_replace_blocks(missing_header, "src/lib.rs").unwrap_err();
    assert!(
        err.to_string()
            .contains("missing SEARCH/REPLACE file header")
    );

    let mut too_many = "### File: src/lib.rs\n".to_string();
    for index in 0..6 {
        too_many.push_str(&format!(
            "<<<<<<< SEARCH\nold{index}\n=======\nnew{index}\n>>>>>>> REPLACE\n"
        ));
    }
    let err = parse_search_replace_blocks(&too_many, "src/lib.rs").unwrap_err();
    assert!(err.to_string().contains("exceeds max 5"));
}

#[test]
fn sr_apply_replaces_deletes_and_appends() {
    let repo = create_repo("sr-apply");
    fs::write(
        repo.join("src/lib.rs"),
        "fn one() {\n    println!(\"one\");\n}\n\nfn remove_me() {}\n",
    )
    .unwrap();

    let text = "### File: src/lib.rs\n<<<<<<< SEARCH\nfn one() {\n    println!(\"one\");\n}\n=======\nfn one() {\n    println!(\"two\");\n}\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nfn remove_me() {}\n=======\n>>>>>>> REPLACE\n<<<<<<< SEARCH\n=======\n\nfn appended() {}\n>>>>>>> REPLACE\n";

    let outcome = apply_search_replace_in(repo.to_str().unwrap(), "src/lib.rs", text).unwrap();
    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    let _ = fs::remove_dir_all(&repo);

    assert_eq!(outcome, ApplyOutcome::Applied { blocks: 3 });
    assert!(updated.contains("println!(\"two\")"));
    assert!(!updated.contains("remove_me"));
    assert!(updated.ends_with("\nfn appended() {}\n"));
}

#[test]
fn sr_apply_is_order_independent_and_rejects_overlapping_blocks() {
    let repo = create_repo("sr-order-independent");
    fs::write(repo.join("src/lib.rs"), "alpha\nmiddle\nomega\n").unwrap();

    let reversed = "### File: src/lib.rs\n<<<<<<< SEARCH\nomega\n=======\nlast\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nalpha\n=======\nfirst\n>>>>>>> REPLACE\n";
    apply_search_replace_in(repo.to_str().unwrap(), "src/lib.rs", reversed).unwrap();
    assert_eq!(
        fs::read_to_string(repo.join("src/lib.rs")).unwrap(),
        "first\nmiddle\nlast\n"
    );

    fs::write(repo.join("src/lib.rs"), "alpha\nmiddle\nomega\n").unwrap();
    let overlapping = "### File: src/lib.rs\n<<<<<<< SEARCH\nalpha\nmiddle\n=======\none\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nmiddle\nomega\n=======\ntwo\n>>>>>>> REPLACE\n";
    let err =
        apply_search_replace_in(repo.to_str().unwrap(), "src/lib.rs", overlapping).unwrap_err();
    let _ = fs::remove_dir_all(&repo);

    assert!(err.to_string().contains("overlap"));
}

#[test]
fn patch_apply_accepts_search_replace_and_unified_diff() {
    let repo = create_repo("patch-apply-entrypoint");
    fs::write(
        repo.join("src/lib.rs"),
        "pub fn value() -> i32 {\n    1\n}\n",
    )
    .unwrap();

    let sr = "### File: src/lib.rs\n<<<<<<< SEARCH\n    1\n=======\n    2\n>>>>>>> REPLACE\n";
    let sr_result = apply(repo.to_str().unwrap(), "src/lib.rs", sr).unwrap();
    assert!(sr_result.applied);

    let diff = "diff --git a/src/lib.rs b/src/lib.rs\n--- a/src/lib.rs\n+++ b/src/lib.rs\n@@ -1,3 +1,3 @@\n pub fn value() -> i32 {\n-    2\n+    3\n }\n";
    let diff_result = apply(repo.to_str().unwrap(), "src/lib.rs", diff).unwrap();
    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    let _ = fs::remove_dir_all(&repo);

    assert!(diff_result.applied);
    assert!(updated.contains("3"));
}

#[test]
fn search_replace_prompt_contains_required_constraints() {
    let prompt = search_replace_system_prompt("follow rules", "src/lib.rs", 5);

    assert!(prompt.contains("Allowed file: src/lib.rs"));
    assert!(prompt.contains("### File: src/lib.rs"));
    assert!(prompt.contains("<<<<<<< SEARCH"));
    assert!(prompt.contains("max blocks: 5"));
    assert!(prompt.contains("禁止 unified diff"));
}

#[test]
fn golden_search_replace_fixtures_all_apply() {
    let cases = [
        (
            "replace",
            include_str!("fixtures/golden/replace.source"),
            include_str!("fixtures/golden/replace.patch"),
            include_str!("fixtures/golden/replace.expected"),
        ),
        (
            "delete",
            include_str!("fixtures/golden/delete.source"),
            include_str!("fixtures/golden/delete.patch"),
            include_str!("fixtures/golden/delete.expected"),
        ),
        (
            "append",
            include_str!("fixtures/golden/append.source"),
            include_str!("fixtures/golden/append.patch"),
            include_str!("fixtures/golden/append.expected"),
        ),
        (
            "trim",
            include_str!("fixtures/golden/trim.source"),
            include_str!("fixtures/golden/trim.patch"),
            include_str!("fixtures/golden/trim.expected"),
        ),
        (
            "indent",
            include_str!("fixtures/golden/indent.source"),
            include_str!("fixtures/golden/indent.patch"),
            include_str!("fixtures/golden/indent.expected"),
        ),
    ];

    for (name, source, patch, expected) in cases {
        let repo = create_repo(&format!("golden-{name}"));
        fs::write(repo.join("src/lib.rs"), source).unwrap();

        apply_search_replace_in(repo.to_str().unwrap(), "src/lib.rs", patch).unwrap();
        let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
        let _ = fs::remove_dir_all(&repo);

        assert_eq!(updated, expected, "golden case `{name}` did not match");
    }
}

#[test]
fn sr_apply_uses_trimmed_line_match_but_rejects_ambiguous_matches() {
    let repo = create_repo("sr-fuzzy");
    fs::write(repo.join("src/lib.rs"), "let a = 1;   \nlet b = 2;\n").unwrap();

    let text =
        "### File: src/lib.rs\n<<<<<<< SEARCH\nlet a = 1;\n=======\nlet a = 3;\n>>>>>>> REPLACE\n";
    let outcome = apply_search_replace_in(repo.to_str().unwrap(), "src/lib.rs", text).unwrap();
    assert_eq!(
        outcome,
        ApplyOutcome::AppliedWithFuzzyMatch {
            blocks: 1,
            level: MatchLevel::TrimTrailingWhitespace
        }
    );

    fs::write(repo.join("src/lib.rs"), "same\nsame\n").unwrap();
    let ambiguous = "### File: src/lib.rs\n<<<<<<< SEARCH\nsame\n=======\nother\n>>>>>>> REPLACE\n";
    let err = apply_search_replace_in(repo.to_str().unwrap(), "src/lib.rs", ambiguous).unwrap_err();
    let _ = fs::remove_dir_all(&repo);

    assert!(err.to_string().contains("ambiguous"));
}

#[test]
fn sr_apply_uses_normalized_indent_match() {
    let repo = create_repo("sr-indent");
    fs::write(
        repo.join("src/lib.rs"),
        "pub fn value() -> i32 {\n        1\n}\n",
    )
    .unwrap();

    let text = "### File: src/lib.rs\n<<<<<<< SEARCH\npub fn value() -> i32 {\n    1\n}\n=======\npub fn value() -> i32 {\n    2\n}\n>>>>>>> REPLACE\n";
    let outcome = apply_search_replace_in(repo.to_str().unwrap(), "src/lib.rs", text).unwrap();
    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    let _ = fs::remove_dir_all(&repo);

    assert_eq!(
        outcome,
        ApplyOutcome::AppliedWithFuzzyMatch {
            blocks: 1,
            level: MatchLevel::NormalizeIndent
        }
    );
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

fn create_repo(name: &str) -> PathBuf {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("codex-cli-{}-{}", name, now));
    fs::create_dir_all(dir.join("src")).unwrap();
    Command::new("git").arg("init").arg(&dir).output().unwrap();
    dir
}
