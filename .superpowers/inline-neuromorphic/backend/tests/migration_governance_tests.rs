use std::fs;
use std::path::PathBuf;

#[test]
fn migration_034_remains_original_checksum_content() {
    let migration = fs::read_to_string(migration_path("034_add_files_deleted_at.sql"))
        .expect("migration 034 should be readable");

    assert_eq!(
        migration,
        "ALTER TABLE files\n\
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;\n\
\n\
CREATE INDEX IF NOT EXISTS idx_files_user_deleted_at\n\
ON files(user_id, deleted_at DESC)\n\
WHERE deleted_at IS NOT NULL;\n\
\n\
ALTER TABLE files\n\
DROP CONSTRAINT IF EXISTS uq_files_user_folder_filename;\n\
\n\
CREATE UNIQUE INDEX IF NOT EXISTS uq_files_active_user_folder_filename\n\
ON files(user_id, folder_id, original_filename) NULLS NOT DISTINCT\n\
WHERE deleted_at IS NULL;\n"
    );
}

#[test]
fn migration_035_carries_active_filename_index_rewrite() {
    let migration = fs::read_to_string(migration_path(
        "035_rewrite_active_file_name_unique_indexes.sql",
    ))
    .expect("migration 035 should be readable");

    assert!(migration.contains("DROP INDEX IF EXISTS uq_files_active_user_folder_filename;"));
    assert!(migration.contains("uq_files_active_user_root_filename"));
    assert!(migration.contains("folder_id IS NULL"));
    assert!(migration.contains("folder_id IS NOT NULL"));
}

#[test]
fn migration_042_remains_original_checksum_content() {
    let migration = fs::read_to_string(migration_path("042_add_audit_events_api_token_id.sql"))
        .expect("migration 042 should be readable");

    assert_eq!(
        migration,
        concat!(
            "ALTER TABLE audit_events\n",
            "DROP CONSTRAINT IF EXISTS audit_events_file_id_fkey;\n",
            "\n",
            "ALTER TABLE audit_events\n",
            "ADD COLUMN IF NOT EXISTS api_token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL;\n",
            "\n",
            "CREATE INDEX IF NOT EXISTS idx_audit_events_user_api_token_created\n",
            "    ON audit_events(user_id, api_token_id, created_at DESC, id DESC)\n",
            "    WHERE api_token_id IS NOT NULL;\n"
        )
    );
}

#[test]
fn migration_043_carries_audit_target_history_hardening() {
    let migration = fs::read_to_string(migration_path(
        "043_preserve_audit_target_history_and_indexes.sql",
    ))
    .expect("migration 043 should be readable");

    assert!(migration.contains("DROP CONSTRAINT IF EXISTS audit_events_folder_id_fkey;"));
    assert!(migration.contains("DROP CONSTRAINT IF EXISTS audit_events_share_id_fkey;"));
    assert!(migration.contains("DROP CONSTRAINT IF EXISTS audit_events_file_request_id_fkey;"));
    assert!(migration.contains("DROP CONSTRAINT IF EXISTS audit_events_api_token_id_fkey;"));
    assert!(migration.contains("idx_audit_events_user_folder_created"));
    assert!(migration.contains("idx_audit_events_user_share_created"));
    assert!(migration.contains("idx_audit_events_user_file_request_created"));
}

fn migration_path(file_name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("migrations")
        .join(file_name)
}
