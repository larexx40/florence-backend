import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse, PaginatedData } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { generateUniqueSlug } from 'src/common/helpers/slug.helper';
import { AttachImageDto } from 'src/image/dto/image.dto';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';

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
  category: true,
  images: {
    orderBy: { position: 'asc' as const },
  },
  productOptions: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      categoryOption: { select: { id: true, name: true } },
      values: { orderBy: { createdAt: 'asc' as const } },
    },
  },
  variants: {
    where: { isActive: true },
    include: {
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
    },
  },
// satisfies constraint removed — re-add after `npx prisma migrate dev && npx prisma generate`
} as const;

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Public queries ───────────────────────────────────────────────────────────

  async getAll(
    query: ProductQueryDto,
  ): Promise<ApiResponse<{ products: any[]; pagination: PaginatedData }>> {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.ProductWhereInput = {
      ...(!query.includeInactive && { isActive: true }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy = { [sortBy]: sortOrder };

    if (query.all) {
      const products = await this.prisma.product.findMany({
        where,
        include: PRODUCT_LIST_INCLUDE,
        orderBy,
      });
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

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_LIST_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

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

  async getBySlug(slug: string): Promise<ApiResponse<any>> {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: PRODUCT_DETAIL_INCLUDE,
    });

    if (!product) throw new NotFoundException('Product not found');

    return {
      status: true,
      message: 'Product fetched successfully',
      data: product,
    };
  }

  // ── Admin mutations ──────────────────────────────────────────────────────────

  async create(input: CreateProductDto): Promise<ApiResponse<any>> {
    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundException('Category not found');

    if (input.discountId) {
      const discount = await this.prisma.discount.findUnique({ where: { id: input.discountId } });
      if (!discount) throw new NotFoundException('Discount not found');
    }

    const slug = await generateUniqueSlug(input.name, (s) =>
      this.prisma.product.findUnique({ where: { slug: s } }).then(Boolean),
    );

    const product = await this.prisma.product.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        categoryId: input.categoryId,
        requiresVariant: input.requiresVariant ?? true,
        minOrderQty: input.minOrderQty ?? 1,
        orderIncrement: input.orderIncrement ?? null,
        prerequisiteVariantId: input.prerequisiteVariantId ?? null,
        discountId: input.discountId ?? null,
        directDiscountEnabled: input.directDiscountEnabled ?? false,
        directDiscountType: input.directDiscountType ?? null,
        directDiscountValue: input.directDiscountValue ?? null,
      },
      include: PRODUCT_DETAIL_INCLUDE,
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: 'Product created successfully',
      data: product,
    };
  }

  async update(id: string, input: UpdateProductDto): Promise<ApiResponse<any>> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    // explicit slug override: validate uniqueness
    if (input.slug && input.slug !== product.slug) {
      const slugTaken = await this.prisma.product.findFirst({
        where: { slug: input.slug, id: { not: id } },
      });
      if (slugTaken) throw new ConflictException(`Slug "${input.slug}" is already in use`);
    }

    // name changed without an explicit slug — regenerate automatically
    if (input.name && input.name !== product.name && !input.slug) {
      input.slug = await generateUniqueSlug(input.name, (s) =>
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

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.minOrderQty !== undefined && { minOrderQty: input.minOrderQty }),
        ...(input.orderIncrement !== undefined && { orderIncrement: input.orderIncrement }),
        ...(input.requiresVariant !== undefined && { requiresVariant: input.requiresVariant }),
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

    // soft-delete — preserve order history references
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return {
      status: true,
      message: 'Product deactivated successfully',
      data: null,
    };
  }

  // ── Product image management ─────────────────────────────────────────────────

  async attachImage(productId: string, dto: AttachImageDto): Promise<ApiResponse<any>> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const image = await this.prisma.productImage.create({
      data: { productId, url: dto.url, altText: dto.altText ?? null, position: dto.position ?? 0 },
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Image attached to product', data: image };
  }

  async detachImage(productId: string, imageId: string): Promise<ApiResponse<null>> {
    // imageId here is the ProductImage.id (UUID of the join record)
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException('Image is not attached to this product');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/products'));
    return { status: true, message: 'Image detached from product', data: null };
  }
}
