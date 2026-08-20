-- AlterTable
ALTER TABLE `Merchant` ADD COLUMN `contactName` VARCHAR(80) NULL,
    ADD COLUMN `contactPhone` VARCHAR(30) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `Shop` ADD COLUMN `description` VARCHAR(500) NULL,
    ADD COLUMN `logoUrl` VARCHAR(500) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE `MerchantApplication` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `clientRequestId` VARCHAR(64) NOT NULL,
    `merchantName` VARCHAR(120) NOT NULL,
    `merchantCode` VARCHAR(50) NOT NULL,
    `shopName` VARCHAR(120) NOT NULL,
    `shopCode` VARCHAR(50) NOT NULL,
    `contactName` VARCHAR(80) NOT NULL,
    `contactPhone` VARCHAR(30) NOT NULL,
    `qualificationUrl` VARCHAR(500) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejectReason` VARCHAR(500) NULL,
    `reviewedById` VARCHAR(30) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `merchantId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MerchantApplication_merchantId_key`(`merchantId`),
    INDEX `MerchantApplication_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `MerchantApplication_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `MerchantApplication_reviewedById_reviewedAt_idx`(`reviewedById`, `reviewedAt`),
    UNIQUE INDEX `MerchantApplication_userId_clientRequestId_key`(`userId`, `clientRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MerchantMember` (
    `merchantId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MerchantMember_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`merchantId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MerchantApplication` ADD CONSTRAINT `MerchantApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantApplication` ADD CONSTRAINT `MerchantApplication_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantApplication` ADD CONSTRAINT `MerchantApplication_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantMember` ADD CONSTRAINT `MerchantMember_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MerchantMember` ADD CONSTRAINT `MerchantMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
