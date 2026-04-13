import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiResponse as ApiDataResponse } from 'src/common/types';
import { AdminService } from './admin.service';
import {
  AddAdminDto,
  ChangeUserRole,
  UpdateNewAdminProfileDto,
} from './dto/admin.dto';
import { UserDto } from 'src/common/dto/user.dto';
import { IRequest } from 'src/common/types';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { StaffGuard } from 'src/guards/staff.guard';

@ApiTags('admin')
@ApiBearerAuth()
@ApiExtraModels(UserDto)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Self ─────────────────────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(AuthGuard, StaffGuard)
  @ApiOperation({ summary: 'Get own admin profile' })
  @ApiOkResponse({
    description: 'Admin profile returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profile fetched successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  async getProfile(@Req() request: IRequest): Promise<ApiDataResponse<any>> {
    return this.adminService.getProfile(request);
  }

  @Post('update-profile')
  @UseGuards(AuthGuard, StaffGuard)
  @ApiOperation({ summary: 'Update own profile and set password (first-time setup)' })
  @ApiOkResponse({
    description: 'Admin profile updated',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profile updated successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  @ApiResponse({ status: 409, description: 'Phone number already in use' })
  async updateProfile(
    @Req() request: IRequest,
    @Body() input: UpdateNewAdminProfileDto,
  ): Promise<ApiDataResponse<any>> {
    return this.adminService.updateProfile(request, input);
  }

  // ── Role & admin management (SUPER_ADMIN only) ───────────────────────────────

  @Post('change-role')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Change a user\'s role (super admin only)' })
  @ApiOkResponse({
    description: 'User role updated',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User role updated successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Super admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async changeUserRole(
    @Req() request: IRequest,
    @Body() input: ChangeUserRole,
  ): Promise<ApiDataResponse<any>> {
    return this.adminService.changeUserRole(request, input);
  }

  @Post('add-admin')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create a new admin account and email credentials (super admin only)' })
  @ApiOkResponse({
    description: 'Admin account created and credentials emailed',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Admin added successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Super admin only' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async addAdmin(
    @Req() request: IRequest,
    @Body() input: AddAdminDto,
  ): Promise<ApiDataResponse<any>> {
    return this.adminService.addAdmin(request, input);
  }
}
