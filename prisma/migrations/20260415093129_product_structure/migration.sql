/*
  Warnings:

  - You are about to drop the column `is_default` on the `product_option_values` table. All the data in the column will be lost.
  - You are about to drop the column `is_locked` on the `product_option_values` table. All the data in the column will be lost.
  - You are about to drop the column `option_value_id` on the `product_option_values` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `product_option_values` table. All the data in the column will be lost.
  - You are about to drop the column `option_value_id` on the `variant_option_values` table. All the data in the column will be lost.
  - You are about to drop the `option_values` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[product_option_id,value]` on the table `product_option_values` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[variant_id,product_option_value_id]` on the table `variant_option_values` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `product_option_id` to the `product_option_values` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `product_option_values` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `product_option_values` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_option_value_id` to the `variant_option_values` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "option_values" DROP CONSTRAINT "option_values_category_option_id_fkey";

-- DropForeignKey
ALTER TABLE "product_option_values" DROP CONSTRAINT "product_option_values_option_value_id_fkey";

-- DropForeignKey
ALTER TABLE "product_option_values" DROP CONSTRAINT "product_option_values_product_id_fkey";

-- DropForeignKey
ALTER TABLE "variant_option_values" DROP CONSTRAINT "variant_option_values_option_value_id_fkey";

-- DropIndex
DROP INDEX "product_option_values_option_value_id_idx";

-- DropIndex
DROP INDEX "product_option_values_product_id_idx";

-- DropIndex
DROP INDEX "product_option_values_product_id_option_value_id_key";

-- DropIndex
DROP INDEX "variant_option_values_option_value_id_idx";

-- DropIndex
DROP INDEX "variant_option_values_variant_id_option_value_id_key";

-- AlterTable
ALTER TABLE "product_option_values" DROP COLUMN "is_default",
DROP COLUMN "is_locked",
DROP COLUMN "option_value_id",
DROP COLUMN "product_id",
ADD COLUMN     "color_hex" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "product_option_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "value" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "requires_variant" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "variant_option_values" DROP COLUMN "option_value_id",
ADD COLUMN     "product_option_value_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "option_values";

-- CreateTable
CREATE TABLE "product_options" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "category_option_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_options_product_id_idx" ON "product_options"("product_id");

-- CreateIndex
CREATE INDEX "product_options_category_option_id_idx" ON "product_options"("category_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_options_product_id_category_option_id_key" ON "product_options"("product_id", "category_option_id");

-- CreateIndex
CREATE INDEX "product_option_values_product_option_id_idx" ON "product_option_values"("product_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_option_values_product_option_id_value_key" ON "product_option_values"("product_option_id", "value");

-- CreateIndex
CREATE INDEX "variant_option_values_product_option_value_id_idx" ON "variant_option_values"("product_option_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "variant_option_values_variant_id_product_option_value_id_key" ON "variant_option_values"("variant_id", "product_option_value_id");

-- AddForeignKey
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_category_option_id_fkey" FOREIGN KEY ("category_option_id") REFERENCES "category_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_product_option_id_fkey" FOREIGN KEY ("product_option_id") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_product_option_value_id_fkey" FOREIGN KEY ("product_option_value_id") REFERENCES "product_option_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
