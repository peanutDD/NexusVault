//! 查询指定 file_id 在数据库中的归属（user_id），以及当前所有用户。
//! 用法：`cargo run --bin check_file_owners`（需配置 .env 中的 DATABASE_URL）

use sqlx::Row;
use uuid::Uuid;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();
    let url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL not set"))?;
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await?;

    // 磁盘上看到的路径对应的 file_id（uploads/<user_id>/<file_id>/...）
    let file_ids = [
        "7d4e5d64-47e8-4d1f-8550-85e4a146bd22",
        "fc134d71-1d84-4e4f-a68d-5d501c5ebc98",
    ];
    let storage_user_id = "e2e3520f-df62-49a2-8e44-aa4710b04eca"; // 磁盘路径里的 user_id

    println!("=== 用户列表 (users) ===\n");
    let users = sqlx::query("SELECT id, email FROM users ORDER BY email")
        .fetch_all(&pool)
        .await?;
    for row in &users {
        let id: Uuid = row.get("id");
        let email: &str = row.get("email");
        let marker = if id.to_string() == storage_user_id {
            "  <-- 磁盘路径中的 user_id (e2e3520f...)"
        } else {
            ""
        };
        println!("  {}  {} {}", id, email, marker);
    }

    println!("\n=== 指定 file_id 在 files 表中的记录 ===\n");
    for id_str in &file_ids {
        let id = Uuid::parse_str(id_str).unwrap();
        let row = sqlx::query(
            "SELECT id, user_id, file_path, original_filename, created_at FROM files WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&pool)
        .await?;
        match row {
            Some(r) => {
                let db_user_id: Uuid = r.get("user_id");
                let path: String = r.get("file_path");
                let name: String = r.get("original_filename");
                let created: chrono::DateTime<chrono::Utc> = r.get("created_at");
                let same = if db_user_id.to_string() == storage_user_id {
                    "（与磁盘路径 user_id 一致）"
                } else {
                    "（与磁盘路径 user_id 不一致，属其他账号）"
                };
                println!(
                    "  file_id = {}  =>  user_id = {} {}  path = {}  name = {}  created = {}",
                    id_str, db_user_id, same, path, name, created
                );
            }
            None => println!("  file_id = {}  =>  无记录（孤儿文件）", id_str),
        }
    }

    println!("\n=== 用户 {} 名下的文件数量 ===\n", storage_user_id);
    let uid = Uuid::parse_str(storage_user_id).unwrap();
    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM files WHERE user_id = $1")
            .bind(uid)
            .fetch_one(&pool)
            .await?;
    println!("  files 表中 user_id = {} 的记录数: {}", storage_user_id, count.0);

    Ok(())
}
