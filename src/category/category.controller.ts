import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { Cacheable } from 'src/cache/cache.decorator';
import { CacheInterceptor } from 'src/cache/cache.interceptor';
import { UploadFile, filePipe } from 'src/common/helpers/file-upload.helper';
import { CategoryService } from './category.service';
import {
  CategoryListResponseDto,
  CategoryOptionResponseDto,
  CategoryQueryDto,
  CategoryResponseDto,
  CategoryTreeResponseDto,
  CategoryWithOptionsListResponseDto,
  CategoryWithOptionsResponseDto,
  CreateCategoryDto,
  CreateCategoryOptionDto,
  SubcategoryResponseDto,
  UpdateCategoryDto,
  UpdateCategoryOptionDto,
} from './dto/category.dto';

@ApiTags('categories')
@ApiSecurity('x-api-key')
@ApiExtraModels(
  CategoryResponseDto,
  SubcategoryResponseDto,
  CategoryListResponseDto,
  CategoryTreeResponseDto,
  CategoryOptionResponseDto,
  CategoryWithOptionsResponseDto,
  CategoryWithOptionsListResponseDto,
)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Get()
  @UseInterceptors(CacheInterceptor)
  @Cacheable(1800)
  @ApiOperation({ summary: 'List categories with search, sort, filter, and pagination' })
  @ApiOkResponse({
    description: 'Categories returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Categories fetched successfully' },
        data: { $ref: getSchemaPath(CategoryListResponseDto) },
      },
    },
  })
  getAll(@Query() query: CategoryQueryDto) {
    return this.categoryService.getAll(query);
  }

  @Get('tree')
  @UseInterceptors(CacheInterceptor)
  @Cacheable(3600)
  @ApiOperation({ summary: 'Get full nested tree: root categories → subcategories → sub-subcategories' })
  @ApiOkResponse({
    description: 'Category tree returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Category tree fetched successfully' },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(CategoryTreeResponseDto) },
        },
      },
    },
  })
  getTree() {
    return this.categoryService.getTree();
  }

  @Get('admin')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all categories with their option types (admin only)' })
  @ApiOkResponse({
    description: 'Categories with options returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Categories fetched successfully' },
        data: { $ref: getSchemaPath(CategoryWithOptionsListResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  getAllWithOptions(@Query() query: CategoryQueryDto) {
    return this.categoryService.getAllWithOptions(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a category by UUID with all its option types (admin only)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiOkResponse({
    description: 'Category with options returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Category fetched successfully' },
        data: { $ref: getSchemaPath(CategoryWithOptionsResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  getById(@Param('id') id: string) {
    return this.categoryService.getById(id);
  }

  @Get(':slug')
  @UseInterceptors(CacheInterceptor)
  @Cacheable(1800)
  @ApiOperation({ summary: 'Get a category by slug with its subcategories' })
  @ApiParam({ name: 'slug', example: 'bags' })
  @ApiOkResponse({
    description: 'Category returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Category fetched successfully' },
        data: { $ref: getSchemaPath(CategoryResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  getBySlug(@Param('slug') slug: string) {
    return this.categoryService.getBySlug(slug);
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @UploadFile('image')
  @ApiOperation({ summary: 'Create a category (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'Category image (jpeg/png/webp/gif, max 10 MB). Omit to pass imageUrl instead.' },
        name: { type: 'string', example: 'Bags' },
        description: { type: 'string', example: 'All types of wholesale bags' },
        imageUrl: { type: 'string', example: 'https://cdn.example.com/bags.jpg', description: 'Use this when not uploading a file' },
        parentId: { type: 'string', format: 'uuid', example: 'uuid-of-parent' },
      },
      required: ['name'],
    },
  })
  @ApiOkResponse({
    description: 'Category created',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Category created successfully' },
        data: { $ref: getSchemaPath(CategoryResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input or unsupported image type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Parent category not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  create(
    @UploadedFile(filePipe()) file: Express.Multer.File | undefined,
    @Body() input: CreateCategoryDto,
  ) {
    return this.categoryService.create(input, file);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @UploadFile('image')
  @ApiOperation({ summary: 'Update a category (admin only)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'New image file — replaces existing, old image deleted from S3 in background' },
        name: { type: 'string', example: 'Women Bags' },
        slug: { type: 'string', example: 'women-bags' },
        description: { type: 'string', example: 'Updated description' },
        imageUrl: { type: 'string', example: 'https://cdn.example.com/new.jpg', description: 'Pass a new URL to replace the image, or omit entirely to keep the existing one' },
        parentId: { type: 'string', format: 'uuid' },
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  @ApiOkResponse({
    description: 'Category updated',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Category updated successfully' },
        data: { $ref: getSchemaPath(CategoryResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input, circular parent reference, or unsupported image type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category or parent not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  update(
    @Param('id') id: string,
    @UploadedFile(filePipe()) file: Express.Multer.File | undefined,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, input, file);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete or deactivate a category (admin only)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiOkResponse({
    description: 'Category deleted or deactivated',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Category deleted successfully' },
        data: { type: 'null', example: null },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }

  // ── Category options ─────────────────────────────────────────────────────────

  @Get(':categoryId/options')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all options (with values) for a category (admin only)' })
  @ApiParam({ name: 'categoryId', description: 'Category UUID' })
  @ApiOkResponse({
    description: 'Options returned',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Category options fetched successfully' },
        data: { type: 'array', items: { $ref: getSchemaPath(CategoryOptionResponseDto) } },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  getOptions(@Param('categoryId') categoryId: string) {
    return this.categoryService.getOptions(categoryId);
  }

  @Post(':categoryId/options')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an option to a category (admin only)' })
  @ApiParam({ name: 'categoryId', description: 'Category UUID' })
  @ApiOkResponse({
    description: 'Option created',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Option created successfully' },
        data: { $ref: getSchemaPath(CategoryOptionResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Option name already exists on this category' })
  createOption(
    @Param('categoryId') categoryId: string,
    @Body() input: CreateCategoryOptionDto,
  ) {
    return this.categoryService.createOption(categoryId, input);
  }

  @Patch(':categoryId/options/:optionId')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category option (admin only)' })
  @ApiParam({ name: 'categoryId', description: 'Category UUID' })
  @ApiParam({ name: 'optionId', description: 'CategoryOption UUID' })
  @ApiOkResponse({
    description: 'Option updated',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Option updated successfully' },
        data: { $ref: getSchemaPath(CategoryOptionResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category or option not found' })
  @ApiResponse({ status: 409, description: 'Option name already exists on this category' })
  updateOption(
    @Param('categoryId') categoryId: string,
    @Param('optionId') optionId: string,
    @Body() input: UpdateCategoryOptionDto,
  ) {
    return this.categoryService.updateOption(categoryId, optionId, input);
  }

  @Delete(':categoryId/options/:optionId')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category option and all its values (admin only)' })
  @ApiParam({ name: 'categoryId', description: 'Category UUID' })
  @ApiParam({ name: 'optionId', description: 'CategoryOption UUID' })
  @ApiOkResponse({
    description: 'Option deleted',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Option deleted successfully' },
        data: { type: 'null', example: null },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Option has values in use by product variants' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category or option not found' })
  removeOption(
    @Param('categoryId') categoryId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.categoryService.removeOption(categoryId, optionId);
  }

}
