import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DirectDiscountType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse, PaginatedData } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { generateUniqueSlug } from 'src/common/helpers/slug.helper';
import { generateSku } from './helpers/sku.helper';
import { buildS3ImageKey, cleanupOrphanedS3Image, validateImageFile } from 'src/common/helpers/image.helper';
import { uploadFileToAWSS3 } from 'src/common/helpers/s3.upload.helper';
import { AttachImageDto } from 'src/image/dto/image.dto';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';

// ── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProductDetailResponse(product: any) {
  const options = product.productOptions.map((opt: any) => ({
    id: opt.id,
    name: opt.categoryOption.name,
    values: opt.values.map((v: any) => ({
      id: v.id,
      value: v.value,
      colorHex: v.colorHex ?? null,
    })),
  }));

  const prices = product.variants.map((v: any) => Number(v.price));

  const variants = product.variants.map((v: any) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    price: Number(v.price),
    compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
    stockQty: v.stockQty,
    isActive: v.isActive,
    minQty: v.minQty ?? null,
    maxQty: v.maxQty ?? null,
    weightKg: v.weightKg != null ? Number(v.weightKg) : null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    combination: v.variantOptionValues.map((vov: any) => ({
      optionName: vov.productOptionValue.productOption.categoryOption.name,
      value: vov.productOptionValue.value,
      colorHex: vov.productOptionValue.colorHex ?? null,
    })),
    images: v.images,
  }));

  const { productOptions, variants: _raw, ...rest } = product;
  void productOptions;

  return {
    ...rest,
    options,
    variants,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
  };
}

function withPriceRange<T extends { variants: { price: { toNumber(): number } | number }[] }>(product: T) {
  const prices = product.variants.map((v) => Number(v.price));
  return {
    ...product,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
  };
}

// ── Shared include shapes ────────────────────────────────────────────────────

const PRODUCT_LIST_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  images: {
    orderBy: { position: 'asc' as const },
    take: 1,
  },
  variants: {
    where: { isActive: true },
    select: { price: true, stockQty: true },
  },
} satisfies Prisma.ProductInclude;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRODUCT_DETAIL_INCLUDE: any = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      parentId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  images: {
    select: { id: true, url: true, altText: true, position: true, createdAt: true },
    orderBy: { position: 'asc' as const },
  },
  productOptions: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      categoryOption: { select: { id: true, name: true } },
      values: {
        orderBy: { createdAt: 'asc' as const },
        select: { id: true, value: true, colorHex: true },
      },
    },
  },
  variants: {
    where: { isActive: true },
    select: {
      id: true,
      sku: true,
      title: true,
      price: true,
      compareAtPrice: true,
      stockQty: true,
      isActive: true,
      minQty: true,
      maxQty: true,
      weightKg: true,
      createdAt: true,
      updatedAt: true,
      variantOptionValues: {
        select: {
          productOptionValue: {
            select: {
              value: true,
              colorHex: true,
              productOption: {
                select: {
                  categoryOption: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      images: {
        orderBy: { position: 'asc' as const },
        select: { id: true, url: true, altText: true, position: true, createdAt: true },
      },
    },
  },
};

const MAX_PRODUCT_IMAGES = 5;

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Validation helpers ───────────────────────────────────────────────────────

  private validateDirectDiscount(
    type: DirectDiscountType | undefined | null,
    value: string | number | undefined | null,
    price?: number,
  ): void {
    if (value == null || type == null) return;
    const numeric = Number(value);
    if (type === DirectDiscountType.PERCENTAGE && numeric > 100) {
      throw new BadRequestException('Discount value cannot exceed 100 for a percentage discount');
    }
    if (type === DirectDiscountType.AMOUNT && price !== undefined && numeric > price) {
      throw new BadRequestException('Discount value cannot exceed the product price');
    }
  }

  // ── Public queries ───────────────────────────────────────────────────────────

  async getAll(
    query: ProductQueryDto,
  ): Promise<ApiResponse<{ products: any[]; pagination: PaginatedData }>> {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.ProductWhereInput = {
      isDeleted: false,
      ...(!query.includeInactive && { isActive: true }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.categorySlug && { category: { slug: query.categorySlug } }),
      ...(query.featured && { isFeatured: true }),
      ...(query.bestSelling && { isBestSeller: true }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    // price sort requires in-memory sort since prices live on variants
    if (sortBy === 'price') {
      const allRaw = await this.prisma.product.findMany({
        where,
        include: PRODUCT_LIST_INCLUDE,
      });
      const sorted = allRaw
        .map(withPriceRange)
        .sort((a, b) => {
          const aPrice = a.minPrice ?? (sortOrder === 'asc' ? Infinity : -Infinity);
          const bPrice = b.minPrice ?? (sortOrder === 'asc' ? Infinity : -Infinity);
          return sortOrder === 'asc' ? aPrice - bPrice : bPrice - aPrice;
        });

      const total = sorted.length;
      const products = query.all ? sorted : sorted.slice((page - 1) * limit, page * limit);
      return {
        status: true,
        message: 'Products fetched successfully',
        data: {
          products,
          pagination: {
            totalData: total,
            totalPages: query.all ? 1 : Math.ceil(total / limit),
            currentPage: query.all ? 1 : page,
            perPage: query.all ? total : limit,
          },
        },
      };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput;
    if (sortBy === 'featured') {
      orderBy = { isFeatured: 'desc' };
    } else if (sortBy === 'bestSelling') {
      orderBy = { isBestSeller: 'desc' };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    if (query.all) {
      const raw = await this.prisma.product.findMany({
        where,
        include: PRODUCT_LIST_INCLUDE,
        orderBy,
      });
      const products = raw.map(withPriceRange);
      const total = products.length;
      return {
        status: true,
        message: 'Products fetched successfully',
        data: {
          products,
          pagination: { totalData: total, totalPages: 1, currentPage: 1, perPage: total },
        },
      };
    }

    const [raw, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_LIST_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    const products = raw.map(withPriceRange);

    return {
      status: true,
      message: 'Products fetched successfully',
      data: {
        products,
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  async getOne(idOrSlug: string): Promise<ApiResponse<any>> {
    const product = await this.prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: PRODUCT_DETAIL_INCLUDE,
    });

    if (!product) throw new NotFoundException('Product not found');

    return {
      status: true,
      message: 'Product fetched successfully',
      data: toProductDetailResponse(product),
    };
  }

  // ── Admin mutations ──────────────────────────────────────────────────────────

  async getProductConfig(): Promise<ApiResponse<any>> {
    const MAX_UPLOAD_SIZE_MB = 5;
    const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_PRODUCT_IMAGES = 5;
    const MAX_VARIANTS_PER_PRODUCT = 100;
    const MAX_OPTIONS_PER_CATEGORY = 10;
    const MAX_VALUES_PER_OPTION = 50;
    const MAX_VARIANT_IMAGES = 2;

    return{
      status: true,
      message: 'Product configuration fetched successfully',
      data: {
        maxUploadSizeMB: MAX_UPLOAD_SIZE_MB,
        maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
        allowedImageTypes: ALLOWED_IMAGE_TYPES,
        maxProductImages: MAX_PRODUCT_IMAGES,
        maxVariantsPerProduct: MAX_VARIANTS_PER_PRODUCT,
        maxOptionsPerCategory: MAX_OPTIONS_PER_CATEGORY,
        maxValuesPerOption: MAX_VALUES_PER_OPTION,
        maxVariantImages: MAX_VARIANT_IMAGES,
      }
    }
  }
  async create(
    input: CreateProductDto,
    files?: Express.Multer.File[]
  ): Promise<ApiResponse<any>> {
    const hasVariant = input.hasVariant ?? true;

    if (!hasVariant && (input.price === undefined || input.price === null)) {
      throw new BadRequestException('price is required when product has no variants');
    }

    this.validateDirectDiscount(
      input.directDiscountType,
      input.directDiscountValue,
      !hasVariant ? input.price : undefined,
    );

    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundException('Category not found');


    if (files && files.length > 0) {
      if (files.length > MAX_PRODUCT_IMAGES) {
        throw new BadRequestException(`Cannot attach more than ${MAX_PRODUCT_IMAGES} images to a product`);
      }
      files.forEach((file) => validateImageFile(file));
    }

    const slug = await generateUniqueSlug(input.name, (s) =>
      this.prisma.product.findUnique({ where: { slug: s } }).then(Boolean),
    );

    let defaultVariantSku: string | undefined;
    if (!hasVariant) {
      defaultVariantSku = await this.generateDefaultVariantSku(category.name, input.name);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          categoryId: input.categoryId,
          requiresVariant: hasVariant,
          minOrderQty: input.minOrderQty ?? 1,
          orderIncrement: input.orderIncrement ?? null,
          directDiscountEnabled: input.directDiscountEnabled ?? false,
          directDiscountType: input.directDiscountType ?? null,
          directDiscountValue: input.directDiscountValue ?? null,
        },
        include: PRODUCT_DETAIL_INCLUDE,
      });

      if (!hasVariant) {
        await tx.productVariant.create({
          data: {
            productId: created.id,
            sku: defaultVariantSku!,
            title: 'Default',
            price: input.price!,
            stockQty: input.quantity ?? 0,
          },
        });
      }

      return created;
    });

    const images = files ? await Promise.all(
      files.map(async (file, index) => {
        const key = buildS3ImageKey('products', file.mimetype);
        const url = await uploadFileToAWSS3(file, key, true, true); // optimize + watermark
        return this.prisma.productImage.create({
          data: {
            productId: product.id,
            url, altText: null,
            position: index
          },
        });
      }),
    ) : [];

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: 'Product created successfully',
      data: { ...product, images },
    };
  }

  private async generateDefaultVariantSku(categoryName: string, productName: string): Promise<string> {
    const base = generateSku({ categoryName, productName, options: [] });
    const exists = await this.prisma.productVariant.findUnique({ where: { sku: base } });
    if (!exists) return base;

    for (let i = 2; i <= 99; i++) {
      const candidate = `${base}-${i}`;
      const found = await this.prisma.productVariant.findUnique({ where: { sku: candidate } });
      if (!found) return candidate;
    }
    throw new ConflictException('Could not generate a unique SKU for this product variant');
  }

  async update(id: string, input: UpdateProductDto, files?: Express.Multer.File[]): Promise<ApiResponse<any>> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    if (input.directDiscountValue != null && input.directDiscountType != null) {
      let minVariantPrice: number | undefined;
      if (input.directDiscountType === DirectDiscountType.AMOUNT) {
        const cheapest = await this.prisma.productVariant.findFirst({
          where: { productId: id, isActive: true },
          orderBy: { price: 'asc' },
          select: { price: true },
        });
        minVariantPrice = cheapest ? Number(cheapest.price) : undefined;
      }
      this.validateDirectDiscount(input.directDiscountType, input.directDiscountValue, minVariantPrice);
    }

    // name changed without an explicit slug — regenerate automatically
    let slug: string | undefined;
    if (input.name && input.name !== product.name) {
      slug = await generateUniqueSlug(input.name, (s) =>
        this.prisma.product.findFirst({ where: { slug: s, id: { not: id } } }).then(Boolean),
      );
    }

    if (input.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new NotFoundException('Category not found');
    }

    if (input.discountId) {
      const discount = await this.prisma.discount.findUnique({ where: { id: input.discountId } });
      if (!discount) throw new NotFoundException('Discount not found');
    }

    if (files && files.length > 0) {
      files.forEach((file) => validateImageFile(file));
      const existing = await this.prisma.productImage.count({ where: { productId: id } });
      if (existing + files.length > MAX_PRODUCT_IMAGES) {
        throw new BadRequestException(
          `Product already has ${existing} image(s). Adding ${files.length} would exceed the limit of ${MAX_PRODUCT_IMAGES}`,
        );
      }
      await Promise.all(
        files.map(async (file, index) => {
          const key = buildS3ImageKey('products', file.mimetype);
          const url = await uploadFileToAWSS3(file, key, true, true);
          return this.prisma.productImage.create({
            data: { productId: id, url, altText: null, position: existing + index },
          });
        }),
      );
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...((slug !== undefined) && { slug: slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.minOrderQty !== undefined && { minOrderQty: input.minOrderQty }),
        ...(input.orderIncrement !== undefined && { orderIncrement: input.orderIncrement }),
        ...(input.hasVariant !== undefined && { requiresVariant: input.hasVariant }),
        ...(input.prerequisiteVariantId !== undefined && {
          prerequisiteVariantId: input.prerequisiteVariantId,
        }),
        ...(input.discountId !== undefined && { discountId: input.discountId }),
        ...(input.directDiscountEnabled !== undefined && { directDiscountEnabled: input.directDiscountEnabled }),
        ...(input.directDiscountType !== undefined && { directDiscountType: input.directDiscountType }),
        ...(input.directDiscountValue !== undefined && { directDiscountValue: input.directDiscountValue }),
      },
      include: PRODUCT_DETAIL_INCLUDE,
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: 'Product updated successfully',
      data: updated,
    };
  }

  async remove(id: string): Promise<ApiResponse<null>> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({ where: { id }, data: { isDeleted: true, isActive: false } });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Product deleted successfully', data: null };
  }

  async toggleStatus(id: string): Promise<ApiResponse<null>> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({ where: { id }, data: { isActive: !product.isActive } });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: `Product ${!product.isActive ? 'enabled' : 'disabled'} successfully`,
      data: null,
    };
  }

  // ── Product image management ─────────────────────────────────────────────────

  async uploadProductImages(
    productId: string,
    files: Express.Multer.File[],
  ): Promise<ApiResponse<any>> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    if (!files || files.length === 0) throw new BadRequestException('At least one image is required');

    // validate all files before touching S3
    files.forEach((file) => validateImageFile(file));

    const existing = await this.prisma.productImage.count({ where: { productId } });
    if (existing + files.length > MAX_PRODUCT_IMAGES) {
      throw new BadRequestException(
        `Product already has ${existing} image(s). Adding ${files.length} would exceed the limit of ${MAX_PRODUCT_IMAGES}`,
      );
    }

    const images = await Promise.all(
      files.map(async (file, index) => {
        const key = buildS3ImageKey('products', file.mimetype);
        const url = await uploadFileToAWSS3(file, key, true, true); // optimize + watermark
        return this.prisma.productImage.create({
          data: { productId, url, altText: null, position: existing + index },
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

  async attachImage(productId: string, dto: AttachImageDto): Promise<ApiResponse<any>> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const image = await this.prisma.productImage.create({
      data: { productId, url: dto.url, altText: dto.altText ?? null, position: dto.position ?? 0 },
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Image attached to product', data: image };
  }

  async deleteProductImage(productId: string, imageId: string): Promise<ApiResponse<null>> {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException('Image not found on this product');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    // fire-and-forget: only deletes from S3 if no other DB record still references the URL
    cleanupOrphanedS3Image(image.url, this.prisma, this.logger);

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Image deleted successfully', data: null };
  }
}
