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
  UploadedFiles,
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
import { UploadFiles } from 'src/common/helpers/file-upload.helper';
import { AttachImageDto } from 'src/image/dto/image.dto';
import { ProductService } from './product.service';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';
import { ProductDetailResponseDto, ProductListResponseDto } from './dto/product-response.dto';
import { VariantService } from './variant/variant.service';
import { GlobalVariantQueryDto } from './variant/dto/variant.dto';

@ApiTags('products')
@ApiSecurity('x-api-key')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly variantService: VariantService,
  ) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Get()
  @UseInterceptors(CacheInterceptor)
  @Cacheable(900)
  @ApiOperation({ summary: 'List all active products with search, sort, filter, and pagination' })
  @ApiResponse({ status: 200, description: 'Products returned', type: ProductListResponseDto, isArray: true })
  getAll(@Query() query: ProductQueryDto) {
    return this.productService.getAll(query);
  }

  @Get('config')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product configuration limits (admin only)' })
  @ApiResponse({ status: 200, description: 'Configuration returned' })
  getProductConfig() {
    return this.productService.getProductConfig();
  }
  
  @Get('variants')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @UseInterceptors(CacheInterceptor)
  @Cacheable(300)
  @ApiOperation({ summary: 'List all variants across all products with search, filter, and pagination (admin only)' })
  @ApiResponse({ status: 200, description: 'Variants returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  getAllVariants(@Query() query: GlobalVariantQueryDto) {
    return this.variantService.getAllGlobal(query);
  }

  @Get(':idOrSlug')
  @UseInterceptors(CacheInterceptor)
  @Cacheable(600)
  @ApiOperation({ summary: 'Get full product detail by UUID or slug' })
  @ApiParam({ name: 'idOrSlug', description: 'Product UUID or slug', example: 'classic-trouser' })
  @ApiResponse({ status: 200, description: 'Product returned', type: ProductDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getOne(@Param('idOrSlug') idOrSlug: string) {
    return this.productService.getOne(idOrSlug);
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @UploadFiles('images', 5)
  @ApiOperation({ summary: 'Create a new product (admin only)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category or discount not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  create(
    @Body() input: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productService.create(input, files);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @UploadFiles('images', 5)
  @ApiOperation({ summary: 'Update a product (admin only). Attach up to 5 images total across all uploads.' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 400, description: 'Invalid input or image limit exceeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  update(
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productService.update(id, input, files);
  }

  @Patch(':id/toggle')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable or disable a product (admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product enabled or disabled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.toggleStatus(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete a product (admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  // ── Image management ─────────────────────────────────────────────────────────

  @Post(':id/images/upload')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @UploadFiles('images', 5)
  @ApiOperation({ summary: 'Upload up to 5 watermarked product images directly (admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({
    status: 201,
    description: 'Images uploaded and attached to the product. Each image is optimised and watermarked before storage.',
  })
  @ApiResponse({ status: 400, description: 'No files provided, invalid type, or would exceed 5-image limit' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  uploadProductImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productService.uploadProductImages(id, files);
  }

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
  @ApiOperation({ summary: 'Permanently delete a product image from DB and S3 (admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiParam({ name: 'imageId', description: 'ProductImage UUID' })
  @ApiResponse({ status: 200, description: 'Image deleted from DB and S3' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Image not found on this product' })
  deleteProductImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.productService.deleteProductImage(id, imageId);
  }
}
