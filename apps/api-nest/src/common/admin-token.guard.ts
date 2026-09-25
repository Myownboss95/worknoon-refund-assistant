import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig } from '../config/app-config.js';
import { ApiException } from './api-exception.js';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * Requires `X-Admin-Token` to equal ADMIN_TOKEN. Both sides are hashed first so the comparison is
 * constant-time and does not leak the token length.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(config: AppConfig) {
    this.expected = digest(config.adminToken);
  }

  canActivate(context: ExecutionContext): boolean {
    const provided = context.switchToHttp().getRequest<Request>().header(ADMIN_TOKEN_HEADER);
    if (typeof provided === 'string' && timingSafeEqual(digest(provided), this.expected)) {
      return true;
    }
    throw new ApiException(
      'ADMIN_UNAUTHORIZED',
      'A valid admin token is required.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
