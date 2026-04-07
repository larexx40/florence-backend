import { Role } from "@prisma/client";
import { Request } from "express";
export interface AuthTokenPayload {
    userId: string;
    email: string;
    username: string;
    role: Role;
    isActive: boolean;
    
}

export interface RequestWithAuth extends Request {
    user: AuthTokenPayload;
}

export interface MerchantAuthPayload {
    id: string;
    email: string;
    role: string; 
    lastLogin: Date;
    active: boolean;
    verified: boolean
}