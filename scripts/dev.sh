#!/usr/bin/env bash
# 一键启动开发环境：检查 DB → 启动后端 → 启动前端
# 前端在前台运行，Ctrl+C 会同时停止后端。

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 解析 psql 路径（支持 Homebrew 安装）
PSQL=""
if command -v psql &>/dev/null; then
    PSQL="psql"
elif [ -x "/opt/homebrew/opt/postgresql@16/bin/psql" ]; then
    PSQL="/opt/homebrew/opt/postgresql@16/bin/psql"
elif [ -x "/opt/homebrew/opt/postgresql/bin/psql" ]; then
    PSQL="/opt/homebrew/opt/postgresql/bin/psql"
fi

echo "=========================================="
echo "开发环境启动"
echo "=========================================="

# 1. 检查 PostgreSQL
echo ""
echo "1. 检查 PostgreSQL..."
if [ -z "$PSQL" ]; then
    echo "   ⚠️  未找到 psql，跳过数据库检查"
else
    if $PSQL postgresql://file_storage:file_storage_password@localhost:5432/file_storage -c "SELECT 1;" &>/dev/null; then
        echo "   ✅ 数据库连接成功"
    else
        echo "   ⚠️  数据库连接失败"
        echo "   请先创建数据库: $PSQL postgres -f $ROOT/create_database.sql"
        exit 1
    fi
fi

# 2. 编译并启动后端（后台）
echo ""
echo "2. 启动后端..."
cd "$ROOT/backend"
cargo build -q 2>/dev/null || cargo build
BACKEND_PID=""
cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        echo ""
        echo "停止后端 (PID=$BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM

cargo run &
BACKEND_PID=$!
cd "$ROOT"

# 3. 等待后端就绪
echo "   等待后端就绪..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/health &>/dev/null; then
        echo "   ✅ 后端已就绪 http://localhost:3000"
        break
    fi
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "   ❌ 后端启动失败"
        exit 1
    fi
    sleep 0.5
done
if ! curl -sf http://localhost:3000/health &>/dev/null; then
    kill $BACKEND_PID 2>/dev/null || true
    echo "   ❌ 后端启动超时"
    exit 1
fi

# 4. 启动前端（前台）
echo ""
echo "3. 启动前端..."
echo "   访问 http://localhost:5173"
echo "   Ctrl+C 停止前端与后端"
echo ""
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
npm run dev
