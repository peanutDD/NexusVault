//! `codex-cli` 的可复用库代码。
//!
//! 二进制入口位于 `src/bin/codex.rs`，这里只保留可测试、可复用的模块：
//! - 配置读取（环境变量）
//! - LLM 调用
//! - Repo/IO（git/gh/changelog/comment）
//! - Skill 实现与 Pipeline 编排

pub mod config;
pub mod llm;
pub mod pipeline;
pub mod repo;
pub mod runtime;
pub mod skills;
pub mod types;
