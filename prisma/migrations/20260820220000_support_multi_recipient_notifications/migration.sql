-- DropIndex
DROP INDEX `NotificationOutbox_channel_eventKey_key` ON `NotificationOutbox`;

-- CreateIndex
CREATE UNIQUE INDEX `NotificationOutbox_channel_userId_eventKey_key` ON `NotificationOutbox`(`channel`, `userId`, `eventKey`);
