# macOS 桌面端应用打包计划 (Tauri v2)

本计划旨在将现有的 React 前端项目通过 Tauri v2 打包为高性能 macOS 桌面应用，并配置为 iPhone 17 Pro Max 的视窗体验。

## 目标
- **平台**: macOS (dmg/app)
- **视窗尺寸**: 430px x 932px (参考 iPhone Pro Max 逻辑分辨率)
- **性能**: 高性能 (Rust + Webview)
- **体验**: 1:1 还原网页端体验，零报错

## 阶段一：环境准备与初始化
1.  **安装 Tauri CLI**: 在 `frontend` 目录下安装 `@tauri-apps/cli`。
2.  **初始化 Tauri**: 运行 `tauri init`，配置项目基础信息。
    -   包管理器: npm
    -   前端构建命令: `npm run build`
    -   前端开发命令: `npm run dev`
    -   前端产物目录: `dist`
    -   应用 URL: `http://localhost:5173`

## 阶段二：核心配置 (iPhone 17 Pro Max 体验)
1.  **修改 `src-tauri/tauri.conf.json`**:
    -   **窗口设置**:
        -   `width`: 430
        -   `height`: 932
        -   `resizable`: false (锁定尺寸以模拟手机，或设为 true 但默认此尺寸) -> *计划默认锁定以完全模拟手机体验，除非用户调整*。
        -   `title`: "Upload Download Util"
    -   **权限配置**:
        -   配置 `capabilities` 以允许网络访问和基础系统交互。
    -   **Bundle ID**: 设置唯一的 bundle identifier (如 `com.tyone.upload-util`).

## 阶段三：图标与资源生成
1.  **生成图标**: 使用 `tauri icon` 命令自动生成 macOS 所需的 .icns 和各种尺寸图标。

## 阶段四：构建与验证
1.  **开发模式验证**: 运行 `npm run tauri dev`。
    -   检查窗口尺寸是否符合预期。
    -   检查控制台是否有报错。
    -   验证与后端的连接 (假设后端在本地或远程运行)。
2.  **生产构建**: 运行 `npm run tauri build`。
    -   生成 `.dmg` 和 `.app` 文件。
3.  **最终检查**: 打开生成的应用，确保无白屏、无崩溃。

## 待确认事项
- 当前方案是将**前端**打包为桌面壳，连接到现有的 API 后端。如果需要将 Rust 后端也打包进同一个应用（离线版），需要额外配置 Sidecar，但考虑到项目结构，目前按“客户端”模式进行。

## 执行步骤
1.  安装依赖并初始化 Tauri。
2.  配置 `tauri.conf.json`。
3.  生成图标。
4.  运行开发版验证。
5.  执行打包。
