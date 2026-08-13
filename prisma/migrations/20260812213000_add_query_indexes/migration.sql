CREATE INDEX `Product_status_sortOrder_createdAt_idx`
ON `Product`(`status`, `sortOrder`, `createdAt`);

CREATE INDEX `Product_categoryId_status_sortOrder_createdAt_idx`
ON `Product`(`categoryId`, `status`, `sortOrder`, `createdAt`);

CREATE INDEX `ProductSku_productId_isActive_price_idx`
ON `ProductSku`(`productId`, `isActive`, `price`);
DROP INDEX `ProductSku_productId_isActive_idx` ON `ProductSku`;

CREATE INDEX `Order_status_createdAt_idx`
ON `Order`(`status`, `createdAt`);

CREATE INDEX `Order_createdAt_idx`
ON `Order`(`createdAt`);
