import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Guards the bulk trip-read endpoints. These expose every rider's stored trip
 * (including origin/destination), so they are never open: the caller must send
 * `x-admin-token` matching ADMIN_TOKEN. If ADMIN_TOKEN is unset the endpoints
 * are disabled outright — failing closed, so a forgotten env var cannot leak
 * the dataset.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      this.logger.warn('ADMIN_TOKEN is not set — trip-read endpoints are disabled.');
      throw new ForbiddenException(
        'Trip read endpoints are disabled. Set ADMIN_TOKEN on the API to enable them.',
      );
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const raw = req.header('x-admin-token');
    if (!raw || !safeEqual(raw, expected)) {
      throw new ForbiddenException('Invalid or missing x-admin-token.');
    }
    return true;
  }
}

/** Constant-time compare that also tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
