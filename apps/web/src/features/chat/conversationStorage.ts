import { BACKENDS, type Backend } from '@/app/BackendContext';
import { readStorage, writeStorage } from '@/shared/lib/storage';

/**
 * The active conversation id, kept per backend in sessionStorage so a page refresh can restore the
 * chat. Conversation ids are only meaningful to the backend that issued them, hence the key.
 */
export function conversationStorageKey(backend: Backend): string {
  return `worknoon.conversation.${backend}`;
}

export function readStoredConversationId(backend: Backend): string | null {
  return readStorage('session', conversationStorageKey(backend));
}

export function storeConversationId(backend: Backend, conversationId: string | null): void {
  writeStorage('session', conversationStorageKey(backend), conversationId);
}

/** Forget the active conversation on every backend (used when switching backend). */
export function clearStoredConversations(): void {
  for (const backend of Object.keys(BACKENDS) as Backend[]) storeConversationId(backend, null);
}
