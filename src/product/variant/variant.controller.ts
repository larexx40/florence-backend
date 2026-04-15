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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { Cacheable } from 'src/cache/cache.decorator';
import { CacheInterceptor } from 'src/cache/cache.interceptor';
import { AttachImageDto } from 'src/image/dto/image.dto';
import { VariantService } from './variant.service';
import {
  CreateVariantDto,
  UpdateStockDto,
  UpdateVariantDto,
  VariantQueryDto,
} from './dto/variant.dto';

@ApiTags('product variants')
@ApiSecurity('x-api-key')
@Controller('products/:productId/variants')
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Get()
  @UseInterceptors(CacheInterceptor)
  @Cacheable(600)
  @ApiOperation({ summary: 'List variants for a product with sort, filter, and pagination' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Variants returned' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getAll(@Param('productId') productId: string, @Query() query: VariantQueryDto) {
    return this.variantService.getAll(productId, query);
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a variant for a product (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 201, description: 'Variant created' })
  @ApiResponse({ status: 400, description: 'Invalid option value IDs or duplicate combination' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'SKU already in use or combination already exists' })
  create(@Param('productId') productId: string, @Body() input: CreateVariantDto) {
    return this.variantService.create(productId, input);
  }

  @Patch(':variantId')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a variant (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  @ApiResponse({ status: 200, description: 'Variant updated' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  @ApiResponse({ status: 409, description: 'SKU already in use' })
  update(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() input: UpdateVariantDto,
  ) {
    return this.variantService.update(productId, variantId, input);
  }

  @Patch(':variantId/stock')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set stock quantity for a variant (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  @ApiResponse({ status: 200, description: 'Stock updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  updateStock(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() input: UpdateStockDto,
  ) {
    return this.variantService.updateStock(productId, variantId, input);
  }

  @Delete(':variantId')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete or deactivate a variant (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  @ApiResponse({ status: 200, description: 'Variant deleted or deactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  remove(@Param('productId') productId: string, @Param('variantId') variantId: string) {
    return this.variantService.remove(productId, variantId);
  }

  // ── Image management ─────────────────────────────────────────────────────────

  @Post(':variantId/images')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Attach an image to a variant (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  @ApiResponse({ status: 201, description: 'Image attached' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Variant or image not found' })
  attachImage(
    @Param('productId') productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: AttachImageDto,
  ) {
    return this.variantService.attachImage(productId, variantId, dto);
  }

  @Delete(':variantId/images/:imageId')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detach an image from a variant (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  @ApiParam({ name: 'imageId', description: 'Image UUID' })
  @ApiResponse({ status: 200, description: 'Image detached' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Variant or image link not found' })
  detachImage(
    @Param('productId') productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.variantService.detachImage(productId, variantId, imageId);
  }
}
