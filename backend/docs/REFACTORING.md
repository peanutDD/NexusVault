# 后端重构记录

## 重构目标

1. **代码安全**：消除 `unwrap()` 导致的潜在 panic
2. **去除冗余**：提取重复的验证逻辑和数据库查询
3. **删除死代码**：移除未使用的函数和导入
4. **常量集中管理**：将硬编码值集中到 `constants.rs`

---

## 重构内容

### 1. 修复 `unwrap()` 安全问题

**问题**：多处使用 `unwrap()` 可能导致 panic

**修复文件**：
- `services/file/batch_zip.rs` - ZIP writer 操作
- `handlers/files/batch.rs` - Mutex lock
- `middleware/rate_limit.rs` - HeaderValue 创建
- `repositories/files.rs` - 日期解析

**修复方式**：
- 使用 `ok()` + `and_then()` 链式处理
- 使用 `if let` 模式匹配
- 使用 `map_err()` 转换错误

### 2. 提取重复的验证逻辑

**问题**：`services/folder.rs` 中有大量重复代码

**新增私有方法**：

```rust
impl FolderService {
    // 验证文件夹名称（空值、长度、非法字符）
    fn validate_folder_name(name: &str) -> Result<&str, AppError>

    // 验证文件夹存在性
    async fn verify_folder_exists(&self, folder_id: Uuid, user_id: Uuid) -> Result<Uuid, AppError>

    // 获取文件夹完整信息
    async fn get_folder_by_id(&self, folder_id: Uuid, user_id: Uuid) -> Result<Folder, AppError>

    // 检查同级目录下是否存在同名文件夹
    async fn check_name_conflict(&self, ...) -> Result<(), AppError>
}
```

**重构后**：
- `create_folder` 减少约 20 行
- `rename_folder` 减少约 25 行
- `move_folder` 减少约 15 行
- `delete_folder` 减少约 5 行

### 3. 删除未使用的代码

**删除的函数/方法**：
- `services/storage.rs::create_storage_backend` - 已被 `storage_factory::create_storage` 替代
- `middleware/auth.rs::extract_user_id_from_token` - 已改用 extractors
- `utils/parse.rs::parse_optional_i64` - 未使用
- `utils/parse.rs::parse_optional_uuid` - 未使用
- `utils/response.rs::paginated_response` - 未使用
- `utils/validation.rs::validate_pagination` - 未使用
- `utils/validation.rs::validate_search` - 未使用
- `models/file.rs::FileListQuery` 方法 - 未使用

**保留但标记的代码**：
- `models/share.rs::FileShare` 的辅助方法 - 业务逻辑方法，保留备用
- `services/file/upload.rs::create_file` - API 扩展预留

### 4. 集中管理硬编码常量

**新建文件**：`src/constants.rs`

**迁移的常量**：

| 常量名 | 值 | 用途 |
|--------|-----|------|
| `MAX_UPLOAD_BODY` | 100 MiB | 普通上传最大请求体 |
| `MAX_CHUNK_BODY` | 12 MiB | 分块上传单块最大 |
| `CHUNK_SIZE` | 5 MiB | 分块上传标准大小 |
| `MAX_BATCH_ZIP_FILES` | 200 | 批量下载最大文件数 |
| `MAX_BATCH_ZIP_TOTAL_BYTES` | 250 MiB | 批量下载最大总大小 |
| `MAX_BATCH_GET_IDS` | 100 | 批量获取最大数量 |
| `MAX_RANGES` | 8 | HTTP Range 最大分段 |
| `LIST_CONCURRENCY` | 12 | 列表接口并发数 |
| `UPLOAD_CONCURRENCY` | 4 | 上传接口并发数 |
| `CHUNK_CONCURRENCY` | 12 | 分块上传并发数 |
| `COMPLETE_CONCURRENCY` | 2 | 分块完成并发数 |
| `CACHE_CONTROL_PRIVATE_REVALIDATE` | - | HTTP 缓存控制头 |
| `API_TOKEN_CHARSET` | - | API Token 字符集 |
| `RANDOM_TOKEN_CHARSET` | - | 随机 Token 字符集 |

---

## 代码质量改进

### 修复前警告

```
warning: function `extract_user_id_from_token` is never used
warning: methods `validate_pagination`, `page_normalized`, and `limit_normalized` are never used
warning: methods `is_expired`, `is_download_limit_reached`, and `requires_password` are never used
warning: method `create_file` is never used
warning: function `parse_optional_i64` is never used
warning: function `parse_optional_uuid` is never used
warning: function `paginated_response` is never used
warning: function `validate_pagination` is never used
warning: function `validate_search` is never used
warning: unused imports
```

### 修复后

```
cargo check
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 3.16s
```

无警告（除依赖库的 future-incompatibility 提示）

---

## 架构保持不变

本次重构专注于代码质量改进，不改变整体架构：

```
src/
├── api/              # 路由定义层
├── handlers/         # HTTP 请求处理层
├── services/         # 业务逻辑层
├── repositories/     # 数据访问层
├── models/           # 数据模型
├── middleware/       # 中间件
├── extractors/       # Axum Extractors
├── database/         # 数据库连接
├── utils/            # 工具函数
├── constants.rs      # [新增] 常量定义
├── config.rs         # 配置管理
└── state.rs          # 应用状态
```

---

## 后续优化建议

1. **文件拆分**（可选）：
   - `services/folder.rs` (569行) 可按操作类型拆分
   - `repositories/files.rs` (364行) 可按查询类型拆分

2. **跨层调用**（可选）：
   - `services/file/batch_zip.rs` 直接调用 Repository
   - 可通过 FileService 方法间接访问

3. **配置外部化**：
   - 部分常量可移至环境变量
   - 支持运行时配置调整

4. **升级依赖**：
   - `sqlx-postgres v0.7.4` 有 future-incompatibility 警告
   - 建议关注新版本发布
