import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthUser } from 'src/common/types';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        const authHeader = request.headers?.['authorization'];
        if (!authHeader?.startsWith('Bearer ')) return true;

        const token = authHeader.split(' ')[1];
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET_ACCESS_KEY) as AuthUser;
            const user = await this.prisma.user.findUnique({
                where: { id: payload.userId },
                select: { id: true, role: true, isActive: true, tokenVersion: true },
            });
            if (user?.isActive && (payload.tokenVersion ?? 0) === user.tokenVersion) {
                request.user = { ...payload, role: user.role };
            }
        } catch {
            // invalid/expired token — continue as unauthenticated
        }
        return true;
    }
}
