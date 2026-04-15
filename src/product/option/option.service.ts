import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import {
  CreateProductOptionDto,
  CreateProductOptionValueDto,
  ProductOptionResponseDto,
  ProductOptionValueResponseDto,
  UpdateProductOptionDto,
  UpdateProductOptionValueDto,
} from './dto/option.dto';

// ── Shared include ───────────────────────────────────────────────────────────

const OPTION_INCLUDE = {
  categoryOption: { select: { id: true, name: true, position: true } },
  values: { orderBy: { position: 'asc' as const } },
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
      orderBy: { position: 'asc' },
      include: OPTION_INCLUDE,
    });

    return { status: true, message: 'Product options fetched successfully', data: options as any };
  }

  async addOption(
    productId: string,
    input: CreateProductOptionDto,
  ): Promise<ApiResponse<ProductOptionResponseDto>> {
    const product = await this.findProductOrThrow(productId);

    // Confirm the CategoryOption belongs to this product's category
    const categoryOption = await this.prisma.categoryOption.findFirst({
      where: { id: input.categoryOptionId, categoryId: product.categoryId },
    });
    if (!categoryOption) {
      throw new NotFoundException('Category option not found in this product\'s category');
    }

    const conflict = await this.prisma.productOption.findUnique({
      where: { productId_categoryOptionId: { productId, categoryOptionId: input.categoryOptionId } },
    });
    if (conflict) {
      throw new ConflictException(`Option "${categoryOption.name}" is already added to this product`);
    }

    const option = await this.prisma.productOption.create({
      data: {
        productId,
        categoryOptionId: input.categoryOptionId,
        position: input.position ?? 0,
      },
      include: OPTION_INCLUDE,
    });

    return { status: true, message: 'Option added to product successfully', data: option as any };
  }

  async updateOption(
    productId: string,
    optionId: string,
    input: UpdateProductOptionDto,
  ): Promise<ApiResponse<ProductOptionResponseDto>> {
    await this.findProductOrThrow(productId);
    await this.findOptionOrThrow(productId, optionId);

    const updated = await this.prisma.productOption.update({
      where: { id: optionId },
      data: {
        ...(input.position !== undefined && { position: input.position }),
      },
      include: OPTION_INCLUDE,
    });

    return { status: true, message: 'Option updated successfully', data: updated as any };
  }

  async removeOption(productId: string, optionId: string): Promise<ApiResponse<null>> {
    await this.findProductOrThrow(productId);
    await this.findOptionOrThrow(productId, optionId);

    // Block delete if any value under this option is used by a variant
    const inUse = await this.prisma.variantOptionValue.findFirst({
      where: { productOptionValue: { productOptionId: optionId } },
    });
    if (inUse) {
      throw new BadRequestException(
        'Cannot remove this option — one or more of its values are used by variants. Delete those variants first.',
      );
    }

    // Cascade deletes ProductOptionValues automatically (schema: onDelete: Cascade)
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
        displayName: input.displayName ?? null,
        colorHex: input.colorHex ?? null,
        position: input.position ?? 0,
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
        where: {
          productOptionId: optionId,
          value: input.value,
          id: { not: valueId },
        },
      });
      if (conflict) {
        throw new ConflictException(`Value "${input.value}" already exists on this option`);
      }
    }

    const updated = await this.prisma.productOptionValue.update({
      where: { id: valueId },
      data: {
        ...(input.value !== undefined && { value: input.value }),
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.colorHex !== undefined && { colorHex: input.colorHex }),
        ...(input.position !== undefined && { position: input.position }),
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
