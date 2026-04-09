
import { Injectable, BadRequestException } from '@nestjs/common';
import { ImageType } from 'src/common/constants/enum';
import { generateId } from 'src/common/helpers/helper';
import { uploadFileToAWSS3 } from 'src/common/helpers/s3.upload.helper';

interface FileUpload {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

interface UploadResult {
    url: string;
    originalname: string;
    size: number;
    success: boolean;
    error?: string;
}

@Injectable()
export class UploadService {
    private validateFile(file: FileUpload): void {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        if (!file.buffer) {
            throw new BadRequestException('File buffer is required');
        }
        if (!file.originalname) {
            throw new BadRequestException('File originalname is required');
        }
        if (!file.mimetype) {
            throw new BadRequestException('File mimetype is required');
        }
        if (file.buffer.length === 0) {
            throw new BadRequestException('File cannot be empty');
        }
    }

    async addImage(
        imageType: ImageType,
        image: FileUpload,
    ) {
        this.validateFile(image);
        const fileExtension = image.originalname.split('.').pop();
        const s3Key = `${imageType}/${generateId()}-${Date.now()}.${fileExtension}`;
        const imageUrl = await uploadFileToAWSS3(image, s3Key);

        return {
            message: "Image Uploaded Successfully",
            status: true,
            data: {
                url: imageUrl,
                fileType: imageType,
            }
        };
    }

    async addFile(
        fileType: string,
        file: FileUpload,
    ) {
        this.validateFile(file);
        const fileExtension = file.originalname.split('.').pop();
        const s3Key = `files/${fileType}/${generateId()}-${Date.now()}.${fileExtension}`;

        // For non-image files, disable image optimization
        const shouldOptimize = file.mimetype?.startsWith('image/') || false;
        const fileUrl = await uploadFileToAWSS3(file, s3Key, shouldOptimize);

        return {
            message: "File Uploaded Successfully",
            status: true,
            data: {
                url: fileUrl,
                fileType: fileType,
            }
        };
    }

    async addMultipleImages(
        imageType: ImageType,
        images: FileUpload[],
    ) {
        const results: UploadResult[] = [];
        const successfulUploads = [];
        const failedUploads = [];

        // Process files in parallel for better performance
        const uploadPromises = images.map(async (image) => {
            try {
                const fileExtension = image.originalname.split('.').pop();
                const s3Key = `${imageType}/${generateId()}-${Date.now()}.${fileExtension}`;
                const imageUrl = await uploadFileToAWSS3(image, s3Key);

                const result: UploadResult = {
                    url: imageUrl,
                    originalname: image.originalname,
                    size: image.size,
                    success: true
                };

                successfulUploads.push(result);
                return result;
            } catch (error) {
                const result: UploadResult = {
                    url: '',
                    originalname: image.originalname,
                    size: image.size,
                    success: false,
                    error: error.message
                };

                failedUploads.push(result);
                return result;
            }
        });

        // Wait for all uploads to complete
        const allResults = await Promise.all(uploadPromises);
        results.push(...allResults);

        return {
            message: `Processed ${images.length} images. ${successfulUploads.length} successful, ${failedUploads.length} failed`,
            status: successfulUploads.length > 0,
            data: {
                successful: successfulUploads,
                failed: failedUploads,
                summary: {
                    total: images.length,
                    successful: successfulUploads.length,
                    failed: failedUploads.length,
                    fileType: imageType
                }
            }
        };
    }

    async addMultipleFiles(
        fileType: string,
        files: FileUpload[],
    ) {
        const results: UploadResult[] = [];
        const successfulUploads = [];
        const failedUploads = [];

        // Process files in parallel for better performance
        const uploadPromises = files.map(async (file) => {
            try {
                const fileExtension = file.originalname.split('.').pop();
                const s3Key = `files/${fileType}/${generateId()}-${Date.now()}.${fileExtension}`;

                // For non-image files, disable image optimization
                const shouldOptimize = file.mimetype?.startsWith('image/') || false;
                const fileUrl = await uploadFileToAWSS3(file, s3Key, shouldOptimize);

                const result: UploadResult = {
                    url: fileUrl,
                    originalname: file.originalname,
                    size: file.size,
                    success: true
                };

                successfulUploads.push(result);
                return result;
            } catch (error) {
                const result: UploadResult = {
                    url: '',
                    originalname: file.originalname,
                    size: file.size,
                    success: false,
                    error: error.message
                };

                failedUploads.push(result);
                return result;
            }
        });

        // Wait for all uploads to complete
        const allResults = await Promise.all(uploadPromises);
        results.push(...allResults);

        return {
            message: `Processed ${files.length} files. ${successfulUploads.length} successful, ${failedUploads.length} failed`,
            status: successfulUploads.length > 0,
            data: {
                successful: successfulUploads,
                failed: failedUploads,
                summary: {
                    total: files.length,
                    successful: successfulUploads.length,
                    failed: failedUploads.length,
                    fileType: fileType
                }
            }
        };
    }
}