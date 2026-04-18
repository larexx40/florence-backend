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
import { uploadFileToAWSS3 } from 'src/common/helpers/s3.upload.helper';
import {
  buildS3ImageKey,
  cleanupOrphanedS3Image,
  validateImageFile,
} from 'src/common/helpers/image.helper';
import {
  CategoryListResponseDto,
  CategoryOptionListResponseDto,
  CategoryOptionQueryDto,
  CategoryOptionResponseDto,
  CategoryOptionWithCategoryDto,
  CategoryQueryDto,
  CategoryResponseDto,
  CategoryTreeResponseDto,
  CategoryWithOptionsListResponseDto,
  CategoryWithOptionsResponseDto,
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

  // ── Admin queries ────────────────────────────────────────────────────────────

  async getAllWithOptions(
    query: CategoryQueryDto,
  ): Promise<ApiResponse<CategoryWithOptionsListResponseDto>> {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';

    const where: Prisma.CategoryWhereInput = {
      ...(!query.includeInactive && { isActive: true }),
      ...(query.rootOnly && { parentId: null }),
      ...(query.parentId && { parentId: query.parentId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const include = {
      ...CATEGORY_INCLUDE,
      categoryOptions: { orderBy: { name: 'asc' as const } },
    };

    const orderBy = { [sortBy]: sortOrder };

    if (query.all) {
      const rows = await this.prisma.category.findMany({ where, include, orderBy });
      const total = rows.length;
      return {
        status: true,
        message: 'Categories fetched successfully',
        data: {
          categories: rows.map(toResponse) as any,
          pagination: { totalData: total, totalPages: 1, currentPage: 1, perPage: total },
        },
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include,
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
        categories: rows.map(toResponse) as any,
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  async getById(id: string): Promise<ApiResponse<CategoryWithOptionsResponseDto>> {
    const raw = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          orderBy: { name: 'asc' },
          select: SUBCATEGORY_SELECT,
        },
        _count: { select: { products: true } },
        categoryOptions: { orderBy: { name: 'asc' } },
      },
    });

    if (!raw) throw new NotFoundException('Category not found');

    return {
      status: true,
      message: 'Category fetched successfully',
      data: toResponse(raw) as any,
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
      validateImageFile(file);
      const key = buildS3ImageKey('categories', file.mimetype);
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
      validateImageFile(file);
      const key = buildS3ImageKey('categories', file.mimetype);
      resolvedImageUrl = await uploadFileToAWSS3(file, key, true, false);
      if (category.imageUrl) {
        cleanupOrphanedS3Image(category.imageUrl, this.prisma, this.logger);
      }
    } else if (input.imageUrl !== undefined) {
      resolvedImageUrl = input.imageUrl;
      if (category.imageUrl && category.imageUrl !== input.imageUrl) {
        cleanupOrphanedS3Image(category.imageUrl, this.prisma, this.logger);
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
    await this.findOrThrow(id);
    await this.prisma.category.update({ where: { id }, data: { isDeleted: true, isActive: false } });
    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/categories'));
    return { status: true, message: 'Category deleted successfully', data: null };
  }

  async toggleStatus(id: string): Promise<ApiResponse<any>> {
    const category = await this.findOrThrow(id);
    const updated = await this.prisma.category.update({
      where: { id },
      data: { isActive: !category.isActive },
      include: CATEGORY_INCLUDE,
    });
    await this.cache.invalidateByPrefix(buildInvalidationPrefix('/categories'));
    return {
      status: true,
      message: `Category ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
      data: toResponse(updated),
    };
  }

  // ── Category options ─────────────────────────────────────────────────────────

  async getAllOptions(
    query: CategoryOptionQueryDto,
  ): Promise<ApiResponse<CategoryOptionListResponseDto>> {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';

    const where: Prisma.CategoryOptionWhereInput = {
      isDeleted: false,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.isRequired !== undefined && { isRequired: query.isRequired }),
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
    };

    const orderBy = { [sortBy]: sortOrder };

    const include = { category: { select: { id: true, name: true } } };

    if (query.all) {
      const rows = await this.prisma.categoryOption.findMany({ where, include, orderBy });
      const total = rows.length;
      return {
        status: true,
        message: 'Category options fetched successfully',
        data: {
          options: rows as unknown as CategoryOptionWithCategoryDto[],
          pagination: { totalData: total, totalPages: 1, currentPage: 1, perPage: total },
        },
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.categoryOption.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.categoryOption.count({ where }),
    ]);

    return {
      status: true,
      message: 'Category options fetched successfully',
      data: {
        options: rows as unknown as CategoryOptionWithCategoryDto[],
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  async getOptions(categoryId: string): Promise<ApiResponse<CategoryOptionResponseDto[]>> {
    await this.findOrThrow(categoryId);

    const options = await this.prisma.categoryOption.findMany({
      where: { categoryId, isDeleted: false },
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
    await this.prisma.categoryOption.update({ where: { id: optionId }, data: { isDeleted: true, isActive: false } });
    return { status: true, message: 'Option deleted successfully', data: null };
  }

  async toggleOptionStatus(categoryId: string, optionId: string): Promise<ApiResponse<any>> {
    await this.findOrThrow(categoryId);
    const option = await this.findOptionOrThrow(categoryId, optionId);
    const updated = await this.prisma.categoryOption.update({
      where: { id: optionId },
      data: { isActive: !option.isActive },
    });
    return {
      status: true,
      message: `Option ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
      data: updated,
    };
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

}
