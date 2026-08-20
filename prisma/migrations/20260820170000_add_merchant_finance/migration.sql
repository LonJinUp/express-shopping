-- AlterTable
ALTER TABLE `Shop` ADD COLUMN `commissionRateBps` SMALLINT UNSIGNED NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE `MerchantAccount` (
    `merchantId` VARCHAR(30) NOT NULL,
    `pendingAmount` INTEGER NOT NULL DEFAULT 0,
    `availableAmount` INTEGER NOT NULL DEFAULT 0,
    `frozenAmount` INTEGER NOT NULL DEFAULT 0,
    `withdrawnAmount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`merchantId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantLedgerEntry` (
    `id` VARCHAR(30) NOT NULL,
    `merchantId` VARCHAR(30) NOT NULL,
    `shopId` VARCHAR(30) NULL,
    `orderId` VARCHAR(30) NULL,
    `refundId` VARCHAR(30) NULL,
    `type` ENUM('PAYMENT', 'REFUND', 'SETTLEMENT', 'WITHDRAWAL', 'WITHDRAWAL_RESTORE', 'WITHDRAWAL_COMPLETE') NOT NULL,
    `referenceId` VARCHAR(30) NOT NULL,
    `grossAmount` INTEGER NOT NULL DEFAULT 0,
    `commissionRateBps` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `commissionAmount` INTEGER NOT NULL DEFAULT 0,
    `netAmount` INTEGER NOT NULL DEFAULT 0,
    `pendingAmountDiff` INTEGER NOT NULL DEFAULT 0,
    `availableAmountDiff` INTEGER NOT NULL DEFAULT 0,
    `frozenAmountDiff` INTEGER NOT NULL DEFAULT 0,
    `withdrawnAmountDiff` INTEGER NOT NULL DEFAULT 0,
    `remark` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `MerchantLedgerEntry_type_referenceId_key`(`type`, `referenceId`),
    INDEX `MerchantLedgerEntry_merchantId_createdAt_idx`(`merchantId`, `createdAt`),
    INDEX `MerchantLedgerEntry_shopId_createdAt_idx`(`shopId`, `createdAt`),
    INDEX `MerchantLedgerEntry_orderId_createdAt_idx`(`orderId`, `createdAt`),
    INDEX `MerchantLedgerEntry_refundId_idx`(`refundId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantSettlement` (
    `id` VARCHAR(30) NOT NULL,
    `settlementNo` VARCHAR(32) NOT NULL,
    `clientRequestId` VARCHAR(64) NOT NULL,
    `merchantId` VARCHAR(30) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `grossAmount` INTEGER NOT NULL DEFAULT 0,
    `refundAmount` INTEGER NOT NULL DEFAULT 0,
    `commissionAmount` INTEGER NOT NULL DEFAULT 0,
    `netAmount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `MerchantSettlement_settlementNo_key`(`settlementNo`),
    INDEX `MerchantSettlement_merchantId_createdAt_idx`(`merchantId`, `createdAt`),
    INDEX `MerchantSettlement_periodStart_periodEnd_idx`(`periodStart`, `periodEnd`),
    UNIQUE INDEX `MerchantSettlement_merchantId_clientRequestId_key`(`merchantId`, `clientRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantSettlementOrder` (
    `settlementId` VARCHAR(30) NOT NULL,
    `orderId` VARCHAR(30) NOT NULL,
    `shopId` VARCHAR(30) NOT NULL,
    `grossAmount` INTEGER NOT NULL,
    `refundAmount` INTEGER NOT NULL DEFAULT 0,
    `commissionAmount` INTEGER NOT NULL,
    `netAmount` INTEGER NOT NULL,
    UNIQUE INDEX `MerchantSettlementOrder_orderId_key`(`orderId`),
    INDEX `MerchantSettlementOrder_shopId_idx`(`shopId`),
    PRIMARY KEY (`settlementId`, `orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantWithdrawal` (
    `id` VARCHAR(30) NOT NULL,
    `withdrawalNo` VARCHAR(32) NOT NULL,
    `clientRequestId` VARCHAR(64) NOT NULL,
    `merchantId` VARCHAR(30) NOT NULL,
    `requestedById` VARCHAR(30) NOT NULL,
    `amount` INTEGER UNSIGNED NOT NULL,
    `accountInfo` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewerId` VARCHAR(30) NULL,
    `reviewRemark` VARCHAR(500) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `MerchantWithdrawal_withdrawalNo_key`(`withdrawalNo`),
    INDEX `MerchantWithdrawal_merchantId_status_createdAt_idx`(`merchantId`, `status`, `createdAt`),
    INDEX `MerchantWithdrawal_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `MerchantWithdrawal_reviewerId_reviewedAt_idx`(`reviewerId`, `reviewedAt`),
    UNIQUE INDEX `MerchantWithdrawal_merchantId_clientRequestId_key`(`merchantId`, `clientRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MerchantAccount` ADD CONSTRAINT `MerchantAccount_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MerchantLedgerEntry` ADD CONSTRAINT `MerchantLedgerEntry_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MerchantLedgerEntry` ADD CONSTRAINT `MerchantLedgerEntry_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MerchantLedgerEntry` ADD CONSTRAINT `MerchantLedgerEntry_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MerchantLedgerEntry` ADD CONSTRAINT `MerchantLedgerEntry_refundId_fkey` FOREIGN KEY (`refundId`) REFERENCES `Refund`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MerchantSettlement` ADD CONSTRAINT `MerchantSettlement_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MerchantSettlementOrder` ADD CONSTRAINT `MerchantSettlementOrder_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `MerchantSettlement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MerchantSettlementOrder` ADD CONSTRAINT `MerchantSettlementOrder_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MerchantSettlementOrder` ADD CONSTRAINT `MerchantSettlementOrder_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MerchantWithdrawal` ADD CONSTRAINT `MerchantWithdrawal_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MerchantWithdrawal` ADD CONSTRAINT `MerchantWithdrawal_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MerchantWithdrawal` ADD CONSTRAINT `MerchantWithdrawal_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
