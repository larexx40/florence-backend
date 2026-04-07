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
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { CategoryService } from './category.service';
import {
  CategoryListResponseDto,
  CategoryQueryDto,
  CategoryResponseDto,
  CategoryTreeResponseDto,
  CreateCategoryDto,
  SubcategoryResponseDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@ApiTags('categories')
@ApiExtraModels(CategoryResponseDto, SubcategoryResponseDto, CategoryListResponseDto, CategoryTreeResponseDto)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Get()
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

  @Get(':slug')
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
  @ApiOperation({ summary: 'Create a category (admin only)' })
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
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Parent category not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  create(@Body() input: CreateCategoryDto) {
    return this.categoryService.create(input);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category (admin only)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
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
  @ApiResponse({ status: 400, description: 'Invalid input or circular parent reference' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Category or parent not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  update(@Param('id') id: string, @Body() input: UpdateCategoryDto) {
    return this.categoryService.update(id, input);
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
}
