import { createContext, use, useMemo, useState, type ReactNode } from 'react';
import { readStorage, writeStorage } from '@/shared/lib/storage';

const STORAGE_KEY = 'worknoon.adminToken';

interface AdminSessionValue {
  token: string | null;
  /** Set after the server rejected the token, so the gate can explain why it reappeared. */
  notice: string | null;
  signIn: (token: string) => void;
  signOut: () => void;
  expire: () => void;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStorage('session', STORAGE_KEY));
  const [notice, setNotice] = useState<string | null>(null);

  const value = useMemo<AdminSessionValue>(
    () => ({
      token,
      notice,
      signIn: (next) => {
        writeStorage('session', STORAGE_KEY, next);
        setNotice(null);
        setToken(next);
      },
      signOut: () => {
        writeStorage('session', STORAGE_KEY, null);
        setNotice(null);
        setToken(null);
      },
      expire: () => {
        writeStorage('session', STORAGE_KEY, null);
        setNotice('That admin token was not accepted. Please enter a valid token.');
        setToken(null);
      },
    }),
    [token, notice],
  );

  return <AdminSessionContext value={value}>{children}</AdminSessionContext>;
}

export function useAdminSession(): AdminSessionValue {
  const context = use(AdminSessionContext);
  if (!context) throw new Error('useAdminSession must be used inside <AdminSessionProvider>');
  return context;
}
