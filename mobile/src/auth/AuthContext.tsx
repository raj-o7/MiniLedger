import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import type { User } from '../api/types';

const TOKEN_KEY = 'miniledger.token';
const USER_KEY = 'miniledger.user';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; token: string; user: User };

interface AuthContextValue {
  state: AuthState;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseStoredUser(json: string | null): User | null {
  if (!json) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(json);
    if (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'number' &&
      'phone' in value &&
      typeof value.phone === 'string' &&
      'createdAt' in value &&
      typeof value.createdAt === 'string'
    ) {
      return { id: value.id, phone: value.phone, createdAt: value.createdAt };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Keeps track of who is logged in. The token is saved in the phone's secure storage
 * (Keychain on iOS, Keystore on Android) so the user stays logged in after closing the app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setState({ status: 'signedOut' });
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  }, []);

  const signIn = useCallback(async (token: string, user: User) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    setAuthToken(token);
    setState({ status: 'signedIn', token, user });
  }, []);

  // When any request comes back 401 (expired token), log out automatically.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // On app start, restore a previous login if there is one.
  useEffect(() => {
    async function restore() {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        const user = parseStoredUser(await SecureStore.getItemAsync(USER_KEY));
        if (token && user) {
          setAuthToken(token);
          setState({ status: 'signedIn', token, user });
          return;
        }
      } catch {
        // Unreadable storage: fall through and ask the user to log in again.
      }
      setState({ status: 'signedOut' });
    }
    void restore();
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
