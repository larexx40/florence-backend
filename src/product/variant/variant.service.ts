import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse, PaginatedData } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { generateVariantSku } from 'src/common/helpers/slug.helper';
import { AttachImageDto } from 'src/image/dto/image.dto';
import { BulkCreateVariantsDto, CreateVariantDto, UpdateStockDto, UpdateVariantDto, VariantQueryDto } from './dto/variant.dto';

// ── Shared include ────────────────────────────────────────────────────────────

const VARIANT_INCLUDE = {
  variantOptionValues: {
    include: {
      productOptionValue: {
        include: {
          productOption: {
            include: { categoryOption: { select: { id: true, name: true } } },
          },
        },
      },
    },
  },
  images: {
    orderBy: { position: 'asc' as const },
  },
};

@Injectable()
export class VariantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findProductOrThrow(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async findVariantOrThrow(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found on this product');
    return variant;
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  async getAll(
    productId: string,
    query: VariantQueryDto,
  ): Promise<ApiResponse<{ variants: any[]; pagination: PaginatedData }>> {
    await this.findProductOrThrow(productId);

    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'asc';

    const where = {
      productId,
      ...(!query.includeInactive && { isActive: true }),
      ...(query.inStock && { stockQty: { gt: 0 } }),
    };

    const orderBy = { [sortBy]: sortOrder };

    if (query.all) {
      const variants = await this.prisma.productVariant.findMany({
        where,
        orderBy,
        include: VARIANT_INCLUDE,
      });
      const total = variants.length;
      return {
        status: true,
        message: 'Variants fetched successfully',
        data: {
          variants,
          pagination: { totalData: total, totalPages: 1, currentPage: 1, perPage: total },
        },
      };
    }

    const [variants, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: VARIANT_INCLUDE,
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return {
      status: true,
      message: 'Variants fetched successfully',
      data: {
        variants,
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async create(productId: string, input: CreateVariantDto): Promise<ApiResponse<any>> {
    const product = await this.findProductOrThrow(productId);

    if (!input.productOptionValueIds.length) {
      throw new BadRequestException('At least one productOptionValueId is required');
    }

    // Load the ProductOptionValues — must belong to this product's options
    const povRows = await this.prisma.productOptionValue.findMany({
      where: {
        id: { in: input.productOptionValueIds },
        productOption: { productId },
      },
      include: {
        productOption: {
          include: { categoryOption: { select: { id: true, name: true } } },
        },
      },
    });

    const foundIds = new Set(povRows.map((r) => r.id));
    const invalidIds = input.productOptionValueIds.filter((id) => !foundIds.has(id));
    if (invalidIds.length) {
      throw new BadRequestException(
        `These ProductOptionValue IDs are not declared for this product: ${invalidIds.join(', ')}`,
      );
    }

    // Ensure no two values from the same option dimension
    const usedOptions = new Set<string>();
    for (const row of povRows) {
      const catOptionId = row.productOption.categoryOptionId;
      if (usedOptions.has(catOptionId)) {
        throw new BadRequestException(
          `Cannot select two values from the same option (${row.productOption.categoryOption.name})`,
        );
      }
      usedOptions.add(catOptionId);
    }

    // Auto-generate denormalized title sorted by categoryOption.name for deterministic output
    const sortedPovRows = [...povRows].sort((a, b) =>
      a.productOption.categoryOption.name.localeCompare(b.productOption.categoryOption.name),
    );
    const title = sortedPovRows.map((r) => r.value).join(' / ') || 'Default';

    const sku = await generateVariantSku(
      product.slug,
      sortedPovRows.map((r) => r.value),
      (candidate) =>
        this.prisma.productVariant.findUnique({ where: { sku: candidate } }).then(Boolean),
    );

    // Check combination uniqueness against existing variants
    const existingVariants = await this.prisma.productVariant.findMany({
      where: { productId },
      include: { variantOptionValues: { select: { productOptionValueId: true } } },
    });

    const sortedNew = [...input.productOptionValueIds].sort();
    const duplicate = existingVariants.find((v) => {
      const sortedExisting = v.variantOptionValues.map((ov) => ov.productOptionValueId).sort();
      return (
        sortedExisting.length === sortedNew.length &&
        sortedExisting.every((id, i) => id === sortedNew[i])
      );
    });
    if (duplicate) throw new ConflictException('A variant with this combination already exists');

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku,
        title,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        stockQty: input.stockQty ?? 0,
        weightKg: input.weightKg ?? null,
        minQty: input.minQty ?? null,
        maxQty: input.maxQty ?? null,
        variantOptionValues: {
          create: input.productOptionValueIds.map((productOptionValueId) => ({
            productOptionValueId,
          })),
        },
      },
      include: VARIANT_INCLUDE,
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variant created successfully', data: variant };
  }

  async createBulk(productId: string, input: BulkCreateVariantsDto): Promise<ApiResponse<any[]>> {
    const product = await this.findProductOrThrow(productId);

    // ── Pre-transaction validation ──────────────────────────────────────────

    // Collect all POV IDs referenced across all variants, validate they belong to this product
    const allPovIds = [...new Set(input.variants.flatMap((v) => v.productOptionValueIds))];
    const povRows = await this.prisma.productOptionValue.findMany({
      where: { id: { in: allPovIds }, productOption: { productId } },
      include: {
        productOption: {
          include: { categoryOption: { select: { id: true, name: true } } },
        },
      },
    });

    const povMap = new Map(povRows.map((r) => [r.id, r]));
    const missingIds = allPovIds.filter((id) => !povMap.has(id));
    if (missingIds.length) {
      throw new BadRequestException(
        `These ProductOptionValue IDs are not declared for this product: ${missingIds.join(', ')}`,
      );
    }

    // Per-variant: validate option dimensions, build title, resolve/generate SKU
    // usedSkus tracks all SKUs assigned so far in this batch to avoid collisions between auto-generated ones
    const usedSkus = new Set<string>();
    const variantMeta: Array<{ sku: string; title: string; povIds: string[] }> = [];

    for (const variantInput of input.variants) {
      if (!variantInput.productOptionValueIds.length) {
        throw new BadRequestException('Each variant requires at least one productOptionValueId');
      }

      const usedOptions = new Set<string>();
      for (const id of variantInput.productOptionValueIds) {
        const row = povMap.get(id)!;
        const catOptionId = row.productOption.categoryOptionId;
        if (usedOptions.has(catOptionId)) {
          throw new BadRequestException(
            `Variant has two values from the same option (${row.productOption.categoryOption.name})`,
          );
        }
        usedOptions.add(catOptionId);
      }

      const sortedRows = variantInput.productOptionValueIds
        .map((id) => povMap.get(id)!)
        .sort((a, b) => a.productOption.categoryOption.name.localeCompare(b.productOption.categoryOption.name));

      const title = sortedRows.map((r) => r.value).join(' / ') || 'Default';

      // auto-generate SKU, skipping any already claimed in this batch
      const sku = await generateVariantSku(
        product.slug,
        sortedRows.map((r) => r.value),
        (candidate) => {
          if (usedSkus.has(candidate)) return Promise.resolve(true);
          return this.prisma.productVariant.findUnique({ where: { sku: candidate } }).then(Boolean);
        },
      );

      usedSkus.add(sku);
      variantMeta.push({ sku, title, povIds: variantInput.productOptionValueIds });
    }

    // Check for duplicate option combinations within the request
    const seenCombos = new Set<string>();
    for (let i = 0; i < input.variants.length; i += 1) {
      const key = [...variantMeta[i].povIds].sort().join(',');
      if (seenCombos.has(key)) {
        throw new BadRequestException(
          `Variant "${variantMeta[i].sku}": duplicate option combination in the same request`,
        );
      }
      seenCombos.add(key);
    }

    // Check for duplicate combinations against existing variants
    const existingVariants = await this.prisma.productVariant.findMany({
      where: { productId },
      include: { variantOptionValues: { select: { productOptionValueId: true } } },
    });
    for (let i = 0; i < input.variants.length; i += 1) {
      const sortedNew = [...variantMeta[i].povIds].sort();
      const dupe = existingVariants.find((v) => {
        const sortedExisting = v.variantOptionValues.map((ov) => ov.productOptionValueId).sort();
        return (
          sortedExisting.length === sortedNew.length &&
          sortedExisting.every((id, j) => id === sortedNew[j])
        );
      });
      if (dupe) {
        throw new ConflictException(
          `Variant "${variantMeta[i].sku}": option combination already exists on this product`,
        );
      }
    }

    // ── Atomic write ────────────────────────────────────────────────────────

    const created = await this.prisma.$transaction(async (tx) => {
      const results: any[] = [];

      for (let i = 0; i < input.variants.length; i += 1) {
        const v = input.variants[i];
        const { sku, title, povIds } = variantMeta[i];

        const variant = await tx.productVariant.create({
          data: {
            productId,
            sku,
            title,
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? null,
            stockQty: v.stockQty ?? 0,
            weightKg: v.weightKg ?? null,
            minQty: v.minQty ?? null,
            maxQty: v.maxQty ?? null,
            variantOptionValues: {
              create: povIds.map((productOptionValueId) => ({ productOptionValueId })),
            },
          },
          include: VARIANT_INCLUDE,
        });

        results.push(variant);
      }

      return results;
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variants created successfully', data: created };
  }

  async update(
    productId: string,
    variantId: string,
    input: UpdateVariantDto,
  ): Promise<ApiResponse<any>> {
    await this.findVariantOrThrow(productId, variantId);

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(input.price !== undefined && { price: input.price }),
        ...(input.compareAtPrice !== undefined && { compareAtPrice: input.compareAtPrice }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.weightKg !== undefined && { weightKg: input.weightKg }),
        ...(input.minQty !== undefined && { minQty: input.minQty }),
        ...(input.maxQty !== undefined && { maxQty: input.maxQty }),
      },
      include: VARIANT_INCLUDE,
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variant updated successfully', data: updated };
  }

  async updateStock(
    productId: string,
    variantId: string,
    input: UpdateStockDto,
  ): Promise<ApiResponse<any>> {
    await this.findVariantOrThrow(productId, variantId);

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { stockQty: input.stockQty },
      select: { id: true, sku: true, stockQty: true },
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Stock updated successfully', data: updated };
  }

  async remove(productId: string, variantId: string): Promise<ApiResponse<null>> {
    await this.findVariantOrThrow(productId, variantId);

    const inOrders = await this.prisma.orderItem.findFirst({ where: { variantId } });
    if (inOrders) {
      // soft-delete — preserve order history references
      await this.prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
      await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
      return {
        status: true,
        message: 'Variant deactivated (it exists in order history)',
        data: null,
      };
    }

    await this.prisma.$transaction([
      this.prisma.variantOptionValue.deleteMany({ where: { variantId } }),
      this.prisma.variantImage.deleteMany({ where: { variantId } }),
      this.prisma.cartItem.deleteMany({ where: { variantId } }),
      this.prisma.productVariant.delete({ where: { id: variantId } }),
    ]);

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variant deleted successfully', data: null };
  }

  // ── Variant image management ─────────────────────────────────────────────────

  async attachImage(
    productId: string,
    variantId: string,
    dto: AttachImageDto,
  ): Promise<ApiResponse<any>> {
    await this.findVariantOrThrow(productId, variantId);

    const image = await this.prisma.variantImage.create({
      data: { variantId, url: dto.url, altText: dto.altText ?? null, position: dto.position ?? 0 },
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Image attached to variant', data: image };
  }

  async detachImage(
    productId: string,
    variantId: string,
    imageId: string,
  ): Promise<ApiResponse<null>> {
    await this.findVariantOrThrow(productId, variantId);

    const image = await this.prisma.variantImage.findFirst({ where: { id: imageId, variantId } });
    if (!image) throw new NotFoundException('Image not found on this variant');

    await this.prisma.variantImage.delete({ where: { id: imageId } });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Image detached from variant', data: null };
  }
}
