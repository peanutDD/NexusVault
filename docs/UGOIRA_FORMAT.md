# Ugoira 动图格式规范

类 Pixiv うごイラ的动图格式：ZIP 压缩包内含帧图与元数据。

## 目录结构

```
example.ugoira (ZIP)
├── frames.json    # 帧序与延迟（必填）
├── 0.png          # 第 1 帧
├── 1.png          # 第 2 帧
├── 2.png
└── ...
```

## frames.json 格式

```json
{
  "frames": [
    { "file": "0.png", "delay": 100 },
    { "file": "1.png", "delay": 100 },
    { "file": "2.png", "delay": 50 }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `frames` | array | 是 | 帧列表 |
| `frames[].file` | string | 否* | 帧文件名，缺省时按顺序使用 `0.png`, `1.png`, ... |
| `frames[].delay` | number | 是 | 该帧延迟（毫秒） |

\* 不写 `file` 时，按 `0.png`, `1.png`, `2.png` 顺序引用。

## 帧图要求

- 格式：PNG 或 JPEG
- 命名：与 `frames.json` 中 `file` 一致
- 尺寸：建议所有帧一致

## MIME 类型

上传与存储使用：`application/x-ugoira`。后端也接受 `application/zip` 且文件名为 `.ugoira` 结尾（兼容旧数据）。

## API（边播放边加载）

| 接口 | 说明 |
|------|------|
| `GET /api/files/:id/preview/ugoira/metadata` | 返回 frames.json 元数据 |
| `GET /api/files/:id/preview/ugoira/frames/:index` | 返回指定索引的帧图（PNG/JPEG） |

认证与预览接口相同（Authorization header 或 `?token=`）。

## 转换工具

项目提供 `scripts/gif2ugoira.mjs`，可将 GIF 转为 Ugoira：

- 源文件目录：`frontend/gif-files/`
- 输出目录：`frontend/gif2ugoira-files/`

```bash
# 需已安装 ffmpeg: brew install ffmpeg
# 将 xxx.gif 放入 frontend/gif-files/ 后执行：
node scripts/gif2ugoira.mjs xxx.gif   # 输出到 frontend/gif2ugoira-files/xxx.ugoira
```

## 前端播放流程

### 当前实现（Range 请求流式加载，对齐 Pixiv zip_player）

参考：https://github.com/pixiv/zip_player

1. **使用 HTTP Range 请求读取 ZIP central directory**（在文件末尾）
2. **解析目录获取每个帧的字节范围**
3. **优先加载 `frames.json` 和首帧**，立即开始播放
4. **边播放边按需加载后续帧**（预加载接下来 2-3 帧，然后根据播放进度加载）
5. 支持缩放、旋转等与普通图片一致的交互

**技术实现**：
- 使用 `@zip.js/zip.js`（支持 Range 请求）替代 JSZip
- 自定义 `FileServiceReader` 实现 zip.js 的 `Reader` 接口
- 通过 `fileService.getFileRange()` 发送 Range 请求
- zip.js 自动处理 central directory 解析和文件解压

**优点**：
- ✅ **可以边下载边播放，快速开始播放**（只下载 metadata + 首帧即可开始）
- ✅ **适合网络环境和大文件**（不需要等待整个 ZIP 下载完）
- ✅ **内存占用可控**（按需加载，只加载已播放和预加载的帧）
- ✅ **对齐 Pixiv 的性能表现**

**性能对比**

| 场景 | 旧实现（一次性下载） | 当前实现（Range 流式） |
|------|---------------------|----------------------|
| 小文件（<5MB）本地 | 快速 | 快速 |
| 大文件（>10MB）本地 | 需等待完整下载（5-10秒） | 快速开始播放（<1秒） |
| 网络环境 | 需等待完整下载（10-30秒） | 边下载边播放（<2秒开始） |
| 内存占用 | 高（所有帧） | 低（按需加载） |
| 首帧显示时间 | 需等待完整 ZIP | 只需 metadata + 首帧 |

### 实现细节

**关键文件**：
- `frontend/src/utils/zipStreaming.ts` - ZIP 流式加载工具（自定义 Reader + zip.js）
- `frontend/src/components/files/preview/UgoiraPlayer.tsx` - Ugoira 播放器组件
- `frontend/src/services/files.ts` - 文件服务（提供 `getFileRange()` 方法）

**加载流程**：
1. 调用 `readZipEntryWithZipJs(fileId, 'frames.json')` 读取 metadata（Range 请求）
2. 解析 `frames.json` 获取帧列表和延迟信息
3. 调用 `readZipEntryWithZipJs(fileId, firstFrameName)` 读取首帧（Range 请求）
4. 立即显示首帧并开始播放动画
5. 后台预加载接下来 2-3 帧
6. 根据播放进度按需加载后续帧（播放到接近已预加载帧时继续预加载）

**Range 请求优势**：
- 服务器已支持 Range 请求（`backend/src/handlers/files/download/get.rs`）
- 每个帧只下载需要的字节范围，不下载整个 ZIP
- 对于 10MB 的 ZIP 文件，首帧可能只需要下载几 KB 的 metadata + 首帧数据
