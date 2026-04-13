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
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { Cacheable } from 'src/cache/cache.decorator';
import { CacheInterceptor } from 'src/cache/cache.interceptor';
import { AttachImageDto } from 'src/image/dto/image.dto';
import { ProductService } from './product.service';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Get()
  @UseInterceptors(CacheInterceptor)
  @Cacheable(900)
  @ApiOperation({ summary: 'List all active products with search, sort, filter, and pagination' })
  @ApiResponse({ status: 200, description: 'Products returned' })
  getAll(@Query() query: ProductQueryDto) {
    return this.productService.getAll(query);
  }

  @Get(':slug')
  @UseInterceptors(CacheInterceptor)
  @Cacheable(600)
  @ApiOperation({ summary: 'Get full product detail by slug including options and variants' })
  @ApiParam({ name: 'slug', example: 'bflo-226' })
  @ApiResponse({ status: 200, description: 'Product returned' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getBySlug(@Param('slug') slug: string) {
    return this.productService.getBySlug(slug);
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (admin only)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category or discount not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  create(@Body() input: CreateProductDto) {
    return this.productService.create(input);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  update(@Param('id') id: string, @Body() input: UpdateProductDto) {
    return this.productService.update(id, input);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a product (admin only) — soft delete' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product deactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  // ── Image management ─────────────────────────────────────────────────────────

  @Post(':id/images')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Attach an image to a product (admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 201, description: 'Image attached' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product or image not found' })
  attachImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachImageDto,
  ) {
    return this.productService.attachImage(id, dto);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detach an image from a product (admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiParam({ name: 'imageId', description: 'Image UUID' })
  @ApiResponse({ status: 200, description: 'Image detached' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product or image link not found' })
  detachImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.productService.detachImage(id, imageId);
  }
}
