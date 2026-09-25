import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  readonly requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The id of the request currently being handled, for correlating log lines. */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
