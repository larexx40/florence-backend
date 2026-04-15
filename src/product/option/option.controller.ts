import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { OptionService } from './option.service';
import {
  CreateProductOptionDto,
  CreateProductOptionValueDto,
  ProductOptionResponseDto,
  ProductOptionValueResponseDto,
  UpdateProductOptionDto,
  UpdateProductOptionValueDto,
} from './dto/option.dto';

@ApiTags('product options')
@ApiSecurity('x-api-key')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@ApiExtraModels(ProductOptionResponseDto, ProductOptionValueResponseDto)
@Controller('products/:productId/options')
export class OptionController {
  constructor(private readonly optionService: OptionService) {}

  // ── Options ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List options (with values) declared for a product (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      properties: {
        status: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'array', items: { $ref: getSchemaPath(ProductOptionResponseDto) } },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getOptions(@Param('productId') productId: string) {
    return this.optionService.getProductOptions(productId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a category option type to a product (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({
    status: 201,
    schema: {
      properties: {
        status: { type: 'boolean' },
        message: { type: 'string' },
        data: { $ref: getSchemaPath(ProductOptionResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Product or category option not found' })
  @ApiResponse({ status: 409, description: 'Option already added to this product' })
  addOption(
    @Param('productId') productId: string,
    @Body() input: CreateProductOptionDto,
  ) {
    return this.optionService.addOption(productId, input);
  }

  @Patch(':optionId')
  @ApiOperation({ summary: 'Update display order of a product option (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'optionId', description: 'ProductOption UUID' })
  @ApiResponse({ status: 200, description: 'Option updated' })
  @ApiResponse({ status: 404, description: 'Product or option not found' })
  updateOption(
    @Param('productId') productId: string,
    @Param('optionId') optionId: string,
    @Body() input: UpdateProductOptionDto,
  ) {
    return this.optionService.updateOption(productId, optionId, input);
  }

  @Delete(':optionId')
  @ApiOperation({ summary: 'Remove an option and all its values from a product (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'optionId', description: 'ProductOption UUID' })
  @ApiResponse({ status: 200, description: 'Option removed' })
  @ApiResponse({ status: 400, description: 'Option values are in use by variants' })
  @ApiResponse({ status: 404, description: 'Product or option not found' })
  removeOption(
    @Param('productId') productId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.optionService.removeOption(productId, optionId);
  }

  // ── Option values ─────────────────────────────────────────────────────────────

  @Post(':optionId/values')
  @ApiOperation({ summary: 'Add a value to a product option (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'optionId', description: 'ProductOption UUID' })
  @ApiResponse({
    status: 201,
    schema: {
      properties: {
        status: { type: 'boolean' },
        message: { type: 'string' },
        data: { $ref: getSchemaPath(ProductOptionValueResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Product or option not found' })
  @ApiResponse({ status: 409, description: 'Value already exists on this option' })
  addValue(
    @Param('productId') productId: string,
    @Param('optionId') optionId: string,
    @Body() input: CreateProductOptionValueDto,
  ) {
    return this.optionService.addValue(productId, optionId, input);
  }

  @Patch(':optionId/values/:valueId')
  @ApiOperation({ summary: 'Update a product option value (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'optionId', description: 'ProductOption UUID' })
  @ApiParam({ name: 'valueId', description: 'ProductOptionValue UUID' })
  @ApiResponse({ status: 200, description: 'Value updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Value already exists on this option' })
  updateValue(
    @Param('productId') productId: string,
    @Param('optionId') optionId: string,
    @Param('valueId') valueId: string,
    @Body() input: UpdateProductOptionValueDto,
  ) {
    return this.optionService.updateValue(productId, optionId, valueId, input);
  }

  @Delete(':optionId/values/:valueId')
  @ApiOperation({ summary: 'Delete a product option value (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'optionId', description: 'ProductOption UUID' })
  @ApiParam({ name: 'valueId', description: 'ProductOptionValue UUID' })
  @ApiResponse({ status: 200, description: 'Value deleted' })
  @ApiResponse({ status: 400, description: 'Value is in use by a variant' })
  @ApiResponse({ status: 404, description: 'Not found' })
  removeValue(
    @Param('productId') productId: string,
    @Param('optionId') optionId: string,
    @Param('valueId') valueId: string,
  ) {
    return this.optionService.removeValue(productId, optionId, valueId);
  }
}
