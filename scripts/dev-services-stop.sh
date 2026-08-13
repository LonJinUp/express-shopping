#!/bin/sh
set -eu

RUNTIME="${EXPRESS_SHOP_RUNTIME:-$HOME/.cache/express-shop-runtime}"
MYSQL_HOME="$RUNTIME/mysql-8.4.10-macos15-arm64"
REDIS_HOME="$RUNTIME/redis-7.4.7"

if [ -x "$MYSQL_HOME/bin/mysqladmin" ] && lsof -nP -iTCP:3306 -sTCP:LISTEN >/dev/null 2>&1; then
	"$MYSQL_HOME/bin/mysqladmin" --no-defaults -h127.0.0.1 -P3306 -uexpress_shop -pexpress_shop shutdown
fi

if [ -x "$REDIS_HOME/src/redis-cli" ] && lsof -nP -iTCP:6379 -sTCP:LISTEN >/dev/null 2>&1; then
	"$REDIS_HOME/src/redis-cli" -h 127.0.0.1 -p 6379 shutdown
fi

echo "开发依赖已停止"
