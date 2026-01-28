//! 数据访问层（Repository）
//!
//! 目标：把“SQL/事务/连接池细节”从 service 中剥离出来，降低耦合、便于测试与演进。
//! Service 只负责业务编排（存储/校验/跨表流程），Repository 负责数据读写。

pub mod files;
pub mod upload_sessions;
pub mod users;
