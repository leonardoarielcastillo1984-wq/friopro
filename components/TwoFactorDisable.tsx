/**
 * TwoFactorDisable Component
 * 2-step disable flow with password confirmation
 */

import React, { useState } from 'react';
import { useDisable2FA } from '@/hooks/use2FA';

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

  // Step 1: Confirmation warning
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

  // Step 2: Password verification
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
