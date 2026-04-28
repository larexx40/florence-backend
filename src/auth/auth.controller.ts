import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiResponse as ApiDataResponse } from 'src/common/types';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { LoginResponseData } from 'src/common/types';
import { LoginResponseDto, RefreshTokenDataDto } from './responses/auth.responses';
import { UserDto } from 'src/common/dto/user.dto';
import { AuthGuard } from 'src/guards/account.guard';
import { IRequest } from 'src/common/types';

@ApiTags('auth')
@ApiSecurity('x-api-key')
// Register nested DTOs so getSchemaPath() can reference them
@ApiExtraModels(LoginResponseDto, RefreshTokenDataDto, UserDto)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({
    description: 'Login successful. isProfileComplete=false means the user must complete first-time profile setup.',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Login successful' },
        data: { $ref: getSchemaPath(LoginResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account' })
  async login(@Body() dto: LoginDto): Promise<ApiDataResponse<LoginResponseData>> {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiOkResponse({
    description: 'Same response regardless of whether the email is registered (prevents email enumeration)',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'If that email is registered, a reset link has been sent' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ApiDataResponse<null>> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using the token received by email' })
  @ApiOkResponse({
    description: 'Password reset successfully',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password reset successfully' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid/expired token or passwords do not match' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<ApiDataResponse<null>> {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token using a valid refresh token' })
  @ApiOkResponse({
    description: 'New access token returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Token refreshed successfully' },
        data: { $ref: getSchemaPath(RefreshTokenDataDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<ApiDataResponse<{ accessToken: string }>> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Invalidate the current user session tokens' })
  @ApiOkResponse({
    description: 'Logout successful',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Logout successful' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async logout(
    @Request() request: IRequest,
    @Body() dto: LogoutDto,
  ): Promise<ApiDataResponse<null>> {
    return this.authService.logout(request.user.userId, dto.refreshToken);
  }
}
