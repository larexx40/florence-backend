import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    PutObjectCommandInput,
    DeleteObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { InternalServerErrorException } from '@nestjs/common';
import { config } from 'dotenv';

config(); // Load environment variables

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});


/**
 * Uploads a file to AWS S3 Bucket and returns the URL of the uploaded file.
 * @param file The file to upload, which is an instance of Express.Multer.File.
 * @param Key The key (file path) in the S3 bucket.
 * @returns A promise that resolves to the URL of the uploaded file on AWS S3.
 * @throws InternalServerErrorException if the upload fails.
 */
// export async function uploadFileToS3(
//     file: Express.Multer.File,
//     Key: string,
// ): Promise<string> {
//     const Bucket = process.env.S3_ASSET_BUCKET_NAME;
//     console.log('S3 Params:', { Bucket, Key });

//     // Define the input for PutObjectCommand
//     const params: PutObjectCommandInput = {
//         Bucket,
//         Key,
//         Body: file.buffer,
//         ContentType: file.mimetype,
//     };

//     try {
//         const command = new PutObjectCommand(params);
//         await s3Client.send(command);
//         return `https://${Bucket}.s3.amazonaws.com/${Key}`;
//     } catch (err) {
//         console.error('Error uploading file to S3:', err);
//         throw new InternalServerErrorException('Failed to upload file.');
//     }
// }

export async function uploadFileToS3(
    file: Express.Multer.File,
    Key: string,
): Promise<string> {
    const Bucket = process.env.S3_ASSET_BUCKET_NAME;
    const MIN_MULTIPART_SIZE = 5 * 1024 * 1024; // 5MB

    try {
        if (file.size > MIN_MULTIPART_SIZE) {
            // Use multipart upload for large files
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket,
                    Key,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                },
            });
            const result = await upload.done();
            return `https://${Bucket}.s3.amazonaws.com/${Key}`;
        } else {
            // Use single PutObject for small files
            const params = {
                Bucket,
                Key,
                Body: file.buffer,
                ContentType: file.mimetype,
            };
            const command = new PutObjectCommand(params);
            await s3Client.send(command);
            return `https://${Bucket}.s3.amazonaws.com/${Key}`;
        }
    } catch (err) {
        console.error('Error uploading file to S3:', err);
        throw new InternalServerErrorException('Failed to upload file.');
    }
}

/**
 * Deletes a file from AWS S3 Bucket.
 * @param Key The key of the file to delete (file path in the bucket).
 * @returns A promise that resolves once the file is deleted.
 * @throws InternalServerErrorException if the deletion fails.
 */
export async function deleteFileFromS3(Key: string): Promise<void> {
    const Bucket = process.env.S3_ASSET_BUCKET_NAME;
    console.log('S3 Delete Params:', { Bucket, Key });

    // Define the input for DeleteObjectCommand
    const params: DeleteObjectCommandInput = {
        Bucket,
        Key,
    };

    try {
        const command = new DeleteObjectCommand(params);
        await s3Client.send(command);
        console.log(`File deleted successfully: ${Key}`);
    } catch (err) {
        console.error('Error deleting file from S3:', err);
        throw new InternalServerErrorException('Failed to delete file.');
    }
}
