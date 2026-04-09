import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { ImageType } from "src/common/constants/enum";

export class UploadImageDto {
    @ApiProperty({
        description: 'Image type/path',
        enum: ImageType,
        example: ImageType.USER,
    })
    @IsNotEmpty({ message: "Image type is required"})
    @IsEnum(ImageType, {
        message: `imageType must be one of: ${Object.values(ImageType).join(', ')}`,
    })
    imageType: ImageType;
}