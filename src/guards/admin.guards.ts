import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AccountType, Role } from '@prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || user.accountType !== AccountType.ADMIN) {
            throw new ForbiddenException('You do not have permission to access this resource');
        }

        console.log(user)
        return true;
    }
}
