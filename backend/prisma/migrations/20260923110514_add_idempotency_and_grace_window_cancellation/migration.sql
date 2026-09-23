-- AlterTable
ALTER TABLE `ride_requests` ADD COLUMN `cancellation_fee_paisa` INTEGER NULL,
    ADD COLUMN `idempotency_key` VARCHAR(191) NULL,
    ADD COLUMN `late_cancellation` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `ride_requests_idempotency_key_key` ON `ride_requests`(`idempotency_key`);
