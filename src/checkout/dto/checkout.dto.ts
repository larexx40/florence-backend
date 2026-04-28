import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

// ── resolve-shipping ──────────────────────────────────────────────────────────

export class ResolveShippingDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'uuid-of-address' })
  @IsOptional()
  @IsUUID('4')
  addressId?: string;
}

// ── place-order ───────────────────────────────────────────────────────────────

export class OrderItemInputDto {
  @ApiProperty({ example: 'uuid-of-variant' })
  @IsUUID('4')
  variantId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

/** Inline address — used when the customer has no saved address yet */
export class InlineAddressDto {
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
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'Lagos Island' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ example: 'uuid-of-city', description: 'City UUID for logistics lookup' })
  @IsOptional()
  @IsUUID('4')
  cityId?: string;

  @ApiPropertyOptional({ example: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '101001' })
  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class PlaceOrderDto {
  @ApiProperty({ example: 'jane@example.com', description: 'Customer email — account is auto-created if it does not exist' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'uuid-of-address', description: 'UUID of a saved address. Omit to use the inline address field.' })
  @IsOptional()
  @IsUUID('4')
  addressId?: string;

  @ApiPropertyOptional({ type: () => InlineAddressDto, description: 'Required if addressId is not supplied' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineAddressDto)
  address?: InlineAddressDto;

  @ApiProperty({ type: () => [OrderItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.PAYSTACK })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'uuid-of-logistics', description: 'Required for delivery (PAYSTACK / BANK_TRANSFER). Omit for in-store pickup (CASH_ON_DELIVERY).' })
  @ValidateIf((o) => o.paymentMethod !== PaymentMethod.CASH_ON_DELIVERY)
  @IsUUID('4')
  logisticsId?: string;

  @ApiPropertyOptional({ example: 'Leave at the gate' })
  @IsOptional()
  @IsString()
  notes?: string;
}
