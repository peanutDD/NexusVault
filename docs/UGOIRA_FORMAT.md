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

上传与存储使用：`application/x-ugoira`

## 前端播放流程

1. 用预览接口获取 ZIP URL（支持 Range）
2. 使用 JSZip 解析 ZIP
3. 读取 `frames.json` 得到帧列表与 delay
4. 按 delay 在 Canvas 上逐帧绘制
5. 支持缩放、旋转等与普通图片一致的交互
