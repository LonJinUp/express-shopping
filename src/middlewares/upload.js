import path from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { getUploadDirectory, imageMimeTypes } from '../services/uploadService.js'

const extensions = new Map([
	['image/jpeg', '.jpg'],
	['image/png', '.png'],
	['image/webp', '.webp'],
	['image/gif', '.gif'],
])

const storage = multer.diskStorage({
	destination: getUploadDirectory(),
	filename(req, file, callback) {
		callback(null, `${Date.now()}-${randomUUID()}${extensions.get(file.mimetype)}`)
	},
})

const uploader = multer({
	storage,
	limits: { fileSize: env.UPLOAD_MAX_IMAGE_MB * 1024 * 1024, files: 1 },
	fileFilter(req, file, callback) {
		if (!imageMimeTypes.has(file.mimetype) || path.extname(file.originalname).length > 10) {
			return callback(
				new AppError('只允许上传 JPEG、PNG、WebP 或 GIF 图片', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
			)
		}
		return callback(null, true)
	},
})

export const uploadImage = uploader.single('image')
