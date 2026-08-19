import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { readSetup, clearSetup } from './setup.js';

/**
 * Session state for the whole app.
 *
 * Also handles the one-time migration: onboarding answers collected before
 * accounts existed live in localStorage, and get pushed to the server the
 * first time someone signs in.
 */

export interface Me {
  user_id: number;
  email: string;
  plan: string;
  role: string;
  path: string | null;
  zip: string | null;
  radius_mi: number;
  alerts_per_day: number;
  quiet_hours: boolean;
  will_report: boolean;
  setup_done_at: string | null;
}

interface AuthValue {
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Request failed'), { status: res.status, data });
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: Me }>('/api/auth/me');
      setMe(user);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /** Push any pre-account onboarding answers up, then forget them locally. */
  const migrateSetup = useCallback(async () => {
    const local = readSetup();
    if (!local) return;
    try {
      await api('/api/auth/me/setup', { method: 'PATCH', body: JSON.stringify(local) });
      clearSetup();
    } catch {
      /* keep it locally and try again next sign-in */
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await migrateSetup();
    await refresh();
  }, [migrateSetup, refresh]);

  const signUp = useCallback(async (email: string, password: string) => {
    await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
    await migrateSetup();
    await refresh();
  }, [migrateSetup, refresh]);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }, []);

  return (
    <Ctx.Provider value={{ me, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
