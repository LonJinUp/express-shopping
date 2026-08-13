-- CreateTable
CREATE TABLE `Merchant` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Merchant_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shop` (
    `id` VARCHAR(30) NOT NULL,
    `merchantId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Shop_code_key`(`code`),
    INDEX `Shop_merchantId_idx`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(30) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(80) NOT NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSession` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `refreshTokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `userAgent` VARCHAR(500) NULL,
    `ip` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserSession_refreshTokenHash_key`(`refreshTokenHash`),
    INDEX `UserSession_userId_revokedAt_expiresAt_idx`(`userId`, `revokedAt`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_usedAt_expiresAt_idx`(`userId`, `usedAt`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `Permission_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(30) NOT NULL,
    `roleId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(30) NOT NULL,
    `permissionId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAddress` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `recipientName` VARCHAR(80) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `province` VARCHAR(80) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `district` VARCHAR(80) NOT NULL,
    `detail` VARCHAR(255) NOT NULL,
    `postalCode` VARCHAR(20) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserAddress_userId_isDefault_idx`(`userId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(30) NOT NULL,
    `parentId` VARCHAR(30) NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    INDEX `Category_parentId_sortOrder_idx`(`parentId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Brand` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `logoUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Brand_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(30) NOT NULL,
    `shopId` VARCHAR(30) NOT NULL,
    `categoryId` VARCHAR(30) NOT NULL,
    `brandId` VARCHAR(30) NULL,
    `name` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(255) NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'DELETED') NOT NULL DEFAULT 'DRAFT',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_shopId_status_createdAt_idx`(`shopId`, `status`, `createdAt`),
    INDEX `Product_categoryId_status_idx`(`categoryId`, `status`),
    INDEX `Product_brandId_idx`(`brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` VARCHAR(30) NOT NULL,
    `productId` VARCHAR(30) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `alt` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `ProductImage_productId_sortOrder_idx`(`productId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSku` (
    `id` VARCHAR(30) NOT NULL,
    `productId` VARCHAR(30) NOT NULL,
    `skuCode` VARCHAR(80) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `specifications` JSON NOT NULL,
    `price` INTEGER UNSIGNED NOT NULL,
    `marketPrice` INTEGER UNSIGNED NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductSku_skuCode_key`(`skuCode`),
    INDEX `ProductSku_productId_isActive_idx`(`productId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inventory` (
    `skuId` VARCHAR(30) NOT NULL,
    `available` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `locked` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`skuId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryLog` (
    `id` VARCHAR(30) NOT NULL,
    `skuId` VARCHAR(30) NOT NULL,
    `type` ENUM('INITIAL', 'MANUAL_ADJUSTMENT', 'ORDER_LOCK', 'ORDER_RELEASE', 'ORDER_DEDUCT', 'AFTER_SALE_RETURN') NOT NULL,
    `availableDiff` INTEGER NOT NULL,
    `lockedDiff` INTEGER NOT NULL,
    `referenceType` VARCHAR(50) NULL,
    `referenceId` VARCHAR(50) NULL,
    `operatorId` VARCHAR(30) NULL,
    `remark` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryLog_skuId_createdAt_idx`(`skuId`, `createdAt`),
    INDEX `InventoryLog_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartItem` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `skuId` VARCHAR(30) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `selected` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CartItem_skuId_idx`(`skuId`),
    UNIQUE INDEX `CartItem_userId_skuId_key`(`userId`, `skuId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(30) NOT NULL,
    `orderNo` VARCHAR(32) NOT NULL,
    `clientRequestId` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `shopId` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'AFTER_SALE', 'REFUNDING', 'REFUNDED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `goodsAmount` INTEGER UNSIGNED NOT NULL,
    `discountAmount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `shippingAmount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `payableAmount` INTEGER UNSIGNED NOT NULL,
    `paidAmount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `refundedAmount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `buyerMessage` VARCHAR(255) NULL,
    `userCouponId` VARCHAR(30) NULL,
    `couponCode` VARCHAR(50) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `shippedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_orderNo_key`(`orderNo`),
    UNIQUE INDEX `Order_userCouponId_key`(`userCouponId`),
    INDEX `Order_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `Order_shopId_status_createdAt_idx`(`shopId`, `status`, `createdAt`),
    INDEX `Order_status_expiresAt_idx`(`status`, `expiresAt`),
    UNIQUE INDEX `Order_userId_clientRequestId_key`(`userId`, `clientRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderAddress` (
    `orderId` VARCHAR(30) NOT NULL,
    `recipientName` VARCHAR(80) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `province` VARCHAR(80) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `district` VARCHAR(80) NOT NULL,
    `detail` VARCHAR(255) NOT NULL,
    `postalCode` VARCHAR(20) NULL,

    PRIMARY KEY (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(30) NOT NULL,
    `orderId` VARCHAR(30) NOT NULL,
    `skuId` VARCHAR(30) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `skuName` VARCHAR(191) NOT NULL,
    `skuCode` VARCHAR(80) NOT NULL,
    `specifications` JSON NOT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `unitPrice` INTEGER UNSIGNED NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `goodsAmount` INTEGER UNSIGNED NOT NULL,
    `discountAmount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `payableAmount` INTEGER UNSIGNED NOT NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    INDEX `OrderItem_skuId_idx`(`skuId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderLog` (
    `id` VARCHAR(30) NOT NULL,
    `orderId` VARCHAR(30) NOT NULL,
    `fromStatus` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'AFTER_SALE', 'REFUNDING', 'REFUNDED') NULL,
    `toStatus` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'AFTER_SALE', 'REFUNDING', 'REFUNDED') NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `operatorId` VARCHAR(30) NULL,
    `remark` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderLog_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(30) NOT NULL,
    `paymentNo` VARCHAR(32) NOT NULL,
    `orderId` VARCHAR(30) NOT NULL,
    `clientRequestId` VARCHAR(64) NOT NULL,
    `channel` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'CLOSED', 'PARTIALLY_REFUNDED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `amount` INTEGER UNSIGNED NOT NULL,
    `transactionId` VARCHAR(100) NULL,
    `queryCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `nextQueryAt` DATETIME(3) NULL,
    `lastQueriedAt` DATETIME(3) NULL,
    `queryError` VARCHAR(500) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_paymentNo_key`(`paymentNo`),
    UNIQUE INDEX `Payment_transactionId_key`(`transactionId`),
    INDEX `Payment_orderId_status_idx`(`orderId`, `status`),
    INDEX `Payment_status_nextQueryAt_idx`(`status`, `nextQueryAt`),
    UNIQUE INDEX `Payment_orderId_clientRequestId_key`(`orderId`, `clientRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentCallbackLog` (
    `id` VARCHAR(30) NOT NULL,
    `channel` VARCHAR(30) NOT NULL,
    `eventId` VARCHAR(100) NOT NULL,
    `paymentId` VARCHAR(30) NULL,
    `status` ENUM('RECEIVED', 'PROCESSED', 'REJECTED') NOT NULL DEFAULT 'RECEIVED',
    `payload` JSON NOT NULL,
    `errorMessage` VARCHAR(500) NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentCallbackLog_paymentId_createdAt_idx`(`paymentId`, `createdAt`),
    UNIQUE INDEX `PaymentCallbackLog_channel_eventId_key`(`channel`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderNote` (
    `id` VARCHAR(30) NOT NULL,
    `orderId` VARCHAR(30) NOT NULL,
    `operatorId` VARCHAR(30) NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderNote_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `orderItemId` VARCHAR(30) NOT NULL,
    `rating` TINYINT UNSIGNED NOT NULL,
    `content` VARCHAR(1000) NULL,
    `isAnonymous` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Review_orderItemId_key`(`orderItemId`),
    INDEX `Review_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Review_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewImage` (
    `id` VARCHAR(30) NOT NULL,
    `reviewId` VARCHAR(30) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `ReviewImage_reviewId_sortOrder_idx`(`reviewId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shipment` (
    `id` VARCHAR(30) NOT NULL,
    `orderId` VARCHAR(30) NOT NULL,
    `carrierCode` VARCHAR(50) NOT NULL,
    `carrierName` VARCHAR(80) NOT NULL,
    `trackingNumber` VARCHAR(100) NOT NULL,
    `shippedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Shipment_orderId_key`(`orderId`),
    INDEX `Shipment_carrierCode_trackingNumber_idx`(`carrierCode`, `trackingNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(30) NOT NULL,
    `shopId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `scope` ENUM('ALL', 'CATEGORY', 'PRODUCT') NOT NULL DEFAULT 'ALL',
    `thresholdAmount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `discountAmount` INTEGER UNSIGNED NOT NULL,
    `totalQuantity` INTEGER UNSIGNED NOT NULL,
    `claimedQuantity` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `perUserLimit` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Coupon_code_key`(`code`),
    INDEX `Coupon_shopId_isActive_startsAt_endsAt_idx`(`shopId`, `isActive`, `startsAt`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponProduct` (
    `couponId` VARCHAR(30) NOT NULL,
    `productId` VARCHAR(30) NOT NULL,

    INDEX `CouponProduct_productId_idx`(`productId`),
    PRIMARY KEY (`couponId`, `productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponCategory` (
    `couponId` VARCHAR(30) NOT NULL,
    `categoryId` VARCHAR(30) NOT NULL,

    INDEX `CouponCategory_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`couponId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserCoupon` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `couponId` VARCHAR(30) NOT NULL,
    `status` ENUM('AVAILABLE', 'USED', 'EXPIRED') NOT NULL DEFAULT 'AVAILABLE',
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserCoupon_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `UserCoupon_couponId_status_idx`(`couponId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingTemplate` (
    `id` VARCHAR(30) NOT NULL,
    `shopId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `baseFee` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `freeThreshold` INTEGER UNSIGNED NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShippingTemplate_shopId_isDefault_isActive_idx`(`shopId`, `isDefault`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingRegionRule` (
    `id` VARCHAR(30) NOT NULL,
    `templateId` VARCHAR(30) NOT NULL,
    `province` VARCHAR(80) NOT NULL,
    `fee` INTEGER UNSIGNED NOT NULL,

    UNIQUE INDEX `ShippingRegionRule_templateId_province_key`(`templateId`, `province`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeBlock` (
    `id` VARCHAR(30) NOT NULL,
    `type` ENUM('BANNER', 'RECOMMENDATION', 'ANNOUNCEMENT') NOT NULL,
    `title` VARCHAR(120) NULL,
    `content` JSON NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HomeBlock_type_isActive_sortOrder_idx`(`type`, `isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Favorite` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `productId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Favorite_productId_idx`(`productId`),
    UNIQUE INDEX `Favorite_userId_productId_key`(`userId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrowsingHistory` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `productId` VARCHAR(30) NOT NULL,
    `viewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BrowsingHistory_userId_viewedAt_idx`(`userId`, `viewedAt`),
    INDEX `BrowsingHistory_productId_idx`(`productId`),
    UNIQUE INDEX `BrowsingHistory_userId_productId_key`(`userId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(30) NOT NULL,
    `operatorId` VARCHAR(30) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `targetId` VARCHAR(50) NULL,
    `requestId` VARCHAR(50) NOT NULL,
    `ip` VARCHAR(80) NULL,
    `userAgent` VARCHAR(500) NULL,
    `statusCode` INTEGER NOT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_operatorId_createdAt_idx`(`operatorId`, `createdAt`),
    INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AfterSale` (
    `id` VARCHAR(30) NOT NULL,
    `afterSaleNo` VARCHAR(32) NOT NULL,
    `clientRequestId` VARCHAR(64) NOT NULL,
    `orderId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `type` ENUM('REFUND_ONLY', 'RETURN_REFUND') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'WAITING_RETURN', 'RETURNED', 'REFUNDING', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `previousOrderStatus` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'AFTER_SALE', 'REFUNDING', 'REFUNDED') NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `requestedAmount` INTEGER UNSIGNED NOT NULL,
    `approvedAmount` INTEGER UNSIGNED NULL,
    `returnCarrierCode` VARCHAR(50) NULL,
    `returnCarrierName` VARCHAR(80) NULL,
    `returnTrackingNumber` VARCHAR(100) NULL,
    `merchantRemark` VARCHAR(500) NULL,
    `stockReturnedAt` DATETIME(3) NULL,
    `remindedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AfterSale_afterSaleNo_key`(`afterSaleNo`),
    INDEX `AfterSale_orderId_status_idx`(`orderId`, `status`),
    INDEX `AfterSale_status_createdAt_idx`(`status`, `createdAt`),
    UNIQUE INDEX `AfterSale_userId_clientRequestId_key`(`userId`, `clientRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AfterSaleItem` (
    `id` VARCHAR(30) NOT NULL,
    `afterSaleId` VARCHAR(30) NOT NULL,
    `orderItemId` VARCHAR(30) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `refundAmount` INTEGER UNSIGNED NOT NULL,

    INDEX `AfterSaleItem_orderItemId_idx`(`orderItemId`),
    UNIQUE INDEX `AfterSaleItem_afterSaleId_orderItemId_key`(`afterSaleId`, `orderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AfterSaleLog` (
    `id` VARCHAR(30) NOT NULL,
    `afterSaleId` VARCHAR(30) NOT NULL,
    `fromStatus` ENUM('PENDING', 'APPROVED', 'WAITING_RETURN', 'RETURNED', 'REFUNDING', 'COMPLETED', 'REJECTED', 'CANCELLED') NULL,
    `toStatus` ENUM('PENDING', 'APPROVED', 'WAITING_RETURN', 'RETURNED', 'REFUNDING', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `operatorId` VARCHAR(30) NULL,
    `remark` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AfterSaleLog_afterSaleId_createdAt_idx`(`afterSaleId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Refund` (
    `id` VARCHAR(30) NOT NULL,
    `refundNo` VARCHAR(32) NOT NULL,
    `afterSaleId` VARCHAR(30) NOT NULL,
    `paymentId` VARCHAR(30) NOT NULL,
    `clientRequestId` VARCHAR(64) NOT NULL,
    `channel` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `amount` INTEGER UNSIGNED NOT NULL,
    `transactionId` VARCHAR(100) NULL,
    `errorMessage` VARCHAR(500) NULL,
    `retryCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `lastAttemptAt` DATETIME(3) NULL,
    `refundedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Refund_refundNo_key`(`refundNo`),
    UNIQUE INDEX `Refund_afterSaleId_key`(`afterSaleId`),
    UNIQUE INDEX `Refund_clientRequestId_key`(`clientRequestId`),
    UNIQUE INDEX `Refund_transactionId_key`(`transactionId`),
    INDEX `Refund_paymentId_status_idx`(`paymentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefundCallbackLog` (
    `id` VARCHAR(30) NOT NULL,
    `channel` VARCHAR(30) NOT NULL,
    `eventId` VARCHAR(100) NOT NULL,
    `refundId` VARCHAR(30) NULL,
    `status` ENUM('RECEIVED', 'PROCESSED', 'REJECTED') NOT NULL DEFAULT 'RECEIVED',
    `payload` JSON NOT NULL,
    `errorMessage` VARCHAR(500) NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RefundCallbackLog_refundId_createdAt_idx`(`refundId`, `createdAt`),
    UNIQUE INDEX `RefundCallbackLog_channel_eventId_key`(`channel`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Shop` ADD CONSTRAINT `Shop_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSession` ADD CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAddress` ADD CONSTRAINT `UserAddress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSku` ADD CONSTRAINT `ProductSku_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLog` ADD CONSTRAINT `InventoryLog_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userCouponId_fkey` FOREIGN KEY (`userCouponId`) REFERENCES `UserCoupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderAddress` ADD CONSTRAINT `OrderAddress_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLog` ADD CONSTRAINT `OrderLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentCallbackLog` ADD CONSTRAINT `PaymentCallbackLog_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderNote` ADD CONSTRAINT `OrderNote_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewImage` ADD CONSTRAINT `ReviewImage_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponProduct` ADD CONSTRAINT `CouponProduct_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponProduct` ADD CONSTRAINT `CouponProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponCategory` ADD CONSTRAINT `CouponCategory_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponCategory` ADD CONSTRAINT `CouponCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCoupon` ADD CONSTRAINT `UserCoupon_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCoupon` ADD CONSTRAINT `UserCoupon_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShippingTemplate` ADD CONSTRAINT `ShippingTemplate_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShippingRegionRule` ADD CONSTRAINT `ShippingRegionRule_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ShippingTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrowsingHistory` ADD CONSTRAINT `BrowsingHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrowsingHistory` ADD CONSTRAINT `BrowsingHistory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSale` ADD CONSTRAINT `AfterSale_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSale` ADD CONSTRAINT `AfterSale_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSaleItem` ADD CONSTRAINT `AfterSaleItem_afterSaleId_fkey` FOREIGN KEY (`afterSaleId`) REFERENCES `AfterSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSaleItem` ADD CONSTRAINT `AfterSaleItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSaleLog` ADD CONSTRAINT `AfterSaleLog_afterSaleId_fkey` FOREIGN KEY (`afterSaleId`) REFERENCES `AfterSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_afterSaleId_fkey` FOREIGN KEY (`afterSaleId`) REFERENCES `AfterSale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundCallbackLog` ADD CONSTRAINT `RefundCallbackLog_refundId_fkey` FOREIGN KEY (`refundId`) REFERENCES `Refund`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
