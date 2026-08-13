import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

export function getHomeBlocks() {
	const now = new Date()
	return prisma.homeBlock.findMany({
		where: {
			isActive: true,
			AND: [
				{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
				{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
			],
		},
		orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
	})
}

export function listHomeBlocks() {
	return prisma.homeBlock.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] })
}

export function createHomeBlock(input) {
	return prisma.homeBlock.create({ data: input })
}

export async function updateHomeBlock(id, input) {
	const exists = await prisma.homeBlock.findUnique({ where: { id }, select: { id: true } })
	if (!exists) throw new AppError('首页内容不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.homeBlock.update({ where: { id }, data: input })
}

export async function deleteHomeBlock(id) {
	const result = await prisma.homeBlock.deleteMany({ where: { id } })
	if (!result.count) throw new AppError('首页内容不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
}
