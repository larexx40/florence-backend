/*
  Warnings:

  - You are about to drop the column `position` on the `category_options` table. All the data in the column will be lost.
  - You are about to drop the column `display_name` on the `product_option_values` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `product_option_values` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `product_options` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DirectDiscountType" AS ENUM ('PERCENTAGE', 'AMOUNT');

-- AlterTable
ALTER TABLE "category_options" DROP COLUMN "position";

-- AlterTable
ALTER TABLE "product_option_values" DROP COLUMN "display_name",
DROP COLUMN "position";

-- AlterTable
ALTER TABLE "product_options" DROP COLUMN "position";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "direct_discount_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "direct_discount_type" "DirectDiscountType",
ADD COLUMN     "direct_discount_value" DECIMAL(12,2);
