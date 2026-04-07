import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddProductOptionDto {
  @ApiProperty({ example: 'Color', description: 'Global option name — created if it does not already exist' })
  @IsNotEmpty({ message: 'Option name is required' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Colour', description: 'Display label shown in the UI' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 0, description: 'Display order of this option on the product page' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateProductOptionDto {
  @ApiPropertyOptional({ example: 'Colour' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class AddOptionValueDto {
  @ApiProperty({ example: 'Black' })
  @IsNotEmpty({ message: 'Value is required' })
  @IsString()
  value: string;

  @ApiPropertyOptional({ example: 'Jet Black' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateOptionValueDto {
  @ApiPropertyOptional({ example: 'Jet Black' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ example: false, description: 'false = grey out this value in the selector UI' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
