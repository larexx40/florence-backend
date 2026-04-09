import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/types';
import { AdminService } from './admin.service';
import { ChangeUserRole, AddAdminDto } from './dto/admin.dto';
import { User } from '@prisma/client';
import { IRequest } from 'src/common/types';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get()
    @ApiOperation({ summary: 'Get admin profile' })
    @ApiResponse({ status: 200, description: 'Admin profile returned' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    async getProfile(
        @Req() request: IRequest,
    ): Promise<AppApiResponse<User>> {
        return await this.adminService.getProfile(request);
    }

    @Post('change-role')
    @ApiOperation({ summary: 'Change a user\'s role' })
    @ApiResponse({ status: 200, description: 'User role updated' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async changeUserRole(
        @Req() request: IRequest,
        @Body() input: ChangeUserRole,
    ): Promise<AppApiResponse<User>> {
        return this.adminService.changeUserRole(request, input);
    }

    @Post('add-admin')
    @ApiOperation({ summary: 'Add a new admin user' })
    @ApiResponse({ status: 201, description: 'Admin created' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 409, description: 'Email already in use' })
    async addAdmin(
        @Req() request: IRequest,
        @Body() input: AddAdminDto,
    ): Promise<AppApiResponse<User>> {
        return this.adminService.addAdmin(request, input);
    }

    @Post('update-new-user-profile')
    @ApiOperation({ summary: 'Update a new admin\'s profile' })
    @ApiResponse({ status: 200, description: 'Profile updated' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    async updateProfile(
        @Req() request: IRequest,
        @Body() input: AddAdminDto,
    ): Promise<AppApiResponse<User>> {
        return this.adminService.addAdmin(request, input);
    }

}
