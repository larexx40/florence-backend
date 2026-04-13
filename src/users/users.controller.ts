import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiResponse as ApiDataResponse } from 'src/common/types';
import { UsersService } from './users.service';
import {
  AwardStoreCreditDto,
  ChangePasswordDto,
  CreateUserDto,
  SendUserEmailDto,
  SetupAccountDto,
  UpdateProfileDto,
  UserOrderQueryDto,
  UserQueryDto,
} from './dto/user.dto';
import {
  UsersListResponseDto,
  UserStatsResponseDto,
  UserOrdersResponseDto,
  UserTransactionsResponseDto,
} from './dto/response.dto';
import { UserDto } from 'src/common/dto/user.dto';
import { PaginatedDataDto } from 'src/common/types/response.type';
import { IRequest } from 'src/common/types';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { StaffGuard } from 'src/guards/staff.guard';

@ApiTags('users')
@ApiBearerAuth()
@ApiExtraModels(
  UserDto,
  PaginatedDataDto,
  UsersListResponseDto,
  UserStatsResponseDto,
  UserOrdersResponseDto,
  UserTransactionsResponseDto,
)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Self-service ─────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get own profile' })
  @ApiOkResponse({
    description: 'Profile returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profile fetched successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Req() request: IRequest): Promise<ApiDataResponse<any>> {
    return this.usersService.getProfile(request);
  }

  @Post('me/setup-account')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'First-time account setup — set password and complete profile' })
  @ApiOkResponse({
    description: 'Account set up successfully — profile is now complete',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Account set up successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error or passwords do not match' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Phone number already in use' })
  async setupAccount(
    @Req() request: IRequest,
    @Body() dto: SetupAccountDto,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.setupAccount(request, dto);
  }

  @Post('me/change-password')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Change own password (requires current password)' })
  @ApiOkResponse({
    description: 'Password changed successfully',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password changed successfully' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Current password incorrect or passwords do not match' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Req() request: IRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiDataResponse<null>> {
    return this.usersService.changePassword(request, dto);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update own profile fields' })
  @ApiOkResponse({
    description: 'Profile updated successfully',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profile updated successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Phone number already in use' })
  async updateProfile(
    @Req() request: IRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.updateProfile(request, dto);
  }

  // ── Admin user management — write ────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiOkResponse({
    description: 'User created successfully',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User created successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 409, description: 'Email or phone already in use' })
  async createUser(
    @Body() input: CreateUserDto,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.createUser(input);
  }

  @Post(':id/store-credit')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Award store credit to a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'Store credit awarded and confirmation email sent to user',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: '₦500 store credit awarded successfully' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async awardStoreCredit(
    @Req() request: IRequest,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: AwardStoreCreditDto,
  ): Promise<ApiDataResponse<null>> {
    return this.usersService.awardStoreCredit(request, userId, input);
  }

  @Post(':id/send-email')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Send a custom email to a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'Email sent successfully',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Email sent successfully' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async sendEmailToUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: SendUserEmailDto,
  ): Promise<ApiDataResponse<null>> {
    return this.usersService.sendEmailToUser(userId, input);
  }

  @Post(':id/send-login-details')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Send first-time login credentials to a user (one-time, cannot be repeated)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'Login credentials emailed to user',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Login details sent successfully' },
        data: { type: 'object', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Login details already sent to this user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async sendLoginDetails(
    @Req() request: IRequest,
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<ApiDataResponse<null>> {
    return this.usersService.sendLoginDetails(request, userId);
  }

  @Patch(':id/toggle-active')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'Account status toggled',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User account activated successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot deactivate own account' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async toggleUserActive(
    @Req() request: IRequest,
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.toggleUserActive(request, userId);
  }

  // ── Admin user management — read ─────────────────────────────────────────────

  @Get()
  @UseGuards(AuthGuard, StaffGuard)
  @ApiOperation({ summary: 'List all users with optional filters and pagination' })
  @ApiOkResponse({
    description: 'Paginated user list returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Users fetched successfully' },
        data: { $ref: getSchemaPath(UsersListResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  async getAllUsers(
    @Query() query: UserQueryDto,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.getAllUsers(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard, StaffGuard)
  @ApiOperation({ summary: 'Get a single user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'User returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User fetched successfully' },
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.getUserById(userId);
  }

  @Get(':id/stats')
  @UseGuards(AuthGuard, StaffGuard)
  @ApiOperation({ summary: 'Get user spend stats: total orders, total spent, store credit balance' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'User stats returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User stats fetched successfully' },
        data: { $ref: getSchemaPath(UserStatsResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserStats(
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.getUserStats(userId);
  }

  @Get(':id/orders')
  @UseGuards(AuthGuard, StaffGuard)
  @ApiOperation({ summary: 'Get paginated order history for a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'Paginated order list returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User orders fetched successfully' },
        data: { $ref: getSchemaPath(UserOrdersResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserOrders(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query() query: UserOrderQueryDto,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.getUserOrders(userId, query);
  }

  @Get(':id/transactions')
  @UseGuards(AuthGuard, StaffGuard)
  @ApiOperation({ summary: 'Get paginated store credit transaction history for a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'Paginated transaction list returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User transactions fetched successfully' },
        data: { $ref: getSchemaPath(UserTransactionsResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserTransactions(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query() query: UserOrderQueryDto,
  ): Promise<ApiDataResponse<any>> {
    return this.usersService.getUserTransactions(userId, query);
  }
}
