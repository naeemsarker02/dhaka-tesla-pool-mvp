-- CreateTable
CREATE TABLE `zones` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cluster` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `zones_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ride_requests` (
    `id` VARCHAR(191) NOT NULL,
    `passenger_id` VARCHAR(191) NOT NULL,
    `pickup_zone_id` VARCHAR(191) NOT NULL,
    `destination_zone_id` VARCHAR(191) NOT NULL,
    `seats_requested` INTEGER NOT NULL,
    `status` ENUM('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `estimated_fare_paisa` INTEGER NOT NULL,
    `fare_paisa` INTEGER NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `matched_at` DATETIME(3) NULL,
    `arrived_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ride_requests` ADD CONSTRAINT `ride_requests_passenger_id_fkey` FOREIGN KEY (`passenger_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ride_requests` ADD CONSTRAINT `ride_requests_pickup_zone_id_fkey` FOREIGN KEY (`pickup_zone_id`) REFERENCES `zones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ride_requests` ADD CONSTRAINT `ride_requests_destination_zone_id_fkey` FOREIGN KEY (`destination_zone_id`) REFERENCES `zones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
