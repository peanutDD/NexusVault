mod common;

use file_storage_backend::services::fulltext_search::{SearchDocument, SearchIndexService};
use uuid::Uuid;

#[test]
fn fulltext_search_returns_snippets_and_enforces_user_isolation() {
    let service = SearchIndexService::open_in_memory().unwrap();
    let user_a = Uuid::new_v4();
    let user_b = Uuid::new_v4();
    service
        .upsert_document(SearchDocument {
            file_id: Uuid::new_v4(),
            user_id: user_a,
            filename: "notes.md".into(),
            path: "/notes.md".into(),
            extracted_text: "rust webdav searchable content".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "text/markdown".into(),
        })
        .unwrap();
    service
        .upsert_document(SearchDocument {
            file_id: Uuid::new_v4(),
            user_id: user_b,
            filename: "secret.md".into(),
            path: "/secret.md".into(),
            extracted_text: "rust webdav searchable content".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "text/markdown".into(),
        })
        .unwrap();

    let results = service.search(user_a, "webdav", 10, None, None).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].filename, "notes.md");
    assert!(results[0].snippet.to_lowercase().contains("webdav"));
}
