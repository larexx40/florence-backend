import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse, PaginatedData } from 'src/common/types';
import { buildReceiptHtml, ReceiptOrder } from './receipt.template';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order.dto';

// ── Include shape ──────────────────────────────────────────────────────────────

const ORDER_DETAIL_INCLUDE = {
  items: true,
  shippingAddress: true,
  logistics: { select: { id: true, name: true, phone: true } },
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
} satisfies Prisma.OrderInclude;

type OrderDetail = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

@Injectable()
export class OrderService {
  // Read once at startup; base64-encode so the receipt HTML is self-contained
  private readonly logoDataUri: string = (() => {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    const buf = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  })();

  constructor(private readonly prisma: PrismaService) {}

  // ── List orders ──────────────────────────────────────────────────────────────

  async getAll(query: OrderQueryDto): Promise<ApiResponse<{ orders: OrderDetail[]; pagination: PaginatedData }>> {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.paymentStatus && { paymentStatus: query.paymentStatus }),
      ...(query.paymentMethod && { paymentMethod: query.paymentMethod }),
      ...(query.search && {
        orderNumber: { contains: query.search, mode: 'insensitive' },
      }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_DETAIL_INCLUDE,
        orderBy: { placedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      status: true,
      message: 'Orders fetched successfully',
      data: {
        orders,
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  // ── Single order ─────────────────────────────────────────────────────────────

  async getOne(id: string): Promise<ApiResponse<OrderDetail>> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return { status: true, message: 'Order fetched successfully', data: order };
  }

  // ── Update status / payment status ───────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<ApiResponse<OrderDetail>> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.paymentStatus && { paymentStatus: dto.paymentStatus }),
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    return { status: true, message: 'Order updated successfully', data: updated };
  }

  // ── Thermal receipt ───────────────────────────────────────────────────────────

  async getReceiptHtml(id: string): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');

    return buildReceiptHtml(order as ReceiptOrder, this.logoDataUri);
  }
}
