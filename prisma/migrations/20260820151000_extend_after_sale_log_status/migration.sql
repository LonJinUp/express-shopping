-- AlterTable
ALTER TABLE `AfterSaleLog`
    MODIFY `fromStatus` ENUM(
        'PENDING',
        'ARBITRATING',
        'APPROVED',
        'WAITING_RETURN',
        'RETURNED',
        'REFUNDING',
        'COMPLETED',
        'REJECTED',
        'CANCELLED'
    ) NULL,
    MODIFY `toStatus` ENUM(
        'PENDING',
        'ARBITRATING',
        'APPROVED',
        'WAITING_RETURN',
        'RETURNED',
        'REFUNDING',
        'COMPLETED',
        'REJECTED',
        'CANCELLED'
    ) NOT NULL;
