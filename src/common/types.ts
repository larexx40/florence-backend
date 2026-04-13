import { User } from "@prisma/client";
import { Request } from "express";
import { AuthTokenPayload } from "src/auth/types/auth.type";

export interface IRequest extends Request {
    user: AuthTokenPayload
}

export interface ApiResponse<T> {
    status: boolean;
    message: string;
    data: T|null;
}

export interface PaginatedData {
    totalData: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
}

export interface LoginResponseData {
    user: User;
    accessToken: string;
    refreshToken: string;
    isVerified: boolean,
    isProfileComplete: boolean;
}

export interface CheckoutData{
    
}