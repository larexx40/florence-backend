import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { FileUpload } from '../types/types';

config();

const logger = new Logger('S3UploadHelper');

// ── Multer config ─────────────────────────────────────────────────────────────
// Kept here so existing imports of multerConfig from this file keep working.

export const multerConfig = {
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
};

// ── S3 client ─────────────────────────────────────────────────────────────────

const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION ?? process.env.AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// ── Logo watermark helpers ────────────────────────────────────────────────────

function getLogoPath(): string | null {
    const candidates = [
        path.resolve(process.cwd(), 'dist/assets/logo.png'),
        path.resolve(process.cwd(), 'src/assets/logo.png'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

async function addWatermark(imageBuffer: Buffer, mimetype: string): Promise<Buffer> {
    const optimizableTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!optimizableTypes.includes(mimetype)) return imageBuffer;

    const logoPath = getLogoPath();
    if (!logoPath) {
        logger.warn('Watermark logo not found — skipping watermark');
        return imageBuffer;
    }

    try {
        const image = sharp(imageBuffer);
        const { width = 800, height = 600 } = await image.metadata();

        // logo width: 18% of image width, clamped between 80px and 200px
        const logoWidth = Math.min(200, Math.max(80, Math.round(width * 0.18)));
        const padding = 15;

        const resizedLogo = await sharp(logoPath)
            .resize(logoWidth, null, { withoutEnlargement: true, fit: 'inside' })
            .png()
            .toBuffer();

        const logoMeta = await sharp(resizedLogo).metadata();
        const logoH = logoMeta.height ?? Math.round(logoWidth * 0.4);

        const left = Math.max(0, width - logoWidth - padding);
        const top = Math.max(0, height - logoH - padding);

        return await image
            .composite([{ input: resizedLogo, left, top, blend: 'over' }])
            .toBuffer();
    } catch (err: any) {
        logger.warn(`Watermark failed — uploading without watermark: ${err.message}`);
        return imageBuffer;
    }
}

// ── Image optimisation ────────────────────────────────────────────────────────

async function optimizeImage(buffer: Buffer, mimetype: string, maxWidth = 2048): Promise<Buffer> {
    const optimizableTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!optimizableTypes.includes(mimetype)) return buffer;

    try {
        let pipeline = sharp(buffer);
        const metadata = await pipeline.metadata();

        if (metadata.width && metadata.width > maxWidth) {
            pipeline = pipeline.resize(maxWidth, null, { withoutEnlargement: true, fit: 'inside' });
        }

        if (mimetype === 'image/jpeg') {
            return await pipeline.jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
        } else if (mimetype === 'image/png') {
            return await pipeline.png({ compressionLevel: 9 }).toBuffer();
        } else if (mimetype === 'image/webp') {
            return await pipeline.webp({ quality: 80 }).toBuffer();
        }

        return await pipeline.toBuffer();
    } catch (err: any) {
        logger.warn(`Image optimization failed, uploading original: ${err.message}`);
        return buffer;
    }
}

async function generateThumbnail(buffer: Buffer, mimetype: string, size = 300): Promise<Buffer> {
    const optimizableTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!optimizableTypes.includes(mimetype)) return buffer;

    try {
        const pipeline = sharp(buffer).resize(size, size, { fit: 'cover', position: 'center' });

        if (mimetype === 'image/jpeg') {
            return await pipeline.jpeg({ quality: 70, progressive: true }).toBuffer();
        } else if (mimetype === 'image/png') {
            return await pipeline.png({ compressionLevel: 8 }).toBuffer();
        } else if (mimetype === 'image/webp') {
            return await pipeline.webp({ quality: 70 }).toBuffer();
        }

        return await pipeline.toBuffer();
    } catch (err: any) {
        logger.warn(`Thumbnail generation failed: ${err.message}`);
        return buffer;
    }
}

// ── Upload helpers ────────────────────────────────────────────────────────────

/**
 * Uploads a file to S3 with optional image optimisation and logo watermark.
 * Requires `multerConfig` (memoryStorage) so `file.buffer` is always populated.
 */
export async function uploadFileToAWSS3(
    file: Express.Multer.File | FileUpload,
    Key: string,
    shouldOptimize = true,
    watermark = true,
): Promise<string> {
    const startedAt = Date.now();
    if (!file.buffer || file.buffer.length === 0) {
        throw new InternalServerErrorException(
            'File buffer is empty. Ensure multer is configured with memoryStorage.',
        );
    }

    const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_REGION', 'S3_ASSET_BUCKET_NAME'];
    const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
    if (missingVars.length > 0) {
        throw new InternalServerErrorException("Image upload is not configured properly. Missing environment variables");
    }

    const Bucket = process.env.S3_ASSET_BUCKET_NAME;
    const MIN_MULTIPART_SIZE = 5 * 1024 * 1024; // 5 MB
    const isImage = file.mimetype?.startsWith('image/');

    let fileBuffer = file.buffer;

    if (shouldOptimize && isImage) {
        const optimizeStartedAt = Date.now();
        const originalSize = fileBuffer.length;
        fileBuffer = await optimizeImage(fileBuffer, file.mimetype);
        const compression = ((1 - fileBuffer.length / originalSize) * 100).toFixed(2);
        logger.log(`Image optimization took ${Date.now() - optimizeStartedAt}ms for ${Key}`);
        logger.log(
            `Image optimized: ${(originalSize / 1024).toFixed(2)}KB → ${(fileBuffer.length / 1024).toFixed(2)}KB (${compression}% reduction)`,
        );
    }

    if (isImage && watermark) {
        const watermarkStartedAt = Date.now();
        fileBuffer = await addWatermark(fileBuffer, file.mimetype);
        logger.log(`Watermark step completed in ${Date.now() - watermarkStartedAt}ms for ${Key}`);
    }

    try {
        const uploadStartedAt = Date.now();
        if (fileBuffer.length > MIN_MULTIPART_SIZE) {
            const upload = new Upload({
                client: s3Client,
                params: { Bucket, Key, Body: fileBuffer, ContentType: file.mimetype },
            });
            await upload.done();
        } else {
            await s3Client.send(new PutObjectCommand({ Bucket, Key, Body: fileBuffer, ContentType: file.mimetype }));
        }

        logger.log(`File uploaded to S3: ${Key} (${(fileBuffer.length / 1024).toFixed(2)}KB)`);
        logger.log(`S3 upload took ${Date.now() - uploadStartedAt}ms for ${Key}`);
        logger.log(`uploadFileToAWSS3 completed in ${Date.now() - startedAt}ms for ${Key}`);
        return `https://s3.${process.env.AWS_S3_REGION}.amazonaws.com/${Bucket}/${Key}`;
    } catch (err: any) {
        logger.error(`S3 upload failed — key: ${Key}, code: ${err.Code ?? 'unknown'}, message: ${err.message}`);
        throw new InternalServerErrorException('Unable to upload file. Please try again later.');
    }
}

/**
 * Uploads a main image (with optimisation + watermark) and an optional thumbnail.
 */
export async function uploadImageWithThumbnail(
    file: Express.Multer.File,
    Key: string,
    thumbnailKey?: string,
    watermark = true,
): Promise<{ imageUrl: string; thumbnailUrl?: string }> {
    const imageUrl = await uploadFileToAWSS3(file, Key, true, watermark);

    let thumbnailUrl: string | undefined;
    if (thumbnailKey && file.mimetype?.startsWith('image/')) {
        try {
            const thumbnailBuffer = await generateThumbnail(file.buffer, file.mimetype, 300);
            const Bucket = process.env.S3_ASSET_BUCKET_NAME;
            await s3Client.send(new PutObjectCommand({ Bucket, Key: thumbnailKey, Body: thumbnailBuffer, ContentType: file.mimetype }));
            thumbnailUrl = `https://s3.${process.env.AWS_S3_REGION}.amazonaws.com/${Bucket}/${thumbnailKey}`;

            logger.log(`Thumbnail generated: ${(thumbnailBuffer.length / 1024).toFixed(2)}KB`);
        } catch (err: any) {
            logger.warn(`Thumbnail upload failed — key: ${thumbnailKey}, message: ${err.message}`);
        }
    }

    return { imageUrl, thumbnailUrl };
}

/**
 * Deletes a file from S3 by key.
 */
export async function deleteFileFromS3(Key: string): Promise<void> {
    const Bucket = process.env.S3_ASSET_BUCKET_NAME;
    try {
        await s3Client.send(new DeleteObjectCommand({ Bucket, Key }));
        logger.log(`S3 object deleted: ${Key}`);
    } catch (err: any) {
        logger.error(`S3 delete failed — key: ${Key}, message: ${err.message}`);
        throw new InternalServerErrorException('Unable to delete file. Please try again later.');
    }
}
