#!/usr/bin/env bash
# 将 PostgreSQL 数据库备份到本地 backend/backups/ 目录
# 用法: 在 backend 目录下执行 ./scripts/backup_db.sh
# 可选环境变量:
#   DATABASE_URL          覆盖 .env 中的配置
#   BACKUP_RETAIN_DAYS    旧备份保留天数，默认 14

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# 加载 .env（若存在），不覆盖已设置的环境变量
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# 默认值（与 .env.example 保持一致）
DATABASE_URL="${DATABASE_URL:-postgresql://file_storage:file_storage_password@localhost:5432/file_storage}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"

# 备份目录（*.dump 已被 .gitignore 忽略）
BACKUP_DIR="$BACKEND_DIR/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/db_${TIMESTAMP}.dump"

echo "→ Backing up database via DATABASE_URL ..."
echo "  Target: $BACKUP_FILE"

# pg_dump 直接接受连接字符串；-F c 为自定义压缩格式，恢复用 pg_restore
pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE"

# 校验
if [[ -f "$BACKUP_FILE" ]]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✓ Backup OK: $BACKUP_FILE ($SIZE)"
else
  echo "✗ Backup FAILED: file not created" >&2
  exit 1
fi

# 清理过期备份
echo "→ Pruning backups older than $BACKUP_RETAIN_DAYS days ..."
find "$BACKUP_DIR" -name 'db_*.dump' -mtime +"$BACKUP_RETAIN_DAYS" -print -delete || true

echo "Done."
