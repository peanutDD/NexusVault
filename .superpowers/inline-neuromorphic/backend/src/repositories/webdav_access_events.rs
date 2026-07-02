//! WebDAV access event repository.
//!
//! This repository records and lists WebDAV request metadata. It never receives
//! raw credentials or Authorization headers.

use sqlx::PgPool;
use uuid::Uuid;

use crate::types::api_token::{WebDavAccessEventListItem, WebDavDiagnosticListItem};
use crate::utils::AppError;

pub struct CreateWebDavAccessEvent<'a> {
    pub user_id: Uuid,
    pub api_token_id: Option<Uuid>,
    pub method: &'a str,
    pub path: &'a str,
    pub status_code: i32,
    pub read_only: bool,
    pub ip_address: Option<&'a str>,
    pub user_agent: Option<&'a str>,
}

pub struct WebDavAccessEventsRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> WebDavAccessEventsRepo<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, event: CreateWebDavAccessEvent<'_>) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO webdav_access_events (
                user_id, api_token_id, method, path, status_code, read_only, ip_address, user_agent
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(event.user_id)
        .bind(event.api_token_id)
        .bind(event.method)
        .bind(event.path)
        .bind(event.status_code)
        .bind(event.read_only)
        .bind(event.ip_address)
        .bind(event.user_agent)
        .execute(self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(())
    }

    pub async fn list_recent_by_user(
        &self,
        user_id: Uuid,
        limit: i64,
    ) -> Result<Vec<WebDavAccessEventListItem>, AppError> {
        sqlx::query_as::<_, WebDavAccessEventListItem>(
            r#"
            SELECT
                event.id,
                event.api_token_id,
                token.name AS token_name,
                event.method,
                event.path,
                event.status_code,
                event.read_only,
                event.ip_address,
                event.user_agent,
                event.created_at
            FROM webdav_access_events event
            LEFT JOIN api_tokens token
                ON token.id = event.api_token_id
               AND token.user_id = event.user_id
            WHERE event.user_id = $1
            ORDER BY event.created_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit.clamp(1, 100))
        .fetch_all(self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn list_diagnostics_by_user(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<WebDavDiagnosticListItem>, AppError> {
        sqlx::query_as::<_, WebDavDiagnosticListItem>(
            r#"
            WITH latest AS (
                SELECT DISTINCT ON (api_token_id)
                    api_token_id,
                    created_at,
                    ip_address,
                    user_agent
                FROM webdav_access_events
                WHERE user_id = $1
                  AND api_token_id IS NOT NULL
                ORDER BY api_token_id, created_at DESC, id DESC
            ),
            rollup AS (
                SELECT
                    api_token_id,
                    COUNT(*) FILTER (WHERE method IN ('GET', 'HEAD', 'PROPFIND'))::BIGINT AS read_count,
                    COUNT(*) FILTER (WHERE method IN ('MKCOL', 'PUT', 'DELETE', 'MOVE', 'COPY', 'LOCK', 'UNLOCK'))::BIGINT AS write_count,
                    COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299)::BIGINT AS status_2xx,
                    COUNT(*) FILTER (WHERE status_code BETWEEN 300 AND 399)::BIGINT AS status_3xx,
                    COUNT(*) FILTER (WHERE status_code = 401)::BIGINT AS status_401,
                    COUNT(*) FILTER (WHERE status_code = 403)::BIGINT AS status_403,
                    COUNT(*) FILTER (WHERE status_code = 416)::BIGINT AS status_416,
                    COUNT(*) FILTER (WHERE status_code = 423)::BIGINT AS status_423,
                    COUNT(*) FILTER (WHERE status_code BETWEEN 500 AND 599)::BIGINT AS status_5xx,
                    COUNT(*) FILTER (
                        WHERE NOT (
                            status_code BETWEEN 200 AND 399
                            OR status_code IN (401, 403, 416, 423)
                            OR status_code BETWEEN 500 AND 599
                        )
                    )::BIGINT AS other
                FROM webdav_access_events
                WHERE user_id = $1
                  AND api_token_id IS NOT NULL
                GROUP BY api_token_id
            )
            SELECT
                token.id AS token_id,
                token.name AS token_name,
                token.webdav_enabled,
                token.webdav_read_only,
                token.webdav_root_folder_id,
                token.last_used_at,
                latest.created_at AS last_webdav_access_at,
                latest.ip_address AS last_ip,
                latest.user_agent AS last_user_agent,
                COALESCE(rollup.read_count, 0)::BIGINT AS read_count,
                COALESCE(rollup.write_count, 0)::BIGINT AS write_count,
                COALESCE(rollup.status_2xx, 0)::BIGINT AS status_2xx,
                COALESCE(rollup.status_3xx, 0)::BIGINT AS status_3xx,
                COALESCE(rollup.status_401, 0)::BIGINT AS status_401,
                COALESCE(rollup.status_403, 0)::BIGINT AS status_403,
                COALESCE(rollup.status_416, 0)::BIGINT AS status_416,
                COALESCE(rollup.status_423, 0)::BIGINT AS status_423,
                COALESCE(rollup.status_5xx, 0)::BIGINT AS status_5xx,
                COALESCE(rollup.other, 0)::BIGINT AS other
            FROM api_tokens token
            LEFT JOIN latest
              ON latest.api_token_id = token.id
            LEFT JOIN rollup
              ON rollup.api_token_id = token.id
            WHERE token.user_id = $1
              AND (
                token.webdav_enabled = TRUE
                OR latest.api_token_id IS NOT NULL
              )
            ORDER BY COALESCE(latest.created_at, token.last_used_at, token.created_at) DESC, token.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(self.pool)
        .await
        .map_err(AppError::from)
    }
}
