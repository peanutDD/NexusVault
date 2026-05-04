# C-026: Rust test modules must stay after production items

Rust source files must not place `#[cfg(test)] mod tests` before production
items in the same module. CI runs `cargo clippy --all-targets --all-features
-- -D warnings`, so `clippy::items_after_test_module` blocks the backend job.

When adding unit tests inside a Rust module, keep the test module at the end of
the file or at least after all production impls/items in that module.
