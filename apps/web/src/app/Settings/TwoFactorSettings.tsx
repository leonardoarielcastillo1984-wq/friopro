"use client";

/**
 * TwoFactorSettings Page Component
 * Complete settings dashboard for 2FA management
 */

import React, { useState } from 'react';
import { TwoFactorSetup } from '@/components/TwoFactorSetup';
import { TwoFactorStatus } from '@/components/TwoFactorStatus';
import { TwoFactorDisable } from '@/components/TwoFactorDisable';
import { use2FAStatus, useGenerateRecoveryCodes } from '@/hooks/use2FA';

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

  // Setup mode
  if (setupMode) {
    return (
      <div className="settings-page">
        <TwoFactorSetup
          onSetupComplete={handleSetupComplete}
          onCancel={() => setSetupMode(false)}
        />
      </div>
    );
  }

  // Disable mode
  if (disableMode) {
    return (
      <div className="settings-page">
        <TwoFactorDisable
          onDisableComplete={handleDisableComplete}
          onCancel={() => setDisableMode(false)}
        />
      </div>
    );
  }

  // Main settings view
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
