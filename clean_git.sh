#!/bin/bash

echo "正在从 Git 跟踪中移除构建产物和上传文件..."
echo ""

# 移除 target 目录
if [ -d "backend/target" ]; then
    echo "移除 backend/target/"
    git rm -r --cached backend/target/ 2>/dev/null || echo "  (未跟踪或已移除)"
fi

# 移除 node_modules
if [ -d "frontend/node_modules" ]; then
    echo "移除 frontend/node_modules/"
    git rm -r --cached frontend/node_modules/ 2>/dev/null || echo "  (未跟踪或已移除)"
fi

# 移除 dist 目录
if [ -d "frontend/dist" ]; then
    echo "移除 frontend/dist/"
    git rm -r --cached frontend/dist/ 2>/dev/null || echo "  (未跟踪或已移除)"
fi

# 移除上传的文件
if [ -d "backend/uploads" ]; then
    echo "移除 backend/uploads/"
    git rm -r --cached backend/uploads/ 2>/dev/null || echo "  (未跟踪或已移除)"
fi

echo ""
echo "完成！现在提交这些更改："
echo "  git add .gitignore"
echo "  git commit -m 'Remove build artifacts and uploads from git tracking'"
