import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiResponse as ApiDataResponse } from 'src/common/types';
import { AdminService } from './admin.service';
import {
  ChangeUserRole,
  CreateStaffDto,
  UpdateNewAdminProfileDto,
} from './dto/admin.dto';
import { UserDto } from 'src/common/dto/user.dto';
import { IRequest } from 'src/common/types';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { StaffGuard } from 'src/guards/staff.guard';

@ApiTags('admin')
@ApiSecurity('x-api-key')
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

  @Post('staff')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create a new staff account and email temporary login credentials (super admin only)' })
  @ApiOkResponse({
    description: 'Staff account created and credentials emailed',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Staff created successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Super admin only' })
  @ApiResponse({ status: 409, description: 'Email or phone already in use' })
  async createStaff(
    @Req() request: IRequest,
    @Body() input: CreateStaffDto,
  ): Promise<ApiDataResponse<any>> {
    return this.adminService.createStaff(request, input);
  }

  @Post('staff/:id/reset-password')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Reset a staff member\'s password and email new temporary credentials (super admin only)' })
  @ApiParam({ name: 'id', description: 'Staff member UUID' })
  @ApiOkResponse({
    description: 'Password reset and emailed to staff member',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password reset and emailed to staff member' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Super admin only or target is not a staff account' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async resetStaffPassword(
    @Req() request: IRequest,
    @Param('id') id: string,
  ): Promise<ApiDataResponse<null>> {
    return this.adminService.resetStaffPassword(request, id);
  }
}
