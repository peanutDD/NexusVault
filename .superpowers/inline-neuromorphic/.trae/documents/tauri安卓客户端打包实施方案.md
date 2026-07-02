# Tauri 安卓客户端打包实施方案（Plan）

## 1. 目标与范围

* 目标：将当前 `frontend + src-tauri` 项目产出可安装的 Android 客户端（Debug APK、Release AAB/APK）。

* 交付物：

  * 本地可安装调试包（`apk`）。

  * 可上架分发包（`aab`，必要时同时产出签名 `apk`）。

  * Android 构建脚本与文档（团队可复现）。

* 非目标：

  * 不在本阶段改造业务功能逻辑。

  * 不在本阶段新增复杂原生插件（仅在需要时最小化补充）。

***

## 2. 现状评估（基于仓库）

* 已具备 Tauri v2 基础：

  * `frontend/src-tauri/tauri.conf.json`

  * `frontend/src-tauri/Cargo.toml` 含 `[lib] crate-type = ["staticlib", "cdylib", "rlib"]`

  * 已有 Android 图标资源目录 `frontend/src-tauri/icons/android/...`

* 当前缺口（需在实施中补齐）：

  * 尚未初始化 Android 工程目录（`src-tauri/gen/android` 等）。

  * 未建立 Android 打包脚本（npm scripts）和签名配置流程。

  * `identifier` 当前为 `com.upload-download-util.desktop`，需要 Android 兼容命名策略。

***

## 3. 详细要求清单

## 3.1 环境要求（开发机/CI）

* Node.js、npm（已在项目使用）。

* Rust stable 工具链与 `rustup`。

* Android Studio（含 SDK Manager）。

* Android SDK 组件：

  * Platform Tools

  * Build-Tools（与 AGP 兼容版本）

  * Android Platform API（目标 API）

  * NDK（如 Tauri/依赖链要求）

  * CMake（如构建链要求）

* JDK（建议 17，保持与 Android Gradle Plugin 兼容）。

* 必要环境变量：

  * `ANDROID_HOME` 或 `ANDROID_SDK_ROOT`

  * `JAVA_HOME`

  * `PATH` 包含 `platform-tools`、`cmdline-tools`

## 3.2 项目配置要求

* Tauri 移动端初始化并生成 Android 工程骨架。

* 包名（applicationId）规范化：

  * Android 建议使用反向域名且全小写字母数字下划线格式（避免 `-`）。

* 前端构建产物在 Android WebView 可正确加载（`frontendDist` 模式）。

* 安全配置可运行且不白屏（先稳定，再逐步收紧）。

## 3.3 签名与发布要求

* 区分 Debug 与 Release 构建。

* Release 需 keystore 签名与密码管理（本地 `.env`/CI Secret）。

* 产物命名、版本号、版本码（versionName/versionCode）策略明确。

## 3.4 质量与验收要求

* 启动无白屏、主流程可用（登录、列表、上传/下载关键链路至少冒烟验证）。

* 日志可追踪（前端 console + Rust 日志 + adb logcat）。

* 构建可复现（脚本化，一条命令可产包）。

***

## 4. 实施方案（分阶段）

## 阶段 A：环境与工具链落地

1. 校验本机工具链版本与路径（Node/Rust/Java/Android SDK）。
2. 安装缺失 Android 目标与依赖。
3. 记录环境变量设置模板（本地 + CI）。

产出：

* `docs/android-build.md`（环境准备章节）。

## 阶段 B：Tauri Android 工程初始化

1. 在 `frontend` 目录初始化 Tauri Android 工程（生成 `src-tauri/gen/android`）。
2. 校验 Rust 与 Android target 集成可编译。
3. 核对 `tauri.conf.json` 在移动端的必要配置。

产出：

* Android 工程骨架文件（`src-tauri/gen/android/...`）。

## 阶段 C：配置修正与兼容

1. 统一包名策略：

   * 保持桌面 identifier 不冲突；

   * 为 Android 使用兼容包名（必要时按平台区分配置）。
2. 版本策略：

   * 统一 `versionName/versionCode` 生成方式（避免手工错漏）。
3. 安全策略：

   * 先确保稳定运行（防白屏）；

   * 再分 dev/prod 逐步收紧。

产出：

* 更新 `tauri.conf.json`、Android Gradle 配置相关项。

## 阶段 D：签名与产物流程

1. 建立 keystore 管理方案：

   * 本地开发 keystore 与生产 keystore 分离。

   * 敏感信息仅放环境变量/密钥系统。
2. 配置 release signing。
3. 增加 npm scripts：

   * `android:dev`

   * `android:apk`

   * `android:aab`

   * `android:logcat`

产出：

* `frontend/package.json` 脚本补齐；

* `docs/android-build.md`（签名与发布章节）。

## 阶段 E：验证与故障排查闭环

1. 本机真机/模拟器安装调试包。
2. 冒烟测试核心业务链路。
3. 若白屏/崩溃，按以下顺序排查：

   * 前端资源是否正确打进包；

   * WebView CSP/资源协议限制；

   * 网络与证书策略；

   * Rust panic 或插件权限问题；

   * AndroidManifest 权限声明缺失。
4. 固化常见故障与处理手册。

产出：

* 验收记录与问题清单。

***

## 5. 计划中的具体修改点（执行阶段将落地）

* `frontend/package.json`

  * 新增 Android 构建/日志脚本。

* `frontend/src-tauri/tauri.conf.json`

  * Android 相关配置对齐（identifier/安全策略/构建流程）。

* `frontend/src-tauri/gen/android/**`

  * Android 工程与 Gradle 配置（初始化后纳管必要文件）。

* `frontend/src-tauri/icons/android/**`

  * 校验并补齐应用图标规格。

* `frontend/docs/android-build.md`（新建）

  * 环境、签名、打包、排错、发布流程。

***

## 6. 风险与缓解

* 风险：包名/签名不规范导致安装或上架失败

  * 缓解：先定义统一命名与签名策略，再执行构建。

* 风险：CSP 或资源协议导致白屏

  * 缓解：先稳定运行配置，再最小化收紧并逐步回归测试。

* 风险：CI 环境缺 Android 组件

  * 缓解：将 SDK 组件版本写入文档与 CI 脚本。

* 风险：插件权限不全导致功能异常

  * 缓解：按 capability 与 Android 权限双维度核对。

***

## 7. 验收标准（DoD）

* 能在本机通过一条命令产出可安装 Android 调试包。

* 能产出签名发布包（AAB），并完成签名校验。

* App 启动无白屏，关键业务链路冒烟通过。

* 打包流程、签名与排障文档完整，团队成员可复现。

***

## 8. 执行顺序建议（实施时）

1. 先完成 A/B（环境 + 初始化）。
2. 再做 C（配置兼容，优先解决运行稳定性）。
3. 再做 D（签名与脚本化）。
4. 最后做 E（回归验证与文档收敛）。

