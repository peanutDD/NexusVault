#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="UploadDownloadUtil.app"
SRC_APP="$ROOT_DIR/src-tauri/target/release/bundle/macos/$APP_NAME"
DEST_APP="/Applications/$APP_NAME"
OPEN_AFTER_INSTALL=true
CUSTOM_DEST=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-open)
      OPEN_AFTER_INSTALL=false
      shift
      ;;
    --dest)
      if [ "$#" -lt 2 ]; then
        echo "参数 --dest 需要提供路径"
        exit 1
      fi
      DEST_APP="$2"
      CUSTOM_DEST=true
      shift 2
      ;;
    *)
      echo "未知参数: $1"
      echo "用法: $(basename "$0") [--no-open] [--dest /path/to/App.app]"
      exit 1
      ;;
  esac
done

if [ ! -d "$SRC_APP" ]; then
  echo "未找到构建产物，开始执行 npx tauri build..."
  (cd "$ROOT_DIR" && npx tauri build)
fi

/usr/bin/osascript -e 'tell application "UploadDownloadUtil" to quit' >/dev/null 2>&1 || true
pkill -f "$APP_NAME" >/dev/null 2>&1 || true

if [ "$CUSTOM_DEST" = true ]; then
  rm -rf "$DEST_APP"
  cp -R "$SRC_APP" "$DEST_APP"
elif [ -w "/Applications" ]; then
  rm -rf "$DEST_APP"
  cp -R "$SRC_APP" "/Applications/"
else
  sudo rm -rf "$DEST_APP"
  sudo cp -R "$SRC_APP" "/Applications/"
fi

touch "$DEST_APP"
if [ "$CUSTOM_DEST" = false ]; then
  killall Dock >/dev/null 2>&1 || true
  killall Finder >/dev/null 2>&1 || true
fi

if [ "$OPEN_AFTER_INSTALL" = true ]; then
  open "$DEST_APP"
fi

echo "安装完成: $DEST_APP"
