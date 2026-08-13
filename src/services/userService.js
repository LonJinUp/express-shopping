import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

const userSelect = {
	id: true,
	email: true,
	phone: true,
	nickname: true,
	avatarUrl: true,
	status: true,
	createdAt: true,
	updatedAt: true,
}

export async function getProfile(userId) {
	const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect })
	if (!user) throw new AppError('用户不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return user
}

export async function updateProfile(userId, input) {
	return prisma.user.update({ where: { id: userId }, data: input, select: userSelect })
}

export async function listAddresses(userId) {
	return prisma.userAddress.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })
}

export async function createAddress(userId, input) {
	return prisma.$transaction(async (tx) => {
		const count = await tx.userAddress.count({ where: { userId } })
		const isDefault = count === 0 || input.isDefault
		if (isDefault) await tx.userAddress.updateMany({ where: { userId }, data: { isDefault: false } })
		return tx.userAddress.create({ data: { ...input, isDefault, userId } })
	})
}

export async function updateAddress(userId, addressId, input) {
	return prisma.$transaction(async (tx) => {
		const address = await tx.userAddress.findFirst({ where: { id: addressId, userId } })
		if (!address) throw new AppError('收货地址不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
		if (input.isDefault) await tx.userAddress.updateMany({ where: { userId }, data: { isDefault: false } })
		return tx.userAddress.update({ where: { id: addressId }, data: input })
	})
}

export async function deleteAddress(userId, addressId) {
	return prisma.$transaction(async (tx) => {
		const address = await tx.userAddress.findFirst({ where: { id: addressId, userId } })
		if (!address) throw new AppError('收货地址不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
		await tx.userAddress.delete({ where: { id: addressId } })
		if (address.isDefault) {
			const nextAddress = await tx.userAddress.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
			if (nextAddress) await tx.userAddress.update({ where: { id: nextAddress.id }, data: { isDefault: true } })
		}
	})
}
