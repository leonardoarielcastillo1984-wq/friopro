/**
 * 2FA Custom Hooks
 * All hooks for Two-Factor Authentication operations
 */

import { useMutation, useQuery } from '@tanstack/react-query';

interface Use2FASetupResponse {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
  message: string;
}

interface Use2FAConfirmResponse {
  success: boolean;
  message: string;
  recoveryCodes: string[];
  recoveryCodesMessage: string;
}

interface Use2FAStatusResponse {
  status: {
    isEnabled: boolean;
    isConfirmed: boolean;
    enabledAt?: string;
    disabledAt?: string;
    recoveryCodesGenerated: number;
    recoveryCodesUsed: number;
    recoveryCodesRemaining: number;
  };
}

export function use2FAStatus() {
  return useQuery({
    queryKey: ['2fa-status'],
    queryFn: async () => {
      const response = await fetch('/api/2fa/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch 2FA status');
      return response.json() as Promise<Use2FAStatusResponse>;
    },
    enabled: !!localStorage.getItem('accessToken'),
  });
}

export function useEnable2FA() {
  return useMutation({
    mutationFn: async (): Promise<Use2FASetupResponse> => {
      const response = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error('Failed to setup 2FA');
      return response.json();
    },
  });
}

export function useConfirm2FA() {
  return useMutation({
    mutationFn: async (token: string): Promise<Use2FAConfirmResponse> => {
      const response = await fetch('/api/2fa/confirm', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to confirm 2FA');
      }
      return response.json();
    },
  });
}

export function useDisable2FA() {
  return useMutation({
    mutationFn: async (password: string) => {
      const response = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disable 2FA');
      }
      return response.json();
    },
  });
}

export function useGenerateRecoveryCodes() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/2fa/recovery-codes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error('Failed to generate recovery codes');
      return response.json();
    },
  });
}

export function useVerify2FA() {
  return useMutation({
    mutationFn: async (sessionToken: string, token: string) => {
      const response = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionToken, token })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid code');
      }
      return response.json();
    },
  });
}
