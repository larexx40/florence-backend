import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { generateUniqueSlug } from 'src/common/helpers/slug.helper';
import {
  deleteFileFromS3,
  uploadFileToAWSS3,
} from 'src/common/helpers/s3.upload.helper';
import {
  CategoryListResponseDto,
  CategoryOptionResponseDto,
  CategoryQueryDto,
  CategoryResponseDto,
  CategoryTreeResponseDto,
  CreateCategoryDto,
  CreateCategoryOptionDto,
  UpdateCategoryDto,
  UpdateCategoryOptionDto,
} from './dto/category.dto';

// ── Include shapes ───────────────────────────────────────────────────────────

const SUBCATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  imageUrl: true,
  isActive: true,
} as const;

const CATEGORY_INCLUDE = {
  children: {
    where: { isActive: true },
    select: SUBCATEGORY_SELECT,
    orderBy: { name: 'asc' as const },
  },
  _count: { select: { products: true } },
} satisfies Prisma.CategoryInclude;

// ── Mappers ──────────────────────────────────────────────────────────────────

// Renames `children` to `subcategories` on every category row
function toResponse(raw: any): CategoryResponseDto {
  const { children, ...rest } = raw;
  return { ...rest, subcategories: children ?? [] };
}

function toTreeResponse(raw: any): CategoryTreeResponseDto {
  const { children, ...rest } = raw;
  return {
    ...rest,
    subcategories: (children ?? []).map((child: any) => {
      const { children: grandchildren, ...childRest } = child;
      return { ...childRest, subcategories: (grandchildren ?? []).map(toResponse) };
    }),
  };
}

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // ── Public queries ───────────────────────────────────────────────────────────

  async getAll(
    query: CategoryQueryDto,
  ): Promise<ApiResponse<CategoryListResponseDto>> {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';

    const where: Prisma.CategoryWhereInput = {
      ...(!query.includeInactive && { isActive: true }),
      // root-only: only top-level categories (no parent)
      ...(query.rootOnly && { parentId: null }),
      ...(query.parentId && { parentId: query.parentId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy = { [sortBy]: sortOrder };

    if (query.all) {
      const rows = await this.prisma.category.findMany({
        where,
        include: CATEGORY_INCLUDE,
        orderBy,
      });
      const total = rows.length;
      return {
        status: true,
        message: 'Categories fetched successfully',
        data: {
          categories: rows.map(toResponse),
          pagination: { totalData: total, totalPages: 1, currentPage: 1, perPage: total },
        },
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: CATEGORY_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      status: true,
      message: 'Categories fetched successfully',
      data: {
        categories: rows.map(toResponse),
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  // Full nested tree: root → subcategories → sub-subcategories (3 levels)
  async getTree(): Promise<ApiResponse<CategoryTreeResponseDto[]>> {
    const rows = await this.prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            children: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              select: SUBCATEGORY_SELECT,
            },
            _count: { select: { products: true } },
          },
        },
        _count: { select: { products: true } },
      },
    });

    return {
      status: true,
      message: 'Category tree fetched successfully',
      data: rows.map(toTreeResponse),
    };
  }

  async getBySlug(slug: string): Promise<ApiResponse<CategoryResponseDto>> {
    const raw = await this.prisma.category.findFirst({
      where: { slug, isActive: true },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: SUBCATEGORY_SELECT,
        },
        _count: { select: { products: true } },
      },
    });

    if (!raw) throw new NotFoundException('Category not found');

    return {
      status: true,
      message: 'Category fetched successfully',
      data: toResponse(raw),
    };
  }

  // ── Admin mutations ──────────────────────────────────────────────────────────

  async create(
    input: CreateCategoryDto,
    file?: Express.Multer.File,
  ): Promise<ApiResponse<CategoryResponseDto>> {
    if (input.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const slug = await generateUniqueSlug(input.name, (s) =>
      this.prisma.category.findUnique({ where: { slug: s } }).then(Boolean),
    );

    let imageUrl: string | null = input.imageUrl ?? null;

    if (file) {
      this.validateImageFile(file);
      const key = this.buildCategoryS3Key(file.mimetype);
      imageUrl = await uploadFileToAWSS3(file, key, true, false);
    }

    const raw = await this.prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        imageUrl,
        parentId: input.parentId ?? null,
      },
      include: CATEGORY_INCLUDE,
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/categories'));
    return {
      status: true,
      message: 'Category created successfully',
      data: toResponse(raw),
    };
  }

  async update(
    id: string,
    input: UpdateCategoryDto,
    file?: Express.Multer.File,
  ): Promise<ApiResponse<CategoryResponseDto>> {
    const category = await this.findOrThrow(id);

    // explicit slug override: validate uniqueness
    if (input.slug && input.slug !== category.slug) {
      const slugTaken = await this.prisma.category.findFirst({
        where: { slug: input.slug, id: { not: id } },
      });
      if (slugTaken) throw new ConflictException(`Slug "${input.slug}" is already in use`);
    }

    // name changed without an explicit slug — regenerate automatically
    if (input.name && input.name !== category.name && !input.slug) {
      input.slug = await generateUniqueSlug(input.name, (s) =>
        this.prisma.category.findFirst({ where: { slug: s, id: { not: id } } }).then(Boolean),
      );
    }

    if (input.parentId) {
      if (input.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      const parent = await this.prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundException('Parent category not found');

      const isDescendant = await this.isDescendantOf(input.parentId, id);
      if (isDescendant) {
        throw new BadRequestException(
          'Cannot set a descendant category as the parent — this would create a circular reference',
        );
      }
    }

    // ── Image resolution ─────────────────────────────────────────────────────
    // file uploaded → upload to S3, delete old in background
    // imageUrl explicitly provided → use it, delete old in background if changed
    // neither → leave existing imageUrl untouched (omit from update data)
    let resolvedImageUrl: string | undefined; // undefined = keep existing

    if (file) {
      this.validateImageFile(file);
      const key = this.buildCategoryS3Key(file.mimetype);
      resolvedImageUrl = await uploadFileToAWSS3(file, key, true);
      if (category.imageUrl) {
        this.cleanupOrphanedImage(category.imageUrl);
      }
    } else if (input.imageUrl !== undefined) {
      resolvedImageUrl = input.imageUrl;
      if (category.imageUrl && category.imageUrl !== input.imageUrl) {
        this.cleanupOrphanedImage(category.imageUrl);
      }
    }

    const raw = await this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(resolvedImageUrl !== undefined && { imageUrl: resolvedImageUrl }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: CATEGORY_INCLUDE,
    });

    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/categories'));
    return {
      status: true,
      message: 'Category updated successfully',
      data: toResponse(raw),
    };
  }

  async remove(id: string): Promise<ApiResponse<null>> {
    const category = await this.findOrThrow(id);

    const hasProducts = await this.prisma.product.findFirst({ where: { categoryId: id } });
    if (hasProducts) {
      await this.prisma.category.update({ where: { id }, data: { isActive: false } });
      await this.cache.invalidateByPrefix(buildInvalidationPrefix('/categories'));
      return {
        status: true,
        message: 'Category deactivated (products are still referencing it)',
        data: null,
      };
    }

    const hasChildren = await this.prisma.category.findFirst({ where: { parentId: id } });
    if (hasChildren) {
      await this.prisma.category.update({ where: { id }, data: { isActive: false } });
      await this.cache.invalidateByPrefix(buildInvalidationPrefix('/categories'));
      return {
        status: true,
        message: 'Category deactivated (it has subcategories)',
        data: null,
      };
    }

    await this.prisma.category.delete({ where: { id } });
    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/categories'));

    // After hard delete: clean up the image from S3 if nothing else references it
    if (category.imageUrl) {
      this.cleanupOrphanedImage(category.imageUrl);
    }

    return { status: true, message: 'Category deleted successfully', data: null };
  }

  // ── Category options ─────────────────────────────────────────────────────────

  async getOptions(categoryId: string): Promise<ApiResponse<CategoryOptionResponseDto[]>> {
    await this.findOrThrow(categoryId);

    const options = await this.prisma.categoryOption.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
    });

    return { status: true, message: 'Category options fetched successfully', data: options };
  }

  async createOption(
    categoryId: string,
    input: CreateCategoryOptionDto,
  ): Promise<ApiResponse<CategoryOptionResponseDto>> {
    await this.findOrThrow(categoryId);

    const conflict = await this.prisma.categoryOption.findUnique({
      where: { categoryId_name: { categoryId, name: input.name } },
    });
    if (conflict) throw new ConflictException(`Option "${input.name}" already exists on this category`);

    const option = await this.prisma.categoryOption.create({
      data: {
        categoryId,
        name: input.name,
        isRequired: input.isRequired ?? false,
      },
    });

    return { status: true, message: 'Option created successfully', data: option };
  }

  async updateOption(
    categoryId: string,
    optionId: string,
    input: UpdateCategoryOptionDto,
  ): Promise<ApiResponse<CategoryOptionResponseDto>> {
    await this.findOrThrow(categoryId);
    await this.findOptionOrThrow(categoryId, optionId);

    if (input.name) {
      const conflict = await this.prisma.categoryOption.findFirst({
        where: { categoryId, name: input.name, id: { not: optionId } },
      });
      if (conflict) throw new ConflictException(`Option "${input.name}" already exists on this category`);
    }

    const updated = await this.prisma.categoryOption.update({
      where: { id: optionId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      },
    });

    return { status: true, message: 'Option updated successfully', data: updated };
  }

  async removeOption(categoryId: string, optionId: string): Promise<ApiResponse<null>> {
    await this.findOrThrow(categoryId);
    await this.findOptionOrThrow(categoryId, optionId);

    // Block delete if any ProductOptionValue under this option is used by a variant
    const inUse = await this.prisma.variantOptionValue.findFirst({
      where: { productOptionValue: { productOption: { categoryOptionId: optionId } } } as any,
    });
    if (inUse) {
      throw new BadRequestException(
        'Cannot delete this option — one or more of its product values are in use by variants',
      );
    }

    await this.prisma.categoryOption.delete({ where: { id: optionId } });
    return { status: true, message: 'Option deleted successfully', data: null };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async findOptionOrThrow(categoryId: string, optionId: string) {
    const option = await this.prisma.categoryOption.findFirst({
      where: { id: optionId, categoryId },
    });
    if (!option) throw new NotFoundException('Category option not found');
    return option;
  }

  // walks up the ancestry chain to detect circular references
  private async isDescendantOf(candidateId: string, ancestorId: string): Promise<boolean> {
    let currentId: string | null = candidateId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      if (currentId === ancestorId) return true;
      visited.add(currentId);

      const row = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = row?.parentId ?? null;
    }

    return false;
  }

  // ── Image helpers ────────────────────────────────────────────────────────────

  private validateImageFile(file: Express.Multer.File): void {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp, gif`,
      );
    }
  }

  private buildCategoryS3Key(mimetype: string): string {
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    const ext = mimetype.split('/')[1].replace('jpeg', 'jpg');
    return `${env}/categories/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  }

  private s3KeyFromUrl(url: string): string | null {
    const pathStyle = url.match(/^https:\/\/s3\.[^.]+\.amazonaws\.com\/[^/]+\/(.+)$/);
    if (pathStyle) return pathStyle[1];
    const virtualHosted = url.match(/^https:\/\/[^.]+\.s3(?:\.[^.]+)?\.amazonaws\.com\/(.+)$/);
    if (virtualHosted) return virtualHosted[1];
    return null;
  }

  // Fire-and-forget: delete the S3 object only if no other record still references the URL.
  // Checks categories, product images, and variant images before deleting.
  private cleanupOrphanedImage(imageUrl: string): void {
    setImmediate(async () => {
      try {
        const key = this.s3KeyFromUrl(imageUrl);
        if (!key) return; // not an S3 URL managed by this bucket

        const [categoryRef, productRef, variantRef] = await Promise.all([
          this.prisma.category.findFirst({ where: { imageUrl } }),
          this.prisma.productImage.findFirst({ where: { url: imageUrl } }),
          this.prisma.variantImage.findFirst({ where: { url: imageUrl } }),
        ]);

        if (categoryRef || productRef || variantRef) return; // still referenced elsewhere

        await deleteFileFromS3(key);
      } catch (err) {
        this.logger.warn(`Background S3 cleanup failed for "${imageUrl}": ${(err as Error).message}`);
      }
    });
  }
}
