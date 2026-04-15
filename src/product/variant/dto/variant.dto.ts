import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VariantQueryDto {
  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ enum: ['price', 'createdAt'], example: 'price' })
  @IsOptional()
  @IsIn(['price', 'createdAt'])
  sortBy?: 'price' | 'createdAt';

  @ApiPropertyOptional({ example: false, description: 'true = only return variants with stock > 0' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Admin only — include inactive variants' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ example: false, description: 'true = return all records without pagination' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all?: boolean;
}

export class CreateVariantDto {

  @ApiProperty({ example: 14000 })
  @IsNotEmpty({ message: 'Price is required' })
  @IsNumber({}, { message: 'Price must be a number' })
  price: number;

  @ApiPropertyOptional({ example: 16000, description: 'Original price before discount — shown as strikethrough' })
  @IsOptional()
  @IsNumber()
  compareAtPrice?: number;

  @ApiPropertyOptional({ example: 50, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @ApiPropertyOptional({ example: 1.5, description: 'Weight in kilograms' })
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Minimum qty per order for this variant — overrides product default' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minQty?: number;

  @ApiPropertyOptional({ example: 100, minimum: 1, description: 'Maximum qty per order for this variant' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxQty?: number;

  @ApiProperty({
    description: 'Array of ProductOptionValue IDs that define this variant combination. One ID per option dimension.',
    example: ['uuid-of-black-pov', 'uuid-of-l-pov'],
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each productOptionValueId must be a valid UUID' })
  productOptionValueIds: string[];
}

export class UpdateVariantDto {
  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 17000 })
  @IsOptional()
  @IsNumber()
  compareAtPrice?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 1.2 })
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minQty?: number;

  @ApiPropertyOptional({ example: 50, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxQty?: number;
}

export class UpdateStockDto {
  @ApiProperty({ example: 100, minimum: 0, description: 'Absolute stock quantity to set' })
  @IsNotEmpty({ message: 'stockQty is required' })
  @IsInt()
  @Min(0)
  stockQty: number;
}

export class BulkCreateVariantsDto {
  @ApiProperty({
    type: [CreateVariantDto],
    description: 'Array of variants to create atomically — if any one fails, none are saved.',
    example: [
      {
        sku: 'BFLO-BLACK-36',
        price: 14000,
        compareAtPrice: 16000,
        stockQty: 50,
        productOptionValueIds: ['<color-pov-uuid>', '<size-pov-uuid>'],
      },
      {
        sku: 'BFLO-BLACK-37',
        price: 14000,
        stockQty: 30,
        productOptionValueIds: ['<color-pov-uuid>', '<size-pov-uuid-37>'],
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one variant is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];
}
