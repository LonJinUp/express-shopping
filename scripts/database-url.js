const input = process.argv[2]
const field = process.argv[3]
if (!input || !field) process.exit(2)

const url = new URL(input)
const values = {
	host: url.hostname,
	port: url.port || '3306',
	user: decodeURIComponent(url.username),
	password: decodeURIComponent(url.password),
	database: url.pathname.slice(1),
}
if (!(field in values) || !values[field]) process.exit(2)
process.stdout.write(values[field])
