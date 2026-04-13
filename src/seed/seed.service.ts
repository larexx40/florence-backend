import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiResponse } from 'src/common/types';
import { CategoryService } from 'src/category/category.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OptionService } from 'src/product/option/option.service';
import { AddProductOptionDto } from 'src/product/option/dto/option.dto';
import { ProductService } from 'src/product/product.service';
import { CreateProductDto } from 'src/product/dto/product.dto';
import { VariantService } from 'src/product/variant/variant.service';
import { CreateVariantDto } from 'src/product/variant/dto/variant.dto';
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
    private readonly optionService: OptionService,
    private readonly variantService: VariantService,
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
          prerequisiteVariantId: undefined,
        } satisfies CreateProductDto);
        product = created.data;
        summary.products.created += 1;
      } else {
        summary.products.skipped += 1;
      }

      for (const option of entry.options) {
        const productOption = await this.prisma.productOption.findFirst({
          where: {
            productId: product.id,
            option: { name: option.name },
          },
          include: { option: true },
        });

        let ensuredProductOptionId = productOption?.id;
        if (!ensuredProductOptionId) {
          const added = await this.optionService.addOption(product.id, {
            name: option.name,
            displayName: option.displayName ?? option.name,
            position: option.position ?? 0,
          } satisfies AddProductOptionDto);
          ensuredProductOptionId = added.data.id;
          summary.options.created += 1;
        } else {
          summary.options.skipped += 1;
        }

        for (let index = 0; index < option.values.length; index += 1) {
          const value = option.values[index];
          const existingValue = await this.prisma.optionValue.findFirst({
            where: { productOptionId: ensuredProductOptionId, value },
          });

          if (!existingValue) {
            await this.optionService.addValue(product.id, ensuredProductOptionId, {
              value,
              position: index,
            });
            summary.optionValues.created += 1;
          } else {
            summary.optionValues.skipped += 1;
          }
        }
      }

      for (const variant of entry.variants) {
        const existingVariant = await this.prisma.variant.findUnique({
          where: { sku: variant.sku },
        });
        if (existingVariant) {
          summary.variants.skipped += 1;
          continue;
        }

        const optionValueIds: string[] = [];
        for (const selected of variant.selectedOptions) {
          const optionValue = await this.prisma.optionValue.findFirst({
            where: {
              value: selected.value,
              productOption: {
                productId: product.id,
                option: { name: selected.optionName },
              },
            },
            select: { id: true },
          });

          if (!optionValue) {
            throw new InternalServerErrorException(
              `Missing option value "${selected.optionName}:${selected.value}" for product "${entry.product.slug}"`,
            );
          }

          optionValueIds.push(optionValue.id);
        }

        await this.variantService.create(product.id, {
          sku: variant.sku,
          price: Number(variant.price),
          compareAtPrice: variant.compareAtPrice ?? undefined,
          stockQty: variant.stockQty,
          weightKg: variant.weightKg ?? undefined,
          optionValueIds,
        } satisfies CreateVariantDto);
        summary.variants.created += 1;
      }

      for (const image of entry.images) {
        const s3Key = `external/shopify/${entry.product.slug}/${image.sourceImageId ?? this.slugify(image.url)}`;
        const existingImage = await this.prisma.image.findUnique({
          where: { s3Key },
        });

        const ensuredImage = existingImage
          ? existingImage
          : await this.prisma.image.create({
              data: {
                s3Key,
                url: image.url,
                mimeType: this.detectMimeType(image.url),
                sizeBytes: 0,
                altText: image.altText ?? null,
                uploadedBy: 'seed:shopify',
              },
            });

        const link = await this.prisma.productImage.findFirst({
          where: {
            productId: product.id,
            imageId: ensuredImage.id,
          },
        });

        if (!link) {
          await this.prisma.productImage.create({
            data: {
              productId: product.id,
              imageId: ensuredImage.id,
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

  private slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private detectMimeType(url: string): string {
    const lowered = url.toLowerCase();
    if (lowered.includes('.png')) return 'image/png';
    if (lowered.includes('.webp')) return 'image/webp';
    if (lowered.includes('.gif')) return 'image/gif';
    return 'image/jpeg';
  }
}
