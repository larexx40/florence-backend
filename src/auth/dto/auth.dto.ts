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

export class LoginMerchantDto {
  @ApiProperty({ example: 'merchant@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsString({ message: 'Email must be a string' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'P@ssword1!' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password can only be a string' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsString({ message: 'Refresh token should be a string' })
  refreshToken: string;
}

export class MerchantSignupDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty({ message: 'Firstname required' })
  @IsString({ message: 'Firstname must be a string' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty({ message: 'Lastname required' })
  @IsString({ message: 'Lastname must be a string' })
  lastName: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty({ message: 'Email required' })
  @IsString({ message: 'Email must be a string' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty({ message: 'Email confirmation is required' })
  @IsString({ message: 'Email confirmation must be a stringmismatch' })
  confirmEmail: string;

  @ApiProperty({ example: 'P@ssword1!', description: 'Min 8 chars, uppercase, lowercase, number, special char' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W)[A-Za-z\d\W]{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and must be at least 8 characters long',
  })
  password: string;

  @ApiProperty({ example: 'P@ssword1!' })
  @IsNotEmpty({ message: 'Password confirmation is required' })
  @IsString({ message: 'Password confirmation must be a string' })
  confirmPassword: string;

  @ApiProperty({ example: 'Acme Ltd' })
  @IsNotEmpty({ message: 'Businessname is required' })
  @IsString({ message: 'Businessname must be a string' })
  businessName: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  phone: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString({ message: 'mismatch' })
  avatar: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'john@example.com' })
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

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsString({ message: 'Email must be a string' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }: TransformFnParams) => value?.trim())
  @Transform(({ value }: TransformFnParams) => value?.toLowerCase())
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-string' })
  @IsNotEmpty({ message: 'Token is required' })
  @IsString({ message: 'Token must be string' })
  token: string;

  @ApiProperty({ example: 'NewP@ssword1!' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  password: string;

  @ApiProperty({ example: 'NewP@ssword1!' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  @IsString({ message: 'Confirm password must be a string' })
  confirmPassword: string;
}

export class RequestOtpDto {
  @ApiPropertyOptional({ example: 'john@example.com' })
  @ValidateIf(o => !o.phoneno)
  @IsEmail({}, { message: 'Invalid email format' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @ValidateIf(o => !o.email)
  @IsPhoneNumber(null, { message: 'Invalid phone number format' })
  @IsOptional()
  phone?: string;
}
