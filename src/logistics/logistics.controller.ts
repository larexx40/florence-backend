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
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiSecurity,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { OptionalAuthGuard } from 'src/guards/optional-auth.guard';
import { Cacheable } from 'src/cache/cache.decorator';
import { CacheInterceptor } from 'src/cache/cache.interceptor';
import { UploadFile, filePipe } from 'src/common/helpers/file-upload.helper';
import { LogisticsService } from './logistics.service';
import {
    AddCoverageDto,
    CoverageQueryDto,
    CreateLogisticsDto,
    LogisticsQueryDto,
    UpdateCoverageDto,
    UpdateLogisticsDto,
} from './dto/logistics.dto';
import {
    CoverageFlatResponseDto,
    CoverageListResponseDto,
    CoverageResponseDto,
    LogisticsCompanyResponseDto,
    LogisticsListResponseDto,
} from './dto/response.dto';
import { PaginatedDataDto } from 'src/common/types/response.type';

@ApiTags('logistics')
@ApiSecurity('x-api-key')
@ApiExtraModels(
    LogisticsCompanyResponseDto,
    LogisticsListResponseDto,
    CoverageResponseDto,
    CoverageFlatResponseDto,
    CoverageListResponseDto,
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

    @Get('coverages')
    @UseGuards(OptionalAuthGuard)
    @ApiOperation({
        summary: 'List all coverage areas with search, sort, filter, and pagination',
        description:
            'Public / customers: returns only active coverages for active logistics companies. ' +
            'Admins (Bearer token required): returns all coverages and can filter by `isActive`.',
    })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Coverages fetched successfully' },
                data: { $ref: getSchemaPath(CoverageListResponseDto) },
            },
        },
    })
    getCoverages(@Query() query: CoverageQueryDto, @Req() req: any) {
        const isAdmin =
            req.user?.role === Role.ADMIN || req.user?.role === Role.SUPER_ADMIN;
        return this.logisticsService.getCoverages(query, isAdmin);
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
    @UploadFile('logo')
    @ApiOperation({ summary: 'Create a logistics company (admin only) — optionally upload a logo file or pass logoUrl' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['name'],
            properties: {
                logo: { type: 'string', format: 'binary', description: 'Logo image (jpeg/png/webp, max 10 MB). Omit to pass logoUrl instead.' },
                name: { type: 'string', example: 'Swift Logistics' },
                phone: { type: 'string', example: '+2348012345678' },
                email: { type: 'string', example: 'hello@swiftlogistics.ng' },
                description: { type: 'string', example: 'Reliable next-day delivery across Lagos' },
                logoUrl: { type: 'string', example: 'https://cdn.example.com/logo.png', description: 'Use this when not uploading a file' },
            },
        },
    })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logistics company created successfully' },
                data: { $ref: getSchemaPath(LogisticsCompanyResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input or unsupported image type' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 409, description: 'Company name already exists' })
    create(
        @UploadedFile(filePipe()) file: Express.Multer.File | undefined,
        @Body() dto: CreateLogisticsDto,
    ) {
        return this.logisticsService.create(dto, file);
    }

    @Post(':id/logo')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @UploadFile('logo')
    @ApiOperation({ summary: 'Upload or replace the logo for a logistics company (admin only) — deletes existing logo from S3' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['logo'],
            properties: {
                logo: { type: 'string', format: 'binary', description: 'Logo image (jpeg/png/webp, max 10 MB)' },
            },
        },
    })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Logo uploaded successfully' },
                data: { $ref: getSchemaPath(LogisticsCompanyResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'No file provided or unsupported image type' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 404, description: 'Logistics company not found' })
    uploadLogo(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFile(filePipe()) file: Express.Multer.File,
    ) {
        return this.logisticsService.uploadLogo(id, file);
    }

    @Patch(':id/toggle')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Enable or disable a logistics company (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiResponse({ status: 200, description: 'Company enabled or disabled' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 404, description: 'Logistics company not found' })
    toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
        return this.logisticsService.toggleStatus(id);
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

    @Patch(':id/coverage/:coverageId')
    @UseGuards(AuthGuard, AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update the shipping fee or LGA for a coverage area (admin only)' })
    @ApiParam({ name: 'id', description: 'Logistics company UUID' })
    @ApiParam({ name: 'coverageId', description: 'Coverage UUID' })
    @ApiOkResponse({
        schema: {
            properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Coverage area updated successfully' },
                data: { $ref: getSchemaPath(CoverageResponseDto) },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 404, description: 'Coverage area or LGA not found' })
    updateCoverage(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('coverageId', ParseUUIDPipe) coverageId: string,
        @Body() dto: UpdateCoverageDto,
    ) {
        return this.logisticsService.updateCoverage(id, coverageId, dto);
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
