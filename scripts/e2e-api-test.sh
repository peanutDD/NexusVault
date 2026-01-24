#!/usr/bin/env bash
# E2E API 测试：注册 → 登录 → 上传 → 列表 → 下载 → 删除
# 使用前请确保后端已启动：cd backend && cargo run

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="e2e-$(date +%s)@example.com"
USERNAME="e2etest"
PASSWORD="password123"

echo "=========================================="
echo "E2E API 测试"
echo "BASE_URL=$BASE_URL"
echo "=========================================="

# 健康检查
echo ""
echo "1. 健康检查..."
curl -sf "$BASE_URL/health" | grep -q OK || { echo "FAIL: /health"; exit 1; }
echo "   OK"

# 注册
echo ""
echo "2. 注册..."
REG=$(curl -sf -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$REG" | grep -q '"token"' || { echo "FAIL: register"; echo "$REG"; exit 1; }
echo "   OK"

# 登录
echo ""
echo "3. 登录..."
LOGIN=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN" ] || { echo "FAIL: login"; echo "$LOGIN"; exit 1; }
echo "   OK"

# 上传
echo ""
echo "4. 上传文件..."
echo "test content $(date)" > /tmp/e2e-upload.txt
UPLOAD=$(curl -sf -X POST "$BASE_URL/api/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/e2e-upload.txt")
FILE_ID=$(echo "$UPLOAD" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$FILE_ID" ] || { echo "FAIL: upload"; echo "$UPLOAD"; exit 1; }
echo "   OK (file_id=$FILE_ID)"

# 列表
echo ""
echo "5. 列表..."
LIST=$(curl -sf "$BASE_URL/api/files?page=1&limit=20" -H "Authorization: Bearer $TOKEN")
echo "$LIST" | grep -q "$FILE_ID" || { echo "FAIL: list"; echo "$LIST"; exit 1; }
echo "   OK"

# 下载
echo ""
echo "6. 下载..."
curl -sf "$BASE_URL/api/files/$FILE_ID/download" -H "Authorization: Bearer $TOKEN" -o /tmp/e2e-download.txt
grep -q "test content" /tmp/e2e-download.txt || { echo "FAIL: download content"; exit 1; }
echo "   OK"

# 删除
echo ""
echo "7. 删除..."
curl -sf -X DELETE "$BASE_URL/api/files/$FILE_ID" -H "Authorization: Bearer $TOKEN" | grep -q "deleted" || true
LIST2=$(curl -sf "$BASE_URL/api/files?page=1&limit=20" -H "Authorization: Bearer $TOKEN")
echo "$LIST2" | grep -q '"total":0' || { echo "FAIL: delete (list not empty)"; echo "$LIST2"; exit 1; }
echo "   OK"

echo ""
echo "=========================================="
echo "全部通过"
echo "=========================================="
