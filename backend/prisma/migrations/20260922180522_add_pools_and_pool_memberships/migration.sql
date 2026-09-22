-- CreateTable
CREATE TABLE `pools` (
    `id` VARCHAR(191) NOT NULL,
    `tesla_id` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `seats_occupied` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `matched_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pool_memberships` (
    `id` VARCHAR(191) NOT NULL,
    `pool_id` VARCHAR(191) NOT NULL,
    `ride_request_id` VARCHAR(191) NOT NULL,
    `seats` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pool_memberships_ride_request_id_key`(`ride_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pools` ADD CONSTRAINT `pools_tesla_id_fkey` FOREIGN KEY (`tesla_id`) REFERENCES `teslas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pool_memberships` ADD CONSTRAINT `pool_memberships_pool_id_fkey` FOREIGN KEY (`pool_id`) REFERENCES `pools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pool_memberships` ADD CONSTRAINT `pool_memberships_ride_request_id_fkey` FOREIGN KEY (`ride_request_id`) REFERENCES `ride_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
