-- CreateTable
CREATE TABLE `ride_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `ride_request_id` VARCHAR(191) NOT NULL,
    `from_status` VARCHAR(191) NOT NULL,
    `to_status` VARCHAR(191) NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changed_by` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ride_status_history` ADD CONSTRAINT `ride_status_history_ride_request_id_fkey` FOREIGN KEY (`ride_request_id`) REFERENCES `ride_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ride_status_history` ADD CONSTRAINT `ride_status_history_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
