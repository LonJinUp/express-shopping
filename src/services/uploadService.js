import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { fileTypeFromFile } from 'file-type'
import { env } from '../config/env.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

export const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const extensionByMime = new Map([
	['image/jpeg', 'jpg'],
	['image/png', 'png'],
	['image/webp', 'webp'],
	['image/gif', 'gif'],
])

export function getUploadDirectory() {
	const directory = path.resolve(process.cwd(), env.UPLOAD_LOCAL_DIR, 'images')
	mkdirSync(directory, { recursive: true })
	return directory
}

export async function ensureUploadDirectory() {
	getUploadDirectory()
}

export function buildImageUrl(filename) {
	return `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/uploads/images/${filename}`
}

export async function validateUploadedImage(file) {
	const detected = await fileTypeFromFile(file.path)
	const expectedExtension = detected ? extensionByMime.get(detected.mime) : null
	const actualExtension = path.extname(file.filename).slice(1).toLowerCase()
	if (!expectedExtension || expectedExtension !== actualExtension) {
		await unlink(file.path).catch(() => {})
		throw new AppError('文件内容不是支持的图片格式', {
			statusCode: 422,
			code: ERROR_CODES.VALIDATION_ERROR,
		})
	}
	return { mimeType: detected.mime, extension: expectedExtension }
}
