use axum::{
    body::{to_bytes, Body},
    extract::State,
    http::{header, HeaderMap, HeaderValue, Method, Request, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use futures::StreamExt;
use metrics::{counter, histogram};
use percent_encoding::{percent_decode_str, utf8_percent_encode, AsciiSet, CONTROLS};
use quick_xml::{
    events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event},
    reader::Reader,
    writer::Writer,
};
use std::{collections::HashMap, time::Instant};
use tempfile::NamedTempFile;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio_util::io::ReaderStream;
use url::Url;
use uuid::Uuid;

use crate::{
    models::{
        file::RenameFileRequest,
        folder::{CreateFolderRequest, MoveFolderRequest, RenameFolderRequest},
    },
    repositories::{traits::FilesRepository, FoldersRepo, SqlxFilesRepo},
    services::{
        api_token::{ApiTokenClaims, ApiTokenService},
        file::{CreateFileFromPathInput, EmbeddingTaskInput, FileService},
        folder::FolderService,
        storage::StorageReadStream,
    },
    utils::{
        effective_file_mime_type, is_macos_appledouble_filename, validation::sanitize_filename,
    },
    AppState,
};

const DEFAULT_LOCK_TIMEOUT_SECS: i64 = 600;
const MAX_LOCK_TIMEOUT_SECS: i64 = 3600;
const DAV_PATH_SEGMENT_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'`')
    .add(b'{')
    .add(b'}');

#[derive(Debug, Clone)]
struct WebDavPrincipal {
    api_token_id: Uuid,
    user_id: Uuid,
    read_only: bool,
    root_folder_id: Option<Uuid>,
}

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
    if principal.read_only && is_write_method(method.as_str()) {
        return StatusCode::FORBIDDEN.into_response();
    }

    let response = match method.as_str() {
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
    };

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

fn is_write_method(method: &str) -> bool {
    matches!(
        method,
        "MKCOL" | "PUT" | "DELETE" | "MOVE" | "COPY" | "LOCK" | "UNLOCK"
    )
}

async fn authenticate(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<WebDavPrincipal, StatusCode> {
    let Some(value) = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
    else {
        return Err(StatusCode::UNAUTHORIZED);
    };
    let token_service = ApiTokenService::from_state(state);
    if let Some(encoded) = value.strip_prefix("Basic ") {
        let decoded = STANDARD
            .decode(encoded)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;
        let Some((_, token)) = decoded.split_once(':') else {
            return Err(StatusCode::UNAUTHORIZED);
        };
        let claims = token_service
            .verify_token_claims(token)
            .await
            .map_err(|_| StatusCode::UNAUTHORIZED)?;
        return principal_from_claims(state, claims).await;
    }
    if let Some(token) = value.strip_prefix("Bearer ") {
        let claims = token_service
            .verify_token_claims(token)
            .await
            .map_err(|_| StatusCode::UNAUTHORIZED)?;
        return principal_from_claims(state, claims).await;
    }
    Err(StatusCode::UNAUTHORIZED)
}

async fn principal_from_claims(
    state: &AppState,
    claims: ApiTokenClaims,
) -> Result<WebDavPrincipal, StatusCode> {
    if !claims.webdav_enabled {
        return Err(StatusCode::FORBIDDEN);
    }
    if let Some(root_folder_id) = claims.webdav_root_folder_id {
        let exists = FoldersRepo::new(&state.pool)
            .exists(root_folder_id, claims.user_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if !exists {
            return Err(StatusCode::FORBIDDEN);
        }
    }
    Ok(WebDavPrincipal {
        api_token_id: claims.token_id,
        user_id: claims.user_id,
        read_only: claims.webdav_read_only,
        root_folder_id: claims.webdav_root_folder_id,
    })
}

fn path_segments(raw_path: &str) -> Result<Vec<String>, StatusCode> {
    let decoded = percent_decode_str(raw_path)
        .decode_utf8()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let mut segments = Vec::new();
    for part in decoded.split('/') {
        if part.is_empty() {
            continue;
        }
        if part == "." || part == ".." || part.contains('\\') || part.contains('\0') {
            return Err(StatusCode::BAD_REQUEST);
        }
        segments.push(part.to_string());
    }
    Ok(segments)
}

async fn resolve_parent(
    state: &AppState,
    principal: &WebDavPrincipal,
    folders: &[String],
) -> Result<Option<Uuid>, StatusCode> {
    if folders.is_empty() {
        return Ok(principal.root_folder_id);
    }

    let folder_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        WITH RECURSIVE path_match AS (
            SELECT id, 1 AS depth
            FROM folders
            WHERE user_id = $1
              AND name = ($3::text[])[1]
              AND (
                  ($2::uuid IS NULL AND parent_id IS NULL)
                  OR parent_id = $2
              )

            UNION ALL

            SELECT child.id, path_match.depth + 1
            FROM path_match
            JOIN folders child
              ON child.parent_id = path_match.id
             AND child.user_id = $1
            WHERE child.name = ($3::text[])[path_match.depth + 1]
              AND path_match.depth < cardinality($3::text[])
        )
        SELECT id
        FROM path_match
        WHERE depth = cardinality($3::text[])
        LIMIT 1
        "#,
    )
    .bind(principal.user_id)
    .bind(principal.root_folder_id)
    .bind(folders)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    folder_id.map(Some).ok_or(StatusCode::NOT_FOUND)
}

async fn resolve_parent_and_name(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
) -> Result<(Option<Uuid>, String), StatusCode> {
    let Some(name) = segments.last() else {
        return Err(StatusCode::BAD_REQUEST);
    };
    let parent = resolve_parent(state, principal, &segments[..segments.len() - 1]).await?;
    Ok((parent, name.clone()))
}

async fn propfind(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    headers: &HeaderMap,
    body: Body,
) -> Response {
    let start = Instant::now();
    let depth = headers
        .get("depth")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("1");
    let requested = match requested_propfind_props(body).await {
        Ok(requested) => requested,
        Err(status) => return status.into_response(),
    };
    let folder_id = match resolve_parent(state, principal, segments).await {
        Ok(folder_id) => folder_id,
        Err(StatusCode::NOT_FOUND) => {
            return propfind_file(state, principal, segments, &requested).await
        }
        Err(status) => return status.into_response(),
    };
    let lock_discoveries =
        if requested.props.contains(&DavProp::LockDiscovery) && !requested.propname {
            match active_lock_discoveries(state, principal.user_id).await {
                Ok(lock_discoveries) => lock_discoveries,
                Err(status) => return status.into_response(),
            }
        } else {
            HashMap::new()
        };
    let mut xml = multistatus_start();
    xml.push_str(&collection_response(
        segments,
        None,
        &requested,
        None,
        &lock_discoveries,
    ));
    if depth != "0" {
        let mut count = 1usize;
        let recursive = depth.eq_ignore_ascii_case("infinity");
        let mut walk = PropfindWalk {
            requested: &requested,
            recursive,
            lock_discoveries: &lock_discoveries,
            xml: &mut xml,
            count: &mut count,
        };
        if let Err(status) =
            append_propfind_children(state, principal, folder_id, segments, &mut walk).await
        {
            return status.into_response();
        }
    }
    xml.push_str(&xml_end("D:multistatus"));
    histogram!("webdav_propfind_duration_seconds").record(start.elapsed().as_secs_f64());
    (
        StatusCode::MULTI_STATUS,
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        xml,
    )
        .into_response()
}

const MAX_PROPFIND_INFINITY_ITEMS: usize = 5_000;

struct PropfindWalk<'a> {
    requested: &'a PropfindRequest,
    recursive: bool,
    lock_discoveries: &'a LockDiscoveryByPath,
    xml: &'a mut String,
    count: &'a mut usize,
}

async fn append_propfind_children(
    state: &AppState,
    principal: &WebDavPrincipal,
    parent_id: Option<Uuid>,
    parent_segments: &[String],
    walk: &mut PropfindWalk<'_>,
) -> Result<(), StatusCode> {
    let repo = FoldersRepo::new(&state.pool);
    let mut pending = vec![(parent_id, parent_segments.to_vec())];

    while let Some((current_parent_id, current_segments)) = pending.pop() {
        let folders = repo
            .list_by_parent(principal.user_id, current_parent_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let files = state
            .file_service
            .list_by_folder(principal.user_id, current_parent_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        for folder in folders {
            *walk.count += 1;
            if *walk.count > MAX_PROPFIND_INFINITY_ITEMS {
                return Err(StatusCode::PAYLOAD_TOO_LARGE);
            }
            walk.xml.push_str(&collection_response(
                &current_segments,
                Some(&folder.name),
                walk.requested,
                Some(folder.updated_at),
                walk.lock_discoveries,
            ));
            if walk.recursive {
                let mut child_segments = current_segments.clone();
                child_segments.push(folder.name);
                pending.push((Some(folder.id), child_segments));
            }
        }
        for file in files {
            *walk.count += 1;
            if *walk.count > MAX_PROPFIND_INFINITY_ITEMS {
                return Err(StatusCode::PAYLOAD_TOO_LARGE);
            }
            walk.xml.push_str(&file_response(
                &current_segments,
                &file,
                walk.requested,
                walk.lock_discoveries,
            ));
        }
    }

    Ok(())
}

async fn propfind_file(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    requested: &PropfindRequest,
) -> Response {
    let Ok((folder_id, filename)) = resolve_parent_and_name(state, principal, segments).await
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let Some(file) = find_file(state, principal.user_id, folder_id, &filename).await else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let lock_discoveries =
        if requested.props.contains(&DavProp::LockDiscovery) && !requested.propname {
            match active_lock_discoveries(state, principal.user_id).await {
                Ok(lock_discoveries) => lock_discoveries,
                Err(status) => return status.into_response(),
            }
        } else {
            HashMap::new()
        };
    let mut xml = multistatus_start();
    xml.push_str(&file_response(
        &segments[..segments.len() - 1],
        &file,
        requested,
        &lock_discoveries,
    ));
    xml.push_str(&xml_end("D:multistatus"));
    (
        StatusCode::MULTI_STATUS,
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        xml,
    )
        .into_response()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DavProp {
    DisplayName,
    ResourceType,
    ContentLength,
    ContentType,
    Etag,
    LastModified,
    CreationDate,
    SupportedLock,
    LockDiscovery,
}

#[derive(Debug, Clone)]
struct PropfindRequest {
    props: Vec<DavProp>,
    unsupported: Vec<String>,
    propname: bool,
}

fn default_propfind_request() -> PropfindRequest {
    PropfindRequest {
        props: vec![
            DavProp::DisplayName,
            DavProp::ResourceType,
            DavProp::ContentLength,
            DavProp::ContentType,
            DavProp::Etag,
            DavProp::LastModified,
            DavProp::CreationDate,
            DavProp::SupportedLock,
            DavProp::LockDiscovery,
        ],
        unsupported: Vec::new(),
        propname: false,
    }
}

fn default_props() -> Vec<DavProp> {
    vec![
        DavProp::DisplayName,
        DavProp::ResourceType,
        DavProp::ContentLength,
        DavProp::ContentType,
        DavProp::Etag,
        DavProp::LastModified,
        DavProp::CreationDate,
        DavProp::SupportedLock,
        DavProp::LockDiscovery,
    ]
}

async fn requested_propfind_props(body: Body) -> Result<PropfindRequest, StatusCode> {
    let Ok(bytes) = to_bytes(body, 64 * 1024).await else {
        return Err(StatusCode::BAD_REQUEST);
    };
    if bytes.is_empty() {
        return Ok(default_propfind_request());
    }
    let xml = std::str::from_utf8(&bytes).map_err(|_| StatusCode::BAD_REQUEST)?;
    parse_propfind_request(xml).map_err(|_| StatusCode::BAD_REQUEST)
}

fn parse_propfind_request(xml: &str) -> Result<PropfindRequest, quick_xml::Error> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut stack: Vec<String> = Vec::new();
    let mut props = Vec::new();
    let mut unsupported = Vec::new();

    loop {
        match reader.read_event()? {
            Event::Start(event) => {
                let name = xml_local_name(event.local_name().as_ref());
                if name == "propname" {
                    return Ok(PropfindRequest {
                        props: default_props(),
                        unsupported: Vec::new(),
                        propname: true,
                    });
                }
                if name == "allprop" {
                    return Ok(default_propfind_request());
                }
                if stack.last().is_some_and(|parent| parent == "prop") {
                    collect_propfind_property(&name, &mut props, &mut unsupported);
                }
                stack.push(name);
            }
            Event::Empty(event) => {
                let name = xml_local_name(event.local_name().as_ref());
                if name == "propname" {
                    return Ok(PropfindRequest {
                        props: default_props(),
                        unsupported: Vec::new(),
                        propname: true,
                    });
                }
                if name == "allprop" {
                    return Ok(default_propfind_request());
                }
                if stack.last().is_some_and(|parent| parent == "prop") {
                    collect_propfind_property(&name, &mut props, &mut unsupported);
                }
            }
            Event::End(_) => {
                let _ = stack.pop();
            }
            Event::Eof => {
                if !stack.is_empty() {
                    return Err(quick_xml::Error::IllFormed(
                        quick_xml::errors::IllFormedError::MissingEndTag(
                            stack.last().cloned().unwrap_or_default(),
                        ),
                    ));
                }
                break;
            }
            _ => {}
        }
    }

    if props.is_empty() && unsupported.is_empty() {
        Ok(default_propfind_request())
    } else {
        Ok(PropfindRequest {
            props,
            unsupported,
            propname: false,
        })
    }
}

fn xml_local_name(name: &[u8]) -> String {
    std::str::from_utf8(name)
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn collect_propfind_property(name: &str, props: &mut Vec<DavProp>, unsupported: &mut Vec<String>) {
    let prop = match name {
        "displayname" => Some(DavProp::DisplayName),
        "resourcetype" => Some(DavProp::ResourceType),
        "getcontentlength" => Some(DavProp::ContentLength),
        "getcontenttype" => Some(DavProp::ContentType),
        "getetag" => Some(DavProp::Etag),
        "getlastmodified" => Some(DavProp::LastModified),
        "creationdate" => Some(DavProp::CreationDate),
        "supportedlock" => Some(DavProp::SupportedLock),
        "lockdiscovery" => Some(DavProp::LockDiscovery),
        _ => None,
    };
    if let Some(prop) = prop {
        if !props.contains(&prop) {
            props.push(prop);
        }
        return;
    }
    if !matches!(name, "propfind" | "prop") && !unsupported.iter().any(|known| known == name) {
        unsupported.push(name.to_string());
    }
}

#[allow(dead_code)]
fn requested_xml_element_names(xml: &str) -> Vec<String> {
    let Ok(request) = parse_propfind_request(xml) else {
        return Vec::new();
    };
    request.unsupported
}

fn multistatus_start() -> String {
    build_xml_fragment(|writer| {
        writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("utf-8"), None)))?;
        let mut start = BytesStart::new("D:multistatus");
        start.push_attribute(("xmlns:D", "DAV:"));
        writer.write_event(Event::Start(start))?;
        Ok(())
    })
}

fn build_xml_fragment<F>(write: F) -> String
where
    F: FnOnce(&mut Writer<Vec<u8>>) -> Result<(), quick_xml::Error>,
{
    let mut writer = Writer::new(Vec::new());
    if write(&mut writer).is_err() {
        return String::new();
    }
    String::from_utf8(writer.into_inner()).unwrap_or_default()
}

fn xml_start(name: &str) -> String {
    build_xml_fragment(|writer| {
        writer.write_event(Event::Start(BytesStart::new(name)))?;
        Ok(())
    })
}

fn xml_end(name: &str) -> String {
    build_xml_fragment(|writer| {
        writer.write_event(Event::End(BytesEnd::new(name)))?;
        Ok(())
    })
}

fn xml_empty(name: &str) -> String {
    build_xml_fragment(|writer| {
        writer.write_event(Event::Empty(BytesStart::new(name)))?;
        Ok(())
    })
}

fn xml_text(name: &str, value: &str) -> String {
    build_xml_fragment(|writer| {
        writer
            .create_element(name)
            .write_text_content(BytesText::new(value))?;
        Ok(())
    })
}

fn xml_element(name: &str, body: &str) -> String {
    let mut xml = xml_start(name);
    xml.push_str(body);
    xml.push_str(&xml_end(name));
    xml
}

type LockDiscoveryByPath = HashMap<String, String>;

fn lock_path_for_child(segments: &[String], child: Option<&str>) -> String {
    let mut path_segments = segments.to_vec();
    if let Some(child) = child {
        path_segments.push(child.to_string());
    }
    lock_key(&path_segments)
}

fn collection_response(
    segments: &[String],
    child: Option<&str>,
    requested: &PropfindRequest,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
    lock_discoveries: &LockDiscoveryByPath,
) -> String {
    let displayname = child
        .map(str::to_string)
        .or_else(|| segments.last().cloned())
        .unwrap_or_else(|| "dav".to_string());
    let mut props = String::new();
    if requested.props.contains(&DavProp::DisplayName) {
        if requested.propname {
            props.push_str(&xml_empty("D:displayname"));
        } else {
            props.push_str(&xml_text("D:displayname", &displayname));
        }
    }
    if requested.props.contains(&DavProp::ResourceType) {
        if requested.propname {
            props.push_str(&xml_empty("D:resourcetype"));
        } else {
            props.push_str(&xml_element("D:resourcetype", &xml_empty("D:collection")));
        }
    }
    if requested.props.contains(&DavProp::LastModified) {
        if requested.propname {
            props.push_str(&xml_empty("D:getlastmodified"));
        } else if let Some(updated_at) = updated_at {
            props.push_str(&xml_text("D:getlastmodified", &updated_at.to_rfc2822()));
        }
    }
    if requested.props.contains(&DavProp::SupportedLock) {
        if requested.propname {
            props.push_str(&xml_empty("D:supportedlock"));
        } else {
            props.push_str(&supported_lock_xml());
        }
    }
    if requested.props.contains(&DavProp::LockDiscovery) {
        if requested.propname {
            props.push_str(&xml_empty("D:lockdiscovery"));
        } else {
            let path = lock_path_for_child(segments, child);
            if let Some(lock_discovery) = lock_discoveries.get(&path) {
                props.push_str(lock_discovery);
            } else {
                props.push_str(&xml_empty("D:lockdiscovery"));
            }
        }
    }
    let unsupported = unsupported_propstat(&requested.unsupported);
    response_xml(&dav_href(segments, child, true), &props, &unsupported)
}

fn file_response(
    segments: &[String],
    file: &crate::models::file::File,
    requested: &PropfindRequest,
    lock_discoveries: &LockDiscoveryByPath,
) -> String {
    let mut props = String::new();
    if requested.props.contains(&DavProp::DisplayName) {
        if requested.propname {
            props.push_str(&xml_empty("D:displayname"));
        } else {
            props.push_str(&xml_text("D:displayname", &file.original_filename));
        }
    }
    if requested.props.contains(&DavProp::ResourceType) {
        props.push_str(&xml_empty("D:resourcetype"));
    }
    if requested.props.contains(&DavProp::ContentLength) {
        if requested.propname {
            props.push_str(&xml_empty("D:getcontentlength"));
        } else {
            props.push_str(&xml_text("D:getcontentlength", &file.file_size.to_string()));
        }
    }
    if requested.props.contains(&DavProp::ContentType) {
        if requested.propname {
            props.push_str(&xml_empty("D:getcontenttype"));
        } else {
            props.push_str(&xml_text("D:getcontenttype", &file.mime_type));
        }
    }
    if requested.props.contains(&DavProp::Etag) {
        if requested.propname {
            props.push_str(&xml_empty("D:getetag"));
        } else {
            props.push_str(&xml_text(
                "D:getetag",
                &format!("\"{}-{}\"", file.id, file.updated_at.timestamp()),
            ));
        }
    }
    if requested.props.contains(&DavProp::LastModified) {
        if requested.propname {
            props.push_str(&xml_empty("D:getlastmodified"));
        } else {
            props.push_str(&xml_text(
                "D:getlastmodified",
                &file.updated_at.to_rfc2822(),
            ));
        }
    }
    if requested.props.contains(&DavProp::CreationDate) {
        if requested.propname {
            props.push_str(&xml_empty("D:creationdate"));
        } else {
            props.push_str(&xml_text("D:creationdate", &file.created_at.to_rfc3339()));
        }
    }
    if requested.props.contains(&DavProp::SupportedLock) {
        if requested.propname {
            props.push_str(&xml_empty("D:supportedlock"));
        } else {
            props.push_str(&supported_lock_xml());
        }
    }
    if requested.props.contains(&DavProp::LockDiscovery) {
        if requested.propname {
            props.push_str(&xml_empty("D:lockdiscovery"));
        } else {
            let path = lock_path_for_child(segments, Some(&file.original_filename));
            if let Some(lock_discovery) = lock_discoveries.get(&path) {
                props.push_str(lock_discovery);
            } else {
                props.push_str(&xml_empty("D:lockdiscovery"));
            }
        }
    }
    let unsupported = unsupported_propstat(&requested.unsupported);
    response_xml(
        &dav_href(segments, Some(&file.original_filename), false),
        &props,
        &unsupported,
    )
}

fn unsupported_propstat(names: &[String]) -> String {
    if names.is_empty() {
        return String::new();
    }
    let props = names
        .iter()
        .map(|name| xml_empty(&format!("D:{name}")))
        .collect::<String>();
    propstat_xml(&props, "HTTP/1.1 404 Not Found")
}

fn response_xml(href: &str, props: &str, unsupported: &str) -> String {
    let mut body = xml_text("D:href", href);
    body.push_str(&propstat_xml(props, "HTTP/1.1 200 OK"));
    body.push_str(unsupported);
    xml_element("D:response", &body)
}

fn propstat_xml(props: &str, status: &str) -> String {
    let mut body = xml_element("D:prop", props);
    body.push_str(&xml_text("D:status", status));
    xml_element("D:propstat", &body)
}

fn supported_lock_xml() -> String {
    let lock_scope = xml_element("D:lockscope", &xml_empty("D:exclusive"));
    let lock_type = xml_element("D:locktype", &xml_empty("D:write"));
    xml_element(
        "D:supportedlock",
        &xml_element("D:lockentry", &(lock_scope + &lock_type)),
    )
}

async fn mkcol(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    body: Body,
    headers: &HeaderMap,
) -> Response {
    let Ok(bytes) = to_bytes(body, 1).await else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    if !bytes.is_empty() {
        return StatusCode::UNSUPPORTED_MEDIA_TYPE.into_response();
    }
    if lock_conflicts(state, principal.user_id, segments, headers).await {
        return locked_response();
    }
    let Ok((parent_id, name)) = resolve_parent_and_name(state, principal, segments).await else {
        return StatusCode::CONFLICT.into_response();
    };
    match FolderService::from_state(state)
        .create_folder(principal.user_id, CreateFolderRequest { name, parent_id })
        .await
    {
        Ok(_) => StatusCode::CREATED.into_response(),
        Err(_) => StatusCode::CONFLICT.into_response(),
    }
}

async fn put_file(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    headers: &HeaderMap,
    body: Body,
) -> Response {
    if lock_conflicts(state, principal.user_id, segments, headers).await {
        return locked_response();
    }
    let Ok((folder_id, filename)) = resolve_parent_and_name(state, principal, segments).await
    else {
        return StatusCode::CONFLICT.into_response();
    };
    if is_macos_appledouble_filename(&filename) {
        tracing::info!(
            user_id = %principal.user_id,
            filename = %filename,
            "ignored macOS AppleDouble WebDAV upload"
        );
        return StatusCode::NO_CONTENT.into_response();
    }
    let mime_type = effective_file_mime_type(
        &filename,
        headers
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok()),
    );
    let temp = match NamedTempFile::new() {
        Ok(file) => file,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };
    let temp_path = temp.path().to_path_buf();
    let mut out = match tokio::fs::File::create(&temp_path).await {
        Ok(file) => file,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };
    let mut stream = body.into_data_stream();
    let mut file_size = 0u64;
    while let Some(chunk) = stream.next().await {
        let Ok(chunk) = chunk else {
            return StatusCode::BAD_REQUEST.into_response();
        };
        file_size = file_size.saturating_add(chunk.len() as u64);
        if file_size > state.config.storage.max_file_size {
            let _ = tokio::fs::remove_file(&temp_path).await;
            return StatusCode::PAYLOAD_TOO_LARGE.into_response();
        }
        if out.write_all(&chunk).await.is_err() {
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    }
    if out.flush().await.is_err() {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }
    drop(out);
    let input = CreateFileFromPathInput {
        user_id: principal.user_id,
        original_filename: filename,
        mime_type,
        file_size,
        source_path: temp.path(),
        content_sha256: None,
        folder_id,
    };
    match state.file_service.create_file_from_path(input).await {
        Ok(_) => {
            counter!("webdav_bytes_written_total").increment(file_size);
            bump_files_cache(state, principal.user_id).await;
            StatusCode::CREATED.into_response()
        }
        Err(_) => StatusCode::CONFLICT.into_response(),
    }
}

async fn get_file(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    headers: &HeaderMap,
    head_only: bool,
) -> Response {
    let Ok((folder_id, filename)) = resolve_parent_and_name(state, principal, segments).await
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let Some(file) = find_file(state, principal.user_id, folder_id, &filename).await else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let total = file.file_size.max(0) as u64;
    let mut status = StatusCode::OK;
    let mut start = 0;
    let mut end = total.saturating_sub(1);
    if let Some(range) = headers.get(header::RANGE).and_then(|v| v.to_str().ok()) {
        if let Some((s, e)) = parse_single_range(range, total) {
            status = StatusCode::PARTIAL_CONTENT;
            start = s;
            end = e;
        } else {
            return StatusCode::RANGE_NOT_SATISFIABLE.into_response();
        }
    }
    let len = if total == 0 { 0 } else { end - start + 1 };
    counter!("webdav_bytes_read_total").increment(len);
    let mut response = if head_only || total == 0 {
        (status, Body::empty()).into_response()
    } else if status == StatusCode::PARTIAL_CONTENT {
        match state
            .file_service
            .open_file_stream_range(&file, start, end)
            .await
        {
            Ok(stream) => (status, stream_body(stream, start, len).await).into_response(),
            Err(_) => {
                counter!("webdav_missing_storage_total").increment(1);
                return StatusCode::NOT_FOUND.into_response();
            }
        }
    } else {
        match state.file_service.open_file_stream(&file).await {
            Ok(stream) => (status, stream_body(stream, 0, len).await).into_response(),
            Err(_) => {
                counter!("webdav_missing_storage_total").increment(1);
                return StatusCode::NOT_FOUND.into_response();
            }
        }
    };
    let headers = response.headers_mut();
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&file.mime_type)
            .unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&(end.saturating_sub(start) + 1).to_string()).unwrap(),
    );
    if status == StatusCode::PARTIAL_CONTENT {
        headers.insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {start}-{end}/{total}")).unwrap(),
        );
    }
    response
}

async fn stream_body(stream: StorageReadStream, start: u64, len: u64) -> Body {
    match stream {
        StorageReadStream::Local(mut file) => {
            if start > 0 {
                let _ = file.seek(std::io::SeekFrom::Start(start)).await;
            }
            Body::from_stream(ReaderStream::new(file.take(len)))
        }
        StorageReadStream::S3(stream) => {
            Body::from_stream(ReaderStream::new(stream.into_async_read()))
        }
    }
}

async fn delete_path(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    headers: &HeaderMap,
) -> Response {
    if lock_conflicts(state, principal.user_id, segments, headers).await {
        return locked_response();
    }
    let Ok((folder_id, filename)) = resolve_parent_and_name(state, principal, segments).await
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if let Some(file) = find_file(state, principal.user_id, folder_id, &filename).await {
        return match state
            .file_service
            .delete_file(file.id, principal.user_id)
            .await
        {
            Ok(_) => {
                bump_files_cache(state, principal.user_id).await;
                StatusCode::NO_CONTENT.into_response()
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        };
    }
    if let Some(folder) = find_folder(state, principal.user_id, folder_id, &filename).await {
        if delete_folder_tree(state, principal.user_id, folder.id)
            .await
            .is_err()
        {
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        bump_files_cache(state, principal.user_id).await;
        return StatusCode::NO_CONTENT.into_response();
    }
    StatusCode::NOT_FOUND.into_response()
}

async fn move_path(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    headers: &HeaderMap,
) -> Response {
    if lock_conflicts(state, principal.user_id, segments, headers).await {
        return locked_response();
    }
    let Some(destination) = destination_segments(headers, segments) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let Ok(dest_segments) = path_segments(&destination) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    if lock_conflicts(state, principal.user_id, &dest_segments, headers).await {
        return locked_response();
    }
    let Ok((source_folder_id, source_name)) =
        resolve_parent_and_name(state, principal, segments).await
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let Ok((dest_folder_id, dest_name)) =
        resolve_parent_and_name(state, principal, &dest_segments).await
    else {
        return StatusCode::CONFLICT.into_response();
    };
    let overwrite = overwrite_allowed(headers);
    if source_folder_id == dest_folder_id && source_name == dest_name {
        return StatusCode::NO_CONTENT.into_response();
    }
    if let Some(file) = find_file(state, principal.user_id, source_folder_id, &source_name).await {
        if destination_exists(state, principal.user_id, dest_folder_id, &dest_name).await {
            if !overwrite {
                return StatusCode::PRECONDITION_FAILED.into_response();
            }
            if delete_destination(state, principal.user_id, dest_folder_id, &dest_name)
                .await
                .is_err()
            {
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        }
        if dest_name != source_name
            && state
                .file_service
                .rename_file(
                    principal.user_id,
                    file.id,
                    RenameFileRequest { name: dest_name },
                )
                .await
                .is_err()
        {
            return StatusCode::CONFLICT.into_response();
        }
        if dest_folder_id != source_folder_id {
            let repo = FoldersRepo::new(&state.pool);
            if repo
                .move_files_to_folder(principal.user_id, &[file.id], dest_folder_id)
                .await
                .is_err()
            {
                return StatusCode::CONFLICT.into_response();
            }
        }
        bump_files_cache(state, principal.user_id).await;
        return StatusCode::CREATED.into_response();
    }
    let Some(folder) = find_folder(state, principal.user_id, source_folder_id, &source_name).await
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if destination_exists(state, principal.user_id, dest_folder_id, &dest_name).await {
        if !overwrite {
            return StatusCode::PRECONDITION_FAILED.into_response();
        }
        if delete_destination(state, principal.user_id, dest_folder_id, &dest_name)
            .await
            .is_err()
        {
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    }
    let service = FolderService::from_state(state);
    if dest_name != source_name
        && service
            .rename_folder(
                principal.user_id,
                folder.id,
                RenameFolderRequest { name: dest_name },
            )
            .await
            .is_err()
    {
        return StatusCode::CONFLICT.into_response();
    }
    if dest_folder_id != source_folder_id
        && service
            .move_folder(
                principal.user_id,
                folder.id,
                MoveFolderRequest {
                    parent_id: dest_folder_id,
                },
            )
            .await
            .is_err()
    {
        return StatusCode::CONFLICT.into_response();
    }
    bump_files_cache(state, principal.user_id).await;
    StatusCode::CREATED.into_response()
}

async fn copy_path(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    headers: &HeaderMap,
) -> Response {
    if lock_conflicts(state, principal.user_id, segments, headers).await {
        return locked_response();
    }
    let Some(destination) = destination_segments(headers, segments) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let Ok(dest_segments) = path_segments(&destination) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    if lock_conflicts(state, principal.user_id, &dest_segments, headers).await {
        return locked_response();
    }
    let Ok((source_folder_id, source_name)) =
        resolve_parent_and_name(state, principal, segments).await
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let Ok((dest_folder_id, dest_name)) =
        resolve_parent_and_name(state, principal, &dest_segments).await
    else {
        return StatusCode::CONFLICT.into_response();
    };
    let overwrite = overwrite_allowed(headers);
    if destination_exists(state, principal.user_id, dest_folder_id, &dest_name).await {
        if !overwrite {
            return StatusCode::PRECONDITION_FAILED.into_response();
        }
        if delete_destination(state, principal.user_id, dest_folder_id, &dest_name)
            .await
            .is_err()
        {
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    }
    if let Some(file) = find_file(state, principal.user_id, source_folder_id, &source_name).await {
        return match copy_file_to_folder(state, principal.user_id, &file, dest_folder_id, dest_name)
            .await
        {
            Ok(_) => {
                bump_files_cache(state, principal.user_id).await;
                StatusCode::CREATED.into_response()
            }
            Err(_) => StatusCode::CONFLICT.into_response(),
        };
    }
    let Some(folder) = find_folder(state, principal.user_id, source_folder_id, &source_name).await
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    match copy_folder_tree(
        state,
        principal.user_id,
        folder.id,
        dest_folder_id,
        dest_name,
    )
    .await
    {
        Ok(_) => {
            bump_files_cache(state, principal.user_id).await;
            StatusCode::CREATED.into_response()
        }
        Err(_) => StatusCode::CONFLICT.into_response(),
    }
}

fn overwrite_allowed(headers: &HeaderMap) -> bool {
    headers
        .get("overwrite")
        .and_then(|v| v.to_str().ok())
        .map(|value| !value.eq_ignore_ascii_case("F"))
        .unwrap_or(true)
}

fn destination_segments(headers: &HeaderMap, source_segments: &[String]) -> Option<String> {
    let value = headers.get("destination")?.to_str().ok()?;
    if let Ok(url) = Url::parse(value) {
        return dav_relative_path_from_absolute_path(url.path());
    }
    if value.starts_with('/') {
        return dav_relative_path_from_absolute_path(value);
    }
    let relative = value.trim_start_matches('/');
    let mut destination = source_segments
        .iter()
        .take(source_segments.len().saturating_sub(1))
        .cloned()
        .collect::<Vec<_>>();
    destination.extend(
        relative
            .split('/')
            .filter(|segment| !segment.is_empty())
            .map(ToOwned::to_owned),
    );
    Some(destination.join("/"))
}

fn dav_relative_path_from_absolute_path(path: &str) -> Option<String> {
    let mut segments = path.trim_start_matches('/').split('/').peekable();
    while let Some(segment) = segments.next() {
        if segment == "dav" {
            return Some(segments.collect::<Vec<_>>().join("/"));
        }
    }
    None
}

async fn find_file(
    state: &AppState,
    user_id: Uuid,
    folder_id: Option<Uuid>,
    filename: &str,
) -> Option<crate::models::file::File> {
    state
        .file_service
        .find_file_by_name_and_folder(user_id, filename, folder_id)
        .await
        .ok()
        .flatten()
}

async fn find_folder(
    state: &AppState,
    user_id: Uuid,
    parent_id: Option<Uuid>,
    name: &str,
) -> Option<crate::models::folder::Folder> {
    FoldersRepo::new(&state.pool)
        .list_by_parent(user_id, parent_id)
        .await
        .ok()?
        .into_iter()
        .find(|folder| folder.name == name)
}

async fn destination_exists(
    state: &AppState,
    user_id: Uuid,
    folder_id: Option<Uuid>,
    name: &str,
) -> bool {
    find_file(state, user_id, folder_id, name).await.is_some()
        || find_folder(state, user_id, folder_id, name).await.is_some()
}

async fn delete_destination(
    state: &AppState,
    user_id: Uuid,
    folder_id: Option<Uuid>,
    name: &str,
) -> Result<(), ()> {
    if let Some(file) = find_file(state, user_id, folder_id, name).await {
        state
            .file_service
            .delete_file(file.id, user_id)
            .await
            .map_err(|_| ())?;
        return Ok(());
    }
    if let Some(folder) = find_folder(state, user_id, folder_id, name).await {
        delete_folder_tree(state, user_id, folder.id).await?;
        return Ok(());
    }
    Ok(())
}

async fn delete_folder_tree(state: &AppState, user_id: Uuid, folder_id: Uuid) -> Result<(), ()> {
    let repo = FoldersRepo::new(&state.pool);
    let folder_ids = repo
        .get_all_descendant_ids(folder_id, user_id)
        .await
        .map_err(|_| ())?;
    let file_ids = repo
        .get_all_file_ids_in_folders(user_id, &folder_ids)
        .await
        .map_err(|_| ())?;
    state
        .file_service
        .batch_delete(&file_ids, user_id)
        .await
        .map_err(|_| ())?;
    repo.delete(&folder_ids, user_id).await.map_err(|_| ())?;
    Ok(())
}

async fn copy_file_to_folder(
    state: &AppState,
    user_id: Uuid,
    file: &crate::models::file::File,
    folder_id: Option<Uuid>,
    filename: String,
) -> Result<(), ()> {
    let file_size = file.file_size.max(0) as u64;
    state
        .file_service
        .ensure_can_store_detailed(user_id, &file.mime_type, file_size)
        .await
        .map_err(|_| ())?;

    let file_id = Uuid::new_v4();
    let original_filename = filename;
    let sanitized_filename = sanitize_filename(&original_filename).map_err(|_| ())?;
    let storage_filename = format!("{file_id}_{sanitized_filename}");
    let file_path = state
        .storage
        .copy_file_to_user(&file.file_path, user_id, file_id, &storage_filename)
        .await
        .map_err(|_| ())?;

    let repo = SqlxFilesRepo::new_with_replica(state.pool.clone(), state.read_pool.clone());
    let inserted = repo
        .insert(
            file_id,
            user_id,
            &storage_filename,
            &original_filename,
            &file_path,
            file_size,
            &file.mime_type,
            &state.config.storage.backend,
            file.content_sha256.as_deref(),
            folder_id,
        )
        .await;

    let file_record = match inserted {
        Ok(file_record) => file_record,
        Err(_) => {
            let _ = state.storage.delete_file(&file_path).await;
            return Err(());
        }
    };

    if let Some(embedding_service) = &state.embedding_service {
        let task = EmbeddingTaskInput {
            embedding_service: embedding_service.clone(),
            storage: state.storage.clone(),
            file: file_record,
            mime_type: file.mime_type.clone(),
            original_filename,
            file_id,
            user_id,
            pool: state.pool.clone(),
        };
        tokio::spawn(async move {
            FileService::generate_embedding_with_content(task).await;
        });
    }

    state
        .file_service
        .enqueue_fulltext_index_task_best_effort(file_id, user_id)
        .await;
    Ok(())
}

async fn copy_folder_tree(
    state: &AppState,
    user_id: Uuid,
    source_folder_id: Uuid,
    destination_parent_id: Option<Uuid>,
    destination_name: String,
) -> Result<(), ()> {
    let folder_service = FolderService::from_state(state);
    let root = folder_service
        .create_folder(
            user_id,
            CreateFolderRequest {
                name: destination_name,
                parent_id: destination_parent_id,
            },
        )
        .await
        .map_err(|_| ())?;

    let repo = FoldersRepo::new(&state.pool);
    let mut pending = vec![(source_folder_id, root.id)];
    while let Some((source_id, dest_id)) = pending.pop() {
        let files = state
            .file_service
            .list_by_folder(user_id, Some(source_id))
            .await
            .map_err(|_| ())?;
        for file in files {
            copy_file_to_folder(
                state,
                user_id,
                &file,
                Some(dest_id),
                file.original_filename.clone(),
            )
            .await?;
        }

        let child_folders = repo
            .list_by_parent(user_id, Some(source_id))
            .await
            .map_err(|_| ())?;
        for child in child_folders {
            if child.id == root.id {
                continue;
            }
            let copied = folder_service
                .create_folder(
                    user_id,
                    CreateFolderRequest {
                        name: child.name,
                        parent_id: Some(dest_id),
                    },
                )
                .await
                .map_err(|_| ())?;
            pending.push((child.id, copied.id));
        }
    }
    Ok(())
}

async fn bump_files_cache(state: &AppState, user_id: Uuid) {
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
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

async fn lock_path(
    state: &AppState,
    principal: &WebDavPrincipal,
    segments: &[String],
    headers: &HeaderMap,
    body: Body,
) -> Response {
    let owner = match request_lock_owner(body).await {
        Ok(owner) => owner,
        Err(status) => return status.into_response(),
    };
    let path = lock_key(segments);
    if lock_conflicts(state, principal.user_id, segments, headers).await {
        return locked_response();
    }
    let token = format!("opaquelocktoken:{}", Uuid::new_v4());
    let depth = headers
        .get("depth")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("0")
        .to_string();
    let timeout_secs = parse_timeout_secs(headers);
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(timeout_secs);
    let refresh_tokens = request_lock_tokens(headers);
    for request_token in &refresh_tokens {
        let refreshed = sqlx::query_as::<_, (String, Option<String>)>(
            r#"
            UPDATE webdav_locks
            SET depth = $1, owner = COALESCE($2::text, owner), expires_at = $3, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $4
              AND api_token_id = $5
              AND path = $6
              AND token = $7
              AND expires_at > NOW()
            RETURNING token, owner
            "#,
        )
        .bind(&depth)
        .bind(owner.as_deref())
        .bind(expires_at)
        .bind(principal.user_id)
        .bind(principal.api_token_id)
        .bind(&path)
        .bind(request_token)
        .fetch_optional(&state.pool)
        .await;
        match refreshed {
            Ok(Some((token, owner))) => {
                return lock_response(&depth, timeout_secs, &token, owner.as_deref());
            }
            Ok(None) => {}
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        }
    }
    if !refresh_tokens.is_empty() {
        return locked_response();
    }
    if sqlx::query(
        "INSERT INTO webdav_locks (user_id, api_token_id, path, token, depth, owner, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(principal.user_id)
    .bind(principal.api_token_id)
    .bind(&path)
    .bind(&token)
    .bind(&depth)
    .bind(owner.as_deref())
    .bind(expires_at)
    .execute(&state.pool)
    .await
    .is_err()
    {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }
    lock_response(&depth, timeout_secs, &token, owner.as_deref())
}

async fn request_lock_owner(body: Body) -> Result<Option<String>, StatusCode> {
    let bytes = to_bytes(body, 64 * 1024)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    if bytes.is_empty() {
        return Ok(None);
    }
    let xml = std::str::from_utf8(&bytes).map_err(|_| StatusCode::BAD_REQUEST)?;
    parse_lock_owner(xml).map_err(|_| StatusCode::BAD_REQUEST)
}

fn parse_lock_owner(xml: &str) -> Result<Option<String>, quick_xml::Error> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut writer = Writer::new(Vec::new());
    let mut depth = 0usize;
    let mut owner_depth = None;

    loop {
        match reader.read_event()? {
            Event::Start(event) => {
                let is_owner = xml_local_name(event.local_name().as_ref()) == "owner";
                if owner_depth.is_some() {
                    writer.write_event(Event::Start(event.into_owned()))?;
                } else if is_owner {
                    owner_depth = Some(depth);
                }
                depth += 1;
            }
            Event::Empty(event) => {
                let is_owner = xml_local_name(event.local_name().as_ref()) == "owner";
                if owner_depth.is_some() {
                    writer.write_event(Event::Empty(event.into_owned()))?;
                } else if is_owner {
                    return Ok(Some(String::new()));
                }
            }
            Event::Text(event) if owner_depth.is_some() => {
                writer.write_event(Event::Text(event.into_owned()))?;
            }
            Event::CData(event) if owner_depth.is_some() => {
                writer.write_event(Event::CData(event.into_owned()))?;
            }
            Event::End(event) => {
                depth = depth.saturating_sub(1);
                if owner_depth == Some(depth) {
                    return Ok(Some(
                        String::from_utf8(writer.into_inner()).unwrap_or_default(),
                    ));
                }
                if owner_depth.is_some() {
                    writer.write_event(Event::End(event.into_owned()))?;
                }
            }
            Event::Eof => return Ok(None),
            _ => {}
        }
    }
}

async fn active_lock_discoveries(
    state: &AppState,
    user_id: Uuid,
) -> Result<LockDiscoveryByPath, StatusCode> {
    let rows: Vec<(String, String, String, Option<String>, i64)> = sqlx::query_as(
        r#"
        SELECT path,
               token,
               depth,
               owner,
               GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - NOW()))))::BIGINT AS timeout_secs
        FROM webdav_locks
        WHERE user_id = $1
          AND expires_at > NOW()
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(rows
        .into_iter()
        .map(|(path, token, depth, owner, timeout_secs)| {
            (
                path,
                active_lock_xml(&depth, timeout_secs, &token, owner.as_deref()),
            )
        })
        .collect())
}

fn active_lock_xml(depth: &str, timeout_secs: i64, token: &str, owner: Option<&str>) -> String {
    let mut active_lock = format!(
        r#"<D:activelock><D:locktype><D:write/></D:locktype><D:lockscope><D:exclusive/></D:lockscope><D:depth>{}</D:depth>"#,
        escape_xml(depth)
    );
    if let Some(owner) = owner {
        if owner.is_empty() {
            active_lock.push_str(&xml_empty("D:owner"));
        } else {
            active_lock.push_str(&xml_element("D:owner", owner));
        }
    }
    active_lock.push_str(&format!(
        r#"<D:timeout>Second-{}</D:timeout><D:locktoken><D:href>{}</D:href></D:locktoken></D:activelock>"#,
        timeout_secs,
        escape_xml(token)
    ));
    xml_element("D:lockdiscovery", &active_lock)
}

fn lock_response(depth: &str, timeout_secs: i64, token: &str, owner: Option<&str>) -> Response {
    let body = format!(
        r#"<?xml version="1.0" encoding="utf-8"?><D:prop xmlns:D="DAV:">{}</D:prop>"#,
        active_lock_xml(depth, timeout_secs, token, owner)
    );
    let mut response = (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        body,
    )
        .into_response();
    response.headers_mut().insert(
        axum::http::HeaderName::from_static("lock-token"),
        HeaderValue::from_str(&format!("<{token}>")).unwrap(),
    );
    response
}

async fn unlock_path(
    state: &AppState,
    principal: &WebDavPrincipal,
    headers: &HeaderMap,
) -> Response {
    let Some(token) = header_lock_token(headers) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    match sqlx::query(
        "DELETE FROM webdav_locks WHERE user_id = $1 AND api_token_id = $2 AND token = $3",
    )
    .bind(principal.user_id)
    .bind(principal.api_token_id)
    .bind(token)
    .execute(&state.pool)
    .await
    {
        Ok(result) if result.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => StatusCode::NOT_FOUND.into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

fn locked_response() -> Response {
    StatusCode::from_u16(423).unwrap().into_response()
}

fn parse_timeout_secs(headers: &HeaderMap) -> i64 {
    headers
        .get("timeout")
        .and_then(|v| v.to_str().ok())
        .and_then(|value| {
            value
                .split(',')
                .find_map(|part| part.trim().strip_prefix("Second-"))
        })
        .and_then(|seconds| seconds.parse::<i64>().ok())
        .map(|seconds| seconds.clamp(1, MAX_LOCK_TIMEOUT_SECS))
        .unwrap_or(DEFAULT_LOCK_TIMEOUT_SECS)
}

async fn lock_conflicts(
    state: &AppState,
    user_id: Uuid,
    segments: &[String],
    headers: &HeaderMap,
) -> bool {
    let request_tokens = request_lock_tokens(headers);
    let path = lock_key(segments);
    let rows: Vec<(String, String, String)> = sqlx::query_as(
        r#"
        SELECT path, token, depth
        FROM webdav_locks
        WHERE user_id = $1
          AND expires_at > NOW()
          AND (
              path = $2
              OR starts_with(path, $2 || '/')
              OR (lower(depth) = 'infinity' AND starts_with($2, path || '/'))
          )
        "#,
    )
    .bind(user_id)
    .bind(&path)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();
    let conflict = rows.into_iter().any(|(locked_path, token, depth)| {
        lock_applies_to_path(&locked_path, &depth, &path)
            && !request_tokens.iter().any(|t| t == &token)
    });
    if conflict {
        counter!("webdav_lock_conflict_total").increment(1);
    }
    conflict
}

fn lock_applies_to_path(locked_path: &str, depth: &str, request_path: &str) -> bool {
    locked_path == request_path
        || locked_path.starts_with(&format!("{request_path}/"))
        || (depth.eq_ignore_ascii_case("infinity")
            && request_path.starts_with(&format!("{locked_path}/")))
}

fn lock_key(segments: &[String]) -> String {
    if segments.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", segments.join("/"))
    }
}

fn header_lock_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("lock-token")
        .and_then(|v| v.to_str().ok())
        .map(|value| value.trim().trim_matches(['<', '>']).to_string())
}

fn request_lock_tokens(headers: &HeaderMap) -> Vec<String> {
    let mut tokens = Vec::new();
    if let Some(token) = header_lock_token(headers) {
        tokens.push(token);
    }
    if let Some(value) = headers.get("if").and_then(|v| v.to_str().ok()) {
        let mut rest = value;
        while let Some(start) = rest.find('<') {
            rest = &rest[start + 1..];
            let Some(end) = rest.find('>') else {
                break;
            };
            tokens.push(rest[..end].to_string());
            rest = &rest[end + 1..];
        }
    }
    tokens
}

fn parse_single_range(range: &str, total: u64) -> Option<(u64, u64)> {
    if total == 0 {
        return None;
    }
    let value = range.strip_prefix("bytes=")?;
    let (start, end) = value.split_once('-')?;
    if start.is_empty() {
        let suffix_len = end.parse::<u64>().ok()?;
        if suffix_len == 0 {
            return None;
        }
        let start = total.saturating_sub(suffix_len);
        return Some((start, total - 1));
    }
    let start = start.parse::<u64>().ok()?;
    let end = if end.is_empty() {
        total.checked_sub(1)?
    } else {
        end.parse::<u64>().ok()?
    };
    if start > end || end >= total {
        return None;
    }
    Some((start, end))
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn dav_href(segments: &[String], child: Option<&str>, is_collection: bool) -> String {
    let mut href = String::from("/dav");
    for segment in segments {
        href.push('/');
        href.push_str(&utf8_percent_encode(segment, DAV_PATH_SEGMENT_ENCODE_SET).to_string());
    }
    if let Some(child) = child {
        href.push('/');
        href.push_str(&utf8_percent_encode(child, DAV_PATH_SEGMENT_ENCODE_SET).to_string());
    }
    if is_collection {
        href.push('/');
    }
    href
}
