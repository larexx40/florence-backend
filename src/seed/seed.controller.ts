import { Body, Controller, Headers, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/types';
import {
  RunSeedDto,
  SeedCategoryOptionsDto,
  SeedShopifyCategoriesDto,
  SeedShopifyProductsDto,
} from './dto/seed.dto';
import {
  SeedCatalogCategoriesSummary,
  SeedCatalogProductsSummary,
  SeedCategoryOptionsSummary,
} from './seed.service';
import { SeedRunSummary } from './seed.runner';
import { SeedService } from './seed.service';

@ApiTags('seed')
@ApiSecurity('x-api-key')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('run')
  @ApiOperation({ summary: 'Trigger database seed via API' })
  @ApiHeader({
    name: 'x-seed-secret',
    required: true,
    description: 'Must match SEED_API_KEY from the server environment',
  })
  @ApiBody({
    type: RunSeedDto,
    required: false,
    description:
      'Optional custom users to seed. If omitted, default users are seeded.',
  })
  @ApiResponse({ status: 201, description: 'Seed completed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid seed secret' })
  @ApiResponse({ status: 500, description: 'Seed API key is not configured' })
  async runSeed(
    @Headers('x-seed-secret') seedSecret: string | undefined,
    @Body() input?: RunSeedDto,
  ): Promise<AppApiResponse<SeedRunSummary>> {
    return this.seedService.run(seedSecret, input);
  }

  @Post('category')
  @ApiOperation({ summary: 'Seed categories from the Shopify snapshot JSON' })
  @ApiHeader({
    name: 'x-seed-secret',
    required: true,
    description: 'Must match SEED_API_KEY from the server environment',
  })
  @ApiBody({
    type: SeedShopifyCategoriesDto,
    required: false,
    description: 'No body required. Reads prisma/data/shopify-data.json.',
  })
  @ApiResponse({ status: 201, description: 'Category seed completed successfully' })
  async seedCategories(
    @Headers('x-seed-secret') seedSecret: string | undefined,
    @Body() _input?: SeedShopifyCategoriesDto,
  ): Promise<AppApiResponse<SeedCatalogCategoriesSummary>> {
    return this.seedService.seedCatalogCategories(seedSecret);
  }

  @Post('category-options')
  @ApiOperation({ summary: 'Seed category options and their values from the built-in definitions' })
  @ApiHeader({
    name: 'x-seed-secret',
    required: true,
    description: 'Must match SEED_API_KEY from the server environment',
  })
  @ApiBody({
    type: SeedCategoryOptionsDto,
    required: false,
    description: 'No body required. Categories must already exist (run POST /seed/category first).',
  })
  @ApiResponse({ status: 201, description: 'Category options seeded successfully' })
  @ApiResponse({ status: 404, description: 'A referenced category slug was not found' })
  async seedCategoryOptions(
    @Headers('x-seed-secret') seedSecret: string | undefined,
    @Body() _input?: SeedCategoryOptionsDto,
  ): Promise<AppApiResponse<SeedCategoryOptionsSummary>> {
    return this.seedService.seedCategoryOptions(seedSecret);
  }

  @Post('products')
  @ApiOperation({
    summary: 'Seed products, options, values, variants, and product images from the Shopify snapshot JSON',
  })
  @ApiHeader({
    name: 'x-seed-secret',
    required: true,
    description: 'Must match SEED_API_KEY from the server environment',
  })
  @ApiBody({
    type: SeedShopifyProductsDto,
    required: false,
    description: 'No body required. Reads prisma/data/shopify-data.json.',
  })
  @ApiResponse({ status: 201, description: 'Product seed completed successfully' })
  async seedProducts(
    @Headers('x-seed-secret') seedSecret: string | undefined,
    @Body() _input?: SeedShopifyProductsDto,
  ): Promise<AppApiResponse<SeedCatalogProductsSummary>> {
    return this.seedService.seedCatalogProducts(seedSecret);
  }
}
