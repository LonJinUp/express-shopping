#!/bin/sh
set -eu

RUNTIME="${EXPRESS_SHOP_RUNTIME:-$HOME/.cache/express-shop-runtime}"
MYSQL_HOME="$RUNTIME/mysql-8.4.10-macos15-arm64"
MYSQL_DATA="$RUNTIME/mysql-data"
REDIS_HOME="$RUNTIME/redis-7.4.7"
RUN_DIR="$RUNTIME/run"

if [ ! -x "$MYSQL_HOME/bin/mysqld" ] || [ ! -x "$REDIS_HOME/src/redis-server" ]; then
	echo "开发依赖运行时不存在，请先按 README 的开发环境说明安装。" >&2
	exit 1
fi

mkdir -p "$RUN_DIR" "$RUNTIME/redis-data"

if ! lsof -nP -iTCP:3306 -sTCP:LISTEN >/dev/null 2>&1; then
	"$MYSQL_HOME/bin/mysqld" \
		--no-defaults \
		--basedir="$MYSQL_HOME" \
		--datadir="$MYSQL_DATA" \
		--port=3306 \
		--bind-address=127.0.0.1 \
		--socket="$RUN_DIR/mysql.sock" \
		--pid-file="$RUN_DIR/mysql.pid" \
		--log-error="$RUN_DIR/mysql.log" \
		--daemonize
fi

i=0
until "$MYSQL_HOME/bin/mysqladmin" --no-defaults -h127.0.0.1 -P3306 -uexpress_shop -pexpress_shop ping >/dev/null 2>&1; do
	i=$((i + 1))
	if [ "$i" -ge 30 ]; then
		echo "MySQL 启动超时，请检查 $RUN_DIR/mysql.log" >&2
		exit 1
	fi
	sleep 1
done

if ! lsof -nP -iTCP:6379 -sTCP:LISTEN >/dev/null 2>&1; then
	"$REDIS_HOME/src/redis-server" \
		--bind 127.0.0.1 \
		--port 6379 \
		--dir "$RUNTIME/redis-data" \
		--appendonly yes \
		--daemonize yes \
		--pidfile "$RUN_DIR/redis.pid" \
		--logfile "$RUN_DIR/redis.log"
fi

"$REDIS_HOME/src/redis-cli" -h 127.0.0.1 -p 6379 ping >/dev/null
echo "开发依赖已就绪：MySQL 127.0.0.1:3306，Redis 127.0.0.1:6379"
