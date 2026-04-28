import { BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { deleteFileFromS3 } from './s3.upload.helper';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Throws BadRequestException if the file mime type is not an allowed image type.
 */
export function validateImageFile(file: Express.Multer.File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      `Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp, gif`,
    );
  }
}

/**
 * Builds an S3 key for an image.
 * Prefixes with the NODE_ENV so dev and prod assets never collide.
 *
 * @param folder  e.g. 'categories', 'products', 'users'
 * @param mimetype  file.mimetype from multer
 */
export function buildS3ImageKey(folder: string, mimetype: string): string {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const ext = mimetype.split('/')[1].replace('jpeg', 'jpg');
  return `${env}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

/**
 * Extracts the S3 object key from a full S3 URL.
 * Handles both path-style and virtual-hosted-style URLs.
 * Returns null if the URL doesn't look like an S3 object URL.
 */
export function s3KeyFromUrl(url: string): string | null {
  const pathStyle = url.match(/^https:\/\/s3\.[^.]+\.amazonaws\.com\/[^/]+\/(.+)$/);
  if (pathStyle) return pathStyle[1];

  const virtualHosted = url.match(/^https:\/\/[^.]+\.s3(?:\.[^.]+)?\.amazonaws\.com\/(.+)$/);
  if (virtualHosted) return virtualHosted[1];

  return null;
}

/**
 * Fire-and-forget: deletes the S3 object only if nothing in the DB still references it.
 * Checks category images, product images, and variant images before deleting.
 * Safe to call without awaiting — failures are logged, never thrown.
 */
export function cleanupOrphanedS3Image(
  imageUrl: string,
  prisma: PrismaService,
  logger: Logger,
): void {
  setImmediate(async () => {
    try {
      const key = s3KeyFromUrl(imageUrl);
      if (!key) return; // not an S3 URL managed by this bucket

      const [categoryRef, productRef, variantRef] = await Promise.all([
        prisma.category.findFirst({ where: { imageUrl } }),
        prisma.productImage.findFirst({ where: { url: imageUrl } }),
        prisma.variantImage.findFirst({ where: { url: imageUrl } }),
      ]);

      if (categoryRef || productRef || variantRef) return; // still in use elsewhere

      await deleteFileFromS3(key);
    } catch (err) {
      logger.warn(`Background S3 cleanup failed for "${imageUrl}": ${(err as Error).message}`);
    }
  });
}
