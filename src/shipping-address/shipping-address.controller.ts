import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { IRequest } from 'src/common/types';
import { Cacheable } from 'src/cache/cache.decorator';
import { CacheInterceptor } from 'src/cache/cache.interceptor';
import { ShippingAddressService } from './shipping-address.service';
import { CreateShippingAddressDto, UpdateShippingAddressDto } from './dto/shipping-address.dto';

@ApiTags('shipping-addresses')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('shipping-addresses')
export class ShippingAddressController {
    constructor(private readonly shippingAddressService: ShippingAddressService) {}

    @Get()
    @UseInterceptors(CacheInterceptor)
    @Cacheable(300, true)
    @ApiOperation({ summary: "Get the authenticated user's shipping addresses" })
    @ApiResponse({ status: 200, description: 'Shipping addresses fetched successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getUserShippingAddresses(@Req() req: IRequest) {
        return this.shippingAddressService.getUserShippingAddresses(req.user.userId);
    }

    @Get(':id')
    @UseInterceptors(CacheInterceptor)
    @Cacheable(300, true)
    @ApiOperation({ summary: 'Get a specific shipping address' })
    @ApiParam({ name: 'id', description: 'Shipping address UUID' })
    @ApiResponse({ status: 200, description: 'Shipping address fetched successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — not your shipping address' })
    @ApiResponse({ status: 404, description: 'Shipping address not found' })
    getShippingAddress(@Req() req: IRequest, @Param('id') id: string) {
        return this.shippingAddressService.getShippingAddress(req.user.userId, id);
    }

    @Post()
    @ApiOperation({ summary: 'Add a new shipping address' })
    @ApiResponse({ status: 201, description: 'Shipping address added successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'City not found' })
    createShippingAddress(@Req() req: IRequest, @Body() dto: CreateShippingAddressDto) {
        return this.shippingAddressService.createShippingAddress(req.user.userId, dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a shipping address' })
    @ApiParam({ name: 'id', description: 'Shipping address UUID' })
    @ApiResponse({ status: 200, description: 'Shipping address updated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — not your shipping address' })
    @ApiResponse({ status: 404, description: 'Shipping address or city not found' })
    updateShippingAddress(@Req() req: IRequest, @Param('id') id: string, @Body() dto: UpdateShippingAddressDto) {
        return this.shippingAddressService.updateShippingAddress(req.user.userId, id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a shipping address' })
    @ApiParam({ name: 'id', description: 'Shipping address UUID' })
    @ApiResponse({ status: 200, description: 'Shipping address deleted successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — not your shipping address' })
    @ApiResponse({ status: 404, description: 'Shipping address not found' })
    deleteShippingAddress(@Req() req: IRequest, @Param('id') id: string) {
        return this.shippingAddressService.deleteShippingAddress(req.user.userId, id);
    }

    @Patch(':id/default')
    @ApiOperation({ summary: 'Set a shipping address as the default' })
    @ApiParam({ name: 'id', description: 'Shipping address UUID' })
    @ApiResponse({ status: 200, description: 'Default shipping address updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — not your shipping address' })
    @ApiResponse({ status: 404, description: 'Shipping address not found' })
    setDefaultShippingAddress(@Req() req: IRequest, @Param('id') id: string) {
        return this.shippingAddressService.setDefaultShippingAddress(req.user.userId, id);
    }
}
