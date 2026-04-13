import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import { ResolveShippingDto } from './dto/checkout.dto';

// ── Include shapes ────────────────────────────────────────────────────────────

const COVERAGE_INCLUDE = {
  city: {
    select: {
      id: true,
      name: true,
      state: { select: { id: true, name: true } },
    },
  },
  localGovernment: { select: { id: true, name: true } },
} satisfies Prisma.LogisticsCoverageInclude;

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves shipping options for checkout:
   *  1. Looks up user by email — returns empty addresses if not found.
   *  2. Picks the selected or default address.
   *  3. Uses that address's cityId (or falls back to city name lookup) to fetch
   *     active logistics companies and their shipping fees.
   *
   * Response shape:
   *   addresses   – all saved addresses for this email (empty [] if unknown email)
   *   selected    – the address that will be used for delivery (null if none)
   *   logistics   – logistics companies covering the selected address's city ([] if no cityId)
   */
  async resolveShipping(dto: ResolveShippingDto): Promise<ApiResponse<{
    addresses: any[];
    selected: any | null;
    logistics: any[];
  }>> {
    const { email, addressId } = dto;

    // ── 1. User lookup ───────────────────────────────────────────────────────

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return {
        status: true,
        message: 'No account found for this email — guest checkout or new address required',
        data: { addresses: [], selected: null, logistics: [] },
      };
    }

    // ── 2. Addresses ─────────────────────────────────────────────────────────

    const addresses = await this.prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });

    // Resolve the target address: explicit pick → default → first available
    let selected: typeof addresses[number] | null = null;

    if (addressId) {
      selected = addresses.find((a) => a.id === addressId) ?? null;
      if (!selected) throw new NotFoundException('Address not found for this user');
    } else {
      selected = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
    }

    // ── 3. Logistics lookup ──────────────────────────────────────────────────

    let logistics: any[] = [];

    if (selected) {
      let cityId = selected.cityId;

      // If address has no cityId, try to resolve by city name + state name
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
          where: {
            isActive: true,
            coverages: { some: { cityId } },
          },
          include: {
            coverages: {
              where: { cityId },
              include: COVERAGE_INCLUDE,
            },
          },
          orderBy: { name: 'asc' },
        });
      }
    }

    return {
      status: true,
      message: 'Shipping options resolved successfully',
      data: { addresses, selected, logistics },
    };
  }
}
