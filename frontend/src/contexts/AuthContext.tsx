import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { api } from '../lib/api';
import { useGuestStore } from '../store/useGuestStore';
import { clearLocalToken, getLocalToken, setLocalToken } from '../lib/session';
import { queryClient } from '../lib/queryClient';

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string, displayName?: string) => Promise<void>;
  signOutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  loginWithPassword: async () => {},
  registerWithPassword: async () => {},
  signOutAll: async () => {},
});

function sessionFromApi(user: { firebaseUid: string; email: string; displayName?: string }) {
  return {
    uid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};

    async function boot() {
      const token = getLocalToken();
      if (token) {
        try {
          const { data } = await api.get<{ user: { firebaseUid: string; email: string; displayName?: string } }>('/api/auth/me', { timeout: 8000 });
          if (cancelled) return;
          setUser(sessionFromApi(data.user));
          useGuestStore.getState().setGuest(false);
          setLoading(false);
          return;
        } catch {
          clearLocalToken();
        }
      }
      if (cancelled) return;
      if (!isFirebaseConfigured) {
        setLoading(false);
        return;
      }
      unsub = onAuthStateChanged(auth, (u) => {
        if (getLocalToken()) return;
        setUser(u ? { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL } : null);
        if (u) useGuestStore.getState().setGuest(false);
        setLoading(false);
      });
    }

    boot();
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  async function loginWithPassword(email: string, password: string) {
    const { data } = await api.post<{ token: string; user: { firebaseUid: string; email: string; displayName?: string } }>(
      '/api/auth/login',
      { email, password }
    );
    setLocalToken(data.token);
    useGuestStore.getState().setGuest(false);
    setUser(sessionFromApi(data.user));
    queryClient.clear();
  }

  async function registerWithPassword(email: string, password: string, displayName?: string) {
    const { data } = await api.post<{ token: string; user: { firebaseUid: string; email: string; displayName?: string } }>(
      '/api/auth/register',
      { email, password, displayName }
    );
    setLocalToken(data.token);
    useGuestStore.getState().setGuest(false);
    setUser(sessionFromApi(data.user));
    queryClient.clear();
  }

  async function signOutAll() {
    clearLocalToken();
    try {
      await signOut(auth);
    } catch {
      /* firebase may be unconfigured */
    }
    useGuestStore.getState().setGuest(false);
    queryClient.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithPassword, registerWithPassword, signOutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
