/**
 * Web Storage can throw (private mode, blocked site data, sandboxed iframes). Every access goes
 * through these helpers so the app keeps working without persistence.
 */
type StorageKind = 'local' | 'session';

function getStore(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStorage(kind: StorageKind, key: string): string | null {
  try {
    return getStore(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(kind: StorageKind, key: string, value: string | null): void {
  try {
    const store = getStore(kind);
    if (!store) return;
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    // Persistence is a convenience; ignore failures.
  }
}
