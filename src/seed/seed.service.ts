import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiResponse } from 'src/common/types';
import {
  categoryOptionsSeedData,
} from './data/category-options.seed';
import { CategoryService } from 'src/category/category.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductService } from 'src/product/product.service';
import { CreateProductDto } from 'src/product/dto/product.dto';
import { RunSeedDto } from './dto/seed.dto';
import { SeedRunSummary, runSeed } from './seed.runner';

interface ShopifyCollectionSeed {
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
}

interface ShopifyOptionSeed {
  name: string;
  displayName?: string | null;
  position?: number;
  values: string[];
}

interface ShopifyVariantSeed {
  sku: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  stockQty: number;
  isActive: boolean;
  weightKg?: number | null;
  selectedOptions: Array<{
    optionName: string;
    value: string;
  }>;
}

interface ShopifyImageSeed {
  sourceImageId?: number;
  url: string;
  altText?: string | null;
  position?: number;
}

interface ShopifyProductSeed {
  category: string;
  product: {
    name: string;
    slug: string;
    description?: string | null;
    isActive: boolean;
    minOrderQty?: number;
    orderIncrement?: number | null;
    prerequisiteVariantId?: string | null;
  };
  images: ShopifyImageSeed[];
  options: ShopifyOptionSeed[];
  variants: ShopifyVariantSeed[];
}

interface ShopifyCatalogSeedFile {
  collections: ShopifyCollectionSeed[];
  products: ShopifyProductSeed[];
}

export interface SeedCatalogCategoriesSummary {
  filePath: string;
  categories: {
    created: number;
    skipped: number;
  };
}

export interface SeedCategoryOptionsSummary {
  categoryOptions: { created: number; skipped: number };
}

export interface SeedCatalogProductsSummary {
  filePath: string;
  categories: {
    created: number;
    skipped: number;
  };
  products: {
    created: number;
    skipped: number;
  };
  options: {
    created: number;
    skipped: number;
  };
  optionValues: {
    created: number;
    skipped: number;
  };
  variants: {
    created: number;
    skipped: number;
  };
  productImages: {
    created: number;
    skipped: number;
  };
}

@Injectable()
export class SeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: CategoryService,
    private readonly productService: ProductService,
  ) {}

  async run(
    seedSecret: string | undefined,
    input?: RunSeedDto,
  ): Promise<ApiResponse<SeedRunSummary>> {
    const expectedSecret = process.env.SEED_API_KEY;

    if (!expectedSecret) {
      throw new InternalServerErrorException(
        'SEED_API_KEY is not configured. Add it to your environment before using this endpoint.',
      );
    }

    if (!seedSecret || seedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid seed secret');
    }

    const summary = await runSeed(
      this.prisma,
      input?.users && input.users.length > 0 ? input.users : undefined,
    );

    return {
      status: true,
      message: 'Seed completed successfully',
      data: summary,
    };
  }

  async seedCatalogCategories(
    seedSecret: string | undefined,
  ): Promise<ApiResponse<SeedCatalogCategoriesSummary>> {
    this.assertSeedSecret(seedSecret);

    const { catalog, filePath } = await this.readShopifyCatalog();
    const summary = await this.ensureCategories(catalog.collections);

    return {
      status: true,
      message: 'Catalog categories seeded successfully',
      data: { filePath, categories: summary },
    };
  }

  async seedCategoryOptions(
    seedSecret: string | undefined,
  ): Promise<ApiResponse<SeedCategoryOptionsSummary>> {
    this.assertSeedSecret(seedSecret);

    const summary: SeedCategoryOptionsSummary = {
      categoryOptions: { created: 0, skipped: 0 },
    };

    for (const entry of categoryOptionsSeedData) {
      const category = await this.prisma.category.findUnique({
        where: { slug: entry.categorySlug },
      });

      if (!category) {
        throw new NotFoundException(
          `Category slug "${entry.categorySlug}" not found. Run POST /seed/category first.`,
        );
      }

      for (const option of entry.options) {
        const existing = await this.prisma.categoryOption.findUnique({
          where: {
            categoryId_name: { categoryId: category.id, name: option.name },
          },
        });

        if (!existing) {
          await this.prisma.categoryOption.create({
            data: {
              categoryId: category.id,
              name: option.name,
              isRequired: option.isRequired,
            },
          });
          summary.categoryOptions.created += 1;
        } else {
          summary.categoryOptions.skipped += 1;
        }
      }
    }

    return {
      status: true,
      message: 'Category options seeded successfully',
      data: summary,
    };
  }

  async seedCatalogProducts(
    seedSecret: string | undefined,
  ): Promise<ApiResponse<SeedCatalogProductsSummary>> {
    this.assertSeedSecret(seedSecret);

    const { catalog, filePath } = await this.readShopifyCatalog();
    const categorySummary = await this.ensureCategories(catalog.collections);

    const summary: SeedCatalogProductsSummary = {
      filePath,
      categories: categorySummary,
      products: { created: 0, skipped: 0 },
      options: { created: 0, skipped: 0 },
      optionValues: { created: 0, skipped: 0 },
      variants: { created: 0, skipped: 0 },
      productImages: { created: 0, skipped: 0 },
    };

    for (const entry of catalog.products) {
      const category = await this.prisma.category.findUnique({
        where: { slug: entry.category },
      });
      if (!category) {
        throw new InternalServerErrorException(
          `Category "${entry.category}" must exist before products can be seeded`,
        );
      }

      let product = await this.prisma.product.findUnique({
        where: { slug: entry.product.slug },
      });

      if (!product) {
        const created = await this.productService.create({
          name: entry.product.name,
          description: entry.product.description ?? undefined,
          categoryId: category.id,
          minOrderQty: entry.product.minOrderQty ?? 1,
          orderIncrement: entry.product.orderIncrement ?? undefined,
          // prerequisiteVariantId: undefined,
        } satisfies CreateProductDto);
        product = created.data;
        summary.products.created += 1;
      } else {
        summary.products.skipped += 1;
      }

      for (const option of entry.options) {
        // normalise Shopify option names to match CategoryOption names
        // e.g. "Colors" / "Colours" → "Color", "Sizes" → "Size"
        const normalised = this.normaliseOptionName(option.name);

        const catOption = await this.prisma.categoryOption.findFirst({
          where: {
            categoryId: category.id,
            name: { equals: normalised, mode: 'insensitive' },
          },
        });

        if (!catOption) {
          // category has no matching option type — skip
          summary.options.skipped += 1;
          continue;
        }

        // find or create ProductOption: links this product to the category option type
        let productOption = await this.prisma.productOption.findUnique({
          where: {
            productId_categoryOptionId: { productId: product.id, categoryOptionId: catOption.id },
          },
        });

        if (!productOption) {
          productOption = await this.prisma.productOption.create({
            data: { productId: product.id, categoryOptionId: catOption.id },
          });
          summary.options.created += 1;
        } else {
          summary.options.skipped += 1;
        }

        for (let index = 0; index < option.values.length; index += 1) {
          const value = option.values[index];

          // find or create ProductOptionValue under this product's option
          const existing = await this.prisma.productOptionValue.findUnique({
            where: {
              productOptionId_value: { productOptionId: productOption.id, value },
            },
          });

          if (!existing) {
            await this.prisma.productOptionValue.create({
              data: { productOptionId: productOption.id, value },
            });
            summary.optionValues.created += 1;
          } else {
            summary.optionValues.skipped += 1;
          }
        }
      }

      for (const variant of entry.variants) {
        const existingVariant = await this.prisma.productVariant.findUnique({
          where: { sku: variant.sku },
        });
        if (existingVariant) {
          summary.variants.skipped += 1;
          continue;
        }

        // resolve each selected option to its ProductOptionValue id
        const productOptionValueIds: string[] = [];
        for (const selected of variant.selectedOptions) {
          const normalised = this.normaliseOptionName(selected.optionName);

          const pov = await this.prisma.productOptionValue.findFirst({
            where: {
              value: selected.value,
              productOption: {
                productId: product.id,
                categoryOption: {
                  categoryId: category.id,
                  name: { equals: normalised, mode: 'insensitive' },
                },
              },
            },
            select: { id: true },
          });

          if (!pov) break; // option type has no match — variant cannot be fully resolved

          productOptionValueIds.push(pov.id);
        }

        if (productOptionValueIds.length !== variant.selectedOptions.length) {
          summary.variants.skipped += 1;
          continue;
        }

        const created = await this.prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: variant.sku,
            title: variant.title,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice ?? null,
            stockQty: variant.stockQty,
            isActive: variant.isActive,
            weightKg: variant.weightKg ?? null,
          },
        });

        for (const productOptionValueId of productOptionValueIds) {
          await this.prisma.variantOptionValue.create({
            data: { variantId: created.id, productOptionValueId },
          });
        }

        summary.variants.created += 1;
      }

      for (const image of entry.images) {
        const existing = await this.prisma.productImage.findFirst({
          where: { productId: product.id, url: image.url },
        });

        if (!existing) {
          await this.prisma.productImage.create({
            data: {
              productId: product.id,
              url: image.url,
              altText: image.altText ?? null,
              position: image.position ?? 0,
            },
          });
          summary.productImages.created += 1;
        } else {
          summary.productImages.skipped += 1;
        }
      }
    }

    return {
      status: true,
      message: 'Catalog products seeded successfully',
      data: summary,
    };
  }

  private assertSeedSecret(seedSecret: string | undefined) {
    const expectedSecret = process.env.SEED_API_KEY;

    if (!expectedSecret) {
      throw new InternalServerErrorException(
        'SEED_API_KEY is not configured. Add it to your environment before using this endpoint.',
      );
    }

    if (!seedSecret || seedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid seed secret');
    }
  }

  private async readShopifyCatalog(): Promise<{
    filePath: string;
    catalog: ShopifyCatalogSeedFile;
  }> {
    const filePath = join(process.cwd(), 'prisma', 'data', 'shopify-data.json');

    try {
      const raw = await readFile(filePath, 'utf8');
      return {
        filePath,
        catalog: JSON.parse(raw) as ShopifyCatalogSeedFile,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Unable to read Shopify seed file at ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  private async ensureCategories(collections: ShopifyCollectionSeed[]) {
    const summary = { created: 0, skipped: 0 };

    for (const collection of collections) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: collection.slug },
      });

      if (existing) {
        summary.skipped += 1;
        continue;
      }

      await this.categoryService.create({
        name: collection.name,
        description: collection.description ?? undefined,
        imageUrl: collection.imageUrl ?? undefined,
      });
      summary.created += 1;
    }

    return summary;
  }

  // Normalises Shopify option names to match CategoryOption names.
  // Shopify exports plurals and British spellings; our categories use singular American.
  // e.g. "Colors" → "color", "Colours" → "color", "Sizes" → "size"
  private normaliseOptionName(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/colou?rs?/, 'color')
      .replace(/sizes?/, 'size')
      .trim();
  }
}
