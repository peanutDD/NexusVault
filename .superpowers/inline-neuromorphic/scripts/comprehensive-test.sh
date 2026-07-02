#!/usr/bin/env bash
# 全面系统测试脚本
# 测试所有功能：数据库连接、注册、登录、上传、下载、删除、分享、配额、错误处理

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="test-$(date +%s)@example.com"
USERNAME="testuser$(date +%s)"
PASSWORD="TestPassword123!"
TEST_FILE="/tmp/test-upload-$(date +%s).txt"
TEST_FILE_CONTENT="这是测试文件内容 $(date)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TESTS_PASSED=0
TESTS_FAILED=0

# 辅助函数
pass() {
    echo -e "${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    echo "  错误详情: $2"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# 清理函数
cleanup() {
    rm -f "$TEST_FILE" /tmp/test-download-*.txt /tmp/test-share-*.txt 2>/dev/null || true
    # 不退出，即使清理失败
    true
}

trap cleanup EXIT

echo "=========================================="
echo "全面系统测试"
echo "BASE_URL=$BASE_URL"
echo "=========================================="
echo ""

# 1. 数据库连接测试
echo "1. 测试数据库连接..."
if pg_isready -h localhost -p 5432 -U file_storage >/dev/null 2>&1; then
    pass "数据库连接正常"
else
    fail "数据库连接失败" "请确保 PostgreSQL 正在运行"
    exit 1
fi

# 2. 后端健康检查
echo ""
echo "2. 测试后端健康检查..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" 2>/dev/null || echo "")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "OK"; then
    pass "后端健康检查通过"
else
    fail "后端健康检查失败" "HTTP $HTTP_CODE: $BODY (请确保后端正在运行: cd backend && cargo run)"
    info "提示: 后端需要在 http://localhost:3000 运行"
    exit 1
fi

# 3. 用户注册
echo ""
echo "3. 测试用户注册..."
REG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null || echo "")
REG_HTTP_CODE=$(echo "$REG_RESPONSE" | tail -n1)
REG_BODY=$(echo "$REG_RESPONSE" | sed '$d')

if ([ "$REG_HTTP_CODE" = "200" ] || [ "$REG_HTTP_CODE" = "201" ]) && echo "$REG_BODY" | grep -q '"token"'; then
    REG_TOKEN=$(echo "$REG_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    pass "用户注册成功"
else
    fail "用户注册失败" "HTTP $REG_HTTP_CODE: $REG_BODY"
    exit 1
fi

# 4. 用户登录
echo ""
echo "4. 测试用户登录..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null || echo "")
LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$LOGIN_HTTP_CODE" = "200" ] && echo "$LOGIN_BODY" | grep -q '"token"'; then
    TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    pass "用户登录成功"
else
    fail "用户登录失败" "HTTP $LOGIN_HTTP_CODE: $LOGIN_BODY"
    exit 1
fi

# 5. 获取当前用户信息
echo ""
echo "5. 测试获取当前用户信息..."
ME_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
ME_HTTP_CODE=$(echo "$ME_RESPONSE" | tail -n1)
ME_BODY=$(echo "$ME_RESPONSE" | sed '$d')

if [ "$ME_HTTP_CODE" = "200" ] && echo "$ME_BODY" | grep -q '"email"'; then
    pass "获取用户信息成功"
else
    fail "获取用户信息失败" "HTTP $ME_HTTP_CODE: $ME_BODY"
fi

# 6. 文件上传
echo ""
echo "6. 测试文件上传..."
echo "$TEST_FILE_CONTENT" > "$TEST_FILE"
UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE" 2>/dev/null || echo "")
UPLOAD_HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)
UPLOAD_BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')

if ([ "$UPLOAD_HTTP_CODE" = "200" ] || [ "$UPLOAD_HTTP_CODE" = "201" ]) && echo "$UPLOAD_BODY" | grep -q '"id"'; then
    FILE_ID=$(echo "$UPLOAD_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    pass "文件上传成功 (file_id=$FILE_ID)"
else
    fail "文件上传失败" "HTTP $UPLOAD_HTTP_CODE: $UPLOAD_BODY"
    FILE_ID=""
fi

# 7. 文件列表
echo ""
echo "7. 测试文件列表..."
LIST_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/files?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
LIST_HTTP_CODE=$(echo "$LIST_RESPONSE" | tail -n1)
LIST_BODY=$(echo "$LIST_RESPONSE" | sed '$d')

if [ "$LIST_HTTP_CODE" = "200" ] && echo "$LIST_BODY" | grep -q '"files"'; then
    if [ -n "$FILE_ID" ] && echo "$LIST_BODY" | grep -q "$FILE_ID"; then
        pass "文件列表查询成功，包含上传的文件"
    else
        pass "文件列表查询成功"
    fi
else
    fail "文件列表查询失败" "HTTP $LIST_HTTP_CODE: $LIST_BODY"
fi

# 8. 文件下载
if [ -n "$FILE_ID" ]; then
    echo ""
    echo "8. 测试文件下载..."
    DOWNLOAD_FILE="/tmp/test-download-$(date +%s).txt"
    DOWNLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/files/$FILE_ID/download" \
      -H "Authorization: Bearer $TOKEN" \
      -o "$DOWNLOAD_FILE" 2>/dev/null || echo "")
    DOWNLOAD_HTTP_CODE=$(echo "$DOWNLOAD_RESPONSE" | tail -n1)

    if [ "$DOWNLOAD_HTTP_CODE" = "200" ] && [ -f "$DOWNLOAD_FILE" ]; then
        if grep -q "$TEST_FILE_CONTENT" "$DOWNLOAD_FILE"; then
            pass "文件下载成功，内容匹配"
        else
            fail "文件下载成功但内容不匹配" ""
        fi
    else
        fail "文件下载失败" "HTTP $DOWNLOAD_HTTP_CODE"
    fi
else
    info "跳过文件下载测试（文件上传失败）"
fi

# 9. 存储使用情况
echo ""
echo "9. 测试存储使用情况查询..."
STORAGE_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/files/storage-usage" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
STORAGE_HTTP_CODE=$(echo "$STORAGE_RESPONSE" | tail -n1)
STORAGE_BODY=$(echo "$STORAGE_RESPONSE" | sed '$d')

if [ "$STORAGE_HTTP_CODE" = "200" ] && (echo "$STORAGE_BODY" | grep -q '"usage"' || echo "$STORAGE_BODY" | grep -q '"total_size"'); then
    pass "存储使用情况查询成功"
else
    fail "存储使用情况查询失败" "HTTP $STORAGE_HTTP_CODE: $STORAGE_BODY"
fi

# 10. 文件分享（如果文件存在）
if [ -n "$FILE_ID" ]; then
    echo ""
    echo "10. 测试文件分享..."
    SHARE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/shares" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"file_id\":\"$FILE_ID\",\"password\":\"sharepass123\",\"expires_in_hours\":24}" 2>/dev/null || echo "")
    SHARE_HTTP_CODE=$(echo "$SHARE_RESPONSE" | tail -n1)
    SHARE_BODY=$(echo "$SHARE_RESPONSE" | sed '$d')

    if ([ "$SHARE_HTTP_CODE" = "200" ] || [ "$SHARE_HTTP_CODE" = "201" ]) && (echo "$SHARE_BODY" | grep -q '"token"' || echo "$SHARE_BODY" | grep -q '"share_token"'); then
        SHARE_TOKEN=$(echo "$SHARE_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        if [ -z "$SHARE_TOKEN" ]; then
            SHARE_TOKEN=$(echo "$SHARE_BODY" | grep -o '"share_token":"[^"]*"' | cut -d'"' -f4)
        fi
        pass "文件分享创建成功 (share_token=$SHARE_TOKEN)"
        
        # 测试访问分享链接
        echo ""
        echo "10.1. 测试访问分享链接..."
        ACCESS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/shares/$SHARE_TOKEN/access" \
          -H "Content-Type: application/json" \
          -d "{\"password\":\"sharepass123\"}" 2>/dev/null || echo "")
        ACCESS_HTTP_CODE=$(echo "$ACCESS_RESPONSE" | tail -n1)
        ACCESS_BODY=$(echo "$ACCESS_RESPONSE" | sed '$d')

        if [ "$ACCESS_HTTP_CODE" = "200" ] && (echo "$ACCESS_BODY" | grep -q '"file_id"' || echo "$ACCESS_BODY" | grep -q '"file"'); then
            pass "分享链接访问成功"
        else
            fail "分享链接访问失败" "HTTP $ACCESS_HTTP_CODE: $ACCESS_BODY"
        fi
    else
        fail "文件分享创建失败" "HTTP $SHARE_HTTP_CODE: $SHARE_BODY"
    fi
else
    info "跳过文件分享测试（文件上传失败）"
fi

# 11. 错误处理测试
echo ""
echo "11. 测试错误处理..."
# 11.1 无效 token
INVALID_TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer invalid-token-12345" 2>/dev/null || echo "")
INVALID_TOKEN_HTTP_CODE=$(echo "$INVALID_TOKEN_RESPONSE" | tail -n1)

if [ "$INVALID_TOKEN_HTTP_CODE" = "401" ] || [ "$INVALID_TOKEN_HTTP_CODE" = "403" ]; then
    pass "无效 token 错误处理正确 (HTTP $INVALID_TOKEN_HTTP_CODE)"
else
    fail "无效 token 错误处理不正确" "期望 401/403，实际 HTTP $INVALID_TOKEN_HTTP_CODE"
fi

# 11.2 不存在的文件下载
NOT_FOUND_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/files/00000000-0000-0000-0000-000000000000/download" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
NOT_FOUND_HTTP_CODE=$(echo "$NOT_FOUND_RESPONSE" | tail -n1)

if [ "$NOT_FOUND_HTTP_CODE" = "404" ]; then
    pass "不存在文件错误处理正确 (HTTP 404)"
else
    fail "不存在文件错误处理不正确" "期望 404，实际 HTTP $NOT_FOUND_HTTP_CODE"
fi

# 12. 文件删除
if [ -n "$FILE_ID" ]; then
    echo ""
    echo "12. 测试文件删除..."
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/files/$FILE_ID" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
    DELETE_HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
    DELETE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')

    if [ "$DELETE_HTTP_CODE" = "200" ] || [ "$DELETE_HTTP_CODE" = "204" ]; then
        pass "文件删除成功"
        
        # 验证文件确实被删除
        VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/files/$FILE_ID/download" \
          -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
        VERIFY_HTTP_CODE=$(echo "$VERIFY_RESPONSE" | tail -n1)
        
        if [ "$VERIFY_HTTP_CODE" = "404" ]; then
            pass "文件删除验证成功（文件已不存在）"
        else
            fail "文件删除验证失败" "文件仍然可以访问 (HTTP $VERIFY_HTTP_CODE)"
        fi
    else
        fail "文件删除失败" "HTTP $DELETE_HTTP_CODE: $DELETE_BODY"
    fi
else
    info "跳过文件删除测试（文件上传失败）"
fi

# 总结
echo ""
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo -e "${GREEN}通过: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}失败: $TESTS_FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}失败: $TESTS_FAILED${NC}"
    echo ""
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
fi
