//! 文件内容提取服务
//!
//! 从各种文件格式中提取文本内容，用于语义搜索。

use std::path::Path;

use crate::utils::AppError;

/// 文件内容提取器
pub struct FileContentExtractor;

impl FileContentExtractor {
    /// 从文件数据中提取文本内容
    ///
    /// # 参数
    /// - `data`: 文件二进制数据
    /// - `mime_type`: MIME 类型
    /// - `original_filename`: 原始文件名（用于格式推断）
    ///
    /// # 返回
    /// - `Ok(String)`: 提取的文本内容
    /// - `Err(AppError)`: 提取失败或格式不支持
    pub fn extract_text(
        data: &[u8],
        mime_type: &str,
        original_filename: &str,
    ) -> Result<String, AppError> {
        // 根据 MIME 类型选择提取方法
        match mime_type {
            // 纯文本类型
            mime if mime.starts_with("text/") => Self::extract_text_content(data),
            // Markdown
            "text/markdown" | "text/x-markdown" => Self::extract_text_content(data),
            // JSON
            "application/json" => Self::extract_text_content(data),
            // PDF
            "application/pdf" => Self::extract_pdf_content(data),
            // Word (docx)
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => {
                Self::extract_docx_content(data)
            }
            // 旧版 Word (doc) - 需要额外库，暂时跳过
            "application/msword" => {
                tracing::warn!("DOC format not supported yet, skipping content extraction");
                Ok(String::new())
            }
            // Excel (xlsx) - 可以提取文本，但格式复杂
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => {
                Self::extract_xlsx_content(data)
            }
            // PowerPoint (pptx)
            "application/vnd.openxmlformats-officedocument.presentationml.presentation" => {
                Self::extract_pptx_content(data)
            }
            // HTML
            "text/html" => Self::extract_html_content(data),
            // XML
            "application/xml" | "text/xml" => Self::extract_text_content(data),
            // 其他：尝试按文件名扩展名推断
            _ => Self::extract_by_extension(data, original_filename),
        }
    }

    /// 提取纯文本内容（UTF-8 或自动检测编码）
    fn extract_text_content(data: &[u8]) -> Result<String, AppError> {
        // 尝试 UTF-8
        if let Ok(text) = String::from_utf8(data.to_vec()) {
            return Ok(text);
        }

        // 尝试检测编码（使用 encoding_rs）
        let encoding = encoding_rs::Encoding::for_bom(data)
            .map(|(enc, _)| enc)
            .unwrap_or(encoding_rs::UTF_8);
        let (text, _, _) = encoding.decode(data);

        Ok(text.into_owned())
    }

    /// 提取 PDF 内容
    fn extract_pdf_content(data: &[u8]) -> Result<String, AppError> {
        use pdf_extract;

        // pdf-extract 可以直接从内存中的字节数据提取文本
        let text = pdf_extract::extract_text_from_mem(data)
            .map_err(|e| AppError::File(format!("PDF 解析失败: {}", e)))?;

        Ok(text)
    }

    /// 提取 DOCX 内容
    fn extract_docx_content(data: &[u8]) -> Result<String, AppError> {
        use docx_lite::extract_text;
        use std::io::Write;

        // docx-lite 需要文件路径，因此先写入临时文件
        let temp_dir = std::env::temp_dir().join("file-storage-backend-docx");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| AppError::File(format!("创建临时目录失败: {}", e)))?;

        let temp_file = temp_dir.join(format!("docx_{}", uuid::Uuid::new_v4()));
        let mut file = std::fs::File::create(&temp_file)
            .map_err(|e| AppError::File(format!("创建临时文件失败: {}", e)))?;

        file.write_all(data)
            .map_err(|e| AppError::File(format!("写入临时文件失败: {}", e)))?;
        file.flush()
            .map_err(|e| AppError::File(format!("刷新临时文件失败: {}", e)))?;
        drop(file); // 确保文件已关闭

        // 提取文本
        let text = extract_text(&temp_file)
            .map_err(|e| AppError::File(format!("DOCX 解析失败: {}", e)))?;

        // 清理临时文件
        let _ = std::fs::remove_file(&temp_file);

        Ok(text)
    }

    /// 提取 XLSX 内容（简化版，只提取文本单元格）
    fn extract_xlsx_content(_data: &[u8]) -> Result<String, AppError> {
        // XLSX 解析比较复杂，这里使用简化方法
        // 实际项目中可能需要使用专门的 Excel 解析库（如 calamine）
        // 暂时返回空字符串，后续可以扩展
        tracing::warn!("XLSX content extraction not fully implemented yet");
        Ok(String::new())
    }

    /// 提取 PPTX 内容
    fn extract_pptx_content(_data: &[u8]) -> Result<String, AppError> {
        // PPTX 解析比较复杂，暂时跳过
        tracing::warn!("PPTX content extraction not implemented yet");
        Ok(String::new())
    }

    /// 提取 HTML 内容（去除标签，只保留文本）
    fn extract_html_content(data: &[u8]) -> Result<String, AppError> {
        let html = String::from_utf8_lossy(data);

        // 简单的 HTML 标签去除（可以使用更专业的库如 scraper）
        let mut text = String::new();
        let mut in_tag = false;

        for ch in html.chars() {
            match ch {
                '<' => in_tag = true,
                '>' => in_tag = false,
                _ if !in_tag => text.push(ch),
                _ => {}
            }
        }

        // 清理多余的空白字符
        let text = text
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n");

        Ok(text)
    }

    /// 根据文件扩展名推断格式并提取
    fn extract_by_extension(data: &[u8], filename: &str) -> Result<String, AppError> {
        let ext = Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match ext.as_str() {
            "txt" | "md" | "markdown" | "json" | "xml" | "csv" | "log" => {
                Self::extract_text_content(data)
            }
            "pdf" => Self::extract_pdf_content(data),
            "docx" => Self::extract_docx_content(data),
            "html" | "htm" => Self::extract_html_content(data),
            _ => {
                // 未知格式，尝试作为文本读取（可能失败）
                tracing::debug!("Unknown file extension: {}, trying as text", ext);
                Self::extract_text_content(data).or_else(|_| {
                    tracing::warn!("Failed to extract content from file: {}", filename);
                    Ok(String::new())
                })
            }
        }
    }

    /// 组合文件名和内容生成搜索文本
    ///
    /// 用于生成向量嵌入，包含文件名和文件内容的关键信息
    pub fn combine_for_embedding(filename: &str, content: &str) -> String {
        // 限制内容长度（避免超出模型输入限制）
        const MAX_CONTENT_LENGTH: usize = 2000; // 根据模型调整

        let content_preview = if content.len() > MAX_CONTENT_LENGTH {
            &content[..MAX_CONTENT_LENGTH]
        } else {
            content
        };

        // 组合格式：文件名 + 内容预览
        format!("文件名: {}\n内容: {}", filename, content_preview)
    }
}
