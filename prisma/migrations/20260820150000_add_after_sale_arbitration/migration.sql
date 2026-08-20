-- AlterTable
ALTER TABLE `AfterSale` MODIFY `status` ENUM(
    'PENDING',
    'ARBITRATING',
    'APPROVED',
    'WAITING_RETURN',
    'RETURNED',
    'REFUNDING',
    'COMPLETED',
    'REJECTED',
    'CANCELLED'
) NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `AfterSaleArbitration` (
    `id` VARCHAR(30) NOT NULL,
    `afterSaleId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'RESOLVED') NOT NULL DEFAULT 'PENDING',
    `reason` VARCHAR(500) NOT NULL,
    `evidence` JSON NULL,
    `decision` ENUM('APPROVE', 'REJECT') NULL,
    `decisionRemark` VARCHAR(500) NULL,
    `resolvedById` VARCHAR(30) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AfterSaleArbitration_afterSaleId_key`(`afterSaleId`),
    INDEX `AfterSaleArbitration_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `AfterSaleArbitration_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AfterSaleArbitration_resolvedById_resolvedAt_idx`(`resolvedById`, `resolvedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AfterSaleArbitration` ADD CONSTRAINT `AfterSaleArbitration_afterSaleId_fkey` FOREIGN KEY (`afterSaleId`) REFERENCES `AfterSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSaleArbitration` ADD CONSTRAINT `AfterSaleArbitration_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSaleArbitration` ADD CONSTRAINT `AfterSaleArbitration_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
