#!/bin/sh
set -eu

TEST_DATABASE_URL="${TEST_DATABASE_URL:-mysql://express_shop:express_shop@127.0.0.1:3306/express_shop_test}"

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

RUNTIME="${EXPRESS_SHOP_RUNTIME:-$HOME/.cache/express-shop-runtime}"
MYSQL="$RUNTIME/mysql-8.4.10-macos15-arm64/bin/mysql"
SOCKET="$RUNTIME/run/mysql.sock"
if [ -x "$MYSQL" ] && [ -S "$SOCKET" ]; then
	"$MYSQL" --no-defaults --socket="$SOCKET" -uroot -e \
		"CREATE DATABASE IF NOT EXISTS express_shop_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON express_shop_test.* TO 'express_shop'@'127.0.0.1'; FLUSH PRIVILEGES;"
else
	TEST_DATABASE_ADMIN_URL="${TEST_DATABASE_ADMIN_URL:-mysql://root:root@127.0.0.1:3306/mysql}"
	printf '%s\n' 'CREATE DATABASE IF NOT EXISTS express_shop_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;' | \
		npx prisma db execute --stdin --url="$TEST_DATABASE_ADMIN_URL"
fi

DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
NODE_ENV=test DATABASE_URL="$TEST_DATABASE_URL" TASKS_ENABLED=false LOG_LEVEL=error \
	npx vitest run tests/integration --maxWorkers=1
