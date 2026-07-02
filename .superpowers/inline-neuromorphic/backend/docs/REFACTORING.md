# 后端彻底重构记录

## 重构目标

1. **文件结构精细化**：创建完整的 Repository 层
2. **高度模块化**：Service 层通过 Repository 访问数据库
3. **修复跨层调用**：消除 Service 直接 SQLx 调用
4. **配置外部化**：常量集中管理
5. **依赖升级**：sqlx 0.7 → 0.8
6. **去冗余**：提取重复代码
7. **提高代码质量**：消除魔法数字

---

## 1. 新增 Repository 层

### 1.1 新增文件

| 文件 | 职责 |
|------|------|
| `repositories/users.rs` | 用户表 CRUD，含密码更新、存在性检查 |
| `repositories/folders.rs` | 文件夹表 CRUD，含递归查询、路径导航 |
| `repositories/shares.rs` | 分享表 CRUD，含下载计数更新 |
| `repositories/api_tokens.rs` | API Token 表 CRUD |

### 1.2 更新模块导出

```rust
// repositories/mod.rs
pub mod api_tokens;
pub mod files;
pub mod folders;
pub mod shares;
pub mod upload_sessions;
pub mod users;

// 重新导出常用类型
pub use api_tokens::ApiTokensRepo;
pub use files::FilesRepo;
pub use folders::FoldersRepo;
pub use shares::SharesRepo;
pub use upload_sessions::UploadSessionsRepo;
pub use users::UsersRepo;
```

---

## 2. Service 层重构

### 2.1 AuthService

**重构前**：直接使用 `sqlx::query_as` 查询用户表

**重构后**：通过 `UsersRepo` 访问数据库

```rust
// 重构前
let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
    .bind(&req.email)
    .fetch_optional(&self.pool)
    .await?;

// 重构后
let repo = UsersRepo::new(&self.pool);
let user = repo.find_by_email(&req.email).await?;
```

### 2.2 FolderService

**重构前**：569 行，直接 SQLx 调用 20+ 处

**重构后**：298 行，全部通过 `FoldersRepo` 访问

**新增私有辅助方法**：
- `validate_folder_name()` - 名称验证
- 其他验证逻辑移至 Repository 层

### 2.3 ShareService

**重构前**：直接 SQLx 调用

**重构后**：通过 `SharesRepo` 和 `FilesRepo` 访问

### 2.4 ApiTokenService

**重构前**：直接 SQLx 调用

**重构后**：通过 `ApiTokensRepo` 访问

---

## 3. 常量集中管理

### 3.1 新增常量

```rust
// constants.rs

// 磁盘空间预留
pub const DISK_RESERVE_UPLOAD: u64 = 16 * 1024 * 1024;  // 16 MiB
pub const DISK_RESERVE_CHUNK: u64 = 32 * 1024 * 1024;   // 32 MiB
pub const DISK_RESERVE_MERGE: u64 = 64 * 1024 * 1024;   // 64 MiB

// ZIP 写入缓冲
pub const ZIP_BUFFER_SIZE: usize = 8 * 1024;            // 8 KiB
```

### 3.2 消除魔法数字

| 文件 | 重构前 | 重构后 |
|------|--------|--------|
| `handlers/files/upload.rs` | `16 * 1024 * 1024u64` | `DISK_RESERVE_UPLOAD` |
| `services/file/chunked_upload.rs` | `32 * 1024 * 1024u64` | `DISK_RESERVE_CHUNK` |
| `services/file/chunked_upload.rs` | `64 * 1024 * 1024u64` | `DISK_RESERVE_MERGE` |
| `services/file/batch_zip.rs` | `8 * 1024` | `ZIP_BUFFER_SIZE` |

---

## 4. 依赖升级

### 4.1 主要升级

| 依赖 | 旧版本 | 新版本 |
|------|--------|--------|
| sqlx | 0.7.4 | 0.8.6 |
| aws-sdk-s3 | 1.x | 最新 |
| 其他 | - | 自动更新 |

### 4.2 升级收益

- 消除 `sqlx-postgres v0.7.4` 的 future-incompatibility 警告
- 性能优化和 bug 修复
- 更好的 Rust 2024 兼容性

---

## 5. 代码质量改进

### 5.1 去除的冗余代码

- `services/storage.rs::create_storage_backend` - 废弃函数
- `middleware/auth.rs::extract_user_id_from_token` - 改用 extractors
- 多个未使用的 parse/validation 函数

### 5.2 保留的预留方法（标记 `#[allow(dead_code)]`）

- `FileShare` 的辅助方法 - 业务逻辑预留
- `FileService::create_file` - API 扩展预留
- Repository 的部分查询方法 - 未来功能预留

---

## 6. 最终目录结构

```
backend/src/
├── api/                    # 路由定义层
│   ├── mod.rs
│   ├── api_token.rs
│   ├── auth.rs
│   ├── files.rs
│   ├── folders.rs
│   └── share.rs
│
├── handlers/               # HTTP 请求处理层
│   ├── mod.rs
│   ├── api_token.rs
│   ├── auth.rs
│   ├── files/             # 文件处理（按功能拆分）
│   │   ├── mod.rs
│   │   ├── batch.rs
│   │   ├── categories.rs
│   │   ├── chunked_upload.rs
│   │   ├── delete.rs
│   │   ├── download/
│   │   ├── list.rs
│   │   ├── storage.rs
│   │   └── upload.rs
│   ├── folders.rs
│   └── share.rs
│
├── services/               # 业务逻辑层（通过 Repository 访问数据）
│   ├── mod.rs
│   ├── api_token.rs       # [重构] 使用 ApiTokensRepo
│   ├── auth.rs            # [重构] 使用 UsersRepo
│   ├── file/              # 文件服务（按业务能力拆分）
│   │   ├── mod.rs
│   │   ├── batch_get.rs
│   │   ├── batch_zip.rs
│   │   ├── categories.rs
│   │   ├── chunked_upload.rs
│   │   ├── delete.rs
│   │   ├── list.rs
│   │   ├── quota.rs
│   │   ├── read.rs
│   │   ├── storage_factory.rs
│   │   └── upload.rs
│   ├── folder.rs          # [重构] 使用 FoldersRepo
│   ├── maintenance.rs
│   ├── share.rs           # [重构] 使用 SharesRepo
│   └── storage.rs
│
├── repositories/           # [新增] 数据访问层
│   ├── mod.rs
│   ├── api_tokens.rs      # [新增]
│   ├── files.rs           # [扩展] 新增方法
│   ├── folders.rs         # [新增]
│   ├── shares.rs          # [新增]
│   ├── upload_sessions.rs
│   └── users.rs           # [扩展] 新增方法
│
├── models/                 # 数据模型
├── middleware/             # 中间件
├── extractors/             # Axum Extractors
├── database/               # 数据库连接池
├── utils/                  # 工具函数
├── constants.rs            # [更新] 新增磁盘/缓冲常量
├── config.rs               # 配置管理
├── state.rs                # 应用状态
├── main.rs                 # 应用入口
└── tasks/                  # [新增] 后台任务目录（预留）
```

---

## 7. 构建结果

```
cargo build --release
Finished `release` profile [optimized] target(s) in 4m 08s
```

## 8. 后续优化建议

1. **将 `maintenance.rs` 移至 `tasks/`** - 维护任务独立管理
2. **添加 Repository trait** - 便于测试 mock
3. **增加集成测试** - 验证 Repository 层正确性
4. **考虑 SQLx 编译时检查** - 使用 `sqlx::query!` 宏
