import {
    IsBoolean,
    IsEmail,
    IsEnum,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

// ── Company DTOs ──────────────────────────────────────────────────────────────

export class CreateLogisticsDto {
    @ApiProperty({ example: 'Swift Logistics' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: '+2348012345678' })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ example: 'hello@swiftlogistics.ng' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ example: 'Reliable next-day delivery across Lagos' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/swift-logo.png' })
    @IsString()
    @IsOptional()
    logoUrl?: string;
}

export class UpdateLogisticsDto {
    @ApiPropertyOptional({ example: 'Swift Logistics NG' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ example: '+2348012345678' })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ example: 'hello@swiftlogistics.ng' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ example: 'Reliable next-day delivery across Lagos' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/swift-logo.png' })
    @IsString()
    @IsOptional()
    logoUrl?: string;

    @ApiPropertyOptional({ example: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export class LogisticsQueryDto {
    @ApiPropertyOptional({ example: '1' })
    @IsOptional()
    page?: string;

    @ApiPropertyOptional({ example: '20' })
    @IsOptional()
    limit?: string;

    @ApiPropertyOptional({ example: 'swift' })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    includeInactive?: boolean;
}

// ── Coverage query ────────────────────────────────────────────────────────────

export enum CoverageSortBy {
    SHIPPING_FEE = 'shippingFee',
    CREATED_AT = 'createdAt',
    COMPANY_NAME = 'companyName',
    CITY_NAME = 'cityName',
}

export class CoverageQueryDto {
    @ApiPropertyOptional({ example: '1' })
    @IsOptional()
    page?: string;

    @ApiPropertyOptional({ example: '20' })
    @IsOptional()
    limit?: string;

    @ApiPropertyOptional({ example: 'Lagos' })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ enum: CoverageSortBy, example: CoverageSortBy.SHIPPING_FEE })
    @IsEnum(CoverageSortBy)
    @IsOptional()
    sortBy?: CoverageSortBy;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'asc' })
    @IsIn(['asc', 'desc'])
    @IsOptional()
    sortOrder?: 'asc' | 'desc';

    @ApiPropertyOptional({ example: 'uuid-of-city' })
    @IsUUID()
    @IsOptional()
    cityId?: string;

    @ApiPropertyOptional({ example: 'uuid-of-state' })
    @IsUUID()
    @IsOptional()
    stateId?: string;

    @ApiPropertyOptional({ example: 'uuid-of-company' })
    @IsUUID()
    @IsOptional()
    companyId?: string;

    @ApiPropertyOptional({ example: true, description: 'Admin only — filter by active status' })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    isActive?: boolean;

    @ApiPropertyOptional({ example: 500, description: 'Minimum shipping fee' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    minFee?: number;

    @ApiPropertyOptional({ example: 5000, description: 'Maximum shipping fee' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    maxFee?: number;
}

// ── Coverage DTOs ─────────────────────────────────────────────────────────────

export class AddCoverageDto {
    @ApiProperty({ example: 'uuid-of-city' })
    @IsUUID()
    @IsNotEmpty()
    cityId: string;

    @ApiPropertyOptional({ example: 'uuid-of-lga' })
    @IsUUID()
    @IsOptional()
    localGovernmentId?: string;

    @ApiPropertyOptional({ example: 1500, description: 'Shipping fee in kobo or smallest currency unit' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    shippingFee?: number;
}

export class UpdateCoverageDto {
    @ApiPropertyOptional({ example: 2000, description: 'New shipping fee' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    shippingFee?: number;

    @ApiPropertyOptional({ example: 'uuid-of-lga', description: 'Replace or clear the LGA — pass null to remove' })
    @IsUUID()
    @IsOptional()
    localGovernmentId?: string;

    @ApiPropertyOptional({ example: true, description: 'Enable or disable this coverage area' })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
