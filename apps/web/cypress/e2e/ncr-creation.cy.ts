describe('NCR Creation Flow', () => {
  beforeEach(() => {
    // Login before each test
    cy.login('test@example.com', 'password123');
    cy.visit('/no-conformidades');
  });

  it('should create a new NCR successfully', () => {
    // Click on "Nueva No Conformidad" button
    cy.get('[data-testid="btn-crear-ncr"]').click();
    
    // Wait for form to load
    cy.get('[data-testid="ncr-form"]').should('be.visible');
    
    // Fill in the form
    cy.get('[data-testid="ncr-title"]').type('NCR de Prueba Automatizada');
    cy.get('[data-testid="ncr-description"]').type('Esta es una NCR creada automáticamente para testing');
    
    // Select severity
    cy.get('[data-testid="ncr-severity"]').click();
    cy.get('[data-value="MAJOR"]').click();
    
    // Select source
    cy.get('[data-testid="ncr-source"]').click();
    cy.get('[data-value="INTERNAL_AUDIT"]').click();
    
    // Assign to user
    cy.get('[data-testid="ncr-assigned-to"]').click();
    cy.get('[data-value="user-1"]').click();
    
    // Set due date
    cy.get('[data-testid="ncr-due-date"]').type('2024-12-31');
    
    // Submit form
    cy.get('[data-testid="btn-guardar"]').click();
    
    // Verify success message
    cy.get('[data-testid="success-message"]').should('be.visible');
    cy.get('[data-testid="success-message"]').should('contain', 'NCR creada exitosamente');
    
    // Verify NCR appears in list
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR de Prueba Automatizada');
  });

  it('should validate required fields', () => {
    // Click on "Nueva No Conformidad" button
    cy.get('[data-testid="btn-crear-ncr"]').click();
    
    // Try to submit without filling required fields
    cy.get('[data-testid="btn-guardar"]').click();
    
    // Should show validation errors
    cy.get('[data-testid="error-title"]').should('be.visible');
    cy.get('[data-testid="error-description"]').should('be.visible');
    cy.get('[data-testid="error-severity"]').should('be.visible');
  });

  it('should show confirmation dialog before deleting', () => {
    // Create an NCR first
    cy.createNCR({
      title: 'NCR para Eliminar',
      description: 'Esta NCR será eliminada en la prueba',
      severity: 'MINOR',
      source: 'PROCESS_DEVIATION'
    });
    
    // Click on delete button
    cy.get('[data-testid="ncr-list"]').contains('NCR para Eliminar').parents('[data-testid="ncr-item"]')
      .find('[data-testid="btn-eliminar"]').click();
    
    // Verify confirmation dialog appears
    cy.get('[data-testid="confirm-dialog"]').should('be.visible');
    cy.get('[data-testid="confirm-dialog"]').should('contain', '¿Está seguro de eliminar esta NCR?');
    
    // Cancel deletion
    cy.get('[data-testid="btn-cancelar"]').click();
    cy.get('[data-testid="confirm-dialog"]').should('not.exist');
    
    // Try deletion again and confirm
    cy.get('[data-testid="ncr-list"]').contains('NCR para Eliminar').parents('[data-testid="ncr-item"]')
      .find('[data-testid="btn-eliminar"]').click();
    
    cy.get('[data-testid="btn-confirmar"]').click();
    
    // Verify success message
    cy.get('[data-testid="success-message"]').should('contain', 'NCR eliminada exitosamente');
    
    // Verify NCR is no longer in list
    cy.get('[data-testid="ncr-list"]').should('not.contain', 'NCR para Eliminar');
  });

  it('should filter NCRs by severity', () => {
    // Create NCRs with different severities
    cy.createNCR({ title: 'NCR Crítica', severity: 'CRITICAL' });
    cy.createNCR({ title: 'NCR Mayor', severity: 'MAJOR' });
    cy.createNCR({ title: 'NCR Menor', severity: 'MINOR' });
    
    // Filter by critical severity
    cy.get('[data-testid="filter-severity"]').click();
    cy.get('[data-value="CRITICAL"]').click();
    
    // Should only show critical NCRs
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR Crítica');
    cy.get('[data-testid="ncr-list"]').should('not.contain', 'NCR Mayor');
    cy.get('[data-testid="ncr-list"]').should('not.contain', 'NCR Menor');
    
    // Clear filter
    cy.get('[data-testid="filter-severity"]').click();
    cy.get('[data-value="all"]').click();
    
    // Should show all NCRs
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR Crítica');
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR Mayor');
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR Menor');
  });

  it('should search NCRs by text', () => {
    // Create test NCRs
    cy.createNCR({ title: 'NCR de Calidad', description: 'Relacionada con procesos de calidad' });
    cy.createNCR({ title: 'NCR de Seguridad', description: 'Relacionada con normas de seguridad' });
    cy.createNCR({ title: 'NCR Ambiental', description: 'Relacionada con aspectos ambientales' });
    
    // Search for "Calidad"
    cy.get('[data-testid="search-input"]').type('Calidad');
    
    // Should only show quality NCR
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR de Calidad');
    cy.get('[data-testid="ncr-list"]').should('not.contain', 'NCR de Seguridad');
    cy.get('[data-testid="ncr-list"]').should('not.contain', 'NCR Ambiental');
    
    // Clear search
    cy.get('[data-testid="search-input"]').clear();
    
    // Should show all NCRs
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR de Calidad');
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR de Seguridad');
    cy.get('[data-testid="ncr-list"]').should('contain', 'NCR Ambiental');
  });

  it('should export NCRs to Excel', () => {
    // Create test NCRs
    cy.createNCR({ title: 'NCR Export 1', severity: 'MAJOR' });
    cy.createNCR({ title: 'NCR Export 2', severity: 'MINOR' });
    
    // Click export button
    cy.get('[data-testid="btn-exportar"]').click();
    
    // Verify download starts
    cy.get('[data-testid="export-success"]').should('be.visible');
    cy.get('[data-testid="export-success"]').should('contain', 'Exportación completada');
  });

  it('should navigate to NCR details', () => {
    // Create an NCR
    cy.createNCR({ title: 'NCR Detallada', description: 'Esta NCR tiene detalles completos' });
    
    // Click on NCR to view details
    cy.get('[data-testid="ncr-list"]').contains('NCR Detallada').click();
    
    // Verify navigation to detail page
    cy.url().should('match', /\/no-conformidades\/[^\/]+$/);
    
    // Verify detail page elements
    cy.get('[data-testid="ncr-detail"]').should('be.visible');
    cy.get('[data-testid="ncr-title"]').should('contain', 'NCR Detallada');
    cy.get('[data-testid="ncr-description"]').should('contain', 'Esta NCR tiene detalles completos');
  });

  it('should update NCR status', () => {
    // Create an NCR
    cy.createNCR({ title: 'NCR de Estado', severity: 'MAJOR' });
    
    // Navigate to detail page
    cy.get('[data-testid="ncr-list"]').contains('NCR de Estado').click();
    
    // Update status
    cy.get('[data-testid="status-select"]').click();
    cy.get('[data-value="IN_ANALYSIS"]').click();
    
    // Add analysis notes
    cy.get('[data-testid="analysis-notes"]').type('Análisis inicial realizado');
    
    // Save changes
    cy.get('[data-testid="btn-guardar-cambios"]').click();
    
    // Verify success message
    cy.get('[data-testid="success-message"]').should('contain', 'Estado actualizado exitosamente');
    
    // Verify status is updated
    cy.get('[data-testid="status-badge"]').should('contain', 'En Análisis');
  });
});

// Custom commands for NCR testing
Cypress.Commands.add('createNCR', (ncrData) => {
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
