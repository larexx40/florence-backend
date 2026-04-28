import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse, PaginatedData } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { buildS3ImageKey, cleanupOrphanedS3Image, validateImageFile } from 'src/common/helpers/image.helper';
import { uploadFileToAWSS3 } from 'src/common/helpers/s3.upload.helper';
import {
    AddCoverageDto,
    CoverageQueryDto,
    CoverageSortBy,
    CreateLogisticsDto,
    LogisticsQueryDto,
    UpdateCoverageDto,
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
    private readonly logger = new Logger(LogisticsService.name);

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

    async create(dto: CreateLogisticsDto, file?: Express.Multer.File): Promise<ApiResponse<any>> {
        const existing = await this.prisma.logisticsCompany.findUnique({ where: { name: dto.name } });
        if (existing) throw new ConflictException(`A logistics company named "${dto.name}" already exists`);

        let logoUrl = dto.logoUrl ?? null;
        if (file) {
            validateImageFile(file);
            const key = buildS3ImageKey('logistics', file.mimetype);
            logoUrl = await uploadFileToAWSS3(file, key, true, false);
        }

        const company = await this.prisma.logisticsCompany.create({
            data: {
                name: dto.name,
                phone: dto.phone ?? null,
                email: dto.email ?? null,
                description: dto.description ?? null,
                logoUrl,
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

    async uploadLogo(id: string, file: Express.Multer.File): Promise<ApiResponse<any>> {
        const company = await this.findOrThrow(id);

        if (!file) throw new BadRequestException('Logo file is required');
        validateImageFile(file);

        const key = buildS3ImageKey('logistics', file.mimetype);
        const logoUrl = await uploadFileToAWSS3(file, key, true, false);

        if (company.logoUrl) {
            cleanupOrphanedS3Image(company.logoUrl, this.prisma, this.logger);
        }

        const updated = await this.prisma.logisticsCompany.update({
            where: { id },
            data: { logoUrl },
            include: COMPANY_INCLUDE,
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
        return { status: true, message: 'Logo uploaded successfully', data: updated };
    }

    async toggleStatus(id: string): Promise<ApiResponse<any>> {
        const company = await this.findOrThrow(id);
        const updated = await this.prisma.logisticsCompany.update({
            where: { id },
            data: { isActive: !company.isActive },
            include: COMPANY_INCLUDE,
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
        return {
            status: true,
            message: `Logistics company ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
            data: updated,
        };
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

    async updateCoverage(companyId: string, coverageId: string, dto: UpdateCoverageDto): Promise<ApiResponse<any>> {
        await this.findOrThrow(companyId);

        const coverage = await this.prisma.logisticsCoverage.findFirst({
            where: { id: coverageId, logisticsCompanyId: companyId },
        });
        if (!coverage) throw new NotFoundException('Coverage area not found');

        if (dto.localGovernmentId) {
            const lga = await this.prisma.localGovernment.findUnique({ where: { id: dto.localGovernmentId } });
            if (!lga) throw new NotFoundException('Local government not found');
        }

        const updated = await this.prisma.logisticsCoverage.update({
            where: { id: coverageId },
            data: {
                ...(dto.shippingFee !== undefined && { shippingFee: dto.shippingFee }),
                ...(dto.localGovernmentId !== undefined && { localGovernmentId: dto.localGovernmentId }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            include: COVERAGE_INCLUDE,
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/logistics'));
        return { status: true, message: 'Coverage area updated successfully', data: updated };
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

    // ── Coverage list (public + admin) ───────────────────────────────────────────

    async getCoverages(
        query: CoverageQueryDto,
        isAdmin: boolean,
    ): Promise<ApiResponse<{ coverages: any[]; pagination: PaginatedData }>> {
        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
        const sortOrder = query.sortOrder ?? 'asc';

        const feeFilter =
            query.minFee !== undefined || query.maxFee !== undefined
                ? {
                      ...(query.minFee !== undefined && { gte: query.minFee }),
                      ...(query.maxFee !== undefined && { lte: query.maxFee }),
                  }
                : undefined;

        const where: Prisma.LogisticsCoverageWhereInput = {
            ...(!isAdmin && { isActive: true, logisticsCompany: { isActive: true } }),
            ...(isAdmin && query.isActive !== undefined && { isActive: query.isActive }),
            ...(query.cityId && { cityId: query.cityId }),
            ...(query.stateId && { city: { stateId: query.stateId } }),
            ...(query.companyId && { logisticsCompanyId: query.companyId }),
            ...(feeFilter && { shippingFee: feeFilter }),
            ...(query.search && {
                OR: [
                    { logisticsCompany: { name: { contains: query.search, mode: 'insensitive' } } },
                    { city: { name: { contains: query.search, mode: 'insensitive' } } },
                    { city: { state: { name: { contains: query.search, mode: 'insensitive' } } } },
                ],
            }),
        };

        const orderBy: Prisma.LogisticsCoverageOrderByWithRelationInput = (() => {
            switch (query.sortBy) {
                case CoverageSortBy.SHIPPING_FEE:
                    return { shippingFee: sortOrder };
                case CoverageSortBy.COMPANY_NAME:
                    return { logisticsCompany: { name: sortOrder } };
                case CoverageSortBy.CITY_NAME:
                    return { city: { name: sortOrder } };
                case CoverageSortBy.CREATED_AT:
                default:
                    return { createdAt: sortOrder };
            }
        })();

        const [rows, total] = await Promise.all([
            this.prisma.logisticsCoverage.findMany({
                where,
                include: {
                    city: { select: { id: true, name: true, state: { select: { id: true, name: true } } } },
                    localGovernment: { select: { id: true, name: true } },
                    logisticsCompany: { select: { id: true, name: true } },
                },
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.logisticsCoverage.count({ where }),
        ]);

        const coverages = rows.map((row) => ({
            id: row.id,
            logisticsCompanyId: row.logisticsCompanyId,
            logisticsName: row.logisticsCompany.name,
            cityId: row.cityId,
            cityName: row.city.name,
            stateId: row.city.state.id,
            stateName: row.city.state.name,
            localGovernmentId: row.localGovernmentId,
            lgaName: row.localGovernment?.name ?? null,
            shippingFee: Number(row.shippingFee),
            // cast until `npx prisma generate` is run to pick up the isActive field
            isActive: (row as any).isActive as boolean,
            createdAt: row.createdAt,
        }));

        return {
            status: true,
            message: 'Coverages fetched successfully',
            data: {
                coverages,
                pagination: {
                    totalData: total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page,
                    perPage: limit,
                },
            },
        };
    }

    // ── Public: fetch by city / state ────────────────────────────────────────────

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

    async getByState(stateId: string): Promise<ApiResponse<any[]>> {
        const state = await this.prisma.state.findUnique({ where: { id: stateId } });
        if (!state) throw new NotFoundException('State not found');

        // find all city IDs in this state
        const cities = await this.prisma.city.findMany({
            where: { stateId },
            select: { id: true },
        });
        const cityIds = cities.map((c) => c.id);

        const companies = await this.prisma.logisticsCompany.findMany({
            where: {
                isActive: true,
                coverages: { some: { cityId: { in: cityIds } } },
            },
            include: {
                coverages: {
                    where: { cityId: { in: cityIds } },
                    include: COVERAGE_INCLUDE,
                },
                _count: { select: { orders: true } },
            },
            orderBy: { name: 'asc' },
        });

        return {
            status: true,
            message: `Logistics companies available in ${state.name}`,
            data: companies,
        };
    }
}
