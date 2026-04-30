import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DirectDiscountType } from '@prisma/client';

export class ProductQueryDto {
  @ApiPropertyOptional({ example: 'bag' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'uuid-of-category' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ example: 'bags', description: 'Filter by category slug (alternative to categoryId)' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({
    enum: ['name', 'createdAt', 'price', 'featured', 'bestSelling'],
    example: 'createdAt',
    description: 'price sorts by minimum variant price; featured and bestSelling sort boolean flags descending',
  })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'price', 'featured', 'bestSelling'])
  sortBy?: 'name' | 'createdAt' | 'price' | 'featured' | 'bestSelling';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ example: false, description: 'Filter to featured products only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Filter to best-selling products only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  bestSelling?: boolean;

  // admin-only: include inactive products when true
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({ example: false, description: 'true = return all records without pagination' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ example: 'BFLO 226' })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Premium quality bag in multiple colours' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'uuid-of-category' })
  @IsNotEmpty({ message: 'Category is required' })
  @IsUUID('4', { message: 'categoryId must be a valid UUID' })
  categoryId: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Minimum units per order' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @ApiPropertyOptional({ example: 6, description: 'Quantity must be a multiple of this value' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  orderIncrement?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'false = product has no variants; a single default variant is created automatically using price and quantity',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasVariant?: boolean;

  @ApiPropertyOptional({
    example: 2500.00,
    description: 'Required when hasVariant is false. Price of the single default variant.',
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseFloat(value) : value))
  @IsNumber({}, { message: 'price must be a number' })
  @IsPositive({ message: 'price must be greater than 0' })
  price?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Stock quantity for the default variant. Only used when hasVariant is false.',
    minimum: 0,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseInt(value, 10) : value))
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: false, description: 'Enable the direct discount on this product' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  directDiscountEnabled?: boolean;

  @ApiPropertyOptional({ enum: DirectDiscountType, example: DirectDiscountType.PERCENTAGE })
  @IsOptional()
  @IsEnum(DirectDiscountType)
  directDiscountType?: DirectDiscountType;

  @ApiPropertyOptional({ example: '15.00', description: 'Percentage (0–100) or absolute amount depending on directDiscountType' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseFloat(value) : value))
  @IsNumber({}, { message: 'Discount Value must be a number' })
  @IsPositive()
  directDiscountValue?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'BFLO 226 Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'uuid-of-category' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Pin this product in featured sections' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Mark this product as a best seller' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isBestSeller?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  orderIncrement?: number;

  @ApiPropertyOptional({ example: 'uuid-of-variant' })
  @IsOptional()
  @IsUUID('4')
  prerequisiteVariantId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasVariant?: boolean;

  @ApiPropertyOptional({ example: 'uuid-of-discount' })
  @IsOptional()
  @IsUUID('4')
  discountId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  directDiscountEnabled?: boolean;

  @ApiPropertyOptional({ enum: DirectDiscountType, example: DirectDiscountType.PERCENTAGE })
  @IsOptional()
  @IsEnum(DirectDiscountType)
  directDiscountType?: DirectDiscountType;

  @ApiPropertyOptional({ example: '15.00' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseFloat(value) : value))
  @IsDecimal()
  @IsPositive()
  directDiscountValue?: string;
}
