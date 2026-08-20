import { Router } from 'express'
import {
	createSettlement,
	createWithdrawal,
	exportLedger,
	getAccount,
	listLedger,
	listSettlements,
	listWithdrawals,
} from '../controllers/merchantFinanceController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import {
	financeShopScopeSchema,
	ledgerListSchema,
	ledgerExportSchema,
	merchantWithdrawalListSchema,
	settlementCreateSchema,
	settlementListSchema,
	withdrawalCreateSchema,
} from '../validators/merchantFinanceValidator.js'

export const merchantFinanceRouter = Router()
merchantFinanceRouter.use(authenticate)
merchantFinanceRouter.get('/finance/account', validate(financeShopScopeSchema, 'query'), getAccount)
merchantFinanceRouter.get('/finance/ledger', validate(ledgerListSchema, 'query'), listLedger)
merchantFinanceRouter.get('/finance/ledger/export', validate(ledgerExportSchema, 'query'), exportLedger)
merchantFinanceRouter.post('/finance/settlements/create', validate(settlementCreateSchema), createSettlement)
merchantFinanceRouter.get('/finance/settlements', validate(settlementListSchema, 'query'), listSettlements)
merchantFinanceRouter.post('/finance/withdrawals/create', validate(withdrawalCreateSchema), createWithdrawal)
merchantFinanceRouter.get('/finance/withdrawals', validate(merchantWithdrawalListSchema, 'query'), listWithdrawals)
