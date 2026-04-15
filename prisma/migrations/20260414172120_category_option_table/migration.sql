/*
  Warnings:

  - You are about to drop the column `is_active` on the `option_values` table. All the data in the column will be lost.
  - You are about to drop the column `product_option_id` on the `option_values` table. All the data in the column will be lost.
  - You are about to drop the column `variant_name` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `image_id` on the `product_images` table. All the data in the column will be lost.
  - You are about to drop the column `image_id` on the `variant_images` table. All the data in the column will be lost.
  - You are about to drop the `images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `options` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_options` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `variants` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[category_option_id,value]` on the table `option_values` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category_option_id` to the `option_values` table without a default value. This is not possible if the table is not empty.
  - Added the required column `variant_title` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `product_images` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `variant_images` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "option_values" DROP CONSTRAINT "option_values_product_option_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "product_images" DROP CONSTRAINT "product_images_image_id_fkey";

-- DropForeignKey
ALTER TABLE "product_images" DROP CONSTRAINT "product_images_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_options" DROP CONSTRAINT "product_options_option_id_fkey";

-- DropForeignKey
ALTER TABLE "product_options" DROP CONSTRAINT "product_options_product_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_prerequisite_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "variant_images" DROP CONSTRAINT "variant_images_image_id_fkey";

-- DropForeignKey
ALTER TABLE "variant_images" DROP CONSTRAINT "variant_images_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "variant_option_values" DROP CONSTRAINT "variant_option_values_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "variants" DROP CONSTRAINT "variants_product_id_fkey";

-- DropIndex
DROP INDEX "option_values_product_option_id_idx";

-- DropIndex
DROP INDEX "option_values_product_option_id_value_key";

-- DropIndex
DROP INDEX "product_images_image_id_idx";

-- DropIndex
DROP INDEX "product_images_product_id_image_id_key";

-- DropIndex
DROP INDEX "variant_images_image_id_idx";

-- DropIndex
DROP INDEX "variant_images_variant_id_image_id_key";

-- AlterTable
ALTER TABLE "option_values" DROP COLUMN "is_active",
DROP COLUMN "product_option_id",
ADD COLUMN     "category_option_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "variant_name",
ADD COLUMN     "variant_title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "product_images" DROP COLUMN "image_id",
ADD COLUMN     "alt_text" TEXT,
ADD COLUMN     "url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "variant_images" DROP COLUMN "image_id",
ADD COLUMN     "alt_text" TEXT,
ADD COLUMN     "url" TEXT NOT NULL;

-- DropTable
DROP TABLE "images";

-- DropTable
DROP TABLE "options";

-- DropTable
DROP TABLE "product_options";

-- DropTable
DROP TABLE "variants";

-- CreateTable
CREATE TABLE "category_options" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_values" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "option_value_id" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "compare_at_price" DECIMAL(12,2),
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "min_qty" INTEGER,
    "max_qty" INTEGER,
    "weight_kg" DECIMAL(8,3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_options_category_id_idx" ON "category_options"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_options_category_id_name_key" ON "category_options"("category_id", "name");

-- CreateIndex
CREATE INDEX "product_option_values_product_id_idx" ON "product_option_values"("product_id");

-- CreateIndex
CREATE INDEX "product_option_values_option_value_id_idx" ON "product_option_values"("option_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_option_values_product_id_option_value_id_key" ON "product_option_values"("product_id", "option_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_sku_idx" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "option_values_category_option_id_idx" ON "option_values"("category_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "option_values_category_option_id_value_key" ON "option_values"("category_option_id", "value");

-- AddForeignKey
ALTER TABLE "category_options" ADD CONSTRAINT "category_options_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_values" ADD CONSTRAINT "option_values_category_option_id_fkey" FOREIGN KEY ("category_option_id") REFERENCES "category_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_prerequisite_variant_id_fkey" FOREIGN KEY ("prerequisite_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "option_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_images" ADD CONSTRAINT "variant_images_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
