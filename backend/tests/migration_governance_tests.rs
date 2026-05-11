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

fn migration_path(file_name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("migrations")
        .join(file_name)
}
