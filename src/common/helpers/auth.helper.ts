import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, IRequest } from 'src/common/types';

/**
 * Call at the top of any service method that needs an authenticated caller.
 *
 * - No user on the request → UnauthorizedException (auth guard didn't run or was bypassed)
 * - User's role not in allowedRoles → ForbiddenException
 * - Pass no roles to only require authentication with no role restriction.
 *
 * Returns the typed user so callers can destructure it immediately:
 *   const user = assertUser(req, Role.ADMIN, Role.SUPER_ADMIN);
 */
export function assertUser(req: IRequest, ...allowedRoles: Role[]): AuthUser {
    if (!req.user) {
        throw new UnauthorizedException('Unauthorized user access');
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        throw new ForbiddenException('You are not allowed to access this route');
    }

    return req.user;
}
