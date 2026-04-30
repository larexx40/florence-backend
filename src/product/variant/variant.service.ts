import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse, PaginatedData } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { generateVariantSku } from 'src/common/helpers/slug.helper';
import { buildS3ImageKey, cleanupOrphanedS3Image, validateImageFile } from 'src/common/helpers/image.helper';
import { uploadFileToAWSS3 } from 'src/common/helpers/s3.upload.helper';
import { AttachImageDto } from 'src/image/dto/image.dto';
import { BulkCreateVariantsDto, BulkUpdateVariantsDto, CreateVariantDto, GlobalVariantQueryDto, UpdateStockDto, UpdateVariantDto, VariantQueryDto } from './dto/variant.dto';

const MAX_VARIANT_IMAGES = 2;

// ── Serializer ────────────────────────────────────────────────────────────────

function serializeVariant(v: any) {
  const { variantOptionValues, ...rest } = v;
  return {
    ...rest,
    combination: (variantOptionValues ?? []).map((vov: any) => ({
      optionName: vov.productOptionValue.productOption.categoryOption.name,
      value: vov.productOptionValue.value,
      colorHex: vov.productOptionValue.colorHex ?? null,
    })),
  };
}

// ── Shared include ────────────────────────────────────────────────────────────

const GLOBAL_VARIANT_INCLUDE = {
  product: { select: { id: true, name: true, slug: true } },
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
  private readonly logger = new Logger(VariantService.name);

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

  async getAllGlobal(
    query: GlobalVariantQueryDto,
  ): Promise<ApiResponse<{ variants: any[]; pagination: PaginatedData }>> {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where = {
      isDeleted: false,
      ...(!query.includeInactive && { isActive: true }),
      ...(query.inStock && { stockQty: { gt: 0 } }),
      ...(query.productId && { productId: query.productId }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' as const } },
          { sku: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const orderBy = { [sortBy]: sortOrder };

    if (query.all) {
      const variants = await this.prisma.productVariant.findMany({
        where,
        orderBy,
        include: GLOBAL_VARIANT_INCLUDE,
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
        include: GLOBAL_VARIANT_INCLUDE,
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
      isDeleted: false,
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
          variants: variants.map(serializeVariant),
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
        variants: variants.map(serializeVariant),
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

  async create(productId: string, input: CreateVariantDto, files?: Express.Multer.File[]): Promise<ApiResponse<any>> {
    const product = await this.findProductOrThrow(productId);

    if (files && files.length > 0) {
      if (files.length > MAX_VARIANT_IMAGES) {
        throw new BadRequestException(`Cannot attach more than ${MAX_VARIANT_IMAGES} images to a variant`);
      }
      files.forEach((file) => validateImageFile(file));
    }

    const povIds = input.productOptionValueIds ?? [];
    const hasOptionValues = povIds.length > 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let variant: any;

    if (hasOptionValues) {
      // Load and validate the provided ProductOptionValues
      const povRows = await this.prisma.productOptionValue.findMany({
        where: {
          id: { in: povIds },
          productOption: { productId },
        },
        include: {
          productOption: {
            include: { categoryOption: { select: { id: true, name: true } } },
          },
        },
      });

      const foundIds = new Set(povRows.map((r) => r.id));
      const invalidIds = povIds.filter((id) => !foundIds.has(id));
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
      const title = sortedPovRows.map((r) => r.value).join(' / ');
      const sortedPovIds = sortedPovRows.map((r) => r.id);

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

      const sortedNew = [...povIds].sort();
      const duplicate = existingVariants.find((v) => {
        const sortedExisting = v.variantOptionValues.map((ov) => ov.productOptionValueId).sort();
        return (
          sortedExisting.length === sortedNew.length &&
          sortedExisting.every((id, i) => id === sortedNew[i])
        );
      });
      if (duplicate) throw new ConflictException('A variant with this combination already exists');

      variant = await this.prisma.productVariant.create({
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
            create: sortedPovIds.map((productOptionValueId) => ({ productOptionValueId })),
          },
        },
        include: VARIANT_INCLUDE,
      });
    } else {
      // No option values — name must be provided and unique within this product
      if (!input.name?.trim()) {
        throw new BadRequestException('name is required when productOptionValueIds is empty');
      }

      const title = input.name.trim();
      const duplicate = await this.prisma.productVariant.findFirst({
        where: { productId, title: { equals: title, mode: 'insensitive' }, variantOptionValues: { none: {} } },
      });
      if (duplicate) {
        throw new ConflictException(`A variant named "${title}" already exists for this product`);
      }

      const sku = await generateVariantSku(
        product.slug,
        [],
        (candidate) =>
          this.prisma.productVariant.findUnique({ where: { sku: candidate } }).then(Boolean),
      );

      variant = await this.prisma.productVariant.create({
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
        },
        include: VARIANT_INCLUDE,
      });
    }

    const images = files && files.length > 0
      ? await Promise.all(
          files.map(async (file, index) => {
            const key = buildS3ImageKey('variants', file.mimetype);
            const url = await uploadFileToAWSS3(file, key, true, true);
            return this.prisma.variantImage.create({
              data: { variantId: variant.id, url, altText: null, position: index },
            });
          }),
        )
      : variant.images;

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variant created successfully', data: serializeVariant({ ...variant, images }) };
  }

  async createBulk(productId: string, input: BulkCreateVariantsDto): Promise<ApiResponse<any[]>> {
    const product = await this.findProductOrThrow(productId);

    // ── Pre-transaction validation ──────────────────────────────────────────

    const withOptionInputs = input.variants.filter((v) => (v.productOptionValueIds ?? []).length > 0);
    const withoutOptionInputs = input.variants.filter((v) => !(v.productOptionValueIds ?? []).length);

    // No-option variants: name is required
    for (const v of withoutOptionInputs) {
      if (!v.name?.trim()) {
        throw new BadRequestException('name is required for variants with no option values');
      }
    }

    // No-option variants: no duplicate names within the batch
    const batchNamesLower = new Set<string>();
    for (const v of withoutOptionInputs) {
      const lower = v.name!.trim().toLowerCase();
      if (batchNamesLower.has(lower)) {
        throw new BadRequestException(`Duplicate variant name "${v.name!.trim()}" in the same request`);
      }
      batchNamesLower.add(lower);
    }

    // No-option variants: no duplicate names against existing DB rows
    if (withoutOptionInputs.length) {
      const existingNoOption = await this.prisma.productVariant.findMany({
        where: { productId, variantOptionValues: { none: {} } },
        select: { title: true },
      });
      const existingTitlesLower = new Set(existingNoOption.map((v) => v.title.toLowerCase()));
      for (const v of withoutOptionInputs) {
        if (existingTitlesLower.has(v.name!.trim().toLowerCase())) {
          throw new ConflictException(`A variant named "${v.name!.trim()}" already exists for this product`);
        }
      }
    }

    // POV variants: load and validate all option values in one query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let povMap = new Map<string, any>();
    if (withOptionInputs.length) {
      const allPovIds = [...new Set(withOptionInputs.flatMap((v) => v.productOptionValueIds!))];
      const povRows = await this.prisma.productOptionValue.findMany({
        where: { id: { in: allPovIds }, productOption: { productId } },
        include: {
          productOption: {
            include: { categoryOption: { select: { id: true, name: true } } },
          },
        },
      });
      povMap = new Map(povRows.map((r) => [r.id, r]));
      const missingIds = allPovIds.filter((id) => !povMap.has(id));
      if (missingIds.length) {
        throw new BadRequestException(
          `These ProductOptionValue IDs are not declared for this product: ${missingIds.join(', ')}`,
        );
      }
    }

    // Per-variant: validate dimensions, build title + SKU
    const usedSkus = new Set<string>();
    const variantMeta: Array<{ sku: string; title: string; povIds: string[] }> = [];

    for (const variantInput of input.variants) {
      const povIds = variantInput.productOptionValueIds ?? [];

      if (povIds.length) {
        const usedOptions = new Set<string>();
        for (const id of povIds) {
          const row = povMap.get(id)!;
          const catOptionId = row.productOption.categoryOptionId;
          if (usedOptions.has(catOptionId)) {
            throw new BadRequestException(
              `Variant has two values from the same option (${row.productOption.categoryOption.name})`,
            );
          }
          usedOptions.add(catOptionId);
        }

        const sortedRows = povIds
          .map((id) => povMap.get(id)!)
          .sort((a, b) => a.productOption.categoryOption.name.localeCompare(b.productOption.categoryOption.name));

        const title = sortedRows.map((r) => r.value).join(' / ');
        const sku = await generateVariantSku(
          product.slug,
          sortedRows.map((r) => r.value),
          (candidate) => {
            if (usedSkus.has(candidate)) return Promise.resolve(true);
            return this.prisma.productVariant.findUnique({ where: { sku: candidate } }).then(Boolean);
          },
        );
        usedSkus.add(sku);
        variantMeta.push({ sku, title, povIds: sortedRows.map((r) => r.id) });
      } else {
        const title = variantInput.name!.trim();
        const sku = await generateVariantSku(
          product.slug,
          [],
          (candidate) => {
            if (usedSkus.has(candidate)) return Promise.resolve(true);
            return this.prisma.productVariant.findUnique({ where: { sku: candidate } }).then(Boolean);
          },
        );
        usedSkus.add(sku);
        variantMeta.push({ sku, title, povIds: [] });
      }
    }

    // POV variants: check duplicate combinations within the batch
    const seenCombos = new Set<string>();
    for (let i = 0; i < variantMeta.length; i += 1) {
      if (!variantMeta[i].povIds.length) continue;
      const key = [...variantMeta[i].povIds].sort().join(',');
      if (seenCombos.has(key)) {
        throw new BadRequestException(
          `Variant "${variantMeta[i].sku}": duplicate option combination in the same request`,
        );
      }
      seenCombos.add(key);
    }

    // POV variants: check duplicate combinations against existing variants
    if (withOptionInputs.length) {
      const existingVariants = await this.prisma.productVariant.findMany({
        where: { productId },
        include: { variantOptionValues: { select: { productOptionValueId: true } } },
      });
      for (let i = 0; i < variantMeta.length; i += 1) {
        if (!variantMeta[i].povIds.length) continue;
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
            ...(povIds.length && {
              variantOptionValues: {
                create: povIds.map((productOptionValueId) => ({ productOptionValueId })),
              },
            }),
          },
          include: VARIANT_INCLUDE,
        });

        results.push(variant);
      }

      return results;
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variants created successfully', data: created.map(serializeVariant) };
  }

  async updateBulk(productId: string, input: BulkUpdateVariantsDto): Promise<ApiResponse<any[]>> {
    await this.findProductOrThrow(productId);

    const variantIds = input.variants.map((v) => v.variantId);

    const existing = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, productId },
      include: { variantOptionValues: { select: { id: true } } },
    });

    const foundIds = new Set(existing.map((v) => v.id));
    const invalid = variantIds.filter((id) => !foundIds.has(id));
    if (invalid.length) {
      throw new NotFoundException(
        `These variant IDs were not found on this product: ${invalid.join(', ')}`,
      );
    }

    const existingMap = new Map(existing.map((v) => [v.id, v]));
    const withNameUpdate = input.variants.filter((v) => v.name !== undefined);

    if (withNameUpdate.length) {
      // Ensure only no-option variants are being renamed
      for (const v of withNameUpdate) {
        if (existingMap.get(v.variantId)!.variantOptionValues.length > 0) {
          throw new BadRequestException(
            `Variant ${v.variantId}: cannot rename a variant that has option values — title is auto-generated from the option combination`,
          );
        }
        if (!v.name!.trim()) {
          throw new BadRequestException(`Variant ${v.variantId}: name cannot be empty`);
        }
      }

      // No duplicate names within the batch
      const batchNamesLower = new Set<string>();
      for (const v of withNameUpdate) {
        const lower = v.name!.trim().toLowerCase();
        if (batchNamesLower.has(lower)) {
          throw new BadRequestException(`Duplicate variant name "${v.name!.trim()}" in the same request`);
        }
        batchNamesLower.add(lower);
      }

      // No duplicate names against existing DB rows (excluding the variants being updated)
      const updatedIds = withNameUpdate.map((v) => v.variantId);
      const existingNoOption = await this.prisma.productVariant.findMany({
        where: { productId, variantOptionValues: { none: {} }, id: { notIn: updatedIds } },
        select: { title: true },
      });
      const existingTitlesLower = new Set(existingNoOption.map((v) => v.title.toLowerCase()));
      for (const v of withNameUpdate) {
        if (existingTitlesLower.has(v.name!.trim().toLowerCase())) {
          throw new ConflictException(`A variant named "${v.name!.trim()}" already exists for this product`);
        }
      }
    }

    const updated = await this.prisma.$transaction(
      input.variants.map((v) =>
        this.prisma.productVariant.update({
          where: { id: v.variantId },
          data: {
            ...(v.name !== undefined && { title: v.name.trim() }),
            ...(v.price !== undefined && { price: v.price }),
            ...(v.compareAtPrice !== undefined && { compareAtPrice: v.compareAtPrice }),
            ...(v.isActive !== undefined && { isActive: v.isActive }),
            ...(v.weightKg !== undefined && { weightKg: v.weightKg }),
            ...(v.minQty !== undefined && { minQty: v.minQty }),
            ...(v.maxQty !== undefined && { maxQty: v.maxQty }),
          },
          include: VARIANT_INCLUDE,
        }),
      ),
    );

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variants updated successfully', data: updated.map(serializeVariant) };
  }

  async update(
    productId: string,
    variantId: string,
    input: UpdateVariantDto,
    files?: Express.Multer.File[],
  ): Promise<ApiResponse<any>> {
    await this.findVariantOrThrow(productId, variantId);

    if (files && files.length > 0) {
      if (files.length > MAX_VARIANT_IMAGES) {
        throw new BadRequestException(`Cannot upload more than ${MAX_VARIANT_IMAGES} images at once`);
      }
      files.forEach((file) => validateImageFile(file));
    }

    let title: string | undefined;
    if (input.name !== undefined) {
      const variantWithOvs = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { variantOptionValues: { select: { id: true } } },
      });
      if (variantWithOvs!.variantOptionValues.length > 0) {
        throw new BadRequestException(
          'Cannot rename a variant that has option values — title is auto-generated from the option combination',
        );
      }
      if (!input.name.trim()) {
        throw new BadRequestException('name cannot be empty');
      }
      title = input.name.trim();
      const duplicate = await this.prisma.productVariant.findFirst({
        where: {
          productId,
          title: { equals: title, mode: 'insensitive' },
          variantOptionValues: { none: {} },
          id: { not: variantId },
        },
      });
      if (duplicate) {
        throw new ConflictException(`A variant named "${title}" already exists for this product`);
      }
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(title !== undefined && { title }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.compareAtPrice !== undefined && { compareAtPrice: input.compareAtPrice }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.weightKg !== undefined && { weightKg: input.weightKg }),
        ...(input.minQty !== undefined && { minQty: input.minQty }),
        ...(input.maxQty !== undefined && { maxQty: input.maxQty }),
      },
      include: VARIANT_INCLUDE,
    });

    if (files && files.length > 0) {
      // fire-and-forget: response does not depend on image state
      (async () => {
        const existingImages = await this.prisma.variantImage.findMany({
          where: { variantId },
          orderBy: { position: 'asc' },
        });

        const deleteCount = Math.max(0, existingImages.length + files.length - MAX_VARIANT_IMAGES);
        if (deleteCount > 0) {
          await Promise.all(
            existingImages.slice(0, deleteCount).map(async (img) => {
              await this.prisma.variantImage.delete({ where: { id: img.id } });
              cleanupOrphanedS3Image(img.url, this.prisma, this.logger);
            }),
          );
        }

        const remainingCount = existingImages.length - deleteCount;
        await Promise.all(
          files.map(async (file, index) => {
            const key = buildS3ImageKey('variants', file.mimetype);
            const url = await uploadFileToAWSS3(file, key, true, true);
            return this.prisma.variantImage.create({
              data: { variantId, url, altText: null, position: remainingCount + index },
            });
          }),
        );
      })().catch((err) => this.logger.error('Variant image replacement failed', err.stack));
    }

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variant updated successfully', data: serializeVariant(updated) };
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
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { isDeleted: true, isActive: false },
    });
    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Variant deleted successfully', data: null };
  }

  async toggleStatus(productId: string, variantId: string): Promise<ApiResponse<any>> {
    const variant = await this.findVariantOrThrow(productId, variantId);
    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: !variant.isActive },
      include: VARIANT_INCLUDE,
    });
    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: `Variant ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
      data: serializeVariant(updated),
    };
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

  async uploadVariantImages(
    productId: string,
    variantId: string,
    files: Express.Multer.File[],
  ): Promise<ApiResponse<any>> {
    await this.findVariantOrThrow(productId, variantId);

    if (!files || files.length === 0) throw new BadRequestException('At least one image is required');

    files.forEach((file) => validateImageFile(file));

    const existing = await this.prisma.variantImage.count({ where: { variantId } });
    if (existing + files.length > MAX_VARIANT_IMAGES) {
      throw new BadRequestException(
        `Variant already has ${existing} image(s). Adding ${files.length} would exceed the limit of ${MAX_VARIANT_IMAGES}`,
      );
    }

    const images = await Promise.all(
      files.map(async (file, index) => {
        const key = buildS3ImageKey('variants', file.mimetype);
        const url = await uploadFileToAWSS3(file, key, true, true);
        return this.prisma.variantImage.create({
          data: { variantId, url, altText: null, position: existing + index },
        });
      }),
    );

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: `${images.length} image(s) uploaded successfully`,
      data: images,
    };
  }

  async deleteVariantImage(
    productId: string,
    variantId: string,
    imageId: string,
  ): Promise<ApiResponse<null>> {
    await this.findVariantOrThrow(productId, variantId);

    const image = await this.prisma.variantImage.findFirst({ where: { id: imageId, variantId } });
    if (!image) throw new NotFoundException('Image not found on this variant');

    await this.prisma.variantImage.delete({ where: { id: imageId } });

    cleanupOrphanedS3Image(image.url, this.prisma, this.logger);

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Image deleted successfully', data: null };
  }
}
