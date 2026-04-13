import { ApiProperty } from '@nestjs/swagger';


export class PaginatedDataDto {
  @ApiProperty({ example: 100 })
  totalData: number;

  @ApiProperty({ example: 5 })
  totalPages: number;

  @ApiProperty({ example: 1 })
  currentPage: number;

  @ApiProperty({ example: 20 })
  perPage: number;
}
