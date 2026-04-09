/*
  Warnings:

  - You are about to drop the column `localGovernmentId` on the `logistics_coverages` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- DropForeignKey
ALTER TABLE "logistics_coverages" DROP CONSTRAINT "logistics_coverages_localGovernmentId_fkey";

-- AlterTable
ALTER TABLE "logistics_companies" ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "logistics_coverages" DROP COLUMN "localGovernmentId",
ADD COLUMN     "local_government_id" TEXT,
ADD COLUMN     "shipping_fee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_profile_complete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password" TEXT;

-- AddForeignKey
ALTER TABLE "logistics_coverages" ADD CONSTRAINT "logistics_coverages_local_government_id_fkey" FOREIGN KEY ("local_government_id") REFERENCES "local_governments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
