import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { Address } from '@prisma/client';
import { CreateShippingAddressDto, UpdateShippingAddressDto } from './dto/shipping-address.dto';

@Injectable()
export class ShippingAddressService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
    ) {}

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async findOrThrow(id: string, userId: string): Promise<Address> {
        const shippingAddress = await this.prisma.address.findUnique({ where: { id } });
        if (!shippingAddress) throw new NotFoundException('Shipping address not found');
        if (shippingAddress.userId !== userId) throw new ForbiddenException('Access denied');
        return shippingAddress;
    }

    // ── Queries ──────────────────────────────────────────────────────────────────

    async getUserShippingAddresses(userId: string): Promise<ApiResponse<Address[]>> {
        const shippingAddresses = await this.prisma.address.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        });
        return { status: true, message: 'Shipping addresses fetched successfully', data: shippingAddresses };
    }

    async getShippingAddress(userId: string, id: string): Promise<ApiResponse<Address>> {
        const shippingAddress = await this.findOrThrow(id, userId);
        return { status: true, message: 'Shipping address fetched successfully', data: shippingAddress };
    }

    // ── Mutations ─────────────────────────────────────────────────────────────────

    async createShippingAddress(userId: string, dto: CreateShippingAddressDto): Promise<ApiResponse<Address>> {
        if (dto.cityId) {
            const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
            if (!city) throw new NotFoundException('City not found');
        }

        const makeDefault = dto.isDefault ?? false;

        const shippingAddress = await this.prisma.$transaction(async (tx) => {
            if (makeDefault) {
                await tx.address.updateMany({
                    where: { userId, isDefault: true },
                    data: { isDefault: false },
                });
            }

            return tx.address.create({
                data: {
                    userId,
                    fullName: dto.fullName,
                    phone: dto.phone,
                    addressLine1: dto.addressLine1,
                    addressLine2: dto.addressLine2 ?? null,
                    city: dto.city,
                    state: dto.state,
                    cityId: dto.cityId ?? null,
                    country: dto.country ?? 'Nigeria',
                    postalCode: dto.postalCode ?? null,
                    isDefault: makeDefault,
                },
            });
        });

        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/shipping-addresses', userId));
        return { status: true, message: 'Shipping address added successfully', data: shippingAddress };
    }

    async updateShippingAddress(userId: string, id: string, dto: UpdateShippingAddressDto): Promise<ApiResponse<Address>> {
        await this.findOrThrow(id, userId);

        if (dto.cityId) {
            const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
            if (!city) throw new NotFoundException('City not found');
        }

        const updated = await this.prisma.address.update({
            where: { id },
            data: {
                ...(dto.fullName !== undefined && { fullName: dto.fullName }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.addressLine1 !== undefined && { addressLine1: dto.addressLine1 }),
                ...(dto.addressLine2 !== undefined && { addressLine2: dto.addressLine2 }),
                ...(dto.city !== undefined && { city: dto.city }),
                ...(dto.state !== undefined && { state: dto.state }),
                ...(dto.cityId !== undefined && { cityId: dto.cityId }),
                ...(dto.country !== undefined && { country: dto.country }),
                ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
            },
        });

        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/shipping-addresses', userId));
        return { status: true, message: 'Shipping address updated successfully', data: updated };
    }

    async deleteShippingAddress(userId: string, id: string): Promise<ApiResponse<null>> {
        const shippingAddress = await this.findOrThrow(id, userId);

        await this.prisma.address.delete({ where: { id } });

        // if the deleted address was default, promote the most recent remaining address
        if (shippingAddress.isDefault) {
            const next = await this.prisma.address.findFirst({
                where: { userId },
                orderBy: { id: 'asc' },
            });
            if (next) {
                await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
            }
        }

        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/shipping-addresses', userId));
        return { status: true, message: 'Shipping address deleted successfully', data: null };
    }

    async setDefaultShippingAddress(userId: string, id: string): Promise<ApiResponse<Address>> {
        await this.findOrThrow(id, userId);

        const shippingAddress = await this.prisma.$transaction(async (tx) => {
            await tx.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false },
            });
            return tx.address.update({
                where: { id },
                data: { isDefault: true },
            });
        });

        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/shipping-addresses', userId));
        return { status: true, message: 'Default shipping address updated successfully', data: shippingAddress };
    }
}
