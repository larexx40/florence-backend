import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Address } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { CreateShippingAddressDto, UpdateShippingAddressDto } from './dto/shipping-address.dto';
import { ShippingAddressResponseDto } from './dto/response.dto';

@Injectable()
export class ShippingAddressService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
    ) {}

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async findOrThrow(id: string, userId: string): Promise<Address> {
        const address = await this.prisma.address.findUnique({ where: { id } });
        if (!address) throw new NotFoundException('Shipping address not found');
        if (address.userId !== userId) throw new ForbiddenException('Access denied');
        return address;
    }

    // ── Queries ──────────────────────────────────────────────────────────────────

    async getUserShippingAddresses(userId: string): Promise<ApiResponse<ShippingAddressResponseDto[]>> {
        const addresses = await this.prisma.address.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        });
        return { status: true, message: 'Shipping addresses fetched successfully', data: addresses };
    }

    async getShippingAddress(userId: string, id: string): Promise<ApiResponse<ShippingAddressResponseDto>> {
        const address = await this.findOrThrow(id, userId);
        return { status: true, message: 'Shipping address fetched successfully', data: address };
    }

    // Looks up a user by email; returns an empty address list when the email is not found
    async getShippingAddressByUserEmail(email: string): Promise<ApiResponse<ShippingAddressResponseDto[]>> {
        const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });

        if (!user) {
            return { status: true, message: 'No user found for this email', data: [] };
        }

        const addresses = await this.prisma.address.findMany({
            where: { userId: user.id },
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        });

        return { status: true, message: 'Shipping addresses fetched successfully', data: addresses };
    }

    // ── Mutations ─────────────────────────────────────────────────────────────────

    async createShippingAddress(userId: string, dto: CreateShippingAddressDto): Promise<ApiResponse<ShippingAddressResponseDto>> {
        if (dto.cityId) {
            const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
            if (!city) throw new NotFoundException('City not found');
        }

        // new addresses are always the default — demote any existing default first
        const address = await this.prisma.$transaction(async (tx) => {
            await tx.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false },
            });

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
                    isDefault: true,
                },
            });
        });

        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/shipping-addresses', userId));
        return { status: true, message: 'Shipping address added successfully', data: address };
    }

    async updateShippingAddress(userId: string, id: string, dto: UpdateShippingAddressDto): Promise<ApiResponse<ShippingAddressResponseDto>> {
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
        const address = await this.findOrThrow(id, userId);

        await this.prisma.address.delete({ where: { id } });

        // if the deleted address was default, promote the most recent remaining one
        if (address.isDefault) {
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

    async setDefaultShippingAddress(userId: string, id: string): Promise<ApiResponse<ShippingAddressResponseDto>> {
        await this.findOrThrow(id, userId);

        const address = await this.prisma.$transaction(async (tx) => {
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
        return { status: true, message: 'Default shipping address updated successfully', data: address };
    }
}
