/**
 * TwoFactorSetup Component
 * 4-step setup flow: init → scanning → verify → codes
 */

import React, { useState } from 'react';
import { useEnable2FA, useConfirm2FA } from '@/hooks/use2FA';

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
      await setupMutation.mutateAsync();
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

  // Step 1: Init
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

  // Step 2: Scanning QR Code
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

  // Step 3: Verify TOTP Code
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

  // Step 4: Display Recovery Codes
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
