import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedDataDto } from 'src/common/types/response.type';

// ── Coverage ──────────────────────────────────────────────────────────────────

export class CoverageCityResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lagos Island' })
  name: string;

  @ApiProperty({ example: { id: 'uuid', name: 'Lagos' } })
  state: { id: string; name: string };
}

export class CoverageResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid-of-company' })
  logisticsCompanyId: string;

  @ApiProperty({ type: () => CoverageCityResponseDto })
  city: CoverageCityResponseDto;

  @ApiPropertyOptional({ example: { id: 'uuid', name: 'Eti-Osa' }, nullable: true })
  localGovernment: { id: string; name: string } | null;

  @ApiProperty({ example: 1500 })
  shippingFee: number;
}

// ── Company ───────────────────────────────────────────────────────────────────

export class LogisticsCompanyResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Swift Logistics' })
  name: string;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 'hello@swiftlogistics.ng', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ example: 'Reliable next-day delivery', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/swift-logo.png', nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: () => [CoverageResponseDto] })
  coverages: CoverageResponseDto[];

  @ApiProperty({ example: { orders: 42 } })
  _count: { orders: number };
}

// ── List ──────────────────────────────────────────────────────────────────────

export class LogisticsListResponseDto {
  @ApiProperty({ type: () => [LogisticsCompanyResponseDto] })
  logistics: LogisticsCompanyResponseDto[];

  @ApiProperty({ type: () => PaginatedDataDto })
  pagination: PaginatedDataDto;
}

// ── Flat coverage (GET /logistics/coverages) ──────────────────────────────────

export class CoverageFlatResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid-of-company' })
  logisticsCompanyId: string;

  @ApiProperty({ example: 'Swift Logistics' })
  logisticsName: string;

  @ApiProperty({ example: 'uuid-of-city' })
  cityId: string;

  @ApiProperty({ example: 'Lagos Island' })
  cityName: string;

  @ApiProperty({ example: 'uuid-of-state' })
  stateId: string;

  @ApiProperty({ example: 'Lagos' })
  stateName: string;

  @ApiPropertyOptional({ example: 'uuid-of-lga', nullable: true })
  localGovernmentId: string | null;

  @ApiPropertyOptional({ example: 'Eti-Osa', nullable: true })
  lgaName: string | null;

  @ApiProperty({ example: 1500 })
  shippingFee: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;
}

export class CoverageListResponseDto {
  @ApiProperty({ type: () => [CoverageFlatResponseDto] })
  coverages: CoverageFlatResponseDto[];

  @ApiProperty({ type: () => PaginatedDataDto })
  pagination: PaginatedDataDto;
}
