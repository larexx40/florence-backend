-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "category_options" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_option_values" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "category_options_is_deleted_idx" ON "category_options"("is_deleted");

-- CreateIndex
CREATE INDEX "product_option_values_is_deleted_idx" ON "product_option_values"("is_deleted");

-- CreateIndex
CREATE INDEX "product_variants_is_deleted_idx" ON "product_variants"("is_deleted");
