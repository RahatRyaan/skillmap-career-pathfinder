/**
 * Authentication state.
 *
 * A single provider owns the session so the header, the route guards, and the
 * API client all agree on who is signed in.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { LoginRequest, RegisterRequest } from '@skillmap/shared';
import { authApi } from '@/lib/endpoints';
import { tokenStore, type StoredUser } from '@/lib/api';

interface AuthState {
  user: StoredUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (input: LoginRequest) => Promise<StoredUser>;
  register: (input: RegisterRequest) => Promise<StoredUser>;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(() => tokenStore.user);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (input: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(input);
      tokenStore.save(response);
      setUser(response.user);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(input);
      tokenStore.save(response);
      setUser(response.user);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refreshToken;
    // Clear locally first: the user asked to sign out, so the UI must reflect
    // that immediately even if the network call fails.
    tokenStore.clear();
    setUser(null);
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
  }, []);

  const refreshUser = useCallback(() => {
    setUser(tokenStore.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
