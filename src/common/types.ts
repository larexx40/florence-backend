import { Request } from "express";
import { Role, User } from "@prisma/client";

export interface AuthUser {
    userId: string;
    email: string;
    username: string;
    role: Role;
    isActive: boolean;
}

export interface IRequest extends Request {
    user: AuthUser;
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