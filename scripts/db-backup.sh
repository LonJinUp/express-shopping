#!/bin/sh
set -eu

DATABASE_URL="${DATABASE_URL:-$(node --env-file-if-exists=.env -e "process.stdout.write(process.env.DATABASE_URL ?? '')")}"
if [ -z "$DATABASE_URL" ]; then
	echo "必须通过环境变量或 .env 配置 DATABASE_URL。" >&2
	exit 1
fi
BACKUP_DIR="${BACKUP_DIR:-backups}"
RUNTIME="${EXPRESS_SHOP_RUNTIME:-$HOME/.cache/express-shop-runtime}"
MYSQL_HOME="$RUNTIME/mysql-8.4.10-macos15-arm64"

HOST=$(node scripts/database-url.js "$DATABASE_URL" host)
PORT=$(node scripts/database-url.js "$DATABASE_URL" port)
USER=$(node scripts/database-url.js "$DATABASE_URL" user)
PASSWORD=$(node scripts/database-url.js "$DATABASE_URL" password)
DATABASE=$(node scripts/database-url.js "$DATABASE_URL" database)

if [ -x "$MYSQL_HOME/bin/mysqldump" ]; then
	MYSQLDUMP="$MYSQL_HOME/bin/mysqldump"
elif command -v mysqldump >/dev/null 2>&1; then
	MYSQLDUMP=$(command -v mysqldump)
else
	echo "找不到 mysqldump，请安装 MySQL 客户端。" >&2
	exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUTPUT="$BACKUP_DIR/${DATABASE}-${TIMESTAMP}.sql.gz"
TEMP="$OUTPUT.tmp"
trap 'rm -f "$TEMP"' EXIT INT TERM

MYSQL_PWD="$PASSWORD" "$MYSQLDUMP" \
	--host="$HOST" \
	--port="$PORT" \
	--user="$USER" \
	--single-transaction \
	--quick \
	--routines \
	--triggers \
	--events \
	--set-gtid-purged=OFF \
	--no-tablespaces \
	"$DATABASE" | gzip -9 >"$TEMP"

gzip -t "$TEMP"
mv "$TEMP" "$OUTPUT"
shasum -a 256 "$OUTPUT" >"$OUTPUT.sha256"
echo "备份完成：$OUTPUT"
