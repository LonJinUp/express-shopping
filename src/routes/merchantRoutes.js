import { Router } from 'express'
import {
	addMember,
	createApplication,
	listAuditLogs,
	listMembers,
	listMyApplications,
	listMyShops,
	updateMember,
	updateShop,
} from '../controllers/merchantController.js'
import { authenticate } from '../middlewares/auth.js'
import { auditMerchantAction } from '../middlewares/audit.js'
import { validate } from '../middlewares/validate.js'
import {
	merchantApplicationInputSchema,
	merchantAuditListSchema,
	merchantMemberAddSchema,
	merchantMemberListSchema,
	merchantMemberUpdateSchema,
	shopUpdateSchema,
} from '../validators/merchantValidator.js'

export const merchantRouter = Router()
merchantRouter.post(
	'/merchant-applications/create',
	authenticate,
	auditMerchantAction,
	validate(merchantApplicationInputSchema),
	createApplication
)
merchantRouter.get('/merchant-applications/mine', authenticate, listMyApplications)
merchantRouter.get('/merchant/shops', authenticate, listMyShops)
merchantRouter.post('/merchant/shops/update', authenticate, auditMerchantAction, validate(shopUpdateSchema), updateShop)
merchantRouter.get('/merchant/members', authenticate, validate(merchantMemberListSchema, 'query'), listMembers)
merchantRouter.post(
	'/merchant/members/add',
	authenticate,
	auditMerchantAction,
	validate(merchantMemberAddSchema),
	addMember
)
merchantRouter.post(
	'/merchant/members/update',
	authenticate,
	auditMerchantAction,
	validate(merchantMemberUpdateSchema),
	updateMember
)
merchantRouter.get('/merchant/audit-logs', authenticate, validate(merchantAuditListSchema, 'query'), listAuditLogs)
