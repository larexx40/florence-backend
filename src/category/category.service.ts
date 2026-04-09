import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import {
  CategoryListResponseDto,
  CategoryQueryDto,
  CategoryResponseDto,
  CategoryTreeResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
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

  async create(input: CreateCategoryDto): Promise<ApiResponse<CategoryResponseDto>> {
    const slugTaken = await this.prisma.category.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw new ConflictException(`Slug "${input.slug}" is already in use`);

    if (input.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const raw = await this.prisma.category.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
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

  async update(id: string, input: UpdateCategoryDto): Promise<ApiResponse<CategoryResponseDto>> {
    const category = await this.findOrThrow(id);

    if (input.slug && input.slug !== category.slug) {
      const slugTaken = await this.prisma.category.findFirst({
        where: { slug: input.slug, id: { not: id } },
      });
      if (slugTaken) throw new ConflictException(`Slug "${input.slug}" is already in use`);
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

    const raw = await this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
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
    return { status: true, message: 'Category deleted successfully', data: null };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

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
