#!/bin/sh
set -eu

TEST_DATABASE_URL="${TEST_DATABASE_URL:-mysql://express_shop:express_shop@127.0.0.1:3306/express_shop_test}"
PERF_PORT="${PERF_PORT:-3100}"

case "$TEST_DATABASE_URL" in
	*/express_shop_test|*/express_shop_test\?*) ;;
	*)
		echo "拒绝运行：TEST_DATABASE_URL 必须指向 express_shop_test 数据库。" >&2
		exit 1
		;;
esac

if ! node -e "const net=require('node:net');const socket=net.connect(3306,'127.0.0.1');socket.on('connect',()=>{socket.end();process.exit(0)});socket.on('error',()=>process.exit(1))"; then
	npm run dev:services >/dev/null
fi

DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy >/dev/null
DATABASE_URL="$TEST_DATABASE_URL" node scripts/performance-seed.js
DATABASE_URL="$TEST_DATABASE_URL" node scripts/check-query-plans.js

LOG_FILE="${TMPDIR:-/tmp}/express-shop-performance.log"
NODE_ENV=test PORT="$PERF_PORT" DATABASE_URL="$TEST_DATABASE_URL" TASKS_ENABLED=false LOG_LEVEL=error RATE_LIMIT_MAX=1000000 \
	node src/server.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT INT TERM

i=0
until curl -fsS "http://127.0.0.1:$PERF_PORT/ready" >/dev/null; do
	i=$((i + 1))
	if [ "$i" -ge 30 ]; then
		cat "$LOG_FILE" >&2
		exit 1
	fi
	sleep 1
done

PERF_BASE_URL="http://127.0.0.1:$PERF_PORT" node scripts/performance-benchmark.js
