import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class TrackOrderDto {
  @ApiProperty({ example: 'ORD-20260413-ABCD' })
  @IsNotEmpty()
  @IsString()
  orderNumber: string;

  @ApiProperty({ example: 'guest@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
