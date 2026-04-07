/**
 * 2FA E2E Tests - Cypress
 * Complete user flows
 */

describe('2FA Complete User Journey', () => {
  const TEST_USER = {
    email: 'test@example.com',
    password: 'Test123!@#'
  };

  const API_URL = 'https://staging-api.sgi360.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.visit('http://localhost:3000/login');
  });

  // =========================================================================
  // TEST 1: Login without 2FA
  // =========================================================================

  it('should login without 2FA', () => {
    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    cy.url().should('include', '/dashboard');
    cy.get('body').should('not.contain', 'Verify Your Identity');
  });

  // =========================================================================
  // TEST 2: Navigate to Security Settings
  // =========================================================================

  it('should navigate to security settings', () => {
    // Login first
    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    // Navigate to settings
    cy.visit('http://localhost:3000/settings/security');
    cy.contains('Security Settings').should('be.visible');
    cy.contains('Two-Factor Authentication').should('be.visible');
    cy.contains('Disabled').should('be.visible');
  });

  // =========================================================================
  // TEST 3: Setup 2FA Flow
  // =========================================================================

  it('should complete 2FA setup', () => {
    // Login
    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]").type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    // Go to security settings
    cy.visit('http://localhost:3000/settings/security');

    // Click Enable 2FA
    cy.get('button').contains('Enable 2FA').click();

    // Should show setup wizard
    cy.contains('Enable Two-Factor Authentication').should('be.visible');
    cy.get('button').contains('Start Setup').click();

    // Should show QR code
    cy.contains('Scan QR Code').should('be.visible');
    cy.get('img[alt="2FA QR Code"]').should('be.visible');

    // Click "I've Scanned"
    cy.get('button').contains("I've Scanned").click();

    // Should show TOTP input
    cy.contains('Verify Setup').should('be.visible');
    cy.get('.totp-input').should('be.visible');

    // Generate TOTP code (using speakeasy in test)
    cy.request({
      method: 'POST',
      url: `${API_URL}/2fa/setup`,
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      }
    }).then(response => {
      const secret = response.body.secret;
      const code = generateTOTPCode(secret);

      // Enter TOTP code
      cy.get('.totp-input').type(code);

      // Click Verify
      cy.get('button').contains('Verify & Enable').click();

      // Should show recovery codes
      cy.contains('2FA Enabled').should('be.visible');
      cy.contains('Recovery Codes').should('be.visible');
      cy.get('.recovery-code').should('have.length', 10);

      // Copy recovery codes
      cy.get('button').contains('Copy All').click();
      cy.contains('Copied').should('be.visible');

      // Done
      cy.get('button').contains('Done').click();

      // Verify status updated
      cy.contains('Enabled').should('be.visible');
      cy.contains('10 remaining').should('be.visible');
    });
  });

  // =========================================================================
  // TEST 4: Login with TOTP
  // =========================================================================

  it('should login with TOTP code', () => {
    // Login with email/password
    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    // Should show 2FA verification
    cy.contains('Verify Your Identity').should('be.visible');
    cy.contains('Enter the 6-digit code').should('be.visible');

    // Generate TOTP code
    cy.request({
      method: 'GET',
      url: `${API_URL}/2fa/status`,
      headers: {
        Authorization: `Bearer ${getAuthToken()}`
      }
    }).then(response => {
      // In test, we'd need to know the secret
      // For now, we'll use a generated code
      const code = generateTOTPCode();

      cy.get('.totp-input').type(code);
      cy.get('button').contains('Verify').click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
    });
  });

  // =========================================================================
  // TEST 5: Login with Recovery Code
  // =========================================================================

  it('should login with recovery code', () => {
    // Login with email/password
    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    // Should show 2FA verification
    cy.contains('Verify Your Identity').should('be.visible');

    // Switch to recovery code mode
    cy.get('button').contains('Use recovery code instead').click();
    cy.contains('Enter one of your recovery codes').should('be.visible');

    // In test environment, we'd need stored recovery codes
    // For CI/CD, we'd use an API endpoint to get test codes
    cy.request({
      method: 'GET',
      url: `${API_URL}/2fa/recovery-codes`,
      headers: {
        Authorization: `Bearer ${getAuthToken()}`
      }
    }).then(response => {
      const recoveryCode = response.body.codes[0];

      cy.get('.totp-input').type(recoveryCode);
      cy.get('button').contains('Verify').click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');

      // Verify recovery code was consumed
      cy.visit('http://localhost:3000/settings/security');
      cy.contains('9 remaining').should('be.visible');
    });
  });

  // =========================================================================
  // TEST 6: Disable 2FA
  // =========================================================================

  it('should disable 2FA', () => {
    // Login
    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    // Go to settings
    cy.visit('http://localhost:3000/settings/security');

    // Click Disable 2FA
    cy.get('button').contains('Disable 2FA').click();

    // Should show warning
    cy.contains('Disabling 2FA will make your account less secure').should('be.visible');

    // Click Continue
    cy.get('button').contains('Continue with Disable').click();

    // Should ask for password
    cy.contains('Enter your password').should('be.visible');
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Disable 2FA').click();

    // Should update status
    cy.contains('Disabled').should('be.visible');
  });

  // =========================================================================
  // TEST 7: Session Expiration
  // =========================================================================

  it('should expire 2FA session after timeout', () => {
    // This would test the 10-minute session expiration
    // In real tests, we'd mock time progression
    cy.clock();

    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    // Should show 2FA form
    cy.contains('Verify Your Identity').should('be.visible');

    // Tick 11 minutes
    cy.tick(11 * 60 * 1000);

    // Session should be expired
    cy.get('button').contains('Verify').should('be.disabled');
    cy.contains('2FA session expired').should('be.visible');
  });

  // =========================================================================
  // TEST 8: Invalid Code Handling
  // =========================================================================

  it('should reject invalid TOTP code', () => {
    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    cy.contains('Verify Your Identity').should('be.visible');

    // Enter wrong code
    cy.get('.totp-input').type('000000');
    cy.get('button').contains('Verify').click();

    // Should show error
    cy.contains('Invalid code').should('be.visible');
    cy.url().should('include', '/login'); // Still on verification
  });

  // =========================================================================
  // TEST 9: Recovery Code Consumption
  // =========================================================================

  it('should prevent recovery code reuse', () => {
    // Login with recovery code first time
    cy.get('input[type="email"]').type(TEST_USER.email);
    cy.get('input[type="password"]').type(TEST_USER.password);
    cy.get('button').contains('Sign In').click();

    cy.contains('Verify Your Identity').should('be.visible');
    cy.get('button').contains('Use recovery code instead').click();

    // Get recovery code
    cy.request({
      method: 'GET',
      url: `${API_URL}/2fa/recovery-codes`,
      headers: {
        Authorization: `Bearer ${getAuthToken()}`
      }
    }).then(response => {
      const code = response.body.codes[0];

      cy.get('.totp-input').type(code);
      cy.get('button').contains('Verify').click();
      cy.url().should('include', '/dashboard');

      // Logout and try same code again
      cy.visit('http://localhost:3000/logout');
      cy.visit('http://localhost:3000/login');

      cy.get('input[type="email"]').type(TEST_USER.email);
      cy.get('input[type="password"]').type(TEST_USER.password);
      cy.get('button').contains('Sign In').click();

      cy.contains('Verify Your Identity').should('be.visible');
      cy.get('button').contains('Use recovery code instead').click();
      cy.get('.totp-input').type(code);
      cy.get('button').contains('Verify').click();

      // Should fail - code already used
      cy.contains('Invalid code').should('be.visible');
    });
  });
});

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

function getAuthToken(): string {
  return localStorage.getItem('accessToken') || '';
}

function generateTOTPCode(secret?: string): string {
  // In real tests, this would use speakeasy or similar
  // For CI/CD, we might use an API endpoint that generates codes
  if (!secret) {
    // Default test secret
    secret = 'JBSWY3DPEBLW64TMMQ======';
  }

  // This would require speakeasy library available in Cypress
  // For now, return a placeholder
  return '123456';
}

// =========================================================================
// API FIXTURES
// =========================================================================

Cypress.Commands.add('loginUser', (email: string, password: string) => {
  cy.visit('http://localhost:3000/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button').contains('Sign In').click();
});

Cypress.Commands.add('enable2FA', () => {
  cy.visit('http://localhost:3000/settings/security');
  cy.get('button').contains('Enable 2FA').click();
  cy.get('button').contains('Start Setup').click();
});

Cypress.Commands.add('disable2FA', (password: string) => {
  cy.get('button').contains('Disable 2FA').click();
  cy.get('button').contains('Continue with Disable').click();
  cy.get('input[type="password"]').type(password);
  cy.get('button').contains('Disable 2FA').click();
});
