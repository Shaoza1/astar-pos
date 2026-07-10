import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { StaffRole } from '@astar-pos/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<StaffRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    // No @Roles() decorator — any authenticated user is allowed
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    return requiredRoles.includes(request.user?.role as StaffRole);
  }
}
