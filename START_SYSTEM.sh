#!/bin/bash

# 文件上传下载系统启动脚本

set -e

echo "=========================================="
echo "文件上传下载系统启动脚本"
echo "=========================================="
echo ""

# 检查 PostgreSQL
echo "1. 检查 PostgreSQL..."
if command -v psql &> /dev/null; then
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        echo "   ✅ PostgreSQL 正在运行"
    else
        echo "   ⚠️  PostgreSQL 未运行，请先启动："
        echo "      brew services start postgresql@16"
        echo "      或使用 Docker: docker-compose up -d"
        exit 1
    fi
else
    echo "   ⚠️  PostgreSQL 未安装"
    echo "   请先安装 PostgreSQL："
    echo "   brew install postgresql@16"
    echo "   或使用 Docker: docker-compose up -d"
    exit 1
fi

# 检查数据库
echo ""
echo "2. 检查数据库..."
if psql postgresql://file_storage:file_storage_password@localhost:5432/file_storage -c "SELECT 1;" &> /dev/null; then
    echo "   ✅ 数据库连接成功"
else
    echo "   ⚠️  数据库不存在或连接失败"
    echo "   请创建数据库："
    echo "   psql postgres"
    echo "   CREATE DATABASE file_storage;"
    echo "   CREATE USER file_storage WITH PASSWORD 'file_storage_password';"
    echo "   GRANT ALL PRIVILEGES ON DATABASE file_storage TO file_storage;"
    exit 1
fi

# 检查后端
echo ""
echo "3. 检查后端..."
cd backend
if [ ! -f "target/debug/file-storage-backend" ] && [ ! -f "target/release/file-storage-backend" ]; then
    echo "   ⚠️  后端未编译，正在编译..."
    cargo build
fi
echo "   ✅ 后端已准备就绪"

# 检查前端
echo ""
echo "4. 检查前端..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "   ⚠️  前端依赖未安装，正在安装..."
    npm install
fi
echo "   ✅ 前端已准备就绪"

echo ""
echo "=========================================="
echo "启动系统"
echo "=========================================="
echo ""
echo "请打开两个终端窗口："
echo ""
echo "终端 1 - 后端服务器："
echo "  cd $(pwd)/../backend"
echo "  cargo run"
echo ""
echo "终端 2 - 前端开发服务器："
echo "  cd $(pwd)"
echo "  npm run dev"
echo ""
echo "然后访问: http://localhost:5173"
echo ""
