import { Role } from '@prisma/client';
import { Transform, TransformFnParams, Type } from 'class-transformer';
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

// ── Self-service DTOs ────────────────────────────────────────────────────────

export class SetupAccountDto {
  @ApiProperty({ example: 'NewP@ssword1!', description: 'Min 8 chars, uppercase, lowercase, number, special char' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ example: 'NewP@ssword1!' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  @IsString({ message: 'Confirm password must be a string' })
  confirmPassword: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  lastName?: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  phone: string;

  @ApiPropertyOptional({ example: 'Acme Ltd' })
  @IsOptional()
  @IsString({ message: 'Business name must be a string' })
  businessName?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  lastName?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Acme Ltd' })
  @IsOptional()
  @IsString({ message: 'Business name must be a string' })
  businessName?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ssword1!' })
  @IsNotEmpty({ message: 'Current password is required' })
  @IsString({ message: 'Current password must be a string' })
  currentPassword: string;

  @ApiProperty({ example: 'NewP@ssword1!', description: 'Min 8 chars, uppercase, lowercase, number, special char' })
  @IsNotEmpty({ message: 'New password is required' })
  @IsString({ message: 'New password must be a string' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;

  @ApiProperty({ example: 'NewP@ssword1!' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  @IsString({ message: 'Confirm password must be a string' })
  confirmPassword: string;
}

// ── Admin user management DTOs ───────────────────────────────────────────────

export class CreateUserDto {
  @ApiProperty({ example: 'Jane' })
  @IsNotEmpty({ message: 'Firstname required' })
  @IsString({ message: 'Firstname must be a string' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty({ message: 'Lastname required' })
  @IsString({ message: 'Lastname must be a string' })
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
  @IsString({ message: 'Phone must be a string' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Acme Ltd' })
  @IsOptional()
  @IsString({ message: 'Business name must be a string' })
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class UserOrderQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class AwardStoreCreditDto {
  @ApiProperty({ example: 500.00, description: 'Amount in Naira to credit to the user' })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @IsPositive({ message: 'Amount must be a positive number' })
  amount: number;

  @ApiPropertyOptional({ example: 'Compensation for delayed order #ORD-001' })
  @IsOptional()
  @IsString({ message: 'Note must be a string' })
  note?: string;
}

export class SendUserEmailDto {
  @ApiProperty({ example: 'Your order update' })
  @IsNotEmpty({ message: 'Subject is required' })
  @IsString({ message: 'Subject must be a string' })
  subject: string;

  @ApiProperty({ example: 'Hello Jane, your order has been dispatched...' })
  @IsNotEmpty({ message: 'Message body is required' })
  @IsString({ message: 'Message must be a string' })
  message: string;
}
