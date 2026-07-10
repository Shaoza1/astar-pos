import { CanActivate, Injectable } from '@nestjs/common';

// Placeholder guard — full JWT strategy implemented in the auth ticket (Phase 1, Ticket 2)
// Returns true unconditionally until real auth is wired up
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
