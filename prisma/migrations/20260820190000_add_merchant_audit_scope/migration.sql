-- AlterTable
ALTER TABLE `AuditLog`
    ADD COLUMN `merchantId` VARCHAR(30) NULL,
    ADD COLUMN `shopId` VARCHAR(30) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_merchantId_createdAt_idx` ON `AuditLog`(`merchantId`, `createdAt`);
CREATE INDEX `AuditLog_shopId_createdAt_idx` ON `AuditLog`(`shopId`, `createdAt`);
