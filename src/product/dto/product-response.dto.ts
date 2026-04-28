import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DirectDiscountType } from '@prisma/client';

// ── Shared refs ──────────────────────────────────────────────────────────────

export class ProductCategoryRefDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Bags' })
  name: string;

  @ApiProperty({ example: 'bags' })
  slug: string;
}

export class ProductImageDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'https://cdn.example.com/products/img.jpg' })
  url: string;

  @ApiPropertyOptional({ example: 'Front view' })
  altText: string | null;

  @ApiProperty({ example: 0 })
  position: number;

  @ApiProperty()
  createdAt: Date;
}

// ── List ─────────────────────────────────────────────────────────────────────

export class ProductListVariantDto {
  @ApiProperty({ example: 25000 })
  price: number;

  @ApiProperty({ example: 12 })
  stockQty: number;
}

export class ProductListResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'BFLO 226' })
  name: string;

  @ApiProperty({ example: 'bflo-226' })
  slug: string;

  @ApiPropertyOptional({ example: 'Premium quality bag in multiple colours' })
  description: string | null;

  @ApiProperty({ example: 'uuid-of-category' })
  categoryId: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  requiresVariant: boolean;

  @ApiProperty({ example: 1 })
  minOrderQty: number;

  @ApiPropertyOptional({ example: 6 })
  orderIncrement: number | null;

  @ApiPropertyOptional({ example: 'uuid-of-variant' })
  prerequisiteVariantId: string | null;

  @ApiPropertyOptional({ example: 'uuid-of-discount' })
  discountId: string | null;

  @ApiProperty({ example: false })
  directDiscountEnabled: boolean;

  @ApiPropertyOptional({ enum: DirectDiscountType, example: DirectDiscountType.PERCENTAGE })
  directDiscountType: DirectDiscountType | null;

  @ApiPropertyOptional({ example: '15.00' })
  directDiscountValue: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: ProductCategoryRefDto })
  category: ProductCategoryRefDto;

  @ApiProperty({ type: [ProductImageDto], description: 'First product image (cover)' })
  images: ProductImageDto[];

  @ApiProperty({ type: [ProductListVariantDto] })
  variants: ProductListVariantDto[];

  @ApiPropertyOptional({ example: 15000, description: 'Lowest price among active variants; null if no variants' })
  minPrice: number | null;

  @ApiPropertyOptional({ example: 35000, description: 'Highest price among active variants; null if no variants' })
  maxPrice: number | null;
}

// ── Detail ───────────────────────────────────────────────────────────────────

export class VariantImageDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'https://cdn.example.com/variants/img.jpg' })
  url: string;

  @ApiPropertyOptional({ example: 'Blue colourway' })
  altText: string | null;

  @ApiProperty({ example: 0 })
  position: number;

  @ApiProperty()
  createdAt: Date;
}

/** One selectable value within an option axis (e.g. "Green" in Color). */
export class OptionValueDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Green' })
  value: string;

  @ApiPropertyOptional({ example: '#00c853', description: 'Hex code for colour swatches; null for non-colour options' })
  colorHex: string | null;
}

/** One option axis (e.g. Color, Size) with all its available values for this product. */
export class ProductOptionResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Color', description: 'Option axis name (from the category)' })
  name: string;

  @ApiProperty({ type: [OptionValueDto] })
  values: OptionValueDto[];
}

/** Single dimension of the variant's identity (e.g. Color=Green). */
export class VariantCombinationDto {
  @ApiProperty({ example: 'Color' })
  optionName: string;

  @ApiProperty({ example: 'Green' })
  value: string;

  @ApiPropertyOptional({ example: '#00c853' })
  colorHex: string | null;
}

export class ProductDetailVariantDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'TROUSER-GR-32' })
  sku: string;

  @ApiProperty({ example: 'Green / 32', description: 'Denormalised display title' })
  title: string;

  @ApiProperty({ example: 15000 })
  price: number;

  @ApiPropertyOptional({ example: 20000, description: 'Original price before discount; null if no compare price set' })
  compareAtPrice: number | null;

  @ApiProperty({ example: 8 })
  stockQty: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: 1 })
  minQty: number | null;

  @ApiPropertyOptional({ example: 10 })
  maxQty: number | null;

  @ApiPropertyOptional({ example: 0.45 })
  weightKg: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({
    type: [VariantCombinationDto],
    description: 'Flat list of option axis + value pairs that define this variant',
    example: [
      { optionName: 'Color', value: 'Green', colorHex: '#00c853' },
      { optionName: 'Size', value: '32', colorHex: null },
    ],
  })
  combination: VariantCombinationDto[];

  @ApiProperty({ type: [VariantImageDto] })
  images: VariantImageDto[];
}

export class ProductDetailCategoryDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Trousers' })
  name: string;

  @ApiProperty({ example: 'trousers' })
  slug: string;

  @ApiPropertyOptional({ example: 'All trouser styles' })
  description: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/categories/trousers.jpg' })
  imageUrl: string | null;

  @ApiPropertyOptional({ example: 'uuid-of-parent' })
  parentId: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ProductDetailResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Classic Trouser' })
  name: string;

  @ApiProperty({ example: 'classic-trouser' })
  slug: string;

  @ApiPropertyOptional({ example: 'Slim-fit trouser in multiple colours and waist sizes' })
  description: string | null;

  @ApiProperty({ example: 'uuid-of-category' })
  categoryId: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  requiresVariant: boolean;

  @ApiProperty({ example: 1 })
  minOrderQty: number;

  @ApiPropertyOptional({ example: 6 })
  orderIncrement: number | null;

  @ApiPropertyOptional({ example: 'uuid-of-variant' })
  prerequisiteVariantId: string | null;

  @ApiPropertyOptional({ example: 'uuid-of-discount' })
  discountId: string | null;

  @ApiProperty({ example: false })
  directDiscountEnabled: boolean;

  @ApiPropertyOptional({ enum: DirectDiscountType, example: DirectDiscountType.PERCENTAGE })
  directDiscountType: DirectDiscountType | null;

  @ApiPropertyOptional({ example: '15.00' })
  directDiscountValue: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: ProductDetailCategoryDto })
  category: ProductDetailCategoryDto;

  @ApiProperty({ type: [ProductImageDto] })
  images: ProductImageDto[];

  @ApiProperty({
    type: [ProductOptionResponseDto],
    description: 'All option axes for this product (e.g. Color, Size) with their available values',
    example: [
      { id: 'uuid', name: 'Color', values: [{ id: 'uuid', value: 'Green', colorHex: '#00c853' }, { id: 'uuid', value: 'Blue', colorHex: '#1565c0' }] },
      { id: 'uuid', name: 'Size', values: [{ id: 'uuid', value: '32', colorHex: null }, { id: 'uuid', value: '38', colorHex: null }] },
    ],
  })
  options: ProductOptionResponseDto[];

  @ApiProperty({ type: [ProductDetailVariantDto] })
  variants: ProductDetailVariantDto[];

  @ApiPropertyOptional({ example: 15000, description: 'Lowest price among active variants' })
  minPrice: number | null;

  @ApiPropertyOptional({ example: 25000, description: 'Highest price among active variants' })
  maxPrice: number | null;
}
