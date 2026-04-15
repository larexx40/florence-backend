import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { multerConfig } from 'src/common/helpers/s3.upload.helper';
import { AuthGuard } from 'src/guards/account.guard';
import { AdminGuard } from 'src/guards/admin.guards';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiSecurity('x-api-key')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // ── Images ────────────────────────────────────────────────────────────────────

  @Post('image')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @ApiOperation({ summary: 'Upload a single image to S3 (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file — jpeg, png, webp, gif, max 10 MB' },
      },
    },
  })
  @ApiQuery({ name: 'watermark', required: false, type: Boolean, description: 'Apply logo watermark (default: true)' })
  @ApiResponse({ status: 201, description: 'Image uploaded — returns S3 URL' })
  @ApiResponse({ status: 400, description: 'No file, unsupported type, or size exceeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('watermark') watermark?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadImage(file, watermark !== 'false');
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
  @ApiOperation({ summary: 'Upload multiple images to S3 in one request (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Up to 10 image files — jpeg, png, webp, gif, max 10 MB each',
        },
      },
    },
  })
  @ApiQuery({ name: 'watermark', required: false, type: Boolean, description: 'Apply logo watermark to all images (default: true)' })
  @ApiResponse({ status: 201, description: 'Returns per-file results — successful and failed uploads listed separately' })
  @ApiResponse({ status: 400, description: 'No files or batch limit exceeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('watermark') watermark?: string,
  ) {
    if (!files?.length) throw new BadRequestException('No files provided');
    return this.uploadService.uploadImages(files, watermark !== 'false');
  }

  // ── Documents ─────────────────────────────────────────────────────────────────

  @Post('file')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @ApiOperation({ summary: 'Upload a single document to S3 (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Document file — pdf, doc, docx, max 20 MB' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded — returns S3 URL' })
  @ApiResponse({ status: 400, description: 'No file, unsupported type, or size exceeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadFile(file);
  }

  @Post('files')
  @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
  @ApiOperation({ summary: 'Upload multiple documents to S3 in one request (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Up to 10 document files — pdf, doc, docx, max 20 MB each',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Returns per-file results — successful and failed uploads listed separately' })
  @ApiResponse({ status: 400, description: 'No files or batch limit exceeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('No files provided');
    return this.uploadService.uploadFiles(files);
  }
}
