import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
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

  @ApiPropertyOptional({ enum: ['name', 'createdAt'], example: 'createdAt' })
  @IsOptional()
  @IsIn(['name', 'createdAt'])
  sortBy?: 'name' | 'createdAt';

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
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @ApiPropertyOptional({ example: 6, description: 'Quantity must be a multiple of this value' })
  @IsOptional()
  @IsInt()
  @Min(1)
  orderIncrement?: number;

  @ApiPropertyOptional({ example: 'uuid-of-variant', description: 'Variant that must be in cart before others can be added' })
  @IsOptional()
  @IsUUID('4')
  prerequisiteVariantId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'false = no variant selector shown; product is sold as-is with a single default variant',
  })
  @IsOptional()
  @IsBoolean()
  requiresVariant?: boolean;

  @ApiPropertyOptional({ example: 'uuid-of-discount' })
  @IsOptional()
  @IsUUID('4')
  discountId?: string;

  @ApiPropertyOptional({ example: false, description: 'Enable the direct discount on this product' })
  @IsOptional()
  @IsBoolean()
  directDiscountEnabled?: boolean;

  @ApiPropertyOptional({ enum: DirectDiscountType, example: DirectDiscountType.PERCENTAGE })
  @IsOptional()
  @IsEnum(DirectDiscountType)
  directDiscountType?: DirectDiscountType;

  @ApiPropertyOptional({ example: '15.00', description: 'Percentage (0–100) or absolute amount depending on directDiscountType' })
  @IsOptional()
  @IsDecimal()
  @IsPositive()
  directDiscountValue?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'BFLO 226 Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'bflo-226-updated' })
  @IsOptional()
  @IsString()
  slug?: string;

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
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  orderIncrement?: number;

  @ApiPropertyOptional({ example: 'uuid-of-variant' })
  @IsOptional()
  @IsUUID('4')
  prerequisiteVariantId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresVariant?: boolean;

  @ApiPropertyOptional({ example: 'uuid-of-discount' })
  @IsOptional()
  @IsUUID('4')
  discountId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  directDiscountEnabled?: boolean;

  @ApiPropertyOptional({ enum: DirectDiscountType, example: DirectDiscountType.PERCENTAGE })
  @IsOptional()
  @IsEnum(DirectDiscountType)
  directDiscountType?: DirectDiscountType;

  @ApiPropertyOptional({ example: '15.00' })
  @IsOptional()
  @IsDecimal()
  @IsPositive()
  directDiscountValue?: string;
}
