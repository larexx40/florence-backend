import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsNumber,
    IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── State DTOs ────────────────────────────────────────────────────────────────

export class CreateStateDto {
    @ApiProperty({ example: 'Lagos' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Ikeja' })
    @IsString()
    @IsOptional()
    capital?: string;

    @ApiPropertyOptional({ example: 6.5244 })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    latitude?: number;

    @ApiPropertyOptional({ example: 3.3792 })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    longitude?: number;
}

// ── City DTOs ─────────────────────────────────────────────────────────────────

export class CreateCityDto {
    @ApiProperty({ example: 'Ikeja' })
    @IsString()
    @IsNotEmpty()
    name: string;
}

// ── LGA DTOs ──────────────────────────────────────────────────────────────────

export class CreateLgaDto {
    @ApiProperty({ example: 'Alimosho' })
    @IsString()
    @IsNotEmpty()
    name: string;
}
