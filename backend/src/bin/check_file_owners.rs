//! 查询指定 file_id 在数据库中的归属（user_id），以及当前所有用户。
//!
//! 用法：
//!   cargo run --bin check_file_owners
//!   cargo run --bin check_file_owners -- --delete <file_id>               # 仅删 DB 记录
//!   cargo run --bin check_file_owners -- --delete-with-file <file_id>     # 删 DB 记录并删磁盘文件
//!
//! 需配置 .env 中的 DATABASE_URL；删文件时从 backend 目录运行。
//!
//! ## 为何会出现「DB 的 user_id 与磁盘路径中的 user_id 不一致」？
//!
//! **原因一：秒传（instant upload）**  
//! 秒传时按 content_sha256 + file_size 复用已有文件的路径，为新用户插一条新记录，
//! 故 file_path 指向首传用户的目录，后续秒传者的记录里 user_id 与路径中的首传者不一致。
//!
//! **原因二：只改用户名/邮箱时被当成「另一个账号」**  
//! 后端逻辑上**不会**因改资料产生新账号：`PUT /update-profile` 只做 UPDATE 同一条 users 行，
//! 且 JWT 里始终是 user_id，不会因邮箱/用户名变更而变。若曾误用「注册」用新邮箱/新用户名
//! 再注册过一次，会多出一个新 user_id；之后用新邮箱登录会进到新账号，旧文件仍在旧 user_id 下，
//! 看起来就像「改了个名/邮箱就变成另一个账号」。正确做法是只在「设置 → 账户信息」里更新资料，不要用注册页。

use std::path::Path;
use sqlx::Row;
use uuid::Uuid;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();
    let args: Vec<String> = std::env::args().collect();
    let delete_with_file = args.get(1).map(|s| s.as_str()) == Some("--delete-with-file");
    let delete_only = args.get(1).map(|s| s.as_str()) == Some("--delete");
    if delete_with_file || delete_only {
        let file_id_str = args
            .get(2)
            .ok_or_else(|| anyhow::anyhow!("用法: --delete <file_id> 或 --delete-with-file <file_id>"))?;
        let file_id = Uuid::parse_str(file_id_str)
            .map_err(|e| anyhow::anyhow!("无效的 file_id: {}", e))?;
        let url = std::env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("DATABASE_URL not set"))?;
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&url)
            .await?;

        let file_path: Option<String> = if delete_with_file {
            let row = sqlx::query_scalar::<_, String>("SELECT file_path FROM files WHERE id = $1")
                .bind(file_id)
                .fetch_optional(&pool)
                .await?;
            row
        } else {
            None
        };

        let result = sqlx::query("DELETE FROM files WHERE id = $1")
            .bind(file_id)
            .execute(&pool)
            .await?;
        println!(
            "已删除 files 表中 id = {} 的记录，影响行数: {}",
            file_id_str,
            result.rows_affected()
        );

        if delete_with_file {
            if let Some(ref path_str) = file_path {
                let path = Path::new(path_str);
                let to_remove = if path.is_absolute() {
                    path.to_path_buf()
                } else {
                    std::env::current_dir()
                        .map(|cwd| cwd.join(path_str))
                        .unwrap_or_else(|_| path.to_path_buf())
                };
                match tokio::fs::remove_file(&to_remove).await {
                    Ok(()) => println!("已删除磁盘文件: {}", to_remove.display()),
                    Err(e) => println!("删除磁盘文件失败 ({}): {}", to_remove.display(), e),
                }
                if let Some(parent) = to_remove.parent() {
                    let _ = tokio::fs::remove_dir(parent).await;
                    if let Some(gp) = parent.parent() {
                        let _ = tokio::fs::remove_dir(gp).await;
                    }
                }
            } else {
                println!("(无 file_path 记录，未删磁盘文件)");
            }
        }
        return Ok(());
    }
    let url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL not set"))?;
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await?;

    // 磁盘上看到的路径对应的 file_id（uploads/<user_id>/<file_id>/...）
    let file_ids = [
        "bfb89e66-79bd-45af-9ee1-5c7eaaadbe6d",
        "7d4e5d64-47e8-4d1f-8550-85e4a146bd22",
        "fc134d71-1d84-4e4f-a68d-5d501c5ebc98",
        "fb524c72-8f0b-478c-bd3c-b81a32e6bd46",
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
        let id = Uuid::parse_str(id_str)
            .map_err(|e| anyhow::anyhow!("invalid UUID for file_id {:?}: {}", id_str, e))?;
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
    let uid = Uuid::parse_str(storage_user_id)
        .map_err(|e| anyhow::anyhow!("invalid UUID for storage_user_id {:?}: {}", storage_user_id, e))?;
    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM files WHERE user_id = $1")
            .bind(uid)
            .fetch_one(&pool)
            .await?;
    println!("  files 表中 user_id = {} 的记录数: {}", storage_user_id, count.0);

    Ok(())
}
