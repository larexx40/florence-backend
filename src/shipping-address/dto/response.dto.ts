import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShippingAddressResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid-of-user' })
  userId: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName: string;

  @ApiProperty({ example: '+2348012345678' })
  phone: string;

  @ApiProperty({ example: '12 Bode Thomas Street' })
  addressLine1: string;

  @ApiPropertyOptional({ example: 'Surulere', nullable: true })
  addressLine2: string | null;

  @ApiProperty({ example: 'Lagos Island' })
  city: string;

  @ApiProperty({ example: 'Lagos' })
  state: string;

  @ApiPropertyOptional({ example: 'uuid-of-city', nullable: true })
  cityId: string | null;

  @ApiProperty({ example: 'Nigeria' })
  country: string;

  @ApiPropertyOptional({ example: '101001', nullable: true })
  postalCode: string | null;

  @ApiProperty({ example: true })
  isDefault: boolean;
}
