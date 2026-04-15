import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import {
  BulkCreateOptionsDto,
  CreateProductOptionDto,
  CreateProductOptionValueDto,
  ProductOptionResponseDto,
  ProductOptionValueResponseDto,
  UpdateProductOptionValueDto,
} from './dto/option.dto';

// ── Shared include ───────────────────────────────────────────────────────────

const OPTION_INCLUDE = {
  categoryOption: { select: { id: true, name: true } },
  values: { orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class OptionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async findProductOrThrow(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async findOptionOrThrow(productId: string, optionId: string) {
    const option = await this.prisma.productOption.findFirst({
      where: { id: optionId, productId },
    });
    if (!option) throw new NotFoundException('Option not found on this product');
    return option;
  }

  private async findValueOrThrow(optionId: string, valueId: string) {
    const value = await this.prisma.productOptionValue.findFirst({
      where: { id: valueId, productOptionId: optionId },
    });
    if (!value) throw new NotFoundException('Option value not found');
    return value;
  }

  // ── Product options ──────────────────────────────────────────────────────────

  async getProductOptions(productId: string): Promise<ApiResponse<ProductOptionResponseDto[]>> {
    await this.findProductOrThrow(productId);

    const options = await this.prisma.productOption.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      include: OPTION_INCLUDE,
    });

    return { status: true, message: 'Product options fetched successfully', data: options as any };
  }

  async addOption(
    productId: string,
    input: CreateProductOptionDto,
  ): Promise<ApiResponse<ProductOptionResponseDto>> {
    const product = await this.findProductOrThrow(productId);

    const categoryOption = await this.prisma.categoryOption.findFirst({
      where: { id: input.categoryOptionId, categoryId: product.categoryId },
    });
    if (!categoryOption) {
      throw new NotFoundException("Category option not found in this product's category");
    }

    const conflict = await this.prisma.productOption.findUnique({
      where: { productId_categoryOptionId: { productId, categoryOptionId: input.categoryOptionId } },
    });
    if (conflict) {
      throw new ConflictException(`Option "${categoryOption.name}" is already added to this product`);
    }

    const option = await this.prisma.productOption.create({
      data: { productId, categoryOptionId: input.categoryOptionId },
      include: OPTION_INCLUDE,
    });

    return { status: true, message: 'Option added to product successfully', data: option as any };
  }

  async addBulkOptions(
    productId: string,
    input: BulkCreateOptionsDto,
  ): Promise<ApiResponse<ProductOptionResponseDto[]>> {
    const product = await this.findProductOrThrow(productId);

    const categoryOptionIds = input.options.map((o) => o.categoryOptionId);

    // Reject duplicate option types in the same request
    if (new Set(categoryOptionIds).size !== categoryOptionIds.length) {
      throw new BadRequestException(
        'Duplicate categoryOptionId in request — each option type can only appear once',
      );
    }

    // All categoryOptionIds must belong to this product's category
    const categoryOptions = await this.prisma.categoryOption.findMany({
      where: { id: { in: categoryOptionIds }, categoryId: product.categoryId },
    });

    if (categoryOptions.length !== categoryOptionIds.length) {
      const foundIds = new Set(categoryOptions.map((co) => co.id));
      const missing = categoryOptionIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Category option(s) not found in this product's category: ${missing.join(', ')}`,
      );
    }

    // None of these option types may already exist on this product
    const existing = await this.prisma.productOption.findMany({
      where: { productId, categoryOptionId: { in: categoryOptionIds } },
      include: { categoryOption: { select: { name: true } } },
    });
    if (existing.length > 0) {
      const names = existing.map((e) => e.categoryOption.name).join(', ');
      throw new ConflictException(`Option(s) already added to this product: ${names}`);
    }

    // Reject duplicate values within each option
    for (const optionInput of input.options) {
      const seen = new Set<string>();
      for (const v of optionInput.values) {
        const key = v.value.toLowerCase();
        if (seen.has(key)) {
          const catOpt = categoryOptions.find((co) => co.id === optionInput.categoryOptionId);
          throw new BadRequestException(
            `Duplicate value "${v.value}" in option "${catOpt?.name}" — each value must be unique`,
          );
        }
        seen.add(key);
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const results: any[] = [];

      for (const optionInput of input.options) {
        const productOption = await tx.productOption.create({
          data: {
            productId,
            categoryOptionId: optionInput.categoryOptionId,
            values: {
              create: optionInput.values.map((v) => ({
                value: v.value,
                colorHex: v.colorHex ?? null,
              })),
            },
          },
          include: OPTION_INCLUDE,
        });

        results.push(productOption);
      }

      return results;
    });

    return { status: true, message: 'Product options added successfully', data: created };
  }

  async removeOption(productId: string, optionId: string): Promise<ApiResponse<null>> {
    await this.findProductOrThrow(productId);
    await this.findOptionOrThrow(productId, optionId);

    const inUse = await this.prisma.variantOptionValue.findFirst({
      where: { productOptionValue: { productOptionId: optionId } },
    });
    if (inUse) {
      throw new BadRequestException(
        'Cannot remove this option — one or more of its values are used by variants. Delete those variants first.',
      );
    }

    // onDelete: Cascade removes ProductOptionValues automatically
    await this.prisma.productOption.delete({ where: { id: optionId } });
    return { status: true, message: 'Option removed from product successfully', data: null };
  }

  // ── Option values ─────────────────────────────────────────────────────────────

  async addValue(
    productId: string,
    optionId: string,
    input: CreateProductOptionValueDto,
  ): Promise<ApiResponse<ProductOptionValueResponseDto>> {
    await this.findProductOrThrow(productId);
    await this.findOptionOrThrow(productId, optionId);

    const conflict = await this.prisma.productOptionValue.findUnique({
      where: { productOptionId_value: { productOptionId: optionId, value: input.value } },
    });
    if (conflict) {
      throw new ConflictException(`Value "${input.value}" already exists on this option`);
    }

    const value = await this.prisma.productOptionValue.create({
      data: {
        productOptionId: optionId,
        value: input.value,
        colorHex: input.colorHex ?? null,
      },
    });

    return { status: true, message: 'Option value added successfully', data: value };
  }

  async updateValue(
    productId: string,
    optionId: string,
    valueId: string,
    input: UpdateProductOptionValueDto,
  ): Promise<ApiResponse<ProductOptionValueResponseDto>> {
    await this.findProductOrThrow(productId);
    await this.findOptionOrThrow(productId, optionId);
    await this.findValueOrThrow(optionId, valueId);

    if (input.value) {
      const conflict = await this.prisma.productOptionValue.findFirst({
        where: { productOptionId: optionId, value: input.value, id: { not: valueId } },
      });
      if (conflict) {
        throw new ConflictException(`Value "${input.value}" already exists on this option`);
      }
    }

    const updated = await this.prisma.productOptionValue.update({
      where: { id: valueId },
      data: {
        ...(input.value !== undefined && { value: input.value }),
        ...(input.colorHex !== undefined && { colorHex: input.colorHex }),
      },
    });

    return { status: true, message: 'Option value updated successfully', data: updated };
  }

  async removeValue(
    productId: string,
    optionId: string,
    valueId: string,
  ): Promise<ApiResponse<null>> {
    await this.findProductOrThrow(productId);
    await this.findOptionOrThrow(productId, optionId);
    const existing = await this.findValueOrThrow(optionId, valueId);

    const inUse = await this.prisma.variantOptionValue.findFirst({
      where: { productOptionValueId: valueId },
    });
    if (inUse) {
      throw new BadRequestException(
        `Cannot delete "${existing.value}" — it is used by a variant. Delete the variant first.`,
      );
    }

    await this.prisma.productOptionValue.delete({ where: { id: valueId } });
    return { status: true, message: 'Option value deleted successfully', data: null };
  }
}
