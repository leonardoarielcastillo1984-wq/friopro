"use client";

/**
 * TwoFactorStatus Component
 * Display current 2FA status and controls
 */

import React from 'react';
import { use2FAStatus } from '@/hooks/use2FA';

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
  const { data: statusData, isLoading } = use2FAStatus();

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
