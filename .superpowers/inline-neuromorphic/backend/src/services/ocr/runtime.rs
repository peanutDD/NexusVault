use std::{io::ErrorKind, path::Path, process::Command};

use crate::{
    services::ocr::{outcome, OcrOutcome, OcrStatus},
    utils::AppError,
};

const TESSERACT_LANGUAGE: &str = "eng";

pub(super) fn command_available(bin: &str) -> bool {
    ["--version", "-v"].into_iter().any(|flag| {
        Command::new(bin)
            .arg(flag)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    })
}

pub(super) fn run_tesseract(input: &Path, tesseract_bin: &str) -> Result<OcrOutcome, AppError> {
    // Runtime v1 intentionally uses English OCR only; adding multi-language
    // support requires installing language packs and exposing a config knob.
    let output = Command::new(tesseract_bin)
        .arg(input)
        .arg("stdout")
        .arg("-l")
        .arg(TESSERACT_LANGUAGE)
        .output();

    match output {
        Ok(output) if output.status.success() => Ok(outcome(
            OcrStatus::Completed,
            String::from_utf8_lossy(&output.stdout).trim(),
        )),
        Ok(output) => {
            tracing::warn!(
                status = ?output.status.code(),
                stderr = %String::from_utf8_lossy(&output.stderr),
                "OCR command failed"
            );
            Ok(outcome(OcrStatus::Failed, ""))
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {
            tracing::warn!(tesseract_bin, "OCR dependency missing");
            Ok(outcome(OcrStatus::DependencyMissing, ""))
        }
        Err(error) => Err(AppError::File(format!("运行 OCR 失败: {error}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::command_available;

    #[test]
    fn command_available_accepts_tools_that_only_support_dash_v() {
        let temp = tempfile::tempdir().unwrap();
        let script = temp.path().join("pdftoppm-like");
        std::fs::write(
            &script,
            "#!/bin/sh\nif [ \"$1\" = \"-v\" ]; then exit 0; fi\nexit 1\n",
        )
        .unwrap();
        make_executable(&script);

        assert!(command_available(script.to_string_lossy().as_ref()));
    }

    #[test]
    fn command_available_rejects_missing_binary() {
        assert!(!command_available("/definitely/missing/ocr-command"));
    }

    #[cfg(unix)]
    fn make_executable(path: &std::path::Path) {
        use std::os::unix::fs::PermissionsExt;

        let mut permissions = std::fs::metadata(path).unwrap().permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(path, permissions).unwrap();
    }

    #[cfg(not(unix))]
    fn make_executable(_path: &std::path::Path) {}
}
