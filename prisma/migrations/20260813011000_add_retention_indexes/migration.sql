CREATE INDEX `UserSession_expiresAt_idx` ON `UserSession`(`expiresAt`);
CREATE INDEX `UserSession_revokedAt_idx` ON `UserSession`(`revokedAt`);
CREATE INDEX `PasswordResetToken_expiresAt_idx` ON `PasswordResetToken`(`expiresAt`);
CREATE INDEX `PasswordResetToken_usedAt_idx` ON `PasswordResetToken`(`usedAt`);
CREATE INDEX `PaymentCallbackLog_status_createdAt_idx` ON `PaymentCallbackLog`(`status`, `createdAt`);
CREATE INDEX `BrowsingHistory_viewedAt_idx` ON `BrowsingHistory`(`viewedAt`);
CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog`(`createdAt`);
CREATE INDEX `RefundCallbackLog_status_createdAt_idx` ON `RefundCallbackLog`(`status`, `createdAt`);
