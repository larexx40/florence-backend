import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiExtraModels,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiSecurity,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { StaffGuard } from 'src/guards/staff.guard';
import { IRequest } from 'src/common/types';
import { Cacheable } from 'src/cache/cache.decorator';
import { CacheInterceptor } from 'src/cache/cache.interceptor';
import { ShippingAddressService } from './shipping-address.service';
import { CreateShippingAddressDto, UpdateShippingAddressDto } from './dto/shipping-address.dto';
import { ShippingAddressResponseDto } from './dto/response.dto';

@ApiTags('shipping-addresses')
@ApiSecurity('x-api-key')
@ApiBearerAuth()
@ApiExtraModels(ShippingAddressResponseDto)
@Controller('shipping-addresses')
export class ShippingAddressController {
    constructor(private readonly shippingAddressService: ShippingAddressService) {}

    // ── Self-service ─────────────────────────────────────────────────────────────

    @Get()
    @UseGuards(AuthGuard)
    @UseInterceptors(CacheInterceptor)
    @Cacheable(300, true)
    @ApiOperation({ summary: "Get the authenticated user's shipping addresses" })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Shipping addresses fetched successfully' },
                data: { type: 'array', items: { $ref: getSchemaPath(ShippingAddressResponseDto) } },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getUserShippingAddresses(@Req() req: IRequest) {
        return this.shippingAddressService.getUserShippingAddresses(req.user.userId);
    }

    @Get(':id')
    @UseGuards(AuthGuard)
    @UseInterceptors(CacheInterceptor)
    @Cacheable(300, true)
    @ApiOperation({ summary: 'Get a specific shipping address' })
    @ApiParam({ name: 'id', description: 'Shipping address UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Shipping address fetched successfully' },
                data: { $ref: getSchemaPath(ShippingAddressResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — not your address' })
    @ApiResponse({ status: 404, description: 'Shipping address not found' })
    getShippingAddress(@Req() req: IRequest, @Param('id', ParseUUIDPipe) id: string) {
        return this.shippingAddressService.getShippingAddress(req.user.userId, id);
    }

    @Post()
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Add a new shipping address' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Shipping address added successfully' },
                data: { $ref: getSchemaPath(ShippingAddressResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'City not found' })
    createShippingAddress(@Req() req: IRequest, @Body() dto: CreateShippingAddressDto) {
        return this.shippingAddressService.createShippingAddress(req.user.userId, dto);
    }

    @Patch(':id')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Update a shipping address' })
    @ApiParam({ name: 'id', description: 'Shipping address UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Shipping address updated successfully' },
                data: { $ref: getSchemaPath(ShippingAddressResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — not your address' })
    @ApiResponse({ status: 404, description: 'Shipping address or city not found' })
    updateShippingAddress(
        @Req() req: IRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateShippingAddressDto,
    ) {
        return this.shippingAddressService.updateShippingAddress(req.user.userId, id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Delete a shipping address' })
    @ApiParam({ name: 'id', description: 'Shipping address UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Shipping address deleted successfully' },
                data: { type: 'object', nullable: true, example: null },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — not your address' })
    @ApiResponse({ status: 404, description: 'Shipping address not found' })
    deleteShippingAddress(@Req() req: IRequest, @Param('id', ParseUUIDPipe) id: string) {
        return this.shippingAddressService.deleteShippingAddress(req.user.userId, id);
    }

    @Patch(':id/default')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Set a shipping address as the default' })
    @ApiParam({ name: 'id', description: 'Shipping address UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Default shipping address updated successfully' },
                data: { $ref: getSchemaPath(ShippingAddressResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — not your address' })
    @ApiResponse({ status: 404, description: 'Shipping address not found' })
    setDefaultShippingAddress(@Req() req: IRequest, @Param('id', ParseUUIDPipe) id: string) {
        return this.shippingAddressService.setDefaultShippingAddress(req.user.userId, id);
    }

    // ── Staff ─────────────────────────────────────────────────────────────────────

    @Get('by-email')
    @UseGuards(AuthGuard, StaffGuard)
    @ApiOperation({ summary: "Look up a user's shipping addresses by email — returns [] when email not found (staff only)" })
    @ApiQuery({ name: 'email', required: true, example: 'jane@example.com' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Shipping addresses fetched successfully' },
                data: { type: 'array', items: { $ref: getSchemaPath(ShippingAddressResponseDto) } },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Staff access required' })
    getShippingAddressByUserEmail(@Query('email') email: string) {
        return this.shippingAddressService.getShippingAddressByUserEmail(email);
    }
}
