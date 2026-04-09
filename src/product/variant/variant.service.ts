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
import { CreateVariantDto, UpdateStockDto, UpdateVariantDto, VariantQueryDto } from './dto/variant.dto';

const VARIANT_INCLUDE = {
  optionValues: {
    include: {
      optionValue: {
        include: { productOption: { include: { option: true } } },
      },
    },
  },
  images: {
    include: { image: true },
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
    const variant = await this.prisma.variant.findFirst({
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
      const variants = await this.prisma.variant.findMany({
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
      this.prisma.variant.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: VARIANT_INCLUDE,
      }),
      this.prisma.variant.count({ where }),
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
    await this.findProductOrThrow(productId);

    const productOptions = await this.prisma.productOption.findMany({
      where: { productId },
      include: { values: { select: { id: true } } },
    });

    if (!productOptions.length) {
      throw new BadRequestException(
        'Add at least one option to the product before creating variants',
      );
    }

    const valueToOption = new Map<string, string>();
    productOptions.forEach((po) => po.values.forEach((v) => valueToOption.set(v.id, po.id)));

    const invalidIds = input.optionValueIds.filter((id) => !valueToOption.has(id));
    if (invalidIds.length) {
      throw new BadRequestException(
        `These option value IDs do not belong to this product: ${invalidIds.join(', ')}`,
      );
    }

    // ensure no two values from the same option
    const usedOptions = new Set<string>();
    for (const valueId of input.optionValueIds) {
      const optionId = valueToOption.get(valueId);
      if (usedOptions.has(optionId)) {
        throw new BadRequestException('Cannot select two values from the same option');
      }
      usedOptions.add(optionId);
    }

    const skuTaken = await this.prisma.variant.findUnique({ where: { sku: input.sku } });
    if (skuTaken) throw new ConflictException(`SKU "${input.sku}" is already in use`);

    // check combination uniqueness
    const existingVariants = await this.prisma.variant.findMany({
      where: { productId },
      include: { optionValues: { select: { optionValueId: true } } },
    });

    const sortedNew = [...input.optionValueIds].sort();
    const duplicate = existingVariants.find((v) => {
      const sortedExisting = v.optionValues.map((ov) => ov.optionValueId).sort();
      return (
        sortedExisting.length === sortedNew.length &&
        sortedExisting.every((id, i) => id === sortedNew[i])
      );
    });
    if (duplicate) throw new ConflictException('A variant with this combination already exists');

    const variant = await this.prisma.variant.create({
      data: {
        productId,
        sku: input.sku,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        stockQty: input.stockQty ?? 0,
        weightKg: input.weightKg ?? null,
        optionValues: {
          create: input.optionValueIds.map((optionValueId) => ({ optionValueId })),
        },
      },
      include: VARIANT_INCLUDE,
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: 'Variant created successfully',
      data: variant,
    };
  }

  async update(
    productId: string,
    variantId: string,
    input: UpdateVariantDto,
  ): Promise<ApiResponse<any>> {
    await this.findVariantOrThrow(productId, variantId);

    if (input.sku) {
      const skuTaken = await this.prisma.variant.findFirst({
        where: { sku: input.sku, id: { not: variantId } },
      });
      if (skuTaken) throw new ConflictException(`SKU "${input.sku}" is already in use`);
    }

    const updated = await this.prisma.variant.update({
      where: { id: variantId },
      data: {
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.compareAtPrice !== undefined && { compareAtPrice: input.compareAtPrice }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.weightKg !== undefined && { weightKg: input.weightKg }),
      },
      include: VARIANT_INCLUDE,
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: 'Variant updated successfully',
      data: updated,
    };
  }

  async updateStock(
    productId: string,
    variantId: string,
    input: UpdateStockDto,
  ): Promise<ApiResponse<any>> {
    await this.findVariantOrThrow(productId, variantId);

    const updated = await this.prisma.variant.update({
      where: { id: variantId },
      data: { stockQty: input.stockQty },
      select: { id: true, sku: true, stockQty: true },
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: 'Stock updated successfully',
      data: updated,
    };
  }

  async remove(productId: string, variantId: string): Promise<ApiResponse<null>> {
    await this.findVariantOrThrow(productId, variantId);

    const inOrders = await this.prisma.orderItem.findFirst({ where: { variantId } });
    if (inOrders) {
      // soft-delete — cannot hard-delete because order history references this variant
      await this.prisma.variant.update({ where: { id: variantId }, data: { isActive: false } });
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
      this.prisma.variant.delete({ where: { id: variantId } }),
    ]);

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variant deleted successfully', data: null };
  }
}
