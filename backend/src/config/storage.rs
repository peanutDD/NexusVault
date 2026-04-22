use serde::de::{self, Deserializer, SeqAccess, Visitor};
use serde::Deserialize;
use std::fmt;

#[derive(Debug, Clone, Deserialize)]
pub struct HlsAbrVariant {
    pub height: u32,
    pub video_bitrate_kbps: u32,
}

fn deserialize_allowed_mime_types<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    struct V;

    impl<'de> Visitor<'de> for V {
        type Value = Vec<String>;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("a string or a sequence of strings")
        }

        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            let s = v.trim();
            if s.is_empty() {
                return Ok(vec![]);
            }
            if s.starts_with('[') {
                return serde_json::from_str::<Vec<String>>(s).map_err(E::custom);
            }
            Ok(s.split(',')
                .map(|t| t.trim())
                .filter(|t| !t.is_empty())
                .map(|t| t.to_string())
                .collect())
        }

        fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
        where
            A: SeqAccess<'de>,
        {
            let mut out = Vec::<String>::new();
            while let Some(item) = seq.next_element::<String>()? {
                let t = item.trim().to_string();
                if !t.is_empty() {
                    out.push(t);
                }
            }
            Ok(out)
        }
    }

    deserializer.deserialize_any(V)
}

#[derive(Debug, Clone, Deserialize)]
pub struct StorageConfig {
    pub backend: String,
    pub path: String,
    pub max_file_size: u64,
    #[serde(default, deserialize_with = "deserialize_allowed_mime_types")]
    pub allowed_mime_types: Vec<String>,
    pub download_mode: String,
    pub presign_ttl_secs: u64,
    pub hls_threshold_bytes: u64,
    pub hls_abr_max_variants: usize,
    #[serde(default)]
    pub hls_abr_variants: Vec<HlsAbrVariant>,

    // AWS S3 settings
    pub aws_access_key_id: Option<String>,
    pub aws_secret_access_key: Option<String>,
    pub aws_region: Option<String>,
    pub aws_bucket: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::deserialize_allowed_mime_types;
    use super::StorageConfig;

    #[test]
    fn allowed_mime_types_accepts_string() {
        #[derive(serde::Deserialize)]
        struct T {
            #[serde(deserialize_with = "deserialize_allowed_mime_types")]
            allowed_mime_types: Vec<String>,
        }

        let v = serde_json::json!({ "allowed_mime_types": "*/*" });
        let parsed: T = serde_json::from_value(v).unwrap();
        assert_eq!(parsed.allowed_mime_types, vec!["*/*".to_string()]);
    }

    #[test]
    fn allowed_mime_types_accepts_csv_string() {
        #[derive(serde::Deserialize)]
        struct T {
            #[serde(deserialize_with = "deserialize_allowed_mime_types")]
            allowed_mime_types: Vec<String>,
        }

        let v = serde_json::json!({ "allowed_mime_types": "image/*, video/*" });
        let parsed: T = serde_json::from_value(v).unwrap();
        assert_eq!(
            parsed.allowed_mime_types,
            vec!["image/*".to_string(), "video/*".to_string()]
        );
    }

    #[test]
    fn allowed_mime_types_accepts_sequence() {
        #[derive(serde::Deserialize)]
        struct T {
            #[serde(deserialize_with = "deserialize_allowed_mime_types")]
            allowed_mime_types: Vec<String>,
        }

        let v = serde_json::json!({ "allowed_mime_types": ["image/*", "video/*"] });
        let parsed: T = serde_json::from_value(v).unwrap();
        assert_eq!(
            parsed.allowed_mime_types,
            vec!["image/*".to_string(), "video/*".to_string()]
        );
    }

    #[test]
    fn hls_abr_variants_defaults_to_empty_when_missing() {
        let v = serde_json::json!({
            "backend": "local",
            "path": "",
            "max_file_size": 2147483648u64,
            "allowed_mime_types": "*/*",
            "download_mode": "proxy",
            "presign_ttl_secs": 300u64,
            "hls_threshold_bytes": 104857600u64,
            "hls_abr_max_variants": 1u64,
            "aws_access_key_id": null,
            "aws_secret_access_key": null,
            "aws_region": null,
            "aws_bucket": null
        });

        let parsed: StorageConfig = serde_json::from_value(v).unwrap();
        assert!(parsed.hls_abr_variants.is_empty());
    }
}
