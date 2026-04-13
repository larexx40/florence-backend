import { IsEmail, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveShippingDto {
  @ApiProperty({
    example: 'jane@example.com',
    description: 'Customer email — used to look up saved delivery addresses',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: 'uuid-of-address',
    description: 'Pre-select a specific address UUID. When omitted the default address is used.',
  })
  @IsOptional()
  @IsUUID('4')
  addressId?: string;
}
