import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import { buildImageUrl, validateUploadedImage } from '../services/uploadService.js'

export async function uploadProductImage(req, res) {
	if (!req.file) {
		throw new AppError('请选择要上传的图片', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const detected = await validateUploadedImage(req.file)
	return res.success(
		{
			url: buildImageUrl(req.file.filename),
			filename: req.file.filename,
			size: req.file.size,
			mimeType: detected.mimeType,
		},
		'图片上传成功',
		201
	)
}
