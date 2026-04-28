import { User } from '@prisma/client';
import { ApiResponse } from 'src/common/types';

export type AdminProfileResponse = ApiResponse<User>;

export type AdminMutationResponse = ApiResponse<null>;
