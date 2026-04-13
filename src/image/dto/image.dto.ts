import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkImageDto {
  @ApiProperty({
    example: 'https://s3.us-east-1.amazonaws.com/my-bucket/images/abc.jpg',
    description: 'Existing S3 object URL — must already exist in the configured bucket',
  })
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ example: 'Product front view' })
  @IsOptional()
  @IsString()
  altText?: string;
}

export class AttachImageDto {
  @ApiProperty({ example: 'uuid-of-image', description: 'Image record UUID returned by /images/upload or /images/link' })
  @IsUUID('4')
  imageId: string;

  @ApiPropertyOptional({ example: 0, minimum: 0, description: 'Display position — lower = shown first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
