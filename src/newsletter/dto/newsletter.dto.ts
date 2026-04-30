import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
