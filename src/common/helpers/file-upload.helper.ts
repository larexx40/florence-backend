import { ParseFilePipeBuilder, UseInterceptors, applyDecorators } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import * as multer from 'multer';

// ── Upload options shape ──────────────────────────────────────────────────────

export interface UploadOptions {
  /** Regex tested against file.mimetype — e.g. /^image\/(jpeg|png)$/ */
  allowedMimePattern: RegExp;
  /** Hard cap enforced by both multer and the validation pipe (bytes). */
  maxBytes: number;
  /** Human-readable description shown in Swagger. */
  description?: string;
}

// ── Built-in presets ─────────────────────────────────────────────────────────

export const IMAGE_UPLOAD: UploadOptions = {
  allowedMimePattern: /^image\/(jpeg|png|webp|gif)$/,
  maxBytes: 10 * 1024 * 1024, // 10 MB
  description: 'Image file (jpeg / png / webp / gif — max 10 MB)',
};

export const DOCUMENT_UPLOAD: UploadOptions = {
  allowedMimePattern:
    /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/,
  maxBytes: 20 * 1024 * 1024, // 20 MB
  description: 'Document file (pdf / doc / docx — max 20 MB)',
};

// ── Method-level decorator ────────────────────────────────────────────────────
//
// Wires up multer memory storage with the preset's size cap and marks the
// endpoint as multipart/form-data for Swagger.
//
// Usage:
//   @UploadFile('image')                      // image preset (default)
//   @UploadFile('file', DOCUMENT_UPLOAD)      // document preset
//   @UploadFile('avatar', { allowedMimePattern: /^image\//, maxBytes: 5_000_000 })
//
// Plain JSON requests are passed through unchanged — multer only activates on
// multipart/form-data, so @UploadedFile() returns undefined for JSON bodies.

export function UploadFile(fieldName: string, opts: UploadOptions = IMAGE_UPLOAD) {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        storage: multer.memoryStorage(),
        limits: { fileSize: opts.maxBytes },
      }),
    ),
    ApiConsumes('multipart/form-data'),
  );
}

// ── Param-level validation pipe ───────────────────────────────────────────────
//
// Validates MIME type and size. Pass into @UploadedFile().
//
// Usage:
//   @UploadedFile(filePipe())                              // image, optional
//   @UploadedFile(filePipe(DOCUMENT_UPLOAD))               // document, optional
//   @UploadedFile(filePipe(IMAGE_UPLOAD, { required: true }))  // required image
//
// When required=false (default) and no file is sent, the pipe passes
// undefined through without throwing.

export function filePipe(
  opts: UploadOptions = IMAGE_UPLOAD,
  pipeOpts: { required?: boolean } = {},
) {
  return new ParseFilePipeBuilder()
    .addFileTypeValidator({ fileType: opts.allowedMimePattern })
    .addMaxSizeValidator({ maxSize: opts.maxBytes })
    .build({ fileIsRequired: pipeOpts.required ?? false });
}
