import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * Swagger-annotated shape of a User record as returned by API responses.
 * Sensitive fields (password, fcmToken) are intentionally omitted.
 */
export class UserDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Jane', nullable: true })
  firstName: string | null;

  @ApiPropertyOptional({ example: 'Doe', nullable: true })
  lastName: string | null;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 'Acme Ltd', nullable: true })
  businessName: string | null;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role: Role;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false, description: 'True once the user has completed first-time account setup' })
  isProfileComplete: boolean;

  @ApiProperty({ example: false })
  isEmailVerified: boolean;

  @ApiProperty({ example: 0.00, description: 'Current store credit balance in Naira' })
  storeCreditBalance: number;

  @ApiProperty({ example: false, description: 'True once admin has sent first-time login credentials (one-time action)' })
  loginDetailsSent: boolean;

  @ApiPropertyOptional({ example: '2025-01-15T10:30:00.000Z', nullable: true })
  lastLogin: Date | null;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  updatedAt: Date;
}
