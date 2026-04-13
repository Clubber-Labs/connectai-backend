/*
  Warnings:

  - The primary key for the `follows` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[followerId,followingId]` on the table `follows` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id` to the `follows` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "follows" DROP CONSTRAINT "follows_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "status" "FollowStatus" NOT NULL DEFAULT 'ACCEPTED',
ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "followersCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "followingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "follows_followingId_status_id_idx" ON "follows"("followingId", "status", "id");

-- CreateIndex
CREATE INDEX "follows_followerId_status_id_idx" ON "follows"("followerId", "status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_followingId_key" ON "follows"("followerId", "followingId");

-- CheckConstraint
ALTER TABLE "follows" ADD CONSTRAINT "no_self_follow" CHECK ("followerId" <> "followingId");
