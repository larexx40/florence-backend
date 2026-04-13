import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiExtraModels,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
    getSchemaPath,
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
import {
    CoverageResponseDto,
    LogisticsCompanyResponseDto,
    LogisticsListResponseDto,
} from './dto/response.dto';
import { PaginatedDataDto } from 'src/common/types/response.type';

@ApiTags('logistics')
@ApiExtraModels(
    LogisticsCompanyResponseDto,
    LogisticsListResponseDto,
    CoverageResponseDto,
    PaginatedDataDto,
)
@Controller('logistics')
export class LogisticsController {
    constructor(private readonly logisticsService: LogisticsService) {}

    // ── Public ───────────────────────────────────────────────────────────────────

    @Get('by-city/:cityId')
    @UseInterceptors(CacheInterceptor)
    @Cacheable(3600)
    @ApiOperation({ summary: 'Get active logistics companies that cover a specific city' })
    @ApiParam({ name: 'cityId', description: 'City UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logistics companies available in Lagos Island, Lagos' },
                data: { type: 'array', items: { $ref: getSchemaPath(LogisticsCompanyResponseDto) } },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'City not found' })
    getByCity(@Param('cityId', ParseUUIDPipe) cityId: string) {
        return this.logisticsService.getByCity(cityId);
    }

    @Get('by-state/:stateId')
    @UseInterceptors(CacheInterceptor)
    @Cacheable(3600)
    @ApiOperation({ summary: 'Get active logistics companies that cover any city in a state' })
    @ApiParam({ name: 'stateId', description: 'State UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logistics companies available in Lagos' },
                data: { type: 'array', items: { $ref: getSchemaPath(LogisticsCompanyResponseDto) } },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'State not found' })
    getByState(@Param('stateId', ParseUUIDPipe) stateId: string) {
        return this.logisticsService.getByState(stateId);
    }

    // ── Admin: company CRUD ──────────────────────────────────────────────────────

    @Get()
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List all logistics companies with search and pagination (admin only)' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logistics companies fetched successfully' },
                data: { $ref: getSchemaPath(LogisticsListResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    getAll(@Query() query: LogisticsQueryDto) {
        return this.logisticsService.getAll(query);
    }

    @Get(':id')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get a logistics company by ID (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logistics company fetched successfully' },
                data: { $ref: getSchemaPath(LogisticsCompanyResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 404, description: 'Logistics company not found' })
    getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.logisticsService.getById(id);
    }

    @Post()
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a logistics company (admin only)' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logistics company created successfully' },
                data: { $ref: getSchemaPath(LogisticsCompanyResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 409, description: 'Company name already exists' })
    create(@Body() dto: CreateLogisticsDto) {
        return this.logisticsService.create(dto);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logistics company updated successfully' },
                data: { $ref: getSchemaPath(LogisticsCompanyResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 404, description: 'Logistics company not found' })
    @ApiResponse({ status: 409, description: 'Company name already taken' })
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLogisticsDto) {
        return this.logisticsService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete or deactivate a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logistics company deleted successfully' },
                data: { type: 'object', nullable: true, example: null },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 404, description: 'Logistics company not found' })
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.logisticsService.remove(id);
    }

    // ── Admin: coverage ──────────────────────────────────────────────────────────

    @Post(':id/coverage')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Add a coverage area to a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Coverage area added successfully' },
                data: { $ref: getSchemaPath(CoverageResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 404, description: 'Logistics company, city, or LGA not found' })
    @ApiResponse({ status: 409, description: 'Coverage for this city already exists' })
    addCoverage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddCoverageDto) {
        return this.logisticsService.addCoverage(id, dto);
    }

    @Delete(':id/coverage/:coverageId')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove a coverage area from a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiParam({ name: 'coverageId', description: 'Coverage UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Coverage area removed successfully' },
                data: { type: 'object', nullable: true, example: null },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 404, description: 'Coverage area not found' })
    removeCoverage(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('coverageId', ParseUUIDPipe) coverageId: string,
    ) {
        return this.logisticsService.removeCoverage(id, coverageId);
    }
}
