import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { Cacheable } from 'src/cache/cache.decorator';
import { CacheInterceptor } from 'src/cache/cache.interceptor';
import { LogisticsService } from './logistics.service';
import {
    AddCoverageDto,
    CreateLogisticsDto,
    LogisticsQueryDto,
    UpdateLogisticsDto,
} from './dto/logistics.dto';

@ApiTags('logistics')
@Controller('logistics')
export class LogisticsController {
    constructor(private readonly logisticsService: LogisticsService) {}

    // ── Public ───────────────────────────────────────────────────────────────────

    @Get('by-city/:cityId')
    @UseInterceptors(CacheInterceptor)
    @Cacheable(3600)
    @ApiOperation({ summary: 'Get logistics companies available in a city' })
    @ApiParam({ name: 'cityId', description: 'City UUID' })
    @ApiResponse({ status: 200, description: 'Logistics companies fetched successfully' })
    @ApiResponse({ status: 404, description: 'City not found' })
    getByCity(@Param('cityId') cityId: string) {
        return this.logisticsService.getByCity(cityId);
    }

    // ── Admin: company CRUD ──────────────────────────────────────────────────────

    @Get()
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List all logistics companies (admin only)' })
    @ApiQuery({ name: 'page', required: false, example: '1' })
    @ApiQuery({ name: 'limit', required: false, example: '20' })
    @ApiQuery({ name: 'search', required: false, example: 'swift' })
    @ApiQuery({ name: 'includeInactive', required: false, example: false })
    @ApiResponse({ status: 200, description: 'Logistics companies fetched successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    getAll(@Query() query: LogisticsQueryDto) {
        return this.logisticsService.getAll(query);
    }

    @Get(':id')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get a logistics company by ID (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiResponse({ status: 200, description: 'Logistics company fetched successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'Logistics company not found' })
    getById(@Param('id') id: string) {
        return this.logisticsService.getById(id);
    }

    @Post()
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a logistics company (admin only)' })
    @ApiResponse({ status: 201, description: 'Logistics company created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 409, description: 'Company name already exists' })
    create(@Body() dto: CreateLogisticsDto) {
        return this.logisticsService.create(dto);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiResponse({ status: 200, description: 'Logistics company updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'Logistics company not found' })
    @ApiResponse({ status: 409, description: 'Company name already taken' })
    update(@Param('id') id: string, @Body() dto: UpdateLogisticsDto) {
        return this.logisticsService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete or deactivate a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiResponse({ status: 200, description: 'Logistics company deleted or deactivated' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'Logistics company not found' })
    remove(@Param('id') id: string) {
        return this.logisticsService.remove(id);
    }

    // ── Admin: coverage ──────────────────────────────────────────────────────────

    @Post(':id/coverage')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Add a coverage area to a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiResponse({ status: 201, description: 'Coverage area added successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'Logistics company or city not found' })
    @ApiResponse({ status: 409, description: 'Coverage for this city already exists' })
    addCoverage(@Param('id') id: string, @Body() dto: AddCoverageDto) {
        return this.logisticsService.addCoverage(id, dto);
    }

    @Delete(':id/coverage/:coverageId')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove a coverage area from a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiParam({ name: 'coverageId', description: 'Coverage UUID' })
    @ApiResponse({ status: 200, description: 'Coverage area removed successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'Coverage area not found' })
    removeCoverage(@Param('id') id: string, @Param('coverageId') coverageId: string) {
        return this.logisticsService.removeCoverage(id, coverageId);
    }
}
