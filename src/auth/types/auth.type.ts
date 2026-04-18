import { AuthUser, IRequest } from "src/common/types";

// Canonical auth types live in src/common/types.ts
// Re-export aliases here for backwards compatibility with existing imports
export type AuthTokenPayload = AuthUser;
export type RequestWithAuth = IRequest;

export interface MerchantAuthPayload {
    id: string;
    email: string;
    role: string;
    lastLogin: Date;
    active: boolean;
    verified: boolean;
}