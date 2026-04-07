import { Role } from "@prisma/client";
import { IsBoolean, IsDefined, IsEmail, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Min } from "class-validator";
import { Transform, TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangeUserRole {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    @IsNotEmpty({ message: 'User id is required' })
    @IsString({ message: 'User id must be a string' })
    @IsUUID('4', { message: 'User id must be a valid UUID' })
    userId: string;

    @ApiProperty({ enum: Role, example: Role[Object.keys(Role)[0]] })
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
  @Transform(({ value }: TransformFnParams) => value?.trim())
  @Transform(({ value }: TransformFnParams) => value?.toLowerCase())
  email: string;
}

export class UpdateNewAdminProfileDto {
    @ApiProperty({ example: '+2348012345678' })
    @IsNotEmpty({ message: 'Phone number is required' })
    @IsString({ message: 'Phone number must be a string' })
    phone: string;

    @ApiPropertyOptional({ example: 'Jane' })
    @IsOptional()
    @IsDefined({ message: "Firstname is required" })
    @IsString({ message: "Firstname must be a string" })
    firstName?: string;

    @ApiPropertyOptional({ example: 'Doe' })
    @IsOptional()
    @IsDefined({ message: "Lastname is required" })
    @IsString({ message: "Lastname must be a string" })
    lastName?: string;

    @ApiProperty({ example: 'P@ssword1!', description: 'Min 8 chars, uppercase, lowercase, number, special char' })
    @IsNotEmpty({ message: 'Password is required' })
    @IsString({ message: 'Password must be a string' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W)[A-Za-z\d\W]{8,}$/, {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and must be at least 8 characters long',
    })
    password: string;
}

export class WishListQueryDto {
    @ApiPropertyOptional({ example: 'shoes' })
    @IsOptional()
    @IsString({ message: 'Search must be a string value.' })
    search?: string;

    @ApiPropertyOptional({ enum: ['createdAt', 'title'], example: 'createdAt' })
    @IsOptional()
    @IsIn(['createdAt', 'title'], { message: 'SortBy must be either "createdAt" or "title".' })
    sortBy?: 'createdAt' | 'title';

    @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'], { message: 'SortOrder must be either "asc" or "desc".' })
    sortOrder?: 'asc' | 'desc';

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean({ message: 'isViewed must be a boolean value if provided.' })
    isViewed?: boolean;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean({ message: 'isImportant must be a boolean value if provided.' })
    isImportant?: boolean;

    @ApiPropertyOptional({ example: 1, minimum: 1 })
    @IsOptional()
    @IsInt({ message: 'Page must be an integer value.' })
    @Min(1, { message: 'Page must be greater than or equal to 1.' })
    page?: number;

    @ApiPropertyOptional({ example: 10, minimum: 1 })
    @IsOptional()
    @IsInt({ message: 'Limit must be an integer value.' })
    @Min(1, { message: 'Limit must be greater than or equal to 1.' })
    limit?: number;
}
