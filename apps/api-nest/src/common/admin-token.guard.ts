import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig } from '../config/app-config.js';
import { AdminAuthLimiter } from './admin-auth-limiter.js';
import { ApiException } from './api-exception.js';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * Requires `X-Admin-Token` to equal ADMIN_TOKEN. Both sides are hashed first so the comparison is
 * constant-time and does not leak the token length. Failures count per client IP (resolved with
 * TRUSTED_PROXIES only); an IP over the limit gets 429 on every admin route until its window passes.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(
    config: AppConfig,
    private readonly limiter: AdminAuthLimiter,
  ) {
    this.expected = digest(config.adminToken);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = request.ip ?? 'unknown';
    if (this.limiter.isBlocked(clientIp)) {
      throw new ApiException(
        'RATE_LIMITED',
        'Too many requests. Please try again in a minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const provided = request.header(ADMIN_TOKEN_HEADER);
    if (typeof provided === 'string' && timingSafeEqual(digest(provided), this.expected)) {
      return true;
    }
    this.limiter.recordFailure(clientIp);
    throw new ApiException(
      'ADMIN_UNAUTHORIZED',
      'A valid admin token is required.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
