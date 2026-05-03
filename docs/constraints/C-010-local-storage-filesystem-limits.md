# C-010: Local storage must absorb filesystem edge cases

LocalStorage delete operations must be idempotent when the target file is
already absent. Stored filename components must stay below common filesystem
limits; keep user-visible names in metadata rather than relying on the local path
component to preserve the full display name.
