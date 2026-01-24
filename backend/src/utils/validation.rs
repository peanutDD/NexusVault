use crate::utils::AppError;

pub fn sanitize_filename(filename: &str) -> Result<String, AppError> {
    // Remove path components and dangerous characters
    let sanitized = filename
        .replace("..", "")
        .replace("/", "")
        .replace("\\", "")
        .replace("\0", "")
        .trim()
        .to_string();

    if sanitized.is_empty() {
        return Err(AppError::Validation("Invalid filename".to_string()));
    }

    Ok(sanitized)
}

pub fn validate_mime_type(mime_type: &str, allowed_types: &[String]) -> Result<(), AppError> {
    for allowed in allowed_types {
        if allowed.ends_with("/*") {
            let prefix = allowed.trim_end_matches("/*");
            if mime_type.starts_with(prefix) {
                return Ok(());
            }
        } else if mime_type == allowed {
            return Ok(());
        }
    }

    Err(AppError::Validation(format!(
        "File type {} is not allowed",
        mime_type
    )))
}

pub fn validate_file_size(size: u64, max_size: u64) -> Result<(), AppError> {
    if size > max_size {
        Err(AppError::Validation(format!(
            "File size {} exceeds maximum allowed size {}",
            size, max_size
        )))
    } else {
        Ok(())
    }
}
