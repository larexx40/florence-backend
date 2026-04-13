import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

const STAFF_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT, Role.LOGISTICS];

/**
 * Allows any staff-level role (SUPER_ADMIN, ADMIN, SUPPORT, LOGISTICS).
 * Use for read-only admin endpoints that non-admin staff should still see.
 * Pair with AdminGuard on write endpoints that must be restricted to SUPER_ADMIN/ADMIN.
 */
@Injectable()
export class StaffGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const { user } = context.switchToHttp().getRequest();

        if (!user || !STAFF_ROLES.includes(user.role)) {
            throw new ForbiddenException('Staff access required');
        }

        return true;
    }
}
