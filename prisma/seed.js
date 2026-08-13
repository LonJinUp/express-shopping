import bcrypt from 'bcryptjs'
import { prisma } from '../src/config/prisma.js'

const permissions = [
	['PRODUCT_MANAGE', '商品管理'],
	['INVENTORY_MANAGE', '库存管理'],
	['ORDER_MANAGE', '订单管理'],
	['USER_MANAGE', '用户管理'],
]

async function main() {
	const merchant = await prisma.merchant.upsert({
		where: { code: 'DEFAULT' },
		update: { name: '默认商户' },
		create: { code: 'DEFAULT', name: '默认商户' },
	})

	await prisma.shop.upsert({
		where: { code: 'DEFAULT' },
		update: { name: '默认店铺', merchantId: merchant.id },
		create: { code: 'DEFAULT', name: '默认店铺', merchantId: merchant.id },
	})

	const userRole = await prisma.role.upsert({
		where: { code: 'USER' },
		update: { name: '普通用户' },
		create: { code: 'USER', name: '普通用户' },
	})
	const adminRole = await prisma.role.upsert({
		where: { code: 'ADMIN' },
		update: { name: '管理员' },
		create: { code: 'ADMIN', name: '管理员' },
	})

	for (const [code, name] of permissions) {
		const permission = await prisma.permission.upsert({ where: { code }, update: { name }, create: { code, name } })
		await prisma.rolePermission.upsert({
			where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
			update: {},
			create: { roleId: adminRole.id, permissionId: permission.id },
		})
	}

	const adminEmail = process.env.ADMIN_EMAIL
	const adminPassword = process.env.ADMIN_PASSWORD
	if (adminEmail && adminPassword) {
		if (adminPassword.length < 8) throw new Error('ADMIN_PASSWORD 至少需要 8 个字符')
		const admin = await prisma.user.upsert({
			where: { email: adminEmail },
			update: { status: 'ACTIVE' },
			create: {
				email: adminEmail,
				nickname: '管理员',
				passwordHash: await bcrypt.hash(adminPassword, 12),
			},
		})
		await prisma.userRole.upsert({
			where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
			update: {},
			create: { userId: admin.id, roleId: adminRole.id },
		})
	}

	console.log(`Seed completed: roles ${userRole.code}, ${adminRole.code}`)
}

main()
	.catch((error) => {
		console.error(error)
		process.exitCode = 1
	})
	.finally(() => prisma.$disconnect())
