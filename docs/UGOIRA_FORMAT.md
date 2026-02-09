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

1. 请求 `metadata` 接口获取帧列表与 delay
2. 请求 `frames/0` 获取首帧，设置 Canvas 尺寸并开始播放
3. 按 delay 在 Canvas 上逐帧绘制，按需拉取后续帧（预取 1–2 帧）
4. 支持缩放、旋转等与普通图片一致的交互
