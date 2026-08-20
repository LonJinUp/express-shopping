-- Seed one account for every existing merchant.
INSERT INTO `MerchantAccount` (`merchantId`, `pendingAmount`, `availableAmount`, `frozenAmount`, `withdrawnAmount`, `createdAt`, `updatedAt`)
SELECT m.`id`, 0, 0, 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Merchant` m
ON DUPLICATE KEY UPDATE `merchantId` = VALUES(`merchantId`);

-- Backfill successful payments as pending merchant revenue.
INSERT IGNORE INTO `MerchantLedgerEntry` (
    `id`, `merchantId`, `shopId`, `orderId`, `type`, `referenceId`, `grossAmount`,
    `commissionRateBps`, `commissionAmount`, `netAmount`, `pendingAmountDiff`, `createdAt`
)
SELECT
    CONCAT('lp_', SUBSTRING(MD5(p.`id`), 1, 24)),
    s.`merchantId`, o.`shopId`, o.`id`, 'PAYMENT', p.`id`, p.`amount`,
    s.`commissionRateBps`, FLOOR(p.`amount` * s.`commissionRateBps` / 10000),
    p.`amount` - FLOOR(p.`amount` * s.`commissionRateBps` / 10000),
    p.`amount` - FLOOR(p.`amount` * s.`commissionRateBps` / 10000),
    COALESCE(p.`paidAt`, p.`createdAt`)
FROM `Payment` p
JOIN `Order` o ON o.`id` = p.`orderId`
JOIN `Shop` s ON s.`id` = o.`shopId`
WHERE p.`status` IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- Backfill successful refunds as commission-reversing pending deductions.
INSERT IGNORE INTO `MerchantLedgerEntry` (
    `id`, `merchantId`, `shopId`, `orderId`, `refundId`, `type`, `referenceId`, `grossAmount`,
    `commissionRateBps`, `commissionAmount`, `netAmount`, `pendingAmountDiff`, `createdAt`
)
SELECT
    CONCAT('lr_', SUBSTRING(MD5(r.`id`), 1, 24)),
    l.`merchantId`, l.`shopId`, l.`orderId`, r.`id`, 'REFUND', r.`id`, -r.`amount`,
    l.`commissionRateBps`, -FLOOR(r.`amount` * l.`commissionRateBps` / 10000),
    -r.`amount` + FLOOR(r.`amount` * l.`commissionRateBps` / 10000),
    -r.`amount` + FLOOR(r.`amount` * l.`commissionRateBps` / 10000),
    COALESCE(r.`refundedAt`, r.`createdAt`)
FROM `Refund` r
JOIN `Payment` p ON p.`id` = r.`paymentId`
JOIN `MerchantLedgerEntry` l ON l.`type` = 'PAYMENT' AND l.`referenceId` = p.`id`
WHERE r.`status` = 'SUCCESS';

-- Rebuild account balances from the immutable ledger after backfill.
UPDATE `MerchantAccount` a
LEFT JOIN (
    SELECT
        `merchantId`,
        COALESCE(SUM(`pendingAmountDiff`), 0) AS `pendingAmount`,
        COALESCE(SUM(`availableAmountDiff`), 0) AS `availableAmount`,
        COALESCE(SUM(`frozenAmountDiff`), 0) AS `frozenAmount`,
        COALESCE(SUM(`withdrawnAmountDiff`), 0) AS `withdrawnAmount`
    FROM `MerchantLedgerEntry`
    GROUP BY `merchantId`
) l ON l.`merchantId` = a.`merchantId`
SET
    a.`pendingAmount` = COALESCE(l.`pendingAmount`, 0),
    a.`availableAmount` = COALESCE(l.`availableAmount`, 0),
    a.`frozenAmount` = COALESCE(l.`frozenAmount`, 0),
    a.`withdrawnAmount` = COALESCE(l.`withdrawnAmount`, 0),
    a.`updatedAt` = CURRENT_TIMESTAMP(3);
