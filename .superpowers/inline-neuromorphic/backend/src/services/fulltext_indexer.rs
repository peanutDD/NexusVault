use metrics::counter;
use serde_json::json;
use uuid::Uuid;

use crate::{
    services::{
        activity::{AuditEventInput, AuditService},
        file_content_extractor::FileContentExtractor,
        fulltext_search::SearchDocument,
        ocr::{OcrExtractor, OcrOptions, OcrStatus},
    },
    utils::AppError,
    AppState,
};

pub struct FulltextIndexer<'a> {
    state: &'a AppState,
}

impl<'a> FulltextIndexer<'a> {
    pub fn new(state: &'a AppState) -> Self {
        Self { state }
    }

    pub async fn index_file(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let file = self.state.file_service.get_file(file_id, user_id).await?;
        let data = self.state.file_service.get_file_data(&file).await?;
        let extracted =
            FileContentExtractor::extract_text(&data, &file.mime_type, &file.original_filename)
                .unwrap_or_default();
        let ocr = OcrExtractor::extract_with_options(
            &data,
            &file.mime_type,
            &file.original_filename,
            OcrOptions {
                enabled: self.state.config.search.ocr_enabled,
                tesseract_bin: self.state.config.search.ocr_tesseract_bin.clone(),
                pdftoppm_bin: self.state.config.search.ocr_pdftoppm_bin.clone(),
                pdf_max_pages: self.state.config.search.ocr_pdf_max_pages,
            },
        )?;

        // OCR is best-effort: disabled, unsupported, and missing dependencies
        // are observable statuses, not reasons to fail the indexing worker.
        counter!("fulltext_ocr_status_total", "status" => ocr.status.as_str()).increment(1);
        tracing::info!(
            file_id = %file.id,
            user_id = %file.user_id,
            ocr_status = ocr.status.as_str(),
            "fulltext OCR extraction status"
        );

        let original_filename = file.original_filename.clone();
        let mime_type = file.mime_type.clone();
        let category = file.category.clone().unwrap_or_default();
        let extracted_len = extracted.chars().count();
        let ocr_len = ocr.text.chars().count();
        let ocr_status = ocr.status;
        AuditService::from_state(self.state)
            .record_lenient(AuditEventInput {
                user_id: file.user_id,
                actor_type: "system",
                actor_user_id: None,
                source: "worker",
                event_type: ocr_event_type(ocr_status),
                target_type: "file",
                file_id: Some(file.id),
                folder_id: file.folder_id,
                share_id: None,
                file_request_id: None,
                api_token_id: None,
                status: None,
                ip_address: None,
                user_agent: None,
                metadata: json!({
                    "filename": original_filename,
                    "mime_type": mime_type.clone(),
                    "ocr_status": ocr_status.as_str(),
                    "ocr_text_length": ocr_len,
                }),
            })
            .await;

        let result = self.state.search_index.upsert_document(SearchDocument {
            file_id: file.id,
            user_id: file.user_id,
            filename: original_filename.clone(),
            path: format!("/{original_filename}"),
            extracted_text: extracted,
            ocr_text: ocr.text,
            category,
            mime_type: mime_type.clone(),
        });

        match result {
            Ok(()) => {
                AuditService::from_state(self.state)
                    .record_lenient(AuditEventInput {
                        user_id: file.user_id,
                        actor_type: "system",
                        actor_user_id: None,
                        source: "worker",
                        event_type: "fulltext.indexed",
                        target_type: "file",
                        file_id: Some(file.id),
                        folder_id: file.folder_id,
                        share_id: None,
                        file_request_id: None,
                        api_token_id: None,
                        status: None,
                        ip_address: None,
                        user_agent: None,
                        metadata: json!({
                            "filename": original_filename,
                            "mime_type": mime_type.clone(),
                            "extracted_text_length": extracted_len,
                            "ocr_status": ocr_status.as_str(),
                            "ocr_text_length": ocr_len,
                        }),
                    })
                    .await;
                Ok(())
            }
            Err(error) => {
                AuditService::from_state(self.state)
                    .record_lenient(AuditEventInput {
                        user_id: file.user_id,
                        actor_type: "system",
                        actor_user_id: None,
                        source: "worker",
                        event_type: "fulltext.failed",
                        target_type: "file",
                        file_id: Some(file.id),
                        folder_id: file.folder_id,
                        share_id: None,
                        file_request_id: None,
                        api_token_id: None,
                        status: None,
                        ip_address: None,
                        user_agent: None,
                        metadata: json!({
                            "filename": original_filename,
                            "mime_type": mime_type.clone(),
                            "error": error.to_string(),
                        }),
                    })
                    .await;
                Err(error)
            }
        }
    }
}

fn ocr_event_type(status: OcrStatus) -> &'static str {
    match status {
        OcrStatus::Completed => "ocr.completed",
        OcrStatus::Failed => "ocr.failed",
        OcrStatus::Disabled | OcrStatus::Unsupported | OcrStatus::DependencyMissing => {
            "ocr.skipped"
        }
    }
}
