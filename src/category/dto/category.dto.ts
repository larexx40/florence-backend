import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Query DTOs ───────────────────────────────────────────────────────────────

export class CategoryQueryDto {
  @ApiPropertyOptional({ example: 'bags' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['name', 'createdAt'], example: 'name' })
  @IsOptional()
  @IsIn(['name', 'createdAt'])
  sortBy?: 'name' | 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ example: 'uuid-of-parent', description: 'Filter by parent category' })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @ApiPropertyOptional({ example: false, description: 'true = return only root categories (no parent)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  rootOnly?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Admin only — include inactive categories' })
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

// ── Mutation DTOs ────────────────────────────────────────────────────────────

export class CreateCategoryDto {
  @ApiProperty({ example: 'Bags' })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'bags' })
  @IsNotEmpty({ message: 'Slug is required' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: 'All types of wholesale bags' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/bags.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-parent',
    description: 'Parent category UUID — omit to create a root category',
  })
  @IsOptional()
  @IsUUID('4', { message: 'parentId must be a valid UUID' })
  parentId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Women Bags' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'women-bags' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/new.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent' })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class SubcategoryResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: "Women's Shoes" })
  name: string;

  @ApiProperty({ example: 'womens-shoes' })
  slug: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/womens-shoes.jpg', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class CategoryResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Shoes' })
  name: string;

  @ApiProperty({ example: 'shoes' })
  slug: string;

  @ApiPropertyOptional({ example: 'All shoe categories', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/shoes.jpg', nullable: true })
  imageUrl: string | null;

  @ApiPropertyOptional({ example: 'uuid-of-parent', nullable: true })
  parentId: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: () => [SubcategoryResponseDto] })
  subcategories: SubcategoryResponseDto[];

  @ApiProperty({ example: { products: 12 } })
  _count: { products: number };
}

export class CategoryListResponseDto {
  @ApiProperty({ type: () => [CategoryResponseDto] })
  categories: CategoryResponseDto[];

  @ApiProperty({
    example: { totalData: 100, totalPages: 5, currentPage: 1, perPage: 20 },
  })
  pagination: {
    totalData: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  };
}

// Standalone — does NOT extend CategoryResponseDto to avoid Swagger circular ref
export class CategoryTreeResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Shoes' })
  name: string;

  @ApiProperty({ example: 'shoes' })
  slug: string;

  @ApiPropertyOptional({ example: 'All shoe categories', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/shoes.jpg', nullable: true })
  imageUrl: string | null;

  @ApiPropertyOptional({ example: 'uuid-of-parent', nullable: true })
  parentId: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: { products: 12 } })
  _count: { products: number };

  @ApiProperty({ type: () => [CategoryTreeResponseDto], description: 'Nested subcategories (up to 3 levels)' })
  subcategories: CategoryTreeResponseDto[];
}
