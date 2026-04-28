import { Role } from '@prisma/client';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W)[A-Za-z\d\W]{8,}$/;
const PASSWORD_MESSAGE =
  'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and must be at least 8 characters long';

export class ChangeUserRole {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsNotEmpty({ message: 'User id is required' })
  @IsString({ message: 'User id must be a string' })
  @IsUUID('4', { message: 'User id must be a valid UUID' })
  userId: string;

  @ApiProperty({ enum: Role, example: Role.SUPPORT })
  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(Role)
  role: Role;
}

export class AddAdminDto {
  @ApiProperty({ example: 'Jane' })
  @IsNotEmpty({ message: 'Firstname required' })
  @IsString({ message: 'Firstname must be a string' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty({ message: 'Lastname required' })
  @IsString({ message: 'Lastname must be a string' })
  lastName: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsString({ message: 'Email must be a string' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }: TransformFnParams) => value?.trim().toLowerCase())
  email: string;
}

export class UpdateNewAdminProfileDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  phone: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsDefined({ message: 'Firstname is required' })
  @IsString({ message: 'Firstname must be a string' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsDefined({ message: 'Lastname is required' })
  @IsString({ message: 'Lastname must be a string' })
  lastName?: string;

  @ApiProperty({ example: 'P@ssword1!', description: 'Min 8 chars, uppercase, lowercase, number, special char' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;
}
