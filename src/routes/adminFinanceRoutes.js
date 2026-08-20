import { Router } from 'express'
import { listWithdrawals, reviewWithdrawal, updateCommission } from '../controllers/adminFinanceController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import {
	adminWithdrawalListSchema,
	commissionUpdateSchema,
	withdrawalReviewSchema,
} from '../validators/merchantFinanceValidator.js'

export const adminFinanceRouter = Router()
adminFinanceRouter.use(authenticate, authorize('ADMIN'))
adminFinanceRouter.get('/finance/withdrawals', validate(adminWithdrawalListSchema, 'query'), listWithdrawals)
adminFinanceRouter.post('/finance/withdrawals/review', validate(withdrawalReviewSchema), reviewWithdrawal)
adminFinanceRouter.post('/shops/commission/update', validate(commissionUpdateSchema), updateCommission)
