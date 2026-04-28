import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from 'src/common/dto/user.dto';

// ── Login ─────────────────────────────────────────────────────────────────────

export class LoginResponseDto {
  @ApiProperty({ type: () => UserDto })
  user: UserDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ example: true, description: 'Whether the user has verified their email' })
  isVerified: boolean;

  @ApiProperty({ example: false, description: 'false = first login, prompt user to complete profile setup' })
  isProfileComplete: boolean;
}

// ── Refresh token ─────────────────────────────────────────────────────────────

export class RefreshTokenDataDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;
}
