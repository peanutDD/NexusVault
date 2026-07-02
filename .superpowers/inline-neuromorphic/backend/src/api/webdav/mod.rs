use std::net::{IpAddr, SocketAddr};

use axum::{
    body::Body,
    extract::{ConnectInfo, State},
    http::{header, HeaderMap, HeaderValue, Method, Request, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use metrics::counter;

mod auth;
mod lock;
mod lock_headers;
mod methods;
mod path;
mod propfind;
mod range;
mod xml_fragments;

use self::{
    auth::authenticate,
    lock::{lock_path, unlock_path},
    methods::{copy_path, delete_path, get_file, mkcol, move_path, put_file},
    path::path_segments,
    propfind::propfind,
};

use crate::{
    repositories::webdav_access_events::CreateWebDavAccessEvent,
    repositories::WebDavAccessEventsRepo,
    services::activity::{AuditEventInput, AuditService},
    services::webdav::{WebDavError, WebDavPrincipal},
    AppState,
};

pub fn create_router() -> Router<AppState> {
    Router::new().fallback(any(handle_fallback))
}

pub async fn handle_root(State(state): State<AppState>, req: Request<Body>) -> Response {
    handle(state, req, String::new()).await
}

async fn handle_fallback(State(state): State<AppState>, req: Request<Body>) -> Response {
    let path = req
        .uri()
        .path()
        .strip_prefix("/dav")
        .unwrap_or(req.uri().path())
        .trim_start_matches('/')
        .to_string();
    handle(state, req, path).await
}

async fn handle(state: AppState, req: Request<Body>, raw_path: String) -> Response {
    let method = req.method().clone();
    let headers = req.headers().clone();
    let peer_addr = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|connect_info| connect_info.0);
    let client_ip = client_ip(&headers, state.config.server.trust_proxy_headers, peer_addr);
    let user_agent = sanitized_user_agent(&headers);
    let (parts, body) = req.into_parts();
    let segments = match path_segments(&raw_path) {
        Ok(segments) => segments,
        Err(status) => return status.into_response(),
    };
    let path_depth = segments.len();
    if method == Method::OPTIONS {
        return options_response();
    }

    let principal = match authenticate(&state, &headers).await {
        Ok(principal) => principal,
        Err(status) => {
            counter!("webdav_auth_fail_total").increment(1);
            let mut response = status.into_response();
            response.headers_mut().insert(
                header::WWW_AUTHENTICATE,
                HeaderValue::from_static("Basic realm=\"WebDAV\""),
            );
            return response;
        }
    };
    let response = if principal.read_only && is_write_method(method.as_str()) {
        StatusCode::FORBIDDEN.into_response()
    } else {
        match method.as_str() {
            "PROPFIND" => propfind(&state, &principal, &segments, &headers, body).await,
            "MKCOL" => mkcol(&state, &principal, &segments, body, &headers).await,
            "PUT" => put_file(&state, &principal, &segments, &headers, body).await,
            "GET" => get_file(&state, &principal, &segments, &headers, false).await,
            "HEAD" => get_file(&state, &principal, &segments, &headers, true).await,
            "DELETE" => delete_path(&state, &principal, &segments, &headers).await,
            "MOVE" => move_path(&state, &principal, &segments, &headers).await,
            "COPY" => copy_path(&state, &principal, &segments, &headers).await,
            "LOCK" => lock_path(&state, &principal, &segments, &headers, body).await,
            "UNLOCK" => unlock_path(&state, &principal, &headers).await,
            _ => StatusCode::METHOD_NOT_ALLOWED.into_response(),
        }
    };
    record_webdav_activity(
        &state,
        &principal,
        method.as_str(),
        &segments,
        response.status().as_u16(),
        client_ip.as_deref(),
        user_agent.as_deref(),
    )
    .await;

    counter!(
        "webdav_request_total",
        "method" => method.as_str().to_string(),
        "status" => response.status().as_u16().to_string()
    )
    .increment(1);
    tracing::info!(
        method = %method,
        path_depth,
        user_id = %principal.user_id,
        status = response.status().as_u16(),
        "webdav request"
    );
    let _ = parts;
    response
}

async fn record_webdav_activity(
    state: &AppState,
    principal: &WebDavPrincipal,
    method: &str,
    segments: &[String],
    status_code: u16,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) {
    let path = normalized_activity_path(segments);
    let repo = WebDavAccessEventsRepo::new(&state.pool);
    if let Err(error) = repo
        .create(CreateWebDavAccessEvent {
            user_id: principal.user_id,
            api_token_id: Some(principal.api_token_id),
            method,
            path: &path,
            status_code: i32::from(status_code),
            read_only: principal.read_only,
            ip_address,
            user_agent,
        })
        .await
    {
        tracing::warn!(
            %error,
            user_id = %principal.user_id,
            api_token_id = %principal.api_token_id,
            method,
            status_code,
            "failed to record webdav activity"
        );
    }
    AuditService::from_state(state)
        .record_lenient(AuditEventInput {
            user_id: principal.user_id,
            actor_type: "api_token",
            actor_user_id: Some(principal.user_id),
            source: "webdav",
            event_type: match method {
                "MKCOL" => "webdav.mkcol",
                "PUT" => "webdav.put",
                "GET" => "webdav.get",
                "HEAD" => "webdav.head",
                "DELETE" => "webdav.delete",
                "MOVE" => "webdav.move",
                "COPY" => "webdav.copy",
                "LOCK" => "webdav.lock",
                "UNLOCK" => "webdav.unlock",
                _ => "webdav.request",
            },
            target_type: "webdav_path",
            file_id: None,
            folder_id: None,
            share_id: None,
            file_request_id: None,
            api_token_id: Some(principal.api_token_id),
            status: Some(i32::from(status_code)),
            ip_address,
            user_agent,
            metadata: serde_json::json!({
                "method": method,
                "path": path,
                "read_only": principal.read_only,
            }),
        })
        .await;
}

fn sanitized_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(256).collect())
}

fn client_ip(
    headers: &HeaderMap,
    trust_proxy_headers: bool,
    peer_addr: Option<SocketAddr>,
) -> Option<String> {
    let header_ip = if trust_proxy_headers {
        forwarded_for_ip(headers)
            .or_else(|| x_forwarded_for_ip(headers))
            .or_else(|| x_real_ip(headers))
    } else {
        None
    };

    header_ip
        .or_else(|| peer_addr.map(|addr| addr.ip()))
        .map(|ip| ip.to_string())
}

fn parse_ip(value: &str) -> Option<IpAddr> {
    let mut value = value.trim().trim_matches('"');
    if let Some(stripped) = value.strip_prefix('[').and_then(|v| v.strip_suffix(']')) {
        value = stripped;
    }

    if let Some(stripped) = value
        .strip_prefix("for=")
        .or_else(|| value.strip_prefix("for=\""))
    {
        value = stripped.trim_matches('"');
        if let Some(stripped) = value.strip_prefix('[').and_then(|v| v.strip_suffix(']')) {
            value = stripped;
        }
    }

    let candidate = if value.contains(':') && value.matches(':').count() > 1 {
        value
    } else {
        value.split(':').next().unwrap_or(value)
    };

    candidate.parse::<IpAddr>().ok()
}

fn forwarded_for_ip(headers: &HeaderMap) -> Option<IpAddr> {
    let value = headers.get("forwarded")?.to_str().ok()?;
    value
        .split(',')
        .flat_map(|item| item.split(';'))
        .map(str::trim)
        .find_map(|part| part.starts_with("for=").then(|| parse_ip(part)).flatten())
}

fn x_forwarded_for_ip(headers: &HeaderMap) -> Option<IpAddr> {
    let value = headers.get("x-forwarded-for")?.to_str().ok()?;
    value.split(',').find_map(parse_ip)
}

fn x_real_ip(headers: &HeaderMap) -> Option<IpAddr> {
    headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .and_then(parse_ip)
}

fn normalized_activity_path(segments: &[String]) -> String {
    if segments.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", segments.join("/"))
    }
}

fn is_write_method(method: &str) -> bool {
    matches!(
        method,
        "MKCOL" | "PUT" | "DELETE" | "MOVE" | "COPY" | "LOCK" | "UNLOCK"
    )
}

fn webdav_error_response(error: WebDavError) -> Response {
    match error {
        WebDavError::BadRequest => StatusCode::BAD_REQUEST,
        WebDavError::NotFound => StatusCode::NOT_FOUND,
        WebDavError::Conflict => StatusCode::CONFLICT,
        WebDavError::Forbidden => StatusCode::FORBIDDEN,
        WebDavError::PreconditionFailed => StatusCode::PRECONDITION_FAILED,
        WebDavError::Internal => StatusCode::INTERNAL_SERVER_ERROR,
    }
    .into_response()
}

fn options_response() -> Response {
    let mut response = StatusCode::NO_CONTENT.into_response();
    response.headers_mut().insert(
        header::ALLOW,
        HeaderValue::from_static(
            "OPTIONS, PROPFIND, MKCOL, PUT, GET, HEAD, DELETE, MOVE, COPY, LOCK, UNLOCK",
        ),
    );
    response
}
