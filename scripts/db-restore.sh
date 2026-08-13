#!/bin/sh
set -eu

DATABASE_URL="${DATABASE_URL:-$(node --env-file-if-exists=.env -e "process.stdout.write(process.env.DATABASE_URL ?? '')")}"
if [ -z "$DATABASE_URL" ]; then
	echo "必须通过环境变量或 .env 配置目标 DATABASE_URL。" >&2
	exit 1
fi
BACKUP_FILE="${BACKUP_FILE:?必须配置 BACKUP_FILE}"
RUNTIME="${EXPRESS_SHOP_RUNTIME:-$HOME/.cache/express-shop-runtime}"
MYSQL_HOME="$RUNTIME/mysql-8.4.10-macos15-arm64"

HOST=$(node scripts/database-url.js "$DATABASE_URL" host)
PORT=$(node scripts/database-url.js "$DATABASE_URL" port)
USER=$(node scripts/database-url.js "$DATABASE_URL" user)
PASSWORD=$(node scripts/database-url.js "$DATABASE_URL" password)
DATABASE=$(node scripts/database-url.js "$DATABASE_URL" database)

case "$DATABASE" in
	*_test) ;;
	*)
		if [ "${ALLOW_PRODUCTION_RESTORE:-false}" != "true" ]; then
			echo "拒绝恢复非测试数据库；生产恢复需设置 ALLOW_PRODUCTION_RESTORE=true。" >&2
			exit 1
		fi
		;;
esac

if [ "${CONFIRM_RESTORE:-}" != "$DATABASE" ]; then
	echo "拒绝恢复：CONFIRM_RESTORE 必须与目标数据库名 $DATABASE 完全一致。" >&2
	exit 1
fi
if [ ! -f "$BACKUP_FILE" ]; then
	echo "备份文件不存在：$BACKUP_FILE" >&2
	exit 1
fi
if [ -f "$BACKUP_FILE.sha256" ]; then
	shasum -a 256 -c "$BACKUP_FILE.sha256"
fi
gzip -t "$BACKUP_FILE"

if [ -x "$MYSQL_HOME/bin/mysql" ]; then
	MYSQL="$MYSQL_HOME/bin/mysql"
elif command -v mysql >/dev/null 2>&1; then
	MYSQL=$(command -v mysql)
else
	echo "找不到 mysql，请安装 MySQL 客户端。" >&2
	exit 1
fi

gzip -dc "$BACKUP_FILE" | MYSQL_PWD="$PASSWORD" "$MYSQL" \
	--host="$HOST" \
	--port="$PORT" \
	--user="$USER" \
	--database="$DATABASE"
echo "恢复完成：$DATABASE"
