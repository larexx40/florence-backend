import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { multerConfig } from 'src/common/helpers/s3.upload.helper';
import { IRequest } from 'src/common/types';
import { AuthGuard } from 'src/guards/account.guard';
import { StaffGuard } from 'src/guards/staff.guard';
import { ImageService } from './image.service';
import { LinkImageDto } from './dto/image.dto';

@ApiTags('images')
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@Controller('images')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @ApiOperation({ summary: 'Upload an image file to S3 (staff only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string', example: 'Product front view' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded and record created' })
  @ApiResponse({ status: 400, description: 'No file provided or unsupported file type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: IRequest,
    @Body('altText') altText?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.imageService.upload(file, request.user.userId, altText);
  }

  @Post('link')
  @ApiOperation({ summary: 'Link an existing S3 image URL — validates the object exists (staff only)' })
  @ApiResponse({ status: 201, description: 'Image record created or existing record returned' })
  @ApiResponse({ status: 400, description: 'Invalid URL or wrong bucket' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Staff access required' })
  @ApiResponse({ status: 404, description: 'S3 object not found at the given URL' })
  async link(@Body() dto: LinkImageDto, @Req() request: IRequest) {
    return this.imageService.link(dto, request.user.userId);
  }
}
