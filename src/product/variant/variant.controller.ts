import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { VariantService } from './variant.service';
import {
  CreateVariantDto,
  UpdateStockDto,
  UpdateVariantDto,
  VariantQueryDto,
} from './dto/variant.dto';

@ApiTags('product variants')
@Controller('products/:productId/variants')
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Get()
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
}
