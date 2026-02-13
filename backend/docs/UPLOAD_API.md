# 上传 API 说明

本文档描述文件上传相关接口：**普通上传**、**分片上传（断点续传）**、**秒传（文件指纹）**。所有接口均需鉴权（Bearer Token 或 Query Token）。

**Base path**：`/api/files`（以实际挂载为准）

---

## 1. 普通上传

适用于小文件（建议 < 100 MiB），一次性 `multipart/form-data` 上传。

| 项目 | 说明 |
|------|------|
| **Method** | `POST` |
| **Path** | `/upload` |
| **Content-Type** | `multipart/form-data` |
| **Body 限制** | 最大 100 MiB（`MAX_UPLOAD_BODY`） |
| **表单字段** | `file`：文件字段（name 须为 `file`） |

**响应**（200）：

```json
{
  "file": {
    "id": "uuid",
    "filename": "存储文件名",
    "original_filename": "用户可见文件名",
    "file_size": 12345,
    "mime_type": "application/octet-stream",
    "category": null,
    "folder_id": null,
    "created_at": "2026-02-08T00:00:00Z"
  }
}
```

服务端会对上传文件计算 SHA-256 并写入 `content_sha256`，供后续秒传使用。

---

## 2. 秒传（文件指纹）

若服务器已存在**相同内容**（同 SHA-256 + 同大小）的文件，可直接创建一条新文件记录，无需上传内容。

**存储策略**：
- 若已有文件的路径属于**当前用户**：复用同一路径（节省存储）。
- 若已有文件的路径属于**其他用户**：复制文件到当前用户目录（避免跨用户路径引用，确保 DB `user_id` 与路径中的 `user_id` 一致）。

| 项目 | 说明 |
|------|------|
| **Method** | `POST` |
| **Path** | `/upload/instant` |
| **Content-Type** | `application/json` |

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content_sha256` | string | 是 | 文件内容 SHA-256，64 位十六进制 |
| `filename` | string | 是 | 用户可见文件名 |
| `file_size` | number | 是 | 文件大小（字节），与 content_sha256 一起用于匹配已有文件 |
| `mime_type` | string | 是 | MIME 类型 |
| `folder_id` | uuid \| null | 否 | 目标文件夹 ID，不传或 null 表示根目录 |

**示例**：

```json
{
  "content_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "filename": "my-file.zip",
  "file_size": 1024,
  "mime_type": "application/zip",
  "folder_id": null
}
```

**响应**：

- **201**：秒传成功，返回与普通上传相同的 `{ "file": { ... } }`
- **404**：服务器无该内容，前端应走**普通上传**或**分片上传**
- **400**：参数错误（如 `content_sha256` 格式非 64 位十六进制）

---

## 3. 分片上传（断点续传）

大文件按块上传，支持记录进度、单块重传、断点续传。分块大小固定 **2 MiB**（`CHUNK_SIZE`）。

### 3.1 初始化

| 项目 | 说明 |
|------|------|
| **Method** | `POST` |
| **Path** | `/upload/chunked/init` |
| **Content-Type** | `application/json` |

**请求体**：

```json
{
  "filename": "large-file.zip",
  "mime_type": "application/zip",
  "total_size": 104857600
}
```

**响应**（200）：

```json
{
  "upload_id": "uuid",
  "chunk_size": 2097152,
  "total_parts": 50,
  "max_concurrent_chunked_uploads": 5
}
```

- `chunk_size`：固定 2 MiB，每块字节数
- `total_parts`：总分块数（从 1 到 total_parts）
- `max_concurrent_chunked_uploads`：每用户同时进行的分片上传数量上限（与前端约定一致）
- 会话有效期 24 小时，过期需重新 init

**限制**：每用户同时进行的分片上传（未完成/未取消）不能超过 **10 个**（达到上限时会尝试清理最旧的会话），否则 init 返回 **400**，文案：`同时进行的分片上传不能超过 10 个，请先完成或取消其他大文件上传`。前端应根据该限制禁用「添加大文件」或提示用户。

### 3.2 上传分块

| 项目 | 说明 |
|------|------|
| **Method** | `PUT` |
| **Path** | `/upload/chunked/:id/chunk?part=N` |
| **Path 参数** | `id`：upload_id（init 返回） |
| **Query** | `part`：分块序号，**从 1 开始**，且 1 ≤ part ≤ total_parts |
| **Body** | 该分块的**原始二进制**，长度通常为 chunk_size（最后一块可小于） |
| **Body 限制** | 单次请求最大 3 MiB（`MAX_CHUNK_BODY`） |

**可选请求头**：

- `X-Part-SHA256`：当前分块内容的 SHA-256 十六进制（64 字符）。若提供，服务端校验通过才接受该块；不匹配返回 400。不传则不做校验。

**响应**：

- **200**：`{ "ok": true, "part": 1 }`
- 同一 part 重复上传会幂等跳过（已上传则直接返回成功）

### 3.3 查询上传状态

| 项目 | 说明 |
|------|------|
| **Method** | `GET` |
| **Path** | `/upload/chunked/:id/status` |

**响应**（200）：

```json
{
  "upload_id": "uuid",
  "uploaded_parts": [1, 2, 3, 5],
  "total_parts": 50
}
```

前端可根据 `uploaded_parts` 做进度条，并只上传缺失的 part，实现断点续传。

### 3.4 完成上传

| 项目 | 说明 |
|------|------|
| **Method** | `POST` |
| **Path** | `/upload/chunked/:id/complete` |
| **Content-Type** | `application/json` |

**请求体**（与 init 一致即可，服务端以会话中的 filename/mime_type 为准）：

```json
{
  "filename": "large-file.zip",
  "mime_type": "application/zip"
}
```

**响应**（200）：与普通上传相同，`{ "file": { ... } }`。服务端会流式合并分块、校验总大小、计算并写入 `content_sha256`，然后清理临时文件。

**错误**：

- **400**：缺少分块（已上传 part 数 ≠ total_parts）

### 3.5 取消上传

| 项目 | 说明 |
|------|------|
| **Method** | `DELETE` |
| **Path** | `/upload/chunked/:id/abort` |

删除上传会话及所有临时分块文件。

---

## 4. 推荐前端流程（已实现）

前端已按以下流程实现，统一入口为 `fileService.uploadFileWithInstant(file, onProgress)`：

1. **上传前**：用 Web Crypto 计算文件 SHA-256（`utils/sha256.ts` 的 `sha256FileHex(file)`）。
2. **先秒传**：`POST /upload/instant`（带 content_sha256、filename、file_size、mime_type、folder_id）。
   - 若 **201**：完成，无需传内容，进度直接 100。
   - 若 **404**：自动继续步骤 3。
3. **按类型与大小选择**（由 `uploadFileWithInstant` 内部决定）：
   - 小文件（非视频且 < 分片阈值）：`POST /upload` 普通上传。
   - 大文件或视频：走分片流程（init → 按 status 只传缺失 part → complete）；可选每块带 `X-Part-SHA256` 做校验。

---

## 5. 常量与限制（服务端）

| 常量 | 值 | 说明 |
|------|-----|------|
| 普通上传最大 body | 100 MiB | 超过会 413 |
| 分块大小 | 2 MiB | 固定，init 返回的 chunk_size |
| 单块请求最大 body | 3 MiB | 单次 PUT chunk 的上限 |
| 分片 chunk 并发数 | 10 | 同时处理的 PUT chunk 请求数（服务端 ConcurrencyLimit） |
| 分片上传会话有效期 | 24 小时 | 过期后 status/complete 会报错，需重新 init |
| 每用户同时分片上传数（大文件数） | 10 个 | 超过后 init 返回 400，需先 complete 或 abort 其他会话 |

---

## 6. 单次上传数量与大文件限制（前后端约定）

前后端约定：**单次上传队列**同时满足以下两条，且需**分开校验、分开提醒**。

| 限制项 | 上限 | 说明 |
|--------|------|------|
| **总文件数** | 20 个 | 单次最多 20 个文件（任意大小合计） |
| **大文件数** | 10 个 | 其中 ≥100MB 的视为大文件，最多 10 个（即最多 10 个大文件 + 10 个小文件） |

- 后端：分片上传 init 时校验「当前用户未过期的分片会话数」≤ 10，超过则返回 400。
- 前端：
  - 添加文件时：**先按「同名 + 同大小 + 同修改时间」去重**（与当前队列及本批内重复的只保留一份），再校验总数量 ≤ 20、大文件 ≤ 10；超限部分不加入队列。若存在重复则提示「已忽略 x 个重复文件（同名同大小）」。
  - **分开提醒**：展示两行统计——「文件数量 x/20」「大文件（≥100MB）y/10」；因总数量超限未添加时单独提示总数量；因大文件数量超限未添加时单独提示大文件数量；已达 20 或 10 时分别常驻一句说明。

---

## 7. 相关文档

- 实现与设计细节见 **ENGINEERING_PLAYBOOK.md** 第 19 节「分片上传 + 断点续传 与 秒传（文件指纹）」。
- 单次 20 个、大文件 10 个的约定与分开提醒见本文档第 6 节。
