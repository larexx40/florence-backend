import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { Cacheable } from 'src/cache/cache.decorator';
import { CacheInterceptor } from 'src/cache/cache.interceptor';
import { LocationService } from './location.service';
import { CreateCityDto, CreateLgaDto, CreateStateDto } from './dto/location.dto';
import { AdminGuard } from 'src/guards/admin.guards';

@ApiTags('locations')
@Controller('locations')
export class LocationController {
    constructor(private readonly locationService: LocationService) {}

    // ── Public: States ───────────────────────────────────────────────────────────

    @Get('states')
    @UseInterceptors(CacheInterceptor)
    @Cacheable(86400)
    @ApiOperation({ summary: 'Get all states' })
    @ApiResponse({ status: 200, description: 'States fetched successfully' })
    getStates() {
        return this.locationService.getStates();
    }

    @Get('states/:stateId')
    @UseInterceptors(CacheInterceptor)
    @Cacheable(86400)
    @ApiOperation({ summary: 'Get a single state by ID' })
    @ApiParam({ name: 'stateId', description: 'State UUID' })
    @ApiResponse({ status: 200, description: 'State fetched successfully' })
    @ApiResponse({ status: 404, description: 'State not found' })
    getState(@Param('stateId') stateId: string) {
        return this.locationService.getState(stateId);
    }

    // ── Public: Cities ───────────────────────────────────────────────────────────

    @Get('states/:stateId/cities')
    @UseInterceptors(CacheInterceptor)
    @Cacheable(86400)
    @ApiOperation({ summary: 'Get all cities in a state' })
    @ApiParam({ name: 'stateId', description: 'State UUID' })
    @ApiResponse({ status: 200, description: 'Cities fetched successfully' })
    @ApiResponse({ status: 404, description: 'State not found' })
    getCitiesByState(@Param('stateId') stateId: string) {
        return this.locationService.getCitiesByState(stateId);
    }

    // ── Public: LGAs ─────────────────────────────────────────────────────────────

    @Get('cities/:cityId/lgas')
    @UseInterceptors(CacheInterceptor)
    @Cacheable(86400)
    @ApiOperation({ summary: 'Get all LGAs in a city' })
    @ApiParam({ name: 'cityId', description: 'City UUID' })
    @ApiResponse({ status: 200, description: 'LGAs fetched successfully' })
    @ApiResponse({ status: 404, description: 'City not found' })
    getLGAsByCity(@Param('cityId') cityId: string) {
        return this.locationService.getLGAsByCity(cityId);
    }

    // ── Admin: create state ──────────────────────────────────────────────────────

    @Post('states')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new state (admin only)' })
    @ApiResponse({ status: 201, description: 'State created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 409, description: 'State already exists' })
    createState(@Body() dto: CreateStateDto) {
        return this.locationService.createState(dto);
    }

    // ── Admin: create city ───────────────────────────────────────────────────────

    @Post('states/:stateId/cities')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Add a city to a state (admin only)' })
    @ApiParam({ name: 'stateId', description: 'State UUID' })
    @ApiResponse({ status: 201, description: 'City created successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'State not found' })
    @ApiResponse({ status: 409, description: 'City already exists in this state' })
    createCity(@Param('stateId') stateId: string, @Body() dto: CreateCityDto) {
        return this.locationService.createCity(stateId, dto);
    }

    // ── Admin: create LGA ────────────────────────────────────────────────────────

    @Post('cities/:cityId/lgas')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Add an LGA to a city (admin only)' })
    @ApiParam({ name: 'cityId', description: 'City UUID' })
    @ApiResponse({ status: 201, description: 'LGA created successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'City not found' })
    createLGA(@Param('cityId') cityId: string, @Body() dto: CreateLgaDto) {
        return this.locationService.createLGA(cityId, dto);
    }
}
