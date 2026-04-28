import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Decimal } from '@prisma/client/runtime/library';
import { Discount, DiscountTier, PaymentMethod, Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { ApiResponse } from 'src/common/types';
import { generateOrderNumber, generatePassword } from 'src/common/helpers/helper';
import { PlaceOrderDto, ResolveShippingDto } from './dto/checkout.dto';

// ── Include shapes ────────────────────────────────────────────────────────────

const COVERAGE_INCLUDE = {
  city: {
    select: { id: true, name: true, state: { select: { id: true, name: true } } },
  },
  localGovernment: { select: { id: true, name: true } },
} satisfies Prisma.LogisticsCoverageInclude;

const VARIANT_ORDER_INCLUDE = {
  product: {
    include: {
      discount: { include: { tiers: true } },
      // needed to enforce prerequisite-variant gate at checkout
      prerequisiteVariant: { select: { id: true, sku: true } },
    },
  },
} satisfies Prisma.ProductVariantInclude;

// Product fields needed for direct-discount resolution (scalar fields included automatically)
type ProductWithDiscounts = {
  discount: (Discount & { tiers: DiscountTier[] }) | null;
  directDiscountEnabled: boolean;
  directDiscountType: 'PERCENTAGE' | 'AMOUNT' | null;
  directDiscountValue: { toNumber(): number } | null;
};

// ── Discount calculator ───────────────────────────────────────────────────────

function calcLineDiscount(
  unitPrice: Decimal,
  quantity: number,
  product: ProductWithDiscounts,
): Decimal {
  const lineTotal = unitPrice.mul(quantity);

  // Direct discount overrides campaign discount when enabled
  if (product.directDiscountEnabled && product.directDiscountType && product.directDiscountValue) {
    const value = new Decimal(product.directDiscountValue.toNumber());
    if (product.directDiscountType === 'PERCENTAGE') {
      return lineTotal.mul(value).div(100).toDecimalPlaces(2);
    }
    if (product.directDiscountType === 'AMOUNT') {
      // per-unit amount deduction, capped so line total can't go negative
      return Decimal.min(value.mul(quantity), lineTotal).toDecimalPlaces(2);
    }
  }

  const discount = product.discount;
  if (!discount || !discount.isActive) return new Decimal(0);

  const now = new Date();
  if (discount.startsAt && now < discount.startsAt) return new Decimal(0);
  if (discount.endsAt && now > discount.endsAt) return new Decimal(0);

  if (discount.type === 'FLAT_PERCENT' && discount.value) {
    return lineTotal.mul(discount.value).div(100).toDecimalPlaces(2);
  }
  if (discount.type === 'FLAT_AMOUNT' && discount.value) {
    // flat amount off the line total, capped so it can't go negative
    return Decimal.min(discount.value, lineTotal).toDecimalPlaces(2);
  }
  if (discount.type === 'TIERED_QUANTITY') {
    const tier = discount.tiers.find(
      (t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty),
    );
    if (tier) {
      return lineTotal.mul(tier.discountPercent).div(100).toDecimalPlaces(2);
    }
  }

  return new Decimal(0);
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name, { timestamp: true });

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly mailService: MailService,
  ) {}

  // ── resolve-shipping ──────────────────────────────────────────────────────────

  async resolveShipping(dto: ResolveShippingDto): Promise<ApiResponse<{
    user: { id: string; isNew: boolean } | null;
    addresses: any[];
    selected: any | null;
    logistics: any[];
  }>> {
    const { email, addressId } = dto;

    // Find or auto-create user by email
    let isNew = false;
    let user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      const tempPassword = generatePassword();
      const hashed = await bcrypt.hash(tempPassword, 10);
      const created = await this.prisma.user.create({
        data: { email, password: hashed, isProfileComplete: false, isEmailVerified: false },
        select: { id: true },
      });
      user = created;
      isNew = true;
    }

    // Addresses
    const addresses = await this.prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });

    let selected: typeof addresses[number] | null = null;
    if (addressId) {
      selected = addresses.find((a) => a.id === addressId) ?? null;
      if (!selected) throw new NotFoundException('Address not found for this user');
    } else {
      selected = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
    }

    // Logistics for selected address city
    let logistics: any[] = [];
    if (selected) {
      let cityId = selected.cityId;
      if (!cityId && selected.city && selected.state) {
        const city = await this.prisma.city.findFirst({
          where: {
            name: { equals: selected.city, mode: 'insensitive' },
            state: { name: { equals: selected.state, mode: 'insensitive' } },
          },
          select: { id: true },
        });
        cityId = city?.id ?? null;
      }
      if (cityId) {
        logistics = await this.prisma.logisticsCompany.findMany({
          where: { isActive: true, coverages: { some: { cityId } } },
          include: { coverages: { where: { cityId }, include: COVERAGE_INCLUDE } },
          orderBy: { name: 'asc' },
        });
      }
    }

    return {
      status: true,
      message: isNew
        ? 'New account created — complete profile after checkout'
        : 'Shipping options resolved successfully',
      data: { user: { id: user.id, isNew }, addresses, selected, logistics },
    };
  }

  // ── place-order ───────────────────────────────────────────────────────────────

  async placeOrder(dto: PlaceOrderDto): Promise<ApiResponse<any>> {
    const { email, paymentMethod, logisticsId, notes } = dto;

    if (!dto.addressId && !dto.address) {
      throw new BadRequestException('Provide either addressId or an inline address');
    }

    // ── 1. Find or create user ───────────────────────────────────────────────

    let user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true } });
    if (!user) {
      const tempPassword = generatePassword();
      const hashed = await bcrypt.hash(tempPassword, 10);
      user = await this.prisma.user.create({
        data: { email, password: hashed, isProfileComplete: false, isEmailVerified: false },
        select: { id: true, email: true, firstName: true },
      });
    }

    // ── 2. Resolve delivery address ──────────────────────────────────────────

    let shippingAddressId: string;

    if (dto.addressId) {
      const addr = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId: user.id } });
      if (!addr) throw new NotFoundException('Address not found for this user');
      shippingAddressId = addr.id;
    } else {
      const a = dto.address!;
      if (a.cityId) {
        const city = await this.prisma.city.findUnique({ where: { id: a.cityId } });
        if (!city) throw new NotFoundException('City not found');
      }
      // demote existing default, create new default
      await this.prisma.address.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
      const created = await this.prisma.address.create({
        data: {
          userId: user.id,
          fullName: a.fullName,
          phone: a.phone,
          addressLine1: a.addressLine1,
          addressLine2: a.addressLine2 ?? null,
          city: a.city,
          state: a.state,
          cityId: a.cityId ?? null,
          country: a.country ?? 'Nigeria',
          postalCode: a.postalCode ?? null,
          isDefault: true,
        },
      });
      shippingAddressId = created.id;
    }

    // ── 3. Validate logistics ─────────────────────────────────────────────────

    let shippingFee = new Decimal(0);

    if (paymentMethod !== PaymentMethod.CASH_ON_DELIVERY) {
      if (!logisticsId) throw new BadRequestException('logisticsId is required for delivery');

      const address = await this.prisma.address.findUnique({ where: { id: shippingAddressId } });
      const cityId = address!.cityId;

      if (!cityId) {
        throw new BadRequestException('Selected address has no city linked — cannot calculate shipping fee. Update the address with a valid cityId.');
      }

      const coverage = await this.prisma.logisticsCoverage.findUnique({
        where: { logisticsCompanyId_cityId: { logisticsCompanyId: logisticsId, cityId } },
      });
      if (!coverage) throw new NotFoundException('This logistics company does not cover the delivery city');

      shippingFee = coverage.shippingFee;
    }

    // ── 4. Validate & price items ─────────────────────────────────────────────

    if (!dto.items.length) throw new BadRequestException('Order must have at least one item');

    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: VARIANT_ORDER_INCLUDE,
    });

    // Check all requested variants were found and are active
    for (const item of dto.items) {
      const variant = variants.find((v) => v.id === item.variantId);
      if (!variant) throw new NotFoundException(`Variant ${item.variantId} not found`);
      if (!variant.isActive) throw new BadRequestException(`Variant ${item.variantId} is not available`);
      if (!variant.product.isActive) throw new BadRequestException(`Product "${variant.product.name}" is not available`);

      const { minOrderQty, orderIncrement } = variant.product;
      if (item.quantity < minOrderQty) {
        throw new BadRequestException(`Minimum order quantity for "${variant.product.name}" is ${minOrderQty}`);
      }
      if (orderIncrement && item.quantity % orderIncrement !== 0) {
        throw new BadRequestException(`Quantity for "${variant.product.name}" must be a multiple of ${orderIncrement}`);
      }
      if (variant.stockQty < item.quantity) {
        throw new BadRequestException(`Insufficient stock for variant ${item.variantId} — available: ${variant.stockQty}`);
      }

      // If the product requires a prerequisite variant, it must appear elsewhere in this order
      const prereq = variant.product.prerequisiteVariant;
      if (prereq && !variantIds.includes(prereq.id)) {
        throw new BadRequestException(
          `"${variant.product.name}" requires variant ${prereq.sku} to be included in the same order`,
        );
      }
    }

    // Build order item data with pricing
    type LineItem = {
      variantId: string;
      productId: string;
      productName: string;
      variantTitle: string;
      sku: string;
      quantity: number;
      unitPrice: Decimal;
      discountAmount: Decimal;
      lineTotal: Decimal;
    };

    const lineItems: LineItem[] = dto.items.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId)!;
      const unitPrice = variant.price;
      const discountAmount = calcLineDiscount(unitPrice, item.quantity, variant.product as ProductWithDiscounts);
      const lineTotal = unitPrice.mul(item.quantity).sub(discountAmount);

      return {
        variantId: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        variantTitle: variant.title,
        sku: variant.sku,
        quantity: item.quantity,
        unitPrice,
        discountAmount,
        lineTotal,
      };
    });

    const subtotal = lineItems.reduce((sum, l) => sum.add(l.unitPrice.mul(l.quantity)), new Decimal(0));
    const totalDiscount = lineItems.reduce((sum, l) => sum.add(l.discountAmount), new Decimal(0));
    const total = subtotal.sub(totalDiscount).add(shippingFee);

    // ── 5. Create order atomically ────────────────────────────────────────────

    const orderNumber = generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      // Decrement stock atomically for each variant
      for (const line of lineItems) {
        const updated = await tx.productVariant.updateMany({
          where: { id: line.variantId, stockQty: { gte: line.quantity } },
          data: { stockQty: { decrement: line.quantity } },
        });
        if (updated.count === 0) {
          throw new BadRequestException(`Stock changed for variant ${line.variantId} — please retry`);
        }
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId: user!.id,
          paymentMethod,
          shippingAddressId,
          logisticsId: logisticsId ?? null,
          subtotal,
          discountAmount: totalDiscount,
          shippingFee,
          storeCreditApplied: 0,
          paystackAmount: total, // updated below if store credit applied
          total,
          notes: notes ?? null,
          items: {
            create: lineItems.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              productName: l.productName,
              variantTitle: l.variantTitle,
              sku: l.sku,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: {
          items: true,
          shippingAddress: true,
          logistics: true,
        },
      });
    });

    // ── 6. Clear the user's cart ─────────────────────────────────────────────────

    await this.prisma.cartItem.deleteMany({
      where: { cart: { userId: user.id } },
    });

    // ── 7. Paystack: initialize payment (outside transaction) ─────────────────

    let paystackUrl: string | null = null;
    let accessCode: string | null = null;

    if (paymentMethod === PaymentMethod.PAYSTACK) {
      const paystackKey = process.env.PAYSTACK_SECRET_KEY;
      const paystackBase = process.env.PAYSTACK_API_BASE_URL ?? 'https://api.paystack.co';
      if (!paystackKey) throw new InternalServerErrorException('PAYSTACK_SECRET_KEY is not configured');

      try {
        const ps = await firstValueFrom(
          this.httpService
            .post<{ status: boolean; data: { authorization_url: string; access_code: string; reference: string } }>(
              `${paystackBase}/transaction/initialize`,
              {
                email,
                amount: total.mul(100).toFixed(0), // Paystack uses kobo
                reference: orderNumber,
                metadata: { orderId: order.id, orderNumber },
              },
              { headers: { Authorization: `Bearer ${paystackKey}` }, timeout: 10000 },
            )
            .pipe(
              map((r) => r.data.data),
              catchError(() => { throw new InternalServerErrorException('Paystack initialization failed'); }),
            ),
        );

        paystackUrl = ps.authorization_url;
        accessCode = ps.access_code;

        // persist the Paystack reference
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            paystackReference: ps.reference,
            paystackAccessCode: accessCode,
          },
        });
      } catch (err) {
        // Order is created; payment link failed — admin can resend manually
        this.logger.error('Paystack init failed', err);
        throw new InternalServerErrorException(
          `Order ${orderNumber} created, contact admin to generate payment link.`,
        );
      }
    }

    // ── 8. Confirmation email ─────────────────────────────────────────────────

    this.mailService.sendMail({
      to: email,
      subject: `Order Confirmed — ${orderNumber} | Everything Florence`,
      template: 'order-confirmation',
      context: {
        firstName: user.firstName ?? 'Customer',
        orderNumber,
        items: lineItems.map((l) => ({
          name: `${l.productName} (${l.variantTitle})`,
          quantity: l.quantity,
          unitPrice: Number(l.unitPrice),
          lineTotal: Number(l.lineTotal),
        })),
        subtotal: Number(subtotal),
        discount: Number(totalDiscount),
        shippingFee: Number(shippingFee),
        total: Number(total),
        paymentMethod,
        paystackUrl,
      },
    });

    return {
      status: true,
      message: `Order ${orderNumber} placed successfully`,
      data: {
        order,
        ...(paystackUrl && { paystackUrl, accessCode }),
      },
    };
  }
}
