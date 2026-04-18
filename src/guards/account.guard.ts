import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthTokenPayload, RequestWithAuth } from 'src/auth/types/auth.type';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        const authorizationHeader = request.headers?.['authorization'];
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid Authorization header');
        }

        const token = authorizationHeader.split(' ')[1];
        try {
            
            const payload = jwt.verify(token, process.env.JWT_SECRET_ACCESS_KEY) as AuthTokenPayload; // Use jsonwebtoken to verify
            const user = await this.prisma.user.findUnique({
                where: { id: payload.userId },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isProfileComplete: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    lastLogin: true, 
                },
            })

            if (!user) {
                throw new UnauthorizedException('User not found');
            }
            if (user.isActive !== true) {
                throw new UnauthorizedException('Account is not active, contact support');
            }
            // Use fresh DB role so role changes take effect without re-login
            request.user = { ...payload, role: user.role };
            return true;
        } catch (error) {
            // console.log(error);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}