/**
 * useAuth Hook - UPDATED with 2FA support
 * Handles authentication state and 2FA flow
 */

import { useState, useCallback } from 'react';

interface LoginResult {
  requires2FA: boolean;
  sessionToken?: string;
}

interface AuthContextType {
  user: any | null;
  token: string | null;
  requires2FA: boolean;
  sessionToken: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
}

export function useAuth(): AuthContextType {
  const [requires2FA, setRequires2FA] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();

      if (data.requires2FA) {
        // 2FA required - store session token temporarily
        setRequires2FA(true);
        setSessionToken(data.sessionToken);
        // Store temporarily in sessionStorage (not persisted to localStorage)
        sessionStorage.setItem('2fa_session_token', data.sessionToken);
        return {
          requires2FA: true,
          sessionToken: data.sessionToken
        };
      }

      // Regular login - set auth tokens
      setRequires2FA(false);
      setSessionToken(null);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      // Note: Caller should handle redirect to app/dashboard
      return {
        requires2FA: false
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verify2FA = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('2fa_session_token');
      if (!token) throw new Error('2FA session expired');

      // Step 1: Verify the TOTP/Recovery code
      const verifyResponse = await fetch(`${getApiUrl()}/api/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token, token: code })
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.error || 'Invalid code');
      }

      // Step 2: Complete 2FA login and get auth tokens
      const tokensResponse = await fetch(`${getApiUrl()}/api/auth/2fa-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token })
      });

      if (!tokensResponse.ok) {
        const error = await tokensResponse.json();
        throw new Error(error.error || '2FA completion failed');
      }

      const tokens = await tokensResponse.json();

      // Set auth state
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('user', JSON.stringify(tokens.user));
      localStorage.setItem('activeTenant', JSON.stringify(tokens.activeTenant));
      localStorage.setItem('tenantRole', tokens.tenantRole);

      // Clear temporary 2FA session
      setRequires2FA(false);
      setSessionToken(null);
      sessionStorage.removeItem('2fa_session_token');

      // Note: Caller should handle redirect to app/dashboard
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('activeTenant');
    localStorage.removeItem('tenantRole');
    sessionStorage.removeItem('2fa_session_token');
    setRequires2FA(false);
    setSessionToken(null);
  }, []);

  return {
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('accessToken'),
    requires2FA,
    sessionToken,
    login,
    verify2FA,
    logout,
    isLoading
  };
}
