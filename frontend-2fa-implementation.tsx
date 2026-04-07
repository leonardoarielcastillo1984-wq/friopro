/**
 * 2FA Frontend Implementation
 * Complete React components and hooks for Two-Factor Authentication
 *
 * Files to create:
 * - hooks/use2FA.ts
 * - hooks/useAuth.ts (update existing)
 * - components/TwoFactorSetup.tsx
 * - components/TwoFactorStatus.tsx
 * - components/TwoFactorDisable.tsx
 * - pages/LoginWith2FA.tsx
 * - pages/Settings/TwoFactorSettings.tsx
 */

// ============================================================================
// 1. hooks/use2FA.ts - Custom hooks for 2FA operations
// ============================================================================

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

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

// ============================================================================
// 2. hooks/useAuth.ts (UPDATED) - Add 2FA session state
// ============================================================================

interface AuthContextType {
  user: any | null;
  token: string | null;
  requires2FA: boolean;
  sessionToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export function useAuth(): AuthContextType {
  const [requires2FA, setRequires2FA] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.requires2FA) {
      // 2FA required
      setRequires2FA(true);
      setSessionToken(data.sessionToken);
      // Store temporarily in sessionStorage (not persisted to localStorage)
      sessionStorage.setItem('2fa_session_token', data.sessionToken);
      return;
    }

    // Regular login
    setRequires2FA(false);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    // Redirect to app
  }, []);

  const verify2FA = useCallback(async (code: string) => {
    const token = sessionStorage.getItem('2fa_session_token');
    if (!token) throw new Error('2FA session expired');

    const response = await fetch('/api/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token, token: code })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid code');
    }

    // Now get auth tokens
    const tokensResponse = await fetch('/api/auth/2fa-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token })
    });

    const tokens = await tokensResponse.json();
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('user', JSON.stringify(tokens.user));

    setRequires2FA(false);
    sessionStorage.removeItem('2fa_session_token');
    // Redirect to app
  }, []);

  return {
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('accessToken'),
    requires2FA,
    sessionToken,
    login,
    verify2FA,
    logout: () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      sessionStorage.removeItem('2fa_session_token');
    },
    isLoading: false
  };
}

// ============================================================================
// 3. components/TwoFactorSetup.tsx - Setup flow component
// ============================================================================

import React, { useState } from 'react';

interface TwoFactorSetupProps {
  onSetupComplete?: (codes: string[]) => void;
  onCancel?: () => void;
}

export function TwoFactorSetup({ onSetupComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'init' | 'scanning' | 'verify' | 'codes'>('init');
  const [totp, setTotp] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const setupMutation = useEnable2FA();
  const confirmMutation = useConfirm2FA();

  const handleStartSetup = async () => {
    try {
      const { qrCodeUrl } = await setupMutation.mutateAsync();
      setStep('scanning');
    } catch (error) {
      alert(`Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleVerify = async () => {
    if (totp.length !== 6) {
      alert('Please enter a 6-digit code');
      return;
    }

    try {
      const { recoveryCodes } = await confirmMutation.mutateAsync(totp);
      setCodes(recoveryCodes);
      setStep('codes');
      onSetupComplete?.(recoveryCodes);
    } catch (error) {
      alert(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCopyAll = () => {
    const text = codes.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([codes.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `sgi360-recovery-codes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (step === 'init') {
    return (
      <div className="2fa-setup-card">
        <h2>Enable Two-Factor Authentication</h2>
        <p className="text-muted">
          Add an extra layer of security to your account by requiring a verification code when you login.
        </p>
        <div className="button-group">
          <button
            onClick={handleStartSetup}
            disabled={setupMutation.isPending}
            className="btn btn-primary"
          >
            {setupMutation.isPending ? 'Setting up...' : 'Start Setup'}
          </button>
          {onCancel && (
            <button onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'scanning') {
    const { data } = setupMutation;
    return (
      <div className="2fa-setup-card">
        <h2>Scan QR Code</h2>
        <p>
          Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
        </p>
        {data && (
          <>
            <div className="qr-code-container">
              <img src={data.qrCodeUrl} alt="2FA QR Code" className="qr-code" />
            </div>
            <details className="manual-entry">
              <summary>Can't scan? Enter manually</summary>
              <div className="manual-code">
                <code>{data.manualEntryKey}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(data.manualEntryKey);
                  }}
                  className="btn-small"
                >
                  Copy
                </button>
              </div>
            </details>
          </>
        )}
        <div className="button-group">
          <button
            onClick={() => setStep('verify')}
            className="btn btn-primary"
          >
            I've Scanned the Code
          </button>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="2fa-setup-card">
        <h2>Verify Setup</h2>
        <p>
          Enter the 6-digit code from your authenticator app to verify the setup.
        </p>
        <input
          type="text"
          value={totp}
          onChange={(e) => setTotp(e.target.value.slice(0, 6))}
          placeholder="000000"
          maxLength="6"
          className="totp-input"
          inputMode="numeric"
          autoFocus
        />
        <div className="button-group">
          <button
            onClick={handleVerify}
            disabled={totp.length !== 6 || confirmMutation.isPending}
            className="btn btn-primary"
          >
            {confirmMutation.isPending ? 'Verifying...' : 'Verify & Enable'}
          </button>
          <button
            onClick={() => setStep('scanning')}
            className="btn btn-secondary"
          >
            Back
          </button>
        </div>
        {confirmMutation.error && (
          <div className="alert alert-error">
            {confirmMutation.error instanceof Error ? confirmMutation.error.message : 'Verification failed'}
          </div>
        )}
      </div>
    );
  }

  if (step === 'codes') {
    return (
      <div className="2fa-setup-card">
        <h2>✓ 2FA Enabled!</h2>
        <p className="success-message">
          Two-factor authentication has been successfully enabled on your account.
        </p>

        <div className="recovery-codes-section">
          <h3>Recovery Codes</h3>
          <p className="text-warning">
            ⚠ Save these recovery codes in a safe place. Each code can be used once if you lose access to your authenticator app.
          </p>

          <div className="recovery-codes-list">
            {codes.map((code, index) => (
              <div key={index} className="recovery-code">
                {code}
              </div>
            ))}
          </div>

          <div className="button-group">
            <button
              onClick={handleCopyAll}
              className="btn btn-secondary"
            >
              {copied ? '✓ Copied!' : 'Copy All'}
            </button>
            <button
              onClick={handleDownload}
              className="btn btn-secondary"
            >
              Download as File
            </button>
          </div>
        </div>

        <div className="button-group">
          <button
            onClick={() => setStep('init')}
            className="btn btn-primary"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// 4. components/TwoFactorStatus.tsx - Display current status
// ============================================================================

interface TwoFactorStatusProps {
  onEnableClick?: () => void;
  onDisableClick?: () => void;
  onRegenerateClick?: () => void;
}

export function TwoFactorStatus({
  onEnableClick,
  onDisableClick,
  onRegenerateClick
}: TwoFactorStatusProps) {
  const { data: statusData, isLoading, refetch } = use2FAStatus();

  if (isLoading) return <div className="loading">Loading 2FA status...</div>;

  const status = statusData?.status;

  return (
    <div className="2fa-status-card">
      <div className="status-header">
        <h3>Two-Factor Authentication</h3>
        <div className={`status-badge ${status?.isEnabled ? 'enabled' : 'disabled'}`}>
          {status?.isEnabled ? '✓ Enabled' : 'Disabled'}
        </div>
      </div>

      {status?.isEnabled && (
        <div className="status-details">
          <p>
            <strong>Enabled:</strong> {status.enabledAt ? new Date(status.enabledAt).toLocaleDateString() : 'N/A'}
          </p>
          <p>
            <strong>Recovery Codes:</strong> {status.recoveryCodesRemaining} remaining ({status.recoveryCodesUsed} used)
          </p>

          {status.recoveryCodesRemaining <= 3 && (
            <div className="alert alert-warning">
              ⚠ You're running low on recovery codes. Consider generating new ones.
            </div>
          )}
        </div>
      )}

      <div className="button-group">
        {!status?.isEnabled ? (
          <button onClick={onEnableClick} className="btn btn-primary">
            Enable 2FA
          </button>
        ) : (
          <>
            <button onClick={onRegenerateClick} className="btn btn-secondary">
              Generate New Recovery Codes
            </button>
            <button onClick={onDisableClick} className="btn btn-danger">
              Disable 2FA
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 5. components/TwoFactorDisable.tsx - Disable flow component
// ============================================================================

interface TwoFactorDisableProps {
  onDisableComplete?: () => void;
  onCancel?: () => void;
}

export function TwoFactorDisable({ onDisableComplete, onCancel }: TwoFactorDisableProps) {
  const [password, setPassword] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const disableMutation = useDisable2FA();

  const handleDisable = async () => {
    if (!password) {
      alert('Please enter your password');
      return;
    }

    try {
      await disableMutation.mutateAsync(password);
      setPassword('');
      setShowConfirmation(false);
      onDisableComplete?.();
    } catch (error) {
      alert(`Failed to disable 2FA: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (!showConfirmation) {
    return (
      <div className="2fa-disable-card">
        <h2>Disable Two-Factor Authentication</h2>
        <div className="alert alert-warning">
          ⚠ Disabling 2FA will make your account less secure. Are you sure?
        </div>
        <div className="button-group">
          <button
            onClick={() => setShowConfirmation(true)}
            className="btn btn-danger"
          >
            Continue with Disable
          </button>
          {onCancel && (
            <button onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="2fa-disable-card">
      <h2>Confirm Disable</h2>
      <p>Enter your password to disable 2FA:</p>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter your password"
        className="form-input"
      />

      <div className="button-group">
        <button
          onClick={handleDisable}
          disabled={!password || disableMutation.isPending}
          className="btn btn-danger"
        >
          {disableMutation.isPending ? 'Disabling...' : 'Disable 2FA'}
        </button>
        <button
          onClick={() => {
            setShowConfirmation(false);
            setPassword('');
          }}
          className="btn btn-secondary"
        >
          Back
        </button>
      </div>

      {disableMutation.error && (
        <div className="alert alert-error">
          {disableMutation.error instanceof Error ? disableMutation.error.message : 'An error occurred'}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. pages/LoginWith2FA.tsx - Login integration
// ============================================================================

interface LoginWith2FAProps {
  onLoginSuccess?: () => void;
}

export function LoginWith2FA({ onLoginSuccess }: LoginWith2FAProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const auth = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await auth.login(email, password);
      // If no 2FA required, login is complete
      if (!auth.requires2FA) {
        onLoginSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // 2FA verification step
  if (auth.requires2FA) {
    return <LoginWith2FAStep2 onSuccess={onLoginSuccess} />;
  }

  // Regular login form
  return (
    <div className="login-form">
      <h2>Sign In</h2>

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary btn-block"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

function LoginWith2FAStep2({ onSuccess }: { onSuccess?: () => void }) {
  const [totp, setTotp] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const auth = useAuth();
  const verifyMutation = useVerify2FA();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = useRecovery ? totp.replace('-', '') : totp;

    try {
      await verifyMutation.mutateAsync(auth.sessionToken || '', code);
      // Now verify with auth context
      await auth.verify2FA(code);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  return (
    <div className="login-2fa-form">
      <h2>Verify Your Identity</h2>
      <p className="text-muted">
        {useRecovery
          ? 'Enter one of your recovery codes'
          : 'Enter the 6-digit code from your authenticator app'}
      </p>

      <form onSubmit={handleVerify}>
        <input
          type="text"
          value={totp}
          onChange={(e) => {
            let value = e.target.value;
            if (!useRecovery) {
              value = value.slice(0, 6);
            } else {
              value = value.slice(0, 9); // XXXX-XXXX format
            }
            setTotp(value);
          }}
          placeholder={useRecovery ? 'XXXX-XXXX' : '000000'}
          inputMode={useRecovery ? 'text' : 'numeric'}
          required
          className="totp-input"
          autoFocus
        />

        {error && <div className="alert alert-error">{error}</div>}

        <button
          type="submit"
          disabled={verifyMutation.isPending}
          className="btn btn-primary btn-block"
        >
          {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setUseRecovery(!useRecovery);
          setTotp('');
        }}
        className="btn btn-link"
      >
        {useRecovery ? 'Use authenticator app' : 'Use recovery code instead'}
      </button>
    </div>
  );
}

// ============================================================================
// 7. pages/Settings/TwoFactorSettings.tsx - Complete settings page
// ============================================================================

export function TwoFactorSettings() {
  const [setupMode, setSetupMode] = useState(false);
  const [disableMode, setDisableMode] = useState(false);
  const { refetch } = use2FAStatus();
  const generateMutation = useGenerateRecoveryCodes();

  const handleSetupComplete = async (codes: string[]) => {
    setSetupMode(false);
    await refetch();
  };

  const handleDisableComplete = async () => {
    setDisableMode(false);
    await refetch();
  };

  const handleGenerateRecoveryCodes = async () => {
    if (window.confirm('Regenerate recovery codes? Old codes will still work but won\'t be shown again.')) {
      try {
        await generateMutation.mutateAsync();
        await refetch();
        alert('New recovery codes generated. Make sure to save them!');
      } catch (error) {
        alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  if (setupMode) {
    return (
      <TwoFactorSetup
        onSetupComplete={handleSetupComplete}
        onCancel={() => setSetupMode(false)}
      />
    );
  }

  if (disableMode) {
    return (
      <TwoFactorDisable
        onDisableComplete={handleDisableComplete}
        onCancel={() => setDisableMode(false)}
      />
    );
  }

  return (
    <div className="settings-page">
      <h1>Security Settings</h1>
      <section className="settings-section">
        <TwoFactorStatus
          onEnableClick={() => setSetupMode(true)}
          onDisableClick={() => setDisableMode(true)}
          onRegenerateClick={handleGenerateRecoveryCodes}
        />
      </section>
    </div>
  );
}

// ============================================================================
// CSS Styling (save as styles/2fa.css)
// ============================================================================

const styles = `
/* 2FA Components Styling */

.2fa-setup-card,
.2fa-status-card,
.2fa-disable-card,
.login-2fa-form {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.2fa-setup-card h2,
.2fa-status-card h3,
.2fa-disable-card h2 {
  margin-top: 0;
  color: #333;
}

.qr-code-container {
  display: flex;
  justify-content: center;
  margin: 2rem 0;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.qr-code {
  width: 200px;
  height: 200px;
}

.manual-entry {
  margin: 1rem 0;
  cursor: pointer;
}

.manual-entry summary {
  color: #007bff;
  padding: 0.5rem 0;
  user-select: none;
}

.manual-code {
  display: flex;
  align-items: center;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: monospace;
  gap: 0.5rem;
}

.manual-code code {
  flex: 1;
  word-break: break-all;
}

.totp-input {
  width: 100%;
  padding: 0.75rem;
  font-size: 2rem;
  text-align: center;
  letter-spacing: 0.5rem;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  margin: 1rem 0;
}

.totp-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.recovery-codes-section {
  margin-top: 2rem;
  padding: 1rem;
  background: #fff8dc;
  border-left: 4px solid #ffc107;
  border-radius: 4px;
}

.recovery-codes-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin: 1rem 0;
  font-family: monospace;
}

.recovery-code {
  padding: 0.5rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: center;
  font-size: 0.9rem;
  user-select: all;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.status-badge.enabled {
  background: #d4edda;
  color: #155724;
}

.status-badge.disabled {
  background: #f8d7da;
  color: #721c24;
}

.status-details {
  margin: 1rem 0;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.status-details p {
  margin: 0.5rem 0;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-link {
  background: none;
  border: none;
  color: #007bff;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  font-size: 0.9rem;
  margin-top: 1rem;
}

.btn-block {
  width: 100%;
}

.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 4px;
  margin: 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alert-success {
  background: #d4edda;
  color: #155724;
  border-left: 4px solid #28a745;
}

.alert-warning {
  background: #fff3cd;
  color: #856404;
  border-left: 4px solid #ffc107;
}

.alert-error {
  background: #f8d7da;
  color: #721c24;
  border-left: 4px solid #dc3545;
}

.success-message {
  color: #28a745;
  font-weight: 600;
  margin: 1rem 0;
}

.text-muted {
  color: #6c757d;
  font-size: 0.9rem;
}

.text-warning {
  color: #f58025;
  font-size: 0.9rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}
`;
