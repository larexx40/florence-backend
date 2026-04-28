import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── ProductOption DTOs ────────────────────────────────────────────────────────

export class CreateProductOptionDto {
  @ApiProperty({
    example: 'uuid-of-category-option',
    description: "CategoryOption UUID — must belong to this product's category",
  })
  @IsNotEmpty()
  @IsUUID('4')
  categoryOptionId: string;
}

export class UpdateProductOptionDto {}

// ── ProductOptionValue DTOs ───────────────────────────────────────────────────

export class CreateProductOptionValueDto {
  @ApiProperty({ example: 'Black', description: 'The value label (e.g. colour name, size code)' })
  @IsNotEmpty()
  @IsString()
  value: string;

  @ApiPropertyOptional({ example: '#000000', description: 'Hex colour code — for colour swatch UI' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;
}

export class UpdateProductOptionValueDto {
  @ApiPropertyOptional({ example: 'Navy Blue' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ example: '#001F5B' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;
}

// ── Bulk create ───────────────────────────────────────────────────────────────

export class BulkCreateOptionItemDto {
  @ApiProperty({
    example: 'uuid-of-category-option',
    description: "CategoryOption UUID — must belong to this product's category",
  })
  @IsNotEmpty()
  @IsUUID('4')
  categoryOptionId: string;

  @ApiProperty({
    type: () => [CreateProductOptionValueDto],
    description: 'All values for this option (e.g. Red, Green, Blue for Color)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Each option must have at least one value' })
  @ValidateNested({ each: true })
  @Type(() => CreateProductOptionValueDto)
  values: CreateProductOptionValueDto[];
}

export class BulkCreateOptionsDto {
  @ApiProperty({
    type: () => [BulkCreateOptionItemDto],
    description:
      'Array of options with their values. Created atomically — one failure rolls back everything.',
    example: [
      {
        categoryOptionId: 'uuid-color',
        values: [
          { value: 'Red', colorHex: '#FF0000' },
          { value: 'Green', colorHex: '#00FF00' },
          { value: 'Blue', colorHex: '#0000FF' },
        ],
      },
      {
        categoryOptionId: 'uuid-size',
        values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }],
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Provide at least one option' })
  @ValidateNested({ each: true })
  @Type(() => BulkCreateOptionItemDto)
  options: BulkCreateOptionItemDto[];
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class ProductOptionValueResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid-of-product-option' })
  productOptionId: string;

  @ApiProperty({ example: 'Black' })
  value: string;

  @ApiPropertyOptional({ example: '#000000', nullable: true })
  colorHex: string | null;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class ProductOptionResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid-of-product' })
  productId: string;

  @ApiProperty({ example: 'uuid-of-category-option' })
  categoryOptionId: string;

  @ApiProperty({ example: { id: 'uuid', name: 'Color' } })
  categoryOption: { id: string; name: string };

  @ApiProperty({ type: () => [ProductOptionValueResponseDto] })
  values: ProductOptionValueResponseDto[];

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
