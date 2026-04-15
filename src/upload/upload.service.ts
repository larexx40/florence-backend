import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { uploadFileToAWSS3 } from 'src/common/helpers/s3.upload.helper';
import { ApiResponse } from 'src/common/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SingleUploadResult {
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MultiUploadResult {
  successful: SingleUploadResult[];
  failed: Array<{ originalName: string; reason: string }>;
  summary: { total: number; successful: number; failed: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE = 20 * 1024 * 1024;  // 20 MB
const MAX_BATCH = 10;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  // ── Single image ──────────────────────────────────────────────────────────────

  async uploadImage(
    file: Express.Multer.File,
    watermark = true,
  ): Promise<ApiResponse<SingleUploadResult>> {
    this.assertImageType(file);
    this.assertSize(file, MAX_IMAGE_SIZE, '10 MB');

    const url = await uploadFileToAWSS3(file, this.imageKey(file), true, watermark);

    return {
      status: true,
      message: 'Image uploaded successfully',
      data: { url, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size },
    };
  }

  // ── Multiple images ───────────────────────────────────────────────────────────

  async uploadImages(
    files: Express.Multer.File[],
    watermark = true,
  ): Promise<ApiResponse<MultiUploadResult>> {
    if (files.length > MAX_BATCH) {
      throw new BadRequestException(`Maximum ${MAX_BATCH} files per request`);
    }

    const results = await Promise.all(
      files.map((file) => this.uploadOneImage(file, watermark)),
    );

    const successful = results.filter((r): r is SingleUploadResult => 'url' in r);
    const failed = results.filter((r): r is { originalName: string; reason: string } => 'reason' in r);

    return {
      status: true,
      message: `${successful.length} of ${files.length} image(s) uploaded`,
      data: {
        successful,
        failed,
        summary: { total: files.length, successful: successful.length, failed: failed.length },
      },
    };
  }

  // ── Single file (docs) ────────────────────────────────────────────────────────

  async uploadFile(file: Express.Multer.File): Promise<ApiResponse<SingleUploadResult>> {
    this.assertFileType(file);
    this.assertSize(file, MAX_FILE_SIZE, '20 MB');

    // no optimisation or watermark for non-image files
    const url = await uploadFileToAWSS3(file, this.fileKey(file), false, false);

    return {
      status: true,
      message: 'File uploaded successfully',
      data: { url, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size },
    };
  }

  // ── Multiple files (docs) ─────────────────────────────────────────────────────

  async uploadFiles(files: Express.Multer.File[]): Promise<ApiResponse<MultiUploadResult>> {
    if (files.length > MAX_BATCH) {
      throw new BadRequestException(`Maximum ${MAX_BATCH} files per request`);
    }

    const results = await Promise.all(files.map((file) => this.uploadOneFile(file)));

    const successful = results.filter((r): r is SingleUploadResult => 'url' in r);
    const failed = results.filter((r): r is { originalName: string; reason: string } => 'reason' in r);

    return {
      status: true,
      message: `${successful.length} of ${files.length} file(s) uploaded`,
      data: {
        successful,
        failed,
        summary: { total: files.length, successful: successful.length, failed: failed.length },
      },
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async uploadOneImage(
    file: Express.Multer.File,
    watermark: boolean,
  ): Promise<SingleUploadResult | { originalName: string; reason: string }> {
    try {
      this.assertImageType(file);
      this.assertSize(file, MAX_IMAGE_SIZE, '10 MB');
      const url = await uploadFileToAWSS3(file, this.imageKey(file), true, watermark);
      return { url, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size };
    } catch (err: any) {
      this.logger.warn(`Image upload failed — ${file.originalname}: ${err.message}`);
      return { originalName: file.originalname, reason: err.message };
    }
  }

  private async uploadOneFile(
    file: Express.Multer.File,
  ): Promise<SingleUploadResult | { originalName: string; reason: string }> {
    try {
      this.assertFileType(file);
      this.assertSize(file, MAX_FILE_SIZE, '20 MB');
      const url = await uploadFileToAWSS3(file, this.fileKey(file), false, false);
      return { url, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size };
    } catch (err: any) {
      this.logger.warn(`File upload failed — ${file.originalname}: ${err.message}`);
      return { originalName: file.originalname, reason: err.message };
    }
  }

  private assertImageType(file: Express.Multer.File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: jpeg, png, webp, gif`,
      );
    }
  }

  private assertFileType(file: Express.Multer.File) {
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: pdf, doc, docx`,
      );
    }
  }

  private assertSize(file: Express.Multer.File, maxBytes: number, label: string) {
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `"${file.originalname}" exceeds the ${label} size limit`,
      );
    }
    if (file.size === 0) {
      throw new BadRequestException(`"${file.originalname}" is empty`);
    }
  }

  private imageKey(file: Express.Multer.File): string {
    const ext = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
    return `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  }

  private fileKey(file: Express.Multer.File): string {
    const ext = file.originalname.split('.').pop() ?? 'bin';
    return `files/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  }
}
