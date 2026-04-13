import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsNumber,
  IsPhoneNumber,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W)[A-Za-z\d\W]{8,}$/;
const PASSWORD_MESSAGE =
  'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and must be at least 8 characters long';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }: TransformFnParams) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'P@ssword1!' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsString({ message: 'Refresh token must be a string' })
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }: TransformFnParams) => value?.trim().toLowerCase())
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }: TransformFnParams) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  @IsNotEmpty({ message: 'Reset token is required' })
  @IsString({ message: 'Token must be a string' })
  token: string;

  @ApiProperty({ example: 'NewP@ssword1!', description: 'Min 8 chars, uppercase, lowercase, number, special char' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ example: 'NewP@ssword1!' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  @IsString({ message: 'Confirm password must be a string' })
  confirmPassword: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsString({ message: 'Email must be a string' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }: TransformFnParams) => value?.trim())
  email: string;

  @ApiProperty({ example: 1234, description: '4-digit OTP' })
  @IsNotEmpty({ message: '4 digit OTP is required' })
  @IsNumber({}, { message: 'OTP must be a number' })
  otp: number;
}

export class RequestOtpDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @ValidateIf(o => !o.phone)
  @IsEmail({}, { message: 'Invalid email format' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @ValidateIf(o => !o.email)
  @IsPhoneNumber(null, { message: 'Invalid phone number format' })
  @IsOptional()
  phone?: string;
}
