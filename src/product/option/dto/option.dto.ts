import { Transform } from 'class-transformer';
import {
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── ProductOption DTOs ────────────────────────────────────────────────────────

export class CreateProductOptionDto {
  @ApiProperty({
    example: 'uuid-of-category-option',
    description: 'CategoryOption UUID — must belong to this product\'s category',
  })
  @IsNotEmpty()
  @IsUUID('4')
  categoryOptionId: string;

  @ApiPropertyOptional({ example: 0, description: 'Display order on the product page' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  position?: number;
}

export class UpdateProductOptionDto {
  @ApiPropertyOptional({ example: 1, description: 'Display order on the product page' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  position?: number;
}

// ── ProductOptionValue DTOs ───────────────────────────────────────────────────

export class CreateProductOptionValueDto {
  @ApiProperty({ example: 'Black', description: 'The value label (e.g. colour name, size code)' })
  @IsNotEmpty()
  @IsString()
  value: string;

  @ApiPropertyOptional({ example: 'Jet Black', description: 'Override label shown in the UI' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: '#000000', description: 'Hex colour code — for colour swatch UI' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @ApiPropertyOptional({ example: 0, description: 'Display order within the option' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  position?: number;
}

export class UpdateProductOptionValueDto {
  @ApiPropertyOptional({ example: 'Navy Blue' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ example: 'Navy' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: '#001F5B' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  position?: number;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class ProductOptionValueResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid-of-product-option' })
  productOptionId: string;

  @ApiProperty({ example: 'Black' })
  value: string;

  @ApiPropertyOptional({ example: 'Jet Black', nullable: true })
  displayName: string | null;

  @ApiPropertyOptional({ example: '#000000', nullable: true })
  colorHex: string | null;

  @ApiProperty({ example: 0 })
  position: number;

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

  @ApiProperty({ example: 0 })
  position: number;

  @ApiProperty({ example: { id: 'uuid', name: 'Color', position: 1 } })
  categoryOption: { id: string; name: string; position: number };

  @ApiProperty({ type: () => [ProductOptionValueResponseDto] })
  values: ProductOptionValueResponseDto[];

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
