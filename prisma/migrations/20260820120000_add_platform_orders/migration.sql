-- CreateTable
CREATE TABLE `PlatformOrder` (
    `id` VARCHAR(30) NOT NULL,
    `platformOrderNo` VARCHAR(32) NOT NULL,
    `clientRequestId` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `goodsAmount` INTEGER UNSIGNED NOT NULL,
    `discountAmount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `shippingAmount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `payableAmount` INTEGER UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlatformOrder_platformOrderNo_key`(`platformOrderNo`),
    INDEX `PlatformOrder_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `PlatformOrder_userId_clientRequestId_key`(`userId`, `clientRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `platformOrderId` VARCHAR(30) NULL;

-- CreateIndex
CREATE INDEX `Order_platformOrderId_idx` ON `Order`(`platformOrderId`);

-- AddForeignKey
ALTER TABLE `PlatformOrder` ADD CONSTRAINT `PlatformOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_platformOrderId_fkey` FOREIGN KEY (`platformOrderId`) REFERENCES `PlatformOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
