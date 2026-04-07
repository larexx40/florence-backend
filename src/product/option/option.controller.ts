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
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { OptionService } from './option.service';
import {
  AddOptionValueDto,
  AddProductOptionDto,
  UpdateOptionValueDto,
  UpdateProductOptionDto,
} from './dto/option.dto';

@ApiTags('product options')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('products/:productId/options')
export class OptionController {
  constructor(private readonly optionService: OptionService) {}

  // ── Product options ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all options for a product (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Options returned' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getOptions(@Param('productId') productId: string) {
    return this.optionService.getOptions(productId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a global option to a product (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 201, description: 'Option added' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Option already added to this product' })
  addOption(@Param('productId') productId: string, @Body() input: AddProductOptionDto) {
    return this.optionService.addOption(productId, input);
  }

  @Patch(':productOptionId')
  @ApiOperation({ summary: 'Update option position on a product (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'productOptionId', description: 'ProductOption UUID' })
  @ApiResponse({ status: 200, description: 'Option updated' })
  @ApiResponse({ status: 404, description: 'Option not found on this product' })
  updateOption(
    @Param('productId') productId: string,
    @Param('productOptionId') productOptionId: string,
    @Body() input: UpdateProductOptionDto,
  ) {
    return this.optionService.updateOption(productId, productOptionId, input);
  }

  @Delete(':productOptionId')
  @ApiOperation({ summary: 'Remove an option from a product (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'productOptionId', description: 'ProductOption UUID' })
  @ApiResponse({ status: 200, description: 'Option removed' })
  @ApiResponse({ status: 400, description: 'Variants are using this option — delete them first' })
  @ApiResponse({ status: 404, description: 'Option not found on this product' })
  removeOption(
    @Param('productId') productId: string,
    @Param('productOptionId') productOptionId: string,
  ) {
    return this.optionService.removeOption(productId, productOptionId);
  }

  // ── Option values ────────────────────────────────────────────────────────────

  @Post(':productOptionId/values')
  @ApiOperation({ summary: 'Add a value to a product option (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'productOptionId', description: 'ProductOption UUID' })
  @ApiResponse({ status: 201, description: 'Value added' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Product or option not found' })
  @ApiResponse({ status: 409, description: 'Value already exists for this option' })
  addValue(
    @Param('productId') productId: string,
    @Param('productOptionId') productOptionId: string,
    @Body() input: AddOptionValueDto,
  ) {
    return this.optionService.addValue(productId, productOptionId, input);
  }

  @Patch(':productOptionId/values/:valueId')
  @ApiOperation({ summary: 'Update an option value (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'productOptionId', description: 'ProductOption UUID' })
  @ApiParam({ name: 'valueId', description: 'OptionValue UUID' })
  @ApiResponse({ status: 200, description: 'Value updated' })
  @ApiResponse({ status: 404, description: 'Value not found' })
  updateValue(
    @Param('productId') productId: string,
    @Param('productOptionId') productOptionId: string,
    @Param('valueId') valueId: string,
    @Body() input: UpdateOptionValueDto,
  ) {
    return this.optionService.updateValue(productId, productOptionId, valueId, input);
  }

  @Delete(':productOptionId/values/:valueId')
  @ApiOperation({ summary: 'Delete an option value (admin only)' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiParam({ name: 'productOptionId', description: 'ProductOption UUID' })
  @ApiParam({ name: 'valueId', description: 'OptionValue UUID' })
  @ApiResponse({ status: 200, description: 'Value deleted' })
  @ApiResponse({ status: 400, description: 'A variant is using this value — delete the variant first' })
  @ApiResponse({ status: 404, description: 'Value not found' })
  removeValue(
    @Param('productId') productId: string,
    @Param('productOptionId') productOptionId: string,
    @Param('valueId') valueId: string,
  ) {
    return this.optionService.removeValue(productId, productOptionId, valueId);
  }
}
