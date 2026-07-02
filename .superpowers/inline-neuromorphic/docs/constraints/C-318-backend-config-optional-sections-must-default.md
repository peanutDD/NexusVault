# C-318 Backend Config Optional Sections Must Default

Backend config structs that are owned by the top-level `Config` and contain only optional fields must implement a missing-section default.

Requirements:
- If an environment variable is documented as optional, omitting the whole config section must not make `Config::from_env()` fail during deserialization.
- Required local defaults such as `STORAGE_PATH` must be inserted before `try_deserialize()`, not after, unless the field itself is optional.
- Required environment variables such as `DATABASE_URL` and `JWT_SECRET` may use empty pre-deserialization defaults only so `Config::validate()` can return `MissingEnvVar`; they must never become usable runtime defaults.
- Optional integrations such as OAuth must default to `None`, not empty strings, so runtime checks can distinguish disabled integrations from configured ones.
- Regression tests must cover `Config::from_env()` with only the required environment variables set.
- Regression tests must cover missing required environment variables and assert `ConfigError::MissingEnvVar`, not `ConfigError::LoadError`.

This prevents startup failures such as `Config loading error: missing field path` or `missing field jwt_secret` when local defaults or validation errors are supposed to apply.
