import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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
  @ApiProperty({ example: 'BFLO-226-BLACK' })
  @IsNotEmpty({ message: 'SKU is required' })
  @IsString()
  sku: string;

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

  @ApiProperty({
    description: 'Array of OptionValue IDs that define this variant combination. One ID per option.',
    example: ['uuid-of-black-value'],
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each optionValueId must be a valid UUID' })
  optionValueIds: string[];
}

export class UpdateVariantDto {
  @ApiPropertyOptional({ example: 'BFLO-226-BLACK-V2' })
  @IsOptional()
  @IsString()
  sku?: string;

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
}

export class UpdateStockDto {
  @ApiProperty({ example: 100, minimum: 0, description: 'Absolute stock quantity to set' })
  @IsNotEmpty({ message: 'stockQty is required' })
  @IsInt()
  @Min(0)
  stockQty: number;
}
