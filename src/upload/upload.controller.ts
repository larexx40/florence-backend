import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
  ParseFilePipeBuilder,
  HttpStatus,
  UseGuards,
  Req
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ImageType } from 'src/common/constants/enum';
import { AuthGuard } from 'src/guards/account.guard';
import { IRequest } from 'src/common/types';

@Controller('v1/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) { }

  @Post('image')
  @ApiOperation({ summary: 'Upload an image to S3 (Merchant)' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imageType: { type: 'string', example: ImageType.USER },
        image: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['imageType', 'image'],
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpeg|jpg|png|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
          message: 'Image cannot be greater than 5MB',
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @Body('type') type: string,
    @Req() request: IRequest,
  ) {
    try {
      console.log("File received: ", file?.originalname);
      console.log("ImageType: ", type);
      console.log("ID: ", request.user?.userId);

      // Check if file exists
      if (!file) {
        throw new BadRequestException('Image file is required');
      }

      // Check if imageType exists
      if (!type) {
        throw new BadRequestException('image type is required');
      }

      // Validate imageType enum
      if (!Object.values(ImageType).includes(type as ImageType)) {
        throw new BadRequestException(
          `imageType must be one of: ${Object.values(ImageType).join(', ')}`
        );
      }

      // Create a file object for the upload service
      const fileObj = {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };

      return this.uploadService.addImage(type as ImageType, fileObj);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error processing file upload: ' + error.message);
    }
  }

  @Post('file')
  @ApiOperation({ summary: 'Upload a PDF or Word document to S3 (Merchant)' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fileType: {
          type: 'string',
          example: 'documents',
          description: 'Category/folder name for the file (e.g., documents, contracts)'
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF or Word document file (.pdf, .doc, .docx)'
        },
      },
      required: ['fileType', 'file'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(pdf|doc|docx)$/,
        })
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024, // 10MB
          message: 'File cannot be greater than 10MB',
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @Body('fileType') fileType: string,
    @Req() request: IRequest,
  ) {
    try {
      console.log("Merchant File received: ", file?.originalname);
      console.log("Merchant FileType: ", fileType);
      console.log("Merchant ID: ", request.user?.userId);

      // Check if file exists
      if (!file) {
        throw new BadRequestException('File is required');
      }

      // Check if fileType exists
      if (!fileType) {
        throw new BadRequestException('fileType is required');
      }

      // Validate fileType is not empty
      if (fileType.trim().length === 0) {
        throw new BadRequestException('fileType cannot be empty');
      }

      // Validate file type - only PDF and Word documents allowed
      const allowedMimeTypes = [
        'application/pdf', // PDF
        'application/msword', // Word .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Word .docx
      ];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Only PDF and Word documents (.pdf, .doc, .docx) are allowed');
      }

      // Validate file extension as additional check
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['pdf', 'doc', 'docx'];
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        throw new BadRequestException('File must have a .pdf, .doc, or .docx extension');
      }

      // Validate file size is not zero
      if (file.size === 0) {
        throw new BadRequestException('File cannot be empty');
      }

      // Create a file object for the upload service
      const fileObj = {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };

      return this.uploadService.addFile(fileType, fileObj);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error processing file upload: ' + error.message);
    }
  }

  @Post('images')
  @ApiOperation({ summary: 'Upload multiple images to S3 (Merchant)' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', example: ImageType.USER },
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Array of image files (jpeg, jpg, png, webp)'
        },
      },
      required: ['type', 'images'],
    },
  })
  @ApiResponse({ status: 201, description: 'Images uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10)) // Max 10 files
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('type') type: string,
    @Req() request: IRequest,
  ) {
    try {
      console.log("Multiple Images received: ", files?.length);
      console.log("ImageType: ", type);
      console.log("Merchant ID: ", request.user?.userId);

      // Check if files exist
      if (!files || files.length === 0) {
        throw new BadRequestException('At least one image file is required');
      }

      // Check if type exists
      if (!type) {
        throw new BadRequestException('image type is required');
      }

      // Validate imageType enum
      if (!Object.values(ImageType).includes(type as ImageType)) {
        throw new BadRequestException(
          `imageType must be one of: ${Object.values(ImageType).join(', ')}`
        );
      }

      // Validate file count (max 10)
      if (files.length > 10) {
        throw new BadRequestException('Maximum 10 images allowed per request');
      }

      // Validate total size (max 50MB)
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const maxTotalSize = 50 * 1024 * 1024; // 50MB
      if (totalSize > maxTotalSize) {
        throw new BadRequestException('Total size of all images cannot exceed 50MB');
      }

      // Validate each file
      const validFiles = [];
      const errors = [];

      for (const file of files) {
        try {
          // Validate file type
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
          if (!allowedTypes.includes(file.mimetype)) {
            errors.push(`${file.originalname}: Invalid file type. Only JPEG, JPG, PNG, and WebP are allowed`);
            continue;
          }

          // Validate file size (5MB per file)
          if (file.size > 5 * 1024 * 1024) {
            errors.push(`${file.originalname}: File size exceeds 5MB limit`);
            continue;
          }

          // Validate file size is not zero
          if (file.size === 0) {
            errors.push(`${file.originalname}: File cannot be empty`);
            continue;
          }

          validFiles.push({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });
        } catch (error) {
          errors.push(`${file.originalname}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        throw new BadRequestException(`Validation errors: ${errors.join('; ')}`);
      }

      if (validFiles.length === 0) {
        throw new BadRequestException('No valid files to upload');
      }

      return this.uploadService.addMultipleImages(type as ImageType, validFiles);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error processing multiple image upload: ' + error.message);
    }
  }

  @Post('files')
  @ApiOperation({ summary: 'Upload multiple PDF or Word documents to S3 (Merchant)' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fileType: {
          type: 'string',
          example: 'documents',
          description: 'Category/folder name for the files (e.g., documents, contracts)'
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Array of document files (.pdf, .doc, .docx)'
        },
      },
      required: ['fileType', 'files'],
    },
  })
  @ApiResponse({ status: 201, description: 'Files uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('fileType') fileType: string,
    @Req() request: IRequest,
  ) {
    try {
      console.log("Multiple Files received: ", files?.length);
      console.log("FileType: ", fileType);
      console.log("Merchant ID: ", request.user?.userId);

      // Check if files exist
      if (!files || files.length === 0) {
        throw new BadRequestException('At least one file is required');
      }

      // Check if fileType exists
      if (!fileType) {
        throw new BadRequestException('fileType is required');
      }

      // Validate fileType is not empty
      if (fileType.trim().length === 0) {
        throw new BadRequestException('fileType cannot be empty');
      }

      // Validate file count (max 10)
      if (files.length > 10) {
        throw new BadRequestException('Maximum 10 files allowed per request');
      }

      // Validate total size (max 100MB)
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const maxTotalSize = 100 * 1024 * 1024; // 100MB
      if (totalSize > maxTotalSize) {
        throw new BadRequestException('Total size of all files cannot exceed 100MB');
      }

      // Validate each file
      const validFiles = [];
      const errors = [];

      for (const file of files) {
        try {
          // Validate file type - only PDF and Word documents allowed
          const allowedMimeTypes = [
            'application/pdf', // PDF
            'application/msword', // Word .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Word .docx
          ];
          if (!allowedMimeTypes.includes(file.mimetype)) {
            errors.push(`${file.originalname}: Invalid file type. Only PDF and Word documents (.pdf, .doc, .docx) are allowed`);
            continue;
          }

          // Validate file extension as additional check
          const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
          const allowedExtensions = ['pdf', 'doc', 'docx'];
          if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
            errors.push(`${file.originalname}: File must have a .pdf, .doc, or .docx extension`);
            continue;
          }

          // Validate file size (10MB per file)
          if (file.size > 10 * 1024 * 1024) {
            errors.push(`${file.originalname}: File size exceeds 10MB limit`);
            continue;
          }

          // Validate file size is not zero
          if (file.size === 0) {
            errors.push(`${file.originalname}: File cannot be empty`);
            continue;
          }

          validFiles.push({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });
        } catch (error) {
          errors.push(`${file.originalname}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        throw new BadRequestException(`Validation errors: ${errors.join('; ')}`);
      }

      if (validFiles.length === 0) {
        throw new BadRequestException('No valid files to upload');
      }

      return this.uploadService.addMultipleFiles(fileType, validFiles);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error processing multiple file upload: ' + error.message);
    }
  }
}