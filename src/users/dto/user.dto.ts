import { Role } from '@prisma/client';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W)[A-Za-z\d\W]{8,}$/;
const PASSWORD_MESSAGE =
  'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and must be at least 8 characters long';

// ── Self-service ─────────────────────────────────────────────────────────────

export class SetupAccountDto {
  @ApiProperty({ example: 'NewP@ssword1!', description: PASSWORD_MESSAGE })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ example: 'NewP@ssword1!' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  @IsString()
  confirmPassword: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'Acme Ltd' })
  @IsOptional()
  @IsString()
  businessName?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Acme Ltd' })
  @IsOptional()
  @IsString()
  businessName?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ssword1!' })
  @IsNotEmpty({ message: 'Current password is required' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewP@ssword1!', description: PASSWORD_MESSAGE })
  @IsNotEmpty({ message: 'New password is required' })
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;

  @ApiProperty({ example: 'NewP@ssword1!' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  @IsString()
  confirmPassword: string;
}

// ── Admin user management ─────────────────────────────────────────────────────

export class CreateUserDto {
  @ApiProperty({ example: 'Jane' })
  @IsNotEmpty({ message: 'Firstname required' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty({ message: 'Lastname required' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'customer@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }: TransformFnParams) => value?.trim().toLowerCase())
  email: string;

  @ApiPropertyOptional({ enum: Role, example: Role.CUSTOMER })
  @IsOptional()
  @IsEnum(Role, { message: 'Invalid role' })
  role?: Role;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Acme Ltd' })
  @IsOptional()
  @IsString()
  businessName?: string;
}

export class UserQueryDto {
  @ApiPropertyOptional({ example: 'jane' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.CUSTOMER })
  @IsOptional()
  @IsEnum(Role, { message: 'Invalid role filter' })
  role?: Role;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['createdAt', 'firstName', 'email', 'lastLogin'], example: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'firstName', 'email', 'lastLogin'])
  sortBy?: 'createdAt' | 'firstName' | 'email' | 'lastLogin';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class UserOrderQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class AwardStoreCreditDto {
  @ApiProperty({ example: 500.00, description: 'Amount in Naira to credit to the user' })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber()
  @IsPositive({ message: 'Amount must be a positive number' })
  amount: number;

  @ApiPropertyOptional({ example: 'Compensation for delayed order #ORD-001' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SendUserEmailDto {
  @ApiProperty({ example: 'Your order update' })
  @IsNotEmpty({ message: 'Subject is required' })
  @IsString()
  subject: string;

  @ApiProperty({ example: 'Hello Jane, your order has been dispatched...' })
  @IsNotEmpty({ message: 'Message body is required' })
  @IsString()
  message: string;
}
