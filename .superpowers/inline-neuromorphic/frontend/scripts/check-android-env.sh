#!/usr/bin/env bash
set -euo pipefail

echo "== Android 环境自检 =="

if command -v java >/dev/null 2>&1 && java -version >/dev/null 2>&1; then
  echo "JAVA: OK ($(java -version 2>&1 | head -n 1))"
else
  echo "JAVA: 未配置可用运行时（可使用 Android Studio 自带 JBR）"
fi

if command -v adb >/dev/null 2>&1; then
  echo "ADB: OK ($(adb version | head -n 1))"
else
  echo "ADB: 缺失"
fi

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
echo "ANDROID_SDK_ROOT: $SDK_ROOT"

if [ -d "$SDK_ROOT/platform-tools" ]; then
  echo "platform-tools: OK"
else
  echo "platform-tools: 缺失"
fi

if [ -d "$SDK_ROOT/build-tools" ] && [ "$(find "$SDK_ROOT/build-tools" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" != "0" ]; then
  echo "build-tools: OK"
else
  echo "build-tools: 缺失"
fi

if [ -d "$SDK_ROOT/platforms" ] && [ "$(find "$SDK_ROOT/platforms" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" != "0" ]; then
  echo "platforms: OK"
else
  echo "platforms: 缺失"
fi

if [ -d "$SDK_ROOT/ndk" ] && [ "$(find "$SDK_ROOT/ndk" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" != "0" ]; then
  echo "ndk: OK"
else
  echo "ndk: 缺失（Tauri Android 必需）"
fi

if [ -d "$SDK_ROOT/cmdline-tools" ] && [ "$(find "$SDK_ROOT/cmdline-tools" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" != "0" ]; then
  echo "cmdline-tools: OK"
else
  echo "cmdline-tools: 缺失（建议安装）"
fi

echo "== Rust Android Targets =="
rustup target list --installed | grep -E "android" || true
