// Custom commands for testing
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      createNCR(ncrData: {
        title: string;
        description?: string;
        severity?: string;
        source?: string;
      }): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('createNCR', (ncrData: {
  title: string;
  description?: string;
  severity?: string;
  source?: string;
}) => {
  cy.get('[data-testid="btn-crear-ncr"]').click();
  
  cy.get('[data-testid="ncr-title"]').type(ncrData.title);
  cy.get('[data-testid="ncr-description"]').type(ncrData.description || 'Descripción de prueba');
  
  if (ncrData.severity) {
    cy.get('[data-testid="ncr-severity"]').click();
    cy.get(`[data-value="${ncrData.severity}"]`).click();
  }
  
  if (ncrData.source) {
    cy.get('[data-testid="ncr-source"]').click();
    cy.get(`[data-value="${ncrData.source}"]`).click();
  }
  
  cy.get('[data-testid="btn-guardar"]').click();
  cy.get('[data-testid="success-message"]').should('be.visible');
});

export {};
