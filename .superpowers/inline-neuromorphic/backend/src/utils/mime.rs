pub fn effective_file_mime_type(filename: &str, supplied_mime_type: Option<&str>) -> String {
    let supplied = supplied_mime_type
        .map(str::trim)
        .filter(|mime| !mime.is_empty())
        .unwrap_or("application/octet-stream");

    if is_generic_mime_type(supplied) {
        if let Some(guessed) = mime_guess::from_path(filename).first_raw() {
            return guessed.to_string();
        }
    }

    supplied.to_string()
}

pub fn is_generic_mime_type(mime_type: &str) -> bool {
    let value = mime_type.trim();
    value.is_empty()
        || value.eq_ignore_ascii_case("application/octet-stream")
        || value.eq_ignore_ascii_case("binary/octet-stream")
}

pub fn sniff_mime_type_from_bytes(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff {
        return Some("image/jpeg");
    }
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some("image/png");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    if bytes.starts_with(b"%PDF-") {
        return Some("application/pdf");
    }
    if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
        return if &bytes[8..12] == b"qt  " {
            Some("video/quicktime")
        } else {
            Some("video/mp4")
        };
    }
    if bytes.starts_with(b"\x1a\x45\xdf\xa3")
        && bytes
            .windows(4)
            .take(128)
            .any(|window| window.eq_ignore_ascii_case(b"webm"))
    {
        return Some("video/webm");
    }
    if bytes.starts_with(b"ID3")
        || (bytes.len() >= 2 && bytes[0] == 0xff && matches!(bytes[1] & 0xe0, 0xe0))
    {
        return Some("audio/mpeg");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WAVE" {
        return Some("audio/wav");
    }
    None
}

pub fn normalize_filename_extension(filename: &str, mime_type: &str) -> String {
    if std::path::Path::new(filename).extension().is_some() {
        return filename.to_string();
    }

    let Some(extension) = extension_for_mime_type(mime_type) else {
        return filename.to_string();
    };

    format!("{filename}.{extension}")
}

pub fn extension_for_mime_type(mime_type: &str) -> Option<&'static str> {
    match mime_type.trim().to_ascii_lowercase().as_str() {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/gif" => Some("gif"),
        "image/webp" => Some("webp"),
        "video/mp4" => Some("mp4"),
        "video/quicktime" => Some("mov"),
        "video/webm" => Some("webm"),
        "audio/mpeg" => Some("mp3"),
        "audio/wav" | "audio/x-wav" => Some("wav"),
        "application/pdf" => Some("pdf"),
        _ => None,
    }
}

pub fn is_macos_appledouble_filename(filename: &str) -> bool {
    filename.starts_with("._") || filename == ".DS_Store"
}
