import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateUploadedImage } from '../src/services/uploadService.js'

let directory

afterEach(async () => {
	if (directory) await rm(directory, { recursive: true, force: true })
	directory = null
})

async function temporaryFile(filename, content) {
	directory = await mkdtemp(path.join(os.tmpdir(), 'express-shop-upload-'))
	const filePath = path.join(directory, filename)
	await writeFile(filePath, content)
	return { path: filePath, filename }
}

describe('upload image validation', () => {
	it('接受文件头与扩展名匹配的 PNG', async () => {
		const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex')
		const file = await temporaryFile('image.png', png)

		await expect(validateUploadedImage(file)).resolves.toEqual({ mimeType: 'image/png', extension: 'png' })
	})

	it('拒绝并删除伪装成图片的文本文件', async () => {
		const file = await temporaryFile('fake.png', Buffer.from('not an image'))

		await expect(validateUploadedImage(file)).rejects.toThrow('文件内容不是支持的图片格式')
		await expect(readFile(file.path)).rejects.toMatchObject({ code: 'ENOENT' })
	})
})
