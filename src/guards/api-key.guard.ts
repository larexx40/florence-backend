import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_API_KEY } from 'src/common/decorators/skip-api-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // allow routes decorated with @SkipApiKey()
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const expectedKey = process.env.API_KEY;
    if (!expectedKey) {
      // misconfiguration — fail closed
      throw new UnauthorizedException('API_KEY is not configured on the server');
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-api-key'];

    if (!provided || provided !== expectedKey) {
      throw new UnauthorizedException('Missing or invalid x-api-key header');
    }

    return true;
  }
}
