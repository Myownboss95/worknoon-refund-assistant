import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context.js';

export const REQUEST_ID_HEADER = 'x-request-id';
const INCOMING_ID = /^[A-Za-z0-9._-]{1,64}$/;
const logger = new Logger('Http');

/**
 * Assigns every request an id (reusing a well-formed incoming X-Request-Id), echoes it in the
 * response, makes it available to log lines through AsyncLocalStorage, and writes one access log
 * line per request. Runs as plain Express middleware so it also covers requests rejected by guards.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && INCOMING_ID.test(incoming) ? incoming : randomUUID();
  const startedAt = performance.now();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.on('finish', () => {
    logger.log({
      event: 'http_request',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });
  runWithRequestContext({ requestId }, next);
}
