import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import {
  AddOptionValueDto,
  AddProductOptionDto,
  UpdateOptionValueDto,
  UpdateProductOptionDto,
} from './dto/option.dto';

@Injectable()
export class OptionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findProductOrThrow(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async findProductOptionOrThrow(productId: string, productOptionId: string) {
    const productOption = await this.prisma.productOption.findFirst({
      where: { id: productOptionId, productId },
    });
    if (!productOption) throw new NotFoundException('Option not found on this product');
    return productOption;
  }

  // ── Product options ──────────────────────────────────────────────────────────

  async getOptions(productId: string): Promise<ApiResponse<any[]>> {
    await this.findProductOrThrow(productId);

    const options = await this.prisma.productOption.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
      include: {
        option: true,
        values: { orderBy: { position: 'asc' } },
      },
    });

    return {
      status: true,
      message: 'Product options fetched successfully',
      data: options,
    };
  }

  async addOption(productId: string, input: AddProductOptionDto): Promise<ApiResponse<any>> {
    await this.findProductOrThrow(productId);

    // find-or-create the global Option by name
    const option = await this.prisma.option.upsert({
      where: { name: input.name },
      update: {},
      create: {
        name: input.name,
        displayName: input.displayName ?? input.name,
      },
    });

    const alreadyLinked = await this.prisma.productOption.findFirst({
      where: { productId, optionId: option.id },
    });
    if (alreadyLinked) {
      throw new ConflictException(`Option "${input.name}" is already added to this product`);
    }

    const productOption = await this.prisma.productOption.create({
      data: {
        productId,
        optionId: option.id,
        position: input.position ?? 0,
      },
      include: { option: true, values: true },
    });

    return {
      status: true,
      message: 'Option added to product successfully',
      data: productOption,
    };
  }

  async updateOption(
    productId: string,
    productOptionId: string,
    input: UpdateProductOptionDto,
  ): Promise<ApiResponse<any>> {
    await this.findProductOptionOrThrow(productId, productOptionId);

    const updated = await this.prisma.productOption.update({
      where: { id: productOptionId },
      data: {
        ...(input.position !== undefined && { position: input.position }),
      },
      include: { option: true, values: true },
    });

    return {
      status: true,
      message: 'Option updated successfully',
      data: updated,
    };
  }

  async removeOption(productId: string, productOptionId: string): Promise<ApiResponse<null>> {
    await this.findProductOptionOrThrow(productId, productOptionId);

    // guard: check no variants are using values from this option
    const valueIds = await this.prisma.optionValue
      .findMany({ where: { productOptionId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    if (valueIds.length) {
      const usedByVariant = await this.prisma.variantOptionValue.findFirst({
        where: { optionValueId: { in: valueIds } },
      });
      if (usedByVariant) {
        throw new BadRequestException(
          'Cannot remove option — existing variants are using its values. Delete those variants first.',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.optionValue.deleteMany({ where: { productOptionId } }),
      this.prisma.productOption.delete({ where: { id: productOptionId } }),
    ]);

    return { status: true, message: 'Option removed from product successfully', data: null };
  }

  // ── Option values ────────────────────────────────────────────────────────────

  async addValue(
    productId: string,
    productOptionId: string,
    input: AddOptionValueDto,
  ): Promise<ApiResponse<any>> {
    await this.findProductOptionOrThrow(productId, productOptionId);

    const exists = await this.prisma.optionValue.findFirst({
      where: { productOptionId, value: input.value },
    });
    if (exists) {
      throw new ConflictException(`Value "${input.value}" already exists for this option`);
    }

    const value = await this.prisma.optionValue.create({
      data: {
        productOptionId,
        value: input.value,
        displayName: input.displayName ?? null,
        position: input.position ?? 0,
      },
    });

    return {
      status: true,
      message: 'Option value added successfully',
      data: value,
    };
  }

  async updateValue(
    productId: string,
    productOptionId: string,
    valueId: string,
    input: UpdateOptionValueDto,
  ): Promise<ApiResponse<any>> {
    await this.findProductOptionOrThrow(productId, productOptionId);

    const optionValue = await this.prisma.optionValue.findFirst({
      where: { id: valueId, productOptionId },
    });
    if (!optionValue) throw new NotFoundException('Option value not found');

    const updated = await this.prisma.optionValue.update({
      where: { id: valueId },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    return {
      status: true,
      message: 'Option value updated successfully',
      data: updated,
    };
  }

  async removeValue(
    productId: string,
    productOptionId: string,
    valueId: string,
  ): Promise<ApiResponse<null>> {
    await this.findProductOptionOrThrow(productId, productOptionId);

    const optionValue = await this.prisma.optionValue.findFirst({
      where: { id: valueId, productOptionId },
    });
    if (!optionValue) throw new NotFoundException('Option value not found');

    const usedByVariant = await this.prisma.variantOptionValue.findFirst({
      where: { optionValueId: valueId },
    });
    if (usedByVariant) {
      throw new BadRequestException(
        'Cannot delete value — a variant is using it. Delete the variant first.',
      );
    }

    await this.prisma.optionValue.delete({ where: { id: valueId } });
    return { status: true, message: 'Option value deleted successfully', data: null };
  }
}
