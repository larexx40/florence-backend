import {
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShippingAddressDto {
    @ApiProperty({ example: 'Jane Doe' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: '+2348012345678' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: '12 Bode Thomas Street' })
    @IsString()
    @IsNotEmpty()
    addressLine1: string;

    @ApiPropertyOptional({ example: 'Surulere' })
    @IsString()
    @IsOptional()
    addressLine2?: string;

    @ApiProperty({ example: 'Lagos' })
    @IsString()
    @IsNotEmpty()
    state: string;

    @ApiProperty({ example: 'Lagos Island' })
    @IsString()
    @IsNotEmpty()
    city: string;

    @ApiPropertyOptional({ example: 'uuid-of-city', description: 'City UUID for logistics lookup' })
    @IsUUID()
    @IsOptional()
    cityId?: string;

    @ApiPropertyOptional({ example: 'Nigeria' })
    @IsString()
    @IsOptional()
    country?: string;

    @ApiPropertyOptional({ example: '101001' })
    @IsString()
    @IsOptional()
    postalCode?: string;

    @ApiPropertyOptional({ example: false, description: 'Set as default shipping address' })
    @IsBoolean()
    @IsOptional()
    isDefault?: boolean;
}

export class UpdateShippingAddressDto {
    @ApiPropertyOptional({ example: 'Jane Doe' })
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional({ example: '+2348012345678' })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ example: '12 Bode Thomas Street' })
    @IsString()
    @IsOptional()
    addressLine1?: string;

    @ApiPropertyOptional({ example: 'Surulere' })
    @IsString()
    @IsOptional()
    addressLine2?: string;

    @ApiPropertyOptional({ example: 'Lagos' })
    @IsString()
    @IsOptional()
    state?: string;

    @ApiPropertyOptional({ example: 'Lagos Island' })
    @IsString()
    @IsOptional()
    city?: string;

    @ApiPropertyOptional({ example: 'uuid-of-city' })
    @IsUUID()
    @IsOptional()
    cityId?: string;

    @ApiPropertyOptional({ example: 'Nigeria' })
    @IsString()
    @IsOptional()
    country?: string;

    @ApiPropertyOptional({ example: '101001' })
    @IsString()
    @IsOptional()
    postalCode?: string;
}
