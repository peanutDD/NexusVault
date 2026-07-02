//! 文件内容提取服务
//!
//! 从各种文件格式中提取文本内容，用于语义搜索。

use std::{
    io::{Cursor, Read},
    path::Path,
};

use flate2::read::{DeflateDecoder, ZlibDecoder};
use quick_xml::{
    events::{BytesRef, Event},
    reader::Reader,
};
use zip::ZipArchive;

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
        let mut chunks = extract_pdf_literals(data);
        for stream in extract_pdf_flate_streams(data) {
            chunks.extend(extract_pdf_literals(&stream));
        }
        Ok(chunks.join("\n"))
    }

    /// 提取 DOCX 内容
    fn extract_docx_content(data: &[u8]) -> Result<String, AppError> {
        let reader = Cursor::new(data);
        let mut archive =
            ZipArchive::new(reader).map_err(|e| AppError::File(format!("DOCX 解析失败: {}", e)))?;
        let mut document = archive
            .by_name("word/document.xml")
            .map_err(|e| AppError::File(format!("DOCX 缺少主文档: {}", e)))?;
        let mut xml = String::new();
        document
            .read_to_string(&mut xml)
            .map_err(|e| AppError::File(format!("DOCX 文本读取失败: {}", e)))?;
        extract_docx_document_text(&xml)
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

fn extract_docx_document_text(xml: &str) -> Result<String, AppError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut in_text = 0usize;
    let mut text = String::new();

    loop {
        match reader
            .read_event()
            .map_err(|e| AppError::File(format!("DOCX XML 解析失败: {}", e)))?
        {
            Event::Start(event) if xml_local_name(event.local_name().as_ref()) == "t" => {
                in_text += 1;
            }
            Event::Empty(event) => match xml_local_name(event.local_name().as_ref()).as_str() {
                "tab" => text.push('\t'),
                "br" | "cr" => text.push('\n'),
                _ => {}
            },
            Event::Text(event) if in_text > 0 => {
                text.push_str(
                    &event
                        .decode()
                        .map_err(|e| AppError::File(format!("DOCX 文本解码失败: {}", e)))?,
                );
            }
            Event::CData(event) if in_text > 0 => {
                text.push_str(
                    &event
                        .decode()
                        .map_err(|e| AppError::File(format!("DOCX CDATA 解码失败: {}", e)))?,
                );
            }
            Event::GeneralRef(event) if in_text > 0 => {
                text.push_str(&decode_xml_general_ref(&event)?);
            }
            Event::End(event) => match xml_local_name(event.local_name().as_ref()).as_str() {
                "t" => in_text = in_text.saturating_sub(1),
                "p" if !text.ends_with('\n') => text.push('\n'),
                _ => {}
            },
            Event::Eof => break,
            _ => {}
        }
    }

    Ok(text.trim().to_string())
}

fn decode_xml_general_ref(reference: &BytesRef<'_>) -> Result<String, AppError> {
    let value = reference
        .decode()
        .map_err(|e| AppError::File(format!("DOCX entity 解码失败: {}", e)))?;

    let resolved = match value.as_ref() {
        "amp" => "&".to_string(),
        "lt" => "<".to_string(),
        "gt" => ">".to_string(),
        "quot" => "\"".to_string(),
        "apos" => "'".to_string(),
        value if value.starts_with("#x") || value.starts_with("#X") => {
            let code = u32::from_str_radix(&value[2..], 16)
                .ok()
                .and_then(char::from_u32);
            code.map(|ch| ch.to_string())
                .unwrap_or_else(|| format!("&{};", value))
        }
        value if value.starts_with('#') => {
            let code = value[1..].parse::<u32>().ok().and_then(char::from_u32);
            code.map(|ch| ch.to_string())
                .unwrap_or_else(|| format!("&{};", value))
        }
        value => format!("&{};", value),
    };

    Ok(resolved)
}

fn xml_local_name(name: &[u8]) -> String {
    let raw = std::str::from_utf8(name).unwrap_or_default();
    raw.rsplit(':').next().unwrap_or(raw).to_ascii_lowercase()
}

fn extract_pdf_literals(data: &[u8]) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut index = 0usize;

    while index < data.len() {
        match data[index] {
            b'(' => {
                if let Some((value, next)) = parse_pdf_literal(data, index + 1) {
                    push_pdf_text_chunk(&mut chunks, value);
                    index = next;
                    continue;
                }
            }
            b'<' if data.get(index + 1) != Some(&b'<') => {
                if let Some((value, next)) = parse_pdf_hex_string(data, index + 1) {
                    push_pdf_text_chunk(&mut chunks, value);
                    index = next;
                    continue;
                }
            }
            _ => {}
        }
        index += 1;
    }

    chunks
}

fn extract_pdf_flate_streams(data: &[u8]) -> Vec<Vec<u8>> {
    let mut decoded_streams = Vec::new();
    let mut index = 0usize;

    while let Some(stream_keyword) = find_pdf_keyword(data, b"stream", index) {
        let stream_start = pdf_stream_data_start(data, stream_keyword + b"stream".len());
        let Some(endstream_keyword) = find_pdf_keyword(data, b"endstream", stream_start) else {
            break;
        };
        index = endstream_keyword + b"endstream".len();

        if !pdf_stream_has_flate_filter(data, stream_keyword) {
            continue;
        }

        let stream_end = pdf_stream_data_end(data, endstream_keyword);
        if let Some(decoded) = decode_pdf_flate_stream(&data[stream_start..stream_end]) {
            decoded_streams.push(decoded);
        }
    }

    decoded_streams
}

fn pdf_stream_has_flate_filter(data: &[u8], stream_keyword: usize) -> bool {
    let Some(dict_start) = rfind_bytes(&data[..stream_keyword], b"<<") else {
        return false;
    };
    let Some(dict_end) = rfind_bytes(&data[..stream_keyword], b">>") else {
        return false;
    };
    dict_start < dict_end
        && data[dict_start..dict_end]
            .windows(b"/FlateDecode".len())
            .any(|window| window == b"/FlateDecode")
}

fn pdf_stream_data_start(data: &[u8], mut index: usize) -> usize {
    while matches!(data.get(index), Some(b' ' | b'\t')) {
        index += 1;
    }

    match (data.get(index), data.get(index + 1)) {
        (Some(b'\r'), Some(b'\n')) => index + 2,
        (Some(b'\r' | b'\n'), _) => index + 1,
        _ => index,
    }
}

fn pdf_stream_data_end(data: &[u8], mut index: usize) -> usize {
    while index > 0 && matches!(data.get(index - 1), Some(b'\r' | b'\n')) {
        index -= 1;
    }
    index
}

fn decode_pdf_flate_stream(stream: &[u8]) -> Option<Vec<u8>> {
    let mut decoded = Vec::new();
    if ZlibDecoder::new(stream).read_to_end(&mut decoded).is_ok() {
        return Some(decoded);
    }

    let mut decoded = Vec::new();
    if DeflateDecoder::new(stream)
        .read_to_end(&mut decoded)
        .is_ok()
    {
        return Some(decoded);
    }

    None
}

fn find_pdf_keyword(data: &[u8], keyword: &[u8], mut from: usize) -> Option<usize> {
    while from + keyword.len() <= data.len() {
        if data[from..].starts_with(keyword)
            && data
                .get(from.wrapping_sub(1))
                .map_or(true, |byte| !byte.is_ascii_alphabetic())
            && data
                .get(from + keyword.len())
                .map_or(true, |byte| !byte.is_ascii_alphabetic())
        {
            return Some(from);
        }
        from += 1;
    }

    None
}

fn rfind_bytes(data: &[u8], needle: &[u8]) -> Option<usize> {
    data.windows(needle.len())
        .rposition(|window| window == needle)
}

fn push_pdf_text_chunk(chunks: &mut Vec<String>, value: String) {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().any(char::is_alphanumeric) {
        chunks.push(normalized);
    }
}

fn parse_pdf_literal(data: &[u8], mut index: usize) -> Option<(String, usize)> {
    let mut depth = 1usize;
    let mut out = Vec::new();

    while index < data.len() {
        match data[index] {
            b'\\' => {
                index += 1;
                if index >= data.len() {
                    break;
                }
                match data[index] {
                    b'n' => out.push(b'\n'),
                    b'r' => out.push(b'\r'),
                    b't' => out.push(b'\t'),
                    b'b' => out.push(0x08),
                    b'f' => out.push(0x0c),
                    b'(' | b')' | b'\\' => out.push(data[index]),
                    b'\r' => {
                        if data.get(index + 1) == Some(&b'\n') {
                            index += 1;
                        }
                    }
                    b'\n' => {}
                    digit if digit.is_ascii_digit() && digit < b'8' => {
                        let mut value = digit - b'0';
                        let mut count = 1;
                        while count < 3 {
                            let Some(next) = data.get(index + 1) else {
                                break;
                            };
                            if !next.is_ascii_digit() || *next >= b'8' {
                                break;
                            }
                            index += 1;
                            value = value.saturating_mul(8).saturating_add(data[index] - b'0');
                            count += 1;
                        }
                        out.push(value);
                    }
                    other => out.push(other),
                }
            }
            b'(' => {
                depth += 1;
                out.push(data[index]);
            }
            b')' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some((String::from_utf8_lossy(&out).into_owned(), index + 1));
                }
                out.push(data[index]);
            }
            byte => out.push(byte),
        }
        index += 1;
    }

    None
}

fn parse_pdf_hex_string(data: &[u8], mut index: usize) -> Option<(String, usize)> {
    let mut hex = Vec::new();

    while index < data.len() {
        match data[index] {
            b'>' => {
                if hex.len() % 2 == 1 {
                    hex.push(b'0');
                }
                let bytes = hex
                    .chunks(2)
                    .filter_map(|pair| {
                        let high = hex_value(pair[0])?;
                        let low = hex_value(pair[1])?;
                        Some((high << 4) | low)
                    })
                    .collect::<Vec<_>>();
                return Some((String::from_utf8_lossy(&bytes).into_owned(), index + 1));
            }
            byte if byte.is_ascii_hexdigit() => hex.push(byte),
            byte if byte.is_ascii_whitespace() => {}
            _ => return None,
        }
        index += 1;
    }

    None
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn docx_content_extractor_reads_document_xml_text() {
        use std::io::Write;
        use zip::{write::SimpleFileOptions, ZipWriter};

        let cursor = Cursor::new(Vec::new());
        let mut writer = ZipWriter::new(cursor);
        writer
            .start_file("word/document.xml", SimpleFileOptions::default())
            .unwrap();
        writer
            .write_all(
                br#"<w:document xmlns:w="word"><w:body><w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:tab/><w:t>DOCX</w:t></w:r></w:p></w:body></w:document>"#,
            )
            .unwrap();
        let docx = writer.finish().unwrap().into_inner();

        let text = FileContentExtractor::extract_docx_content(&docx).unwrap();

        assert_eq!(text, "Hello\tDOCX");
    }

    #[test]
    fn docx_content_extractor_preserves_xml_entity_references() {
        use std::io::Write;
        use zip::{write::SimpleFileOptions, ZipWriter};

        let cursor = Cursor::new(Vec::new());
        let mut writer = ZipWriter::new(cursor);
        writer
            .start_file("word/document.xml", SimpleFileOptions::default())
            .unwrap();
        writer
            .write_all(
                br#"<w:document xmlns:w="word"><w:body><w:p><w:r><w:t>R&amp;D &lt;Lab&gt; &#x21; &#33;</w:t></w:r></w:p></w:body></w:document>"#,
            )
            .unwrap();
        let docx = writer.finish().unwrap().into_inner();

        let text = FileContentExtractor::extract_docx_content(&docx).unwrap();

        assert_eq!(text, "R&D <Lab> ! !");
    }

    #[test]
    fn pdf_content_extractor_reads_literal_and_hex_strings() {
        let pdf = br#"%PDF-1.4
1 0 obj
<< /Length 64 >>
stream
BT (Hello\040PDF) Tj <2054657874> Tj ET
endstream
endobj"#;

        let text = FileContentExtractor::extract_pdf_content(pdf).unwrap();

        assert!(text.contains("Hello PDF"));
        assert!(text.contains("Text"));
    }

    #[test]
    fn pdf_content_extractor_reads_flate_decoded_stream_text() {
        use flate2::{write::ZlibEncoder, Compression};
        use std::io::Write;

        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(b"BT (Compressed PDF Text) Tj ET")
            .unwrap();
        let compressed = encoder.finish().unwrap();
        let mut pdf = format!(
            "%PDF-1.4\n1 0 obj\n<< /Length {} /Filter /FlateDecode >>\nstream\n",
            compressed.len()
        )
        .into_bytes();
        pdf.extend_from_slice(&compressed);
        pdf.extend_from_slice(b"\nendstream\nendobj\n%%EOF");

        let text = FileContentExtractor::extract_pdf_content(&pdf).unwrap();

        assert!(text.contains("Compressed PDF Text"));
    }
}
