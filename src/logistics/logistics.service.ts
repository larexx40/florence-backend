import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse, PaginatedData } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import {
    AddCoverageDto,
    CreateLogisticsDto,
    LogisticsQueryDto,
    UpdateLogisticsDto,
} from './dto/logistics.dto';

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

const COMPANY_INCLUDE = {
    coverages: { include: COVERAGE_INCLUDE },
    _count: { select: { orders: true } },
} satisfies Prisma.LogisticsCompanyInclude;

@Injectable()
export class LogisticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
    ) {}

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async findOrThrow(id: string) {
        const company = await this.prisma.logisticsCompany.findUnique({ where: { id } });
        if (!company) throw new NotFoundException('Logistics company not found');
        return company;
    }

    // ── Admin: company CRUD ──────────────────────────────────────────────────────

    async getAll(query: LogisticsQueryDto): Promise<ApiResponse<{ logistics: any[]; pagination: PaginatedData }>> {
        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));

        const where: Prisma.LogisticsCompanyWhereInput = {
            ...(!query.includeInactive && { isActive: true }),
            ...(query.search && {
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { description: { contains: query.search, mode: 'insensitive' } },
                ],
            }),
        };

        const [rows, total] = await Promise.all([
            this.prisma.logisticsCompany.findMany({
                where,
                include: COMPANY_INCLUDE,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.logisticsCompany.count({ where }),
        ]);

        return {
            status: true,
            message: 'Logistics companies fetched successfully',
            data: {
                logistics: rows,
                pagination: {
                    totalData: total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page,
                    perPage: limit,
                },
            },
        };
    }

    async getById(id: string): Promise<ApiResponse<any>> {
        const company = await this.prisma.logisticsCompany.findUnique({
            where: { id },
            include: COMPANY_INCLUDE,
        });
        if (!company) throw new NotFoundException('Logistics company not found');
        return { status: true, message: 'Logistics company fetched successfully', data: company };
    }

    async create(dto: CreateLogisticsDto): Promise<ApiResponse<any>> {
        const existing = await this.prisma.logisticsCompany.findUnique({ where: { name: dto.name } });
        if (existing) throw new ConflictException(`A logistics company named "${dto.name}" already exists`);

        const company = await this.prisma.logisticsCompany.create({
            data: {
                name: dto.name,
                phone: dto.phone ?? null,
                email: dto.email ?? null,
                description: dto.description ?? null,
                logoUrl: dto.logoUrl ?? null,
            },
            include: COMPANY_INCLUDE,
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
        return { status: true, message: 'Logistics company created successfully', data: company };
    }

    async update(id: string, dto: UpdateLogisticsDto): Promise<ApiResponse<any>> {
        const company = await this.findOrThrow(id);

        if (dto.name && dto.name !== company.name) {
            const taken = await this.prisma.logisticsCompany.findFirst({
                where: { name: dto.name, id: { not: id } },
            });
            if (taken) throw new ConflictException(`A logistics company named "${dto.name}" already exists`);
        }

        const updated = await this.prisma.logisticsCompany.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.email !== undefined && { email: dto.email }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            include: COMPANY_INCLUDE,
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
        return { status: true, message: 'Logistics company updated successfully', data: updated };
    }

    async remove(id: string): Promise<ApiResponse<null>> {
        await this.findOrThrow(id);

        // soft-delete if the company has orders attached
        const hasOrders = await this.prisma.order.findFirst({ where: { logisticsId: id } });
        if (hasOrders) {
            await this.prisma.logisticsCompany.update({ where: { id }, data: { isActive: false } });
            await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
            return { status: true, message: 'Logistics company deactivated (has linked orders)', data: null };
        }

        await this.prisma.logisticsCompany.delete({ where: { id } });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
        return { status: true, message: 'Logistics company deleted successfully', data: null };
    }

    // ── Admin: coverage ──────────────────────────────────────────────────────────

    async addCoverage(companyId: string, dto: AddCoverageDto): Promise<ApiResponse<any>> {
        await this.findOrThrow(companyId);

        const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
        if (!city) throw new NotFoundException('City not found');

        if (dto.localGovernmentId) {
            const lga = await this.prisma.localGovernment.findUnique({ where: { id: dto.localGovernmentId } });
            if (!lga) throw new NotFoundException('Local government not found');
        }

        const existing = await this.prisma.logisticsCoverage.findUnique({
            where: { logisticsCompanyId_cityId: { logisticsCompanyId: companyId, cityId: dto.cityId } },
        });
        if (existing) throw new ConflictException('Coverage for this city already exists for this logistics company');

        const coverage = await this.prisma.logisticsCoverage.create({
            data: {
                logisticsCompanyId: companyId,
                cityId: dto.cityId,
                localGovernmentId: dto.localGovernmentId ?? null,
                shippingFee: dto.shippingFee ?? 0,
            },
            include: COVERAGE_INCLUDE,
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
        return { status: true, message: 'Coverage area added successfully', data: coverage };
    }

    async removeCoverage(companyId: string, coverageId: string): Promise<ApiResponse<null>> {
        await this.findOrThrow(companyId);

        const coverage = await this.prisma.logisticsCoverage.findFirst({
            where: { id: coverageId, logisticsCompanyId: companyId },
        });
        if (!coverage) throw new NotFoundException('Coverage area not found');

        await this.prisma.logisticsCoverage.delete({ where: { id: coverageId } });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
        return { status: true, message: 'Coverage area removed successfully', data: null };
    }

    // ── User/Public: fetch by city ────────────────────────────────────────────────

    async getByCity(cityId: string): Promise<ApiResponse<any[]>> {
        const city = await this.prisma.city.findUnique({
            where: { id: cityId },
            include: { state: { select: { id: true, name: true } } },
        });
        if (!city) throw new NotFoundException('City not found');

        const companies = await this.prisma.logisticsCompany.findMany({
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

        return {
            status: true,
            message: `Logistics companies available in ${city.name}, ${city.state.name}`,
            data: companies,
        };
    }
}
