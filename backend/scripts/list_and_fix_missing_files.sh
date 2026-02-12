#!/usr/bin/env bash
# 1. 列出 DB 中有记录但磁盘上不存在的文件
# 2. 可选：生成 DELETE 语句或直接删除
# 用法: ./scripts/list_and_fix_missing_files.sh [--delete]
# --delete: 执行删除；不加则只列出

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

STORAGE_PATH="${STORAGE_PATH:-./uploads}"
if [[ "$STORAGE_PATH" != /* ]]; then
  BASE_DIR="$(pwd)"
  STORAGE_ABS="$BASE_DIR/$STORAGE_PATH"
else
  STORAGE_ABS="$STORAGE_PATH"
fi

DO_DELETE=false
[[ "$1" == "--delete" ]] && DO_DELETE=true

psql -d file_storage -t -A -c "SELECT id, file_path FROM files" | while IFS='|' read -r id path; do
  [[ -z "$id" ]] && continue
  if [[ "$path" == ./* ]]; then
    full_path="$BACKEND_DIR/${path#./}"
  elif [[ "$path" != /* ]]; then
    full_path="$BACKEND_DIR/$path"
  else
    full_path="$path"
  fi
  if [[ ! -f "$full_path" ]]; then
    echo "$id"
  fi
done > /tmp/missing_file_ids.txt 2>/dev/null || true

COUNT=$(wc -l < /tmp/missing_file_ids.txt 2>/dev/null || echo 0)
echo "Missing files (DB record exists, file not on disk): $COUNT"
echo ""
cat /tmp/missing_file_ids.txt 2>/dev/null | head -50
[[ $COUNT -gt 50 ]] && echo "... and $((COUNT - 50)) more"
echo ""

if [[ $COUNT -gt 0 ]]; then
  echo "To delete these records, run:"
  echo "  cat /tmp/missing_file_ids.txt | xargs -I {} psql -d file_storage -c \"DELETE FROM files WHERE id = '{}';\""
  echo ""
  echo "Or use a single transaction (faster):"
  echo "  (echo 'BEGIN;'; cat /tmp/missing_file_ids.txt | sed \"s/.*/DELETE FROM files WHERE id = '&';/\"; echo 'COMMIT;') | psql -d file_storage -f -"
fi
