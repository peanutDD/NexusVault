#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"

if [ -z "${JAVA_HOME:-}" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi

if [ -z "${JAVA_HOME:-}" ] && command -v /usr/libexec/java_home >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home)"
fi

if [ -z "${NDK_HOME:-}" ] && [ -d "$SDK_ROOT/ndk" ]; then
  latest_ndk="$(find "$SDK_ROOT/ndk" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
  if [ -n "${latest_ndk:-}" ]; then
    export NDK_HOME="$latest_ndk"
  fi
fi

export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"

BUILD_TOOLS_DIR="$(find "$ANDROID_SDK_ROOT/build-tools" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
ZIPALIGN_BIN="$BUILD_TOOLS_DIR/zipalign"
APKSIGNER_BIN="$BUILD_TOOLS_DIR/apksigner"

if [ ! -x "$ZIPALIGN_BIN" ] || [ ! -x "$APKSIGNER_BIN" ]; then
  echo "未找到 zipalign 或 apksigner: $BUILD_TOOLS_DIR"
  exit 1
fi

KEYSTORE_DIR="$ROOT_DIR/src-tauri/gen/android/keys"
KEYSTORE_PATH="${ANDROID_KEYSTORE_PATH:-$KEYSTORE_DIR/upload-download-util-release.jks}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-uploaddownloadutil}"
KEYSTORE_PASSWORD="${ANDROID_KEYSTORE_PASSWORD:-ChangeThisPassword123!}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$KEYSTORE_PASSWORD}"
KEY_DNAME="${ANDROID_KEY_DNAME:-CN=UploadDownloadUtil, OU=Mobile, O=UploadDownloadUtil, L=Shanghai, ST=Shanghai, C=CN}"

mkdir -p "$KEYSTORE_DIR"

if [ ! -f "$KEYSTORE_PATH" ]; then
  if [ -x "${JAVA_HOME:-}/bin/keytool" ]; then
    KEYTOOL_BIN="${JAVA_HOME}/bin/keytool"
  else
    KEYTOOL_BIN="$(command -v keytool)"
  fi
  "$KEYTOOL_BIN" -genkeypair -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 36500 -storepass "$KEYSTORE_PASSWORD" -keypass "$KEY_PASSWORD" -dname "$KEY_DNAME"
fi

cd "$ROOT_DIR"
npm run android:apk

UNSIGNED_APK="$ROOT_DIR/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk"
ALIGNED_APK="$ROOT_DIR/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-aligned.apk"
SIGNED_APK="$ROOT_DIR/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-signed.apk"

if [ ! -f "$UNSIGNED_APK" ]; then
  echo "未找到 unsigned APK: $UNSIGNED_APK"
  exit 1
fi

"$ZIPALIGN_BIN" -f -p 4 "$UNSIGNED_APK" "$ALIGNED_APK"
"$APKSIGNER_BIN" sign --ks "$KEYSTORE_PATH" --ks-key-alias "$KEY_ALIAS" --ks-pass "pass:$KEYSTORE_PASSWORD" --key-pass "pass:$KEY_PASSWORD" --out "$SIGNED_APK" "$ALIGNED_APK"
"$APKSIGNER_BIN" verify --verbose "$SIGNED_APK"

echo "SIGNED_APK=$SIGNED_APK"
echo "安装命令: adb install -r \"$SIGNED_APK\""
