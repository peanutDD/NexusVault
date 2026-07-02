//! 兼容转发层：将 entity 和 type 重新导出，兼容现有 import
//!
//! ## 迁移状态
//!
//! - DB 实体 → [`crate::entities::user`] ✅ 已迁移
//! - API DTO → [`crate::types::user`] ✅ 已迁移
//!
//! 所有现有 import 保持兼容，无需修改调用方代码。

pub use crate::entities::user::User;

pub use crate::types::user::{
    AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest,
    SendEmailVerificationRequest, UpdateProfileRequest, UserResponse,
};

impl From<crate::entities::user::User> for UserResponse {
    fn from(user: crate::entities::user::User) -> Self {
        UserResponse {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at,
        }
    }
}
