# Android 打包指南（Tauri v2）

## 前置要求

- Java（建议 JDK 17）
- Android SDK（至少包含 platform-tools、build-tools、platforms）
- Android NDK（必需）
- Rust Android targets（本项目已安装）

## 快速自检

```bash
cd frontend
chmod +x scripts/check-android-env.sh
npm run android:doctor
```

若输出里 `ndk: 缺失`，请先在 Android Studio 的 SDK Manager 安装 NDK（推荐），或通过 `sdkmanager` 安装后再继续。

## 一键环境变量（zsh）

```bash
cd frontend
source ./scripts/android-env.zsh
```

或使用：

```bash
cd frontend
eval "$(npm run -s android:env:print)"
```

持久写入 `~/.zshrc`：

```bash
cd frontend
npm run android:env:persist
source ~/.zshrc
```

## 初始化 Android 工程

```bash
cd frontend
npm run android:init
```

初始化后应出现：

- `src-tauri/gen/android/`

## 常用命令

```bash
cd frontend
npm run android:doctor
npm run android:dev
npm run android:run
npm run android:apk
npm run android:apk:installable
npm run android:aab
npm run android:logcat
```

`android:apk:installable` 会自动：

- 生成/复用 keystore
- 构建 release unsigned APK
- zipalign
- apksigner 签名并校验
- 输出可直接安装的 signed APK 路径

可选环境变量：

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_DNAME`

## 当前仓库实测状态

- Rust Android targets：已安装。
- Android SDK 基础组件：已检测到。
- 阻塞项：`ndk` 与 `cmdline-tools` 缺失，`android:init` 会失败。

建议在 Android Studio -> SDK Manager 安装：

- Android SDK Command-line Tools (latest)
- Android NDK (Side by side)

## 包名策略

- 本项目通过 `src-tauri/tauri.android.conf.json` 为 Android 单独设置包名：
  - `com.uploaddownloadutil.mobile`
- 桌面端 identifier 不受影响。

## 常见问题

- 初始化失败：`Android NDK not found`
  - 安装 NDK，并确保位于 `$ANDROID_SDK_ROOT/ndk/*`
- 打包失败：找不到 SDK/Java
  - 设置 `ANDROID_SDK_ROOT` / `ANDROID_HOME` / `JAVA_HOME`
- 启动白屏
  - 先确认前端构建成功，再检查 WebView 资源加载与网络权限。
