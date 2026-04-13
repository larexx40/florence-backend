import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserDto } from 'src/common/dto/user.dto';
import { PaginatedDataDto } from 'src/common/types/response.type';

// ── Single user ───────────────────────────────────────────────────────────────

// UsersListResponseDto.users and single-user endpoints both reference UserDto directly.
// Import UserDto from src/common/dto/user.dto and use getSchemaPath(UserDto) in controllers.

// ── Users list ────────────────────────────────────────────────────────────────

export class UsersListResponseDto {
  @ApiProperty({ type: () => [UserDto] })
  users: UserDto[];

  @ApiProperty({ type: () => PaginatedDataDto })
  pagination: PaginatedDataDto;
}

// ── User stats ────────────────────────────────────────────────────────────────

export class UserStatsResponseDto {
  @ApiProperty({ example: 12, description: 'Total number of orders placed' })
  totalOrders: number;

  @ApiProperty({ example: 150000.00, description: 'Cumulative amount spent in Naira' })
  totalSpent: number;

  @ApiProperty({ example: 5000.00, description: 'Current store credit balance in Naira' })
  storeCreditBalance: number;

  @ApiPropertyOptional({ example: '2025-03-10T14:00:00.000Z', nullable: true, description: 'Date of last order' })
  lastOrderAt: Date | null;
}

// ── User orders ───────────────────────────────────────────────────────────────

export class UserOrdersResponseDto {
  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Paginated list of orders' })
  orders: Record<string, any>[];

  @ApiProperty({ type: () => PaginatedDataDto })
  pagination: PaginatedDataDto;
}

// ── User store credit transactions ────────────────────────────────────────────

export class UserTransactionsResponseDto {
  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Paginated list of store credit transactions' })
  transactions: Record<string, any>[];

  @ApiProperty({ type: () => PaginatedDataDto })
  pagination: PaginatedDataDto;
}
