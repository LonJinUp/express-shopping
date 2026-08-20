import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

const applicationSelect = {
	id: true,
	clientRequestId: true,
	merchantName: true,
	merchantCode: true,
	shopName: true,
	shopCode: true,
	contactName: true,
	contactPhone: true,
	qualificationUrl: true,
	status: true,
	rejectReason: true,
	reviewedAt: true,
	merchantId: true,
	createdAt: true,
	updatedAt: true,
}

function conflict(message) {
	return new AppError(message, { statusCode: 409, code: ERROR_CODES.CONFLICT })
}

export async function createApplication(userId, input) {
	try {
		return await prisma.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`
			const repeated = await tx.merchantApplication.findUnique({
				where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
				select: applicationSelect,
			})
			if (repeated) return { application: repeated, duplicated: true }

			const [pending, membership, occupiedCode] = await Promise.all([
				tx.merchantApplication.findFirst({ where: { userId, status: 'PENDING' }, select: { id: true } }),
				tx.merchantMember.findFirst({ where: { userId, status: 'ACTIVE' }, select: { merchantId: true } }),
				tx.merchant.findFirst({
					where: { OR: [{ code: input.merchantCode }, { shops: { some: { code: input.shopCode } } }] },
					select: { id: true },
				}),
			])
			if (pending) throw conflict('已有待审核的商户入驻申请')
			if (membership) throw conflict('当前账号已加入商户')
			if (occupiedCode) throw conflict('商户编码或店铺编码已被使用')

			const application = await tx.merchantApplication.create({
				data: { userId, ...input },
				select: applicationSelect,
			})
			return { application, duplicated: false }
		})
	} catch (error) {
		if (error.code === 'P2002') throw conflict('申请已提交或编码已被使用')
		throw error
	}
}

export function listMyApplications(userId) {
	return prisma.merchantApplication.findMany({
		where: { userId },
		select: applicationSelect,
		orderBy: { createdAt: 'desc' },
	})
}

export async function listApplications({ status, page, pageSize }) {
	const where = status ? { status } : {}
	const [items, total] = await Promise.all([
		prisma.merchantApplication.findMany({
			where,
			select: { ...applicationSelect, applicant: { select: { id: true, nickname: true, email: true, phone: true } } },
			orderBy: { createdAt: 'desc' },
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.merchantApplication.count({ where }),
	])
	return { items, pagination: { page, pageSize, total } }
}

export async function reviewApplication(id, input, reviewerId) {
	return prisma.$transaction(async (tx) => {
		const application = await tx.merchantApplication.findUnique({ where: { id } })
		if (!application) throw new AppError('入驻申请不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
		if (application.status !== 'PENDING') throw conflict('该入驻申请已处理')

		if (input.action === 'REJECT') {
			const updated = await tx.merchantApplication.updateMany({
				where: { id, status: 'PENDING' },
				data: { status: 'REJECTED', rejectReason: input.reason, reviewedById: reviewerId, reviewedAt: new Date() },
			})
			if (updated.count !== 1) throw conflict('该入驻申请已处理')
			return tx.merchantApplication.findUnique({ where: { id }, select: applicationSelect })
		}

		const occupied = await tx.merchant.findFirst({
			where: { OR: [{ code: application.merchantCode }, { shops: { some: { code: application.shopCode } } }] },
			select: { id: true },
		})
		if (occupied) throw conflict('商户编码或店铺编码已被使用')

		const updated = await tx.merchantApplication.updateMany({
			where: { id, status: 'PENDING' },
			data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date() },
		})
		if (updated.count !== 1) throw conflict('该入驻申请已处理')

		const merchant = await tx.merchant.create({
			data: {
				name: application.merchantName,
				code: application.merchantCode,
				contactName: application.contactName,
				contactPhone: application.contactPhone,
				shops: { create: { name: application.shopName, code: application.shopCode } },
				members: { create: { userId: application.userId, role: 'OWNER' } },
			},
			select: { id: true },
		})
		const merchantRole = await tx.role.upsert({
			where: { code: 'MERCHANT' },
			update: { name: '商户成员' },
			create: { code: 'MERCHANT', name: '商户成员' },
		})
		await tx.userRole.upsert({
			where: { userId_roleId: { userId: application.userId, roleId: merchantRole.id } },
			update: {},
			create: { userId: application.userId, roleId: merchantRole.id },
		})
		return tx.merchantApplication.update({
			where: { id },
			data: { merchantId: merchant.id },
			select: applicationSelect,
		})
	})
}

export async function listMyShops(userId) {
	return prisma.merchantMember.findMany({
		where: { userId, status: 'ACTIVE', merchant: { status: 'ACTIVE' } },
		select: {
			role: true,
			merchant: {
				select: {
					id: true,
					name: true,
					code: true,
					status: true,
					shops: { orderBy: { createdAt: 'asc' } },
				},
			},
		},
	})
}

export async function updateShop(userId, id, input) {
	await assertShopAccess(userId, id, ['OWNER', 'ADMIN'])
	return prisma.shop.update({ where: { id }, data: input })
}

export async function assertShopAccess(userId, shopId, allowedRoles = ['OWNER', 'ADMIN', 'STAFF']) {
	const shop = await prisma.shop.findFirst({
		where: {
			id: shopId,
			status: 'ACTIVE',
			merchant: {
				status: 'ACTIVE',
				members: { some: { userId, status: 'ACTIVE', role: { in: allowedRoles } } },
			},
		},
		select: { id: true, merchantId: true, name: true, code: true },
	})
	if (!shop) throw new AppError('店铺不存在或没有管理权限', { statusCode: 403, code: ERROR_CODES.FORBIDDEN })
	return shop
}
