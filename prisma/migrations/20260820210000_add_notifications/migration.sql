-- CreateTable
CREATE TABLE `UserNotification` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `eventKey` VARCHAR(120) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `referenceType` VARCHAR(50) NULL,
    `referenceId` VARCHAR(30) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserNotification_userId_eventKey_key`(`userId`, `eventKey`),
    INDEX `UserNotification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationOutbox` (
    `id` VARCHAR(30) NOT NULL,
    `channel` VARCHAR(30) NOT NULL DEFAULT 'IN_APP',
    `eventKey` VARCHAR(120) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `maxAttempts` SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `lastError` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationOutbox_channel_eventKey_key`(`channel`, `eventKey`),
    INDEX `NotificationOutbox_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `NotificationOutbox_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserNotification` ADD CONSTRAINT `UserNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationOutbox` ADD CONSTRAINT `NotificationOutbox_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
