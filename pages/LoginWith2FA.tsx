/**
 * LoginWith2FA Page Component
 * Complete login page handling both regular and 2FA flows
 */

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useVerify2FA } from '@/hooks/use2FA';

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
        setEmail('');
        setPassword('');
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

interface LoginWith2FAStep2Props {
  onSuccess?: () => void;
}

function LoginWith2FAStep2({ onSuccess }: LoginWith2FAStep2Props) {
  const [totp, setTotp] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const code = useRecovery ? totp.replace('-', '') : totp;

    try {
      await auth.verify2FA(code);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
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
          disabled={isLoading}
        />

        {error && <div className="alert alert-error">{error}</div>}

        <button
          type="submit"
          disabled={isLoading || (useRecovery ? totp.length < 8 : totp.length !== 6)}
          className="btn btn-primary btn-block"
        >
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setUseRecovery(!useRecovery);
          setTotp('');
          setError('');
        }}
        className="btn btn-link"
        disabled={isLoading}
      >
        {useRecovery ? 'Use authenticator app' : 'Use recovery code instead'}
      </button>
    </div>
  );
}
