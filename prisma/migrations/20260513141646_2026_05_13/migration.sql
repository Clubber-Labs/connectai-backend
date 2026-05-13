/*
  Warnings:

  - You are about to drop the column `bannedReason` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "bannedReason",
ADD COLUMN     "banReason" TEXT;
