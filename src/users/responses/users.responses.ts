import { User } from '@prisma/client';
import { ApiResponse, PaginatedData } from 'src/common/types';

export type UserProfileResponse = ApiResponse<User>;

export type UserMutationResponse = ApiResponse<null>;

export type UsersListResponse = ApiResponse<{
  users: User[];
  pagination: PaginatedData;
}>;

export type UserStatsResponse = ApiResponse<{
  totalOrders: number;
  totalSpent: number;
  storeCreditBalance: number;
  lastOrderAt: Date | null;
}>;

export type UserOrdersResponse = ApiResponse<{
  orders: any[];
  pagination: PaginatedData;
}>;

export type UserTransactionsResponse = ApiResponse<{
  transactions: any[];
  pagination: PaginatedData;
}>;
