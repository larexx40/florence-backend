import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
            throw new ForbiddenException('You do not have permission to access this resource');
        }

        return true;
    }
}
