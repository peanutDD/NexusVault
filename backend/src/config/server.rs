use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub cors_origin: String,
    pub frontend_base_url: Option<String>,
    #[serde(default)]
    pub trust_proxy_headers: bool,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<u16>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub smtp_from: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::ServerConfig;

    #[test]
    fn trust_proxy_headers_defaults_to_false_when_missing() {
        let v = serde_json::json!({
            "port": 3000,
            "cors_origin": "*",
            "frontend_base_url": null,
            "smtp_host": null,
            "smtp_port": null,
            "smtp_username": null,
            "smtp_password": null,
            "smtp_from": null
        });

        let parsed: ServerConfig = serde_json::from_value(v).unwrap();
        assert!(!parsed.trust_proxy_headers);
    }
}
