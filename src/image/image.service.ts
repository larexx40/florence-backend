import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Image } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import { uploadFileToAWSS3 } from 'src/common/helpers/s3.upload.helper';
import { LinkImageDto } from './dto/image.dto';

// ── S3 client (same credentials as the upload helper) ────────────────────────

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION_NEW ?? process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_NEW ?? process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_NEW ?? process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── URL parser ───────────────────────────────────────────────────────────────

// Supports both path-style and virtual-hosted-style S3 URLs:
//   path-style:    https://s3.{region}.amazonaws.com/{bucket}/{key}
//   virtual-hosted: https://{bucket}.s3.{region}.amazonaws.com/{key}
function parseS3Url(url: string): { bucket: string; key: string } | null {
  const pathStyle = url.match(/^https:\/\/s3\.[^.]+\.amazonaws\.com\/([^/]+)\/(.+)$/);
  if (pathStyle) return { bucket: pathStyle[1], key: pathStyle[2] };

  const virtualHosted = url.match(/^https:\/\/([^.]+)\.s3(?:\.[^.]+)?\.amazonaws\.com\/(.+)$/);
  if (virtualHosted) return { bucket: virtualHosted[1], key: virtualHosted[2] };

  return null;
}

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name, { timestamp: true });

  constructor(private readonly prisma: PrismaService) {}

  // ── Upload new file to S3 ────────────────────────────────────────────────────

  async upload(
    file: Express.Multer.File,
    uploadedBy: string,
    altText?: string,
  ): Promise<ApiResponse<Image>> {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp, gif`);
    }

    const requiredEnv = ['AWS_ACCESS_KEY_ID_NEW', 'AWS_SECRET_ACCESS_KEY_NEW', 'AWS_S3_REGION_NEW', 'S3_ASSET_BUCKET_NAME'];
    const missing = requiredEnv.filter((v) => !process.env[v]);
    if (missing.length) {
      throw new InternalServerErrorException(`Missing environment variables: ${missing.join(', ')}`);
    }

    const ext = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
    const s3Key = `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const url = await uploadFileToAWSS3(file, s3Key, true);

    const image = await this.prisma.image.create({
      data: {
        s3Key,
        url,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        altText: altText ?? null,
        uploadedBy,
      },
    });

    return { status: true, message: 'Image uploaded successfully', data: image };
  }

  // ── Link an existing S3 object by URL ────────────────────────────────────────

  async link(dto: LinkImageDto, uploadedBy: string): Promise<ApiResponse<Image>> {
    const parsed = parseS3Url(dto.url);
    if (!parsed) {
      throw new BadRequestException('URL does not look like an S3 object URL. Expected: https://s3.{region}.amazonaws.com/{bucket}/{key}');
    }

    const { bucket, key } = parsed;
    const configuredBucket = process.env.S3_ASSET_BUCKET_NAME;

    if (configuredBucket && bucket !== configuredBucket) {
      throw new BadRequestException(`Image must be in the configured bucket ("${configuredBucket}"), got "${bucket}"`);
    }

    // Validate the object actually exists in S3
    let contentType: string | undefined;
    let contentLength: number | undefined;
    try {
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      contentType = head.ContentType;
      contentLength = head.ContentLength;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(`S3 object not found: ${dto.url}`);
      }
      this.logger.error('S3 HeadObject failed', err.message);
      throw new InternalServerErrorException('Could not verify image in S3');
    }

    // Upsert: if we already have this key on record, return existing
    const existing = await this.prisma.image.findUnique({ where: { s3Key: key } });
    if (existing) {
      return { status: true, message: 'Image already exists — returning existing record', data: existing };
    }

    const image = await this.prisma.image.create({
      data: {
        s3Key: key,
        url: dto.url,
        mimeType: contentType ?? 'application/octet-stream',
        sizeBytes: contentLength ?? 0,
        altText: dto.altText ?? null,
        uploadedBy,
      },
    });

    return { status: true, message: 'Image linked successfully', data: image };
  }
}
