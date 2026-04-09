import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import { CacheService } from 'src/cache/cache.service';
import { buildInvalidationPrefix } from 'src/cache/cache-key.util';
import { City, LocalGovernment, State } from '@prisma/client';
import { CreateCityDto, CreateLgaDto, CreateStateDto } from './dto/location.dto';

@Injectable()
export class LocationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
    ) {}

    // ── States ───────────────────────────────────────────────────────────────────

    async getStates(): Promise<ApiResponse<State[]>> {
        const states = await this.prisma.state.findMany({
            orderBy: { name: 'asc' },
        });
        return { status: true, message: 'States fetched successfully', data: states };
    }

    async getState(id: string): Promise<ApiResponse<State>> {
        const state = await this.prisma.state.findUnique({ where: { id } });
        if (!state) throw new NotFoundException('State not found');
        return { status: true, message: 'State fetched successfully', data: state };
    }

    async createState(dto: CreateStateDto): Promise<ApiResponse<State>> {
        const existing = await this.prisma.state.findUnique({ where: { name: dto.name } });
        if (existing) throw new ConflictException(`State "${dto.name}" already exists`);

        const state = await this.prisma.state.create({
            data: {
                name: dto.name,
                capital: dto.capital ?? null,
                latitude: dto.latitude ?? null,
                longitude: dto.longitude ?? null,
            },
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/locations'));
        return { status: true, message: 'State created successfully', data: state };
    }

    // ── Cities ───────────────────────────────────────────────────────────────────

    async getCitiesByState(stateId: string): Promise<ApiResponse<City[]>> {
        const state = await this.prisma.state.findUnique({ where: { id: stateId } });
        if (!state) throw new NotFoundException('State not found');

        const cities = await this.prisma.city.findMany({
            where: { stateId },
            orderBy: { name: 'asc' },
        });
        return { status: true, message: 'Cities fetched successfully', data: cities };
    }

    async createCity(stateId: string, dto: CreateCityDto): Promise<ApiResponse<City>> {
        const state = await this.prisma.state.findUnique({ where: { id: stateId } });
        if (!state) throw new NotFoundException('State not found');

        const existing = await this.prisma.city.findUnique({
            where: { name_stateId: { name: dto.name, stateId } },
        });
        if (existing) throw new ConflictException(`City "${dto.name}" already exists in this state`);

        const city = await this.prisma.city.create({
            data: { name: dto.name, stateId },
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/locations'));
        return { status: true, message: 'City created successfully', data: city };
    }

    // ── Local Governments ─────────────────────────────────────────────────────────

    async getLGAsByCity(cityId: string): Promise<ApiResponse<LocalGovernment[]>> {
        const city = await this.prisma.city.findUnique({ where: { id: cityId } });
        if (!city) throw new NotFoundException('City not found');

        const lgas = await this.prisma.localGovernment.findMany({
            where: { cityId },
            orderBy: { name: 'asc' },
        });
        return { status: true, message: 'LGAs fetched successfully', data: lgas };
    }

    async createLGA(cityId: string, dto: CreateLgaDto): Promise<ApiResponse<LocalGovernment>> {
        const city = await this.prisma.city.findUnique({ where: { id: cityId } });
        if (!city) throw new NotFoundException('City not found');

        const lga = await this.prisma.localGovernment.create({
            data: { name: dto.name, cityId },
        });
        await this.cache.invalidateByPrefix(buildInvalidationPrefix('/locations'));
        return { status: true, message: 'LGA created successfully', data: lga };
    }
}
