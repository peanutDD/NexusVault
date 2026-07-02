#!/usr/bin/env bash
# 检查 files 表中记录的文件在磁盘上是否存在
# 用法: 在 backend 目录下执行 ./scripts/check_missing_files.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# 解析 .env 中的 STORAGE_PATH，默认 ./uploads
STORAGE_PATH="${STORAGE_PATH:-./uploads}"
# 转为绝对路径
if [[ "$STORAGE_PATH" != /* ]]; then
  BASE_DIR="$(pwd)"
  STORAGE_ABS="$BASE_DIR/$STORAGE_PATH"
else
  STORAGE_ABS="$STORAGE_PATH"
fi

echo "Storage base: $STORAGE_ABS"
echo "Checking files from database..."
echo ""

# 从数据库读取 file_path，逐行检查
psql -d file_storage -t -A -c "SELECT id, file_path FROM files" | while IFS='|' read -r id path; do
  # 路径可能是 ./uploads/... 或相对路径，统一转为绝对路径
  if [[ "$path" == ./* ]]; then
    full_path="$BACKEND_DIR/${path#./}"
  elif [[ "$path" != /* ]]; then
    full_path="$BACKEND_DIR/$path"
  else
    full_path="$path"
  fi
  if [[ ! -f "$full_path" ]]; then
    echo "$id|$path"
  fi
done
