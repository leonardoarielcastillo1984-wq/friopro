/**
 * Permisos del Sistema de Exportación Documental
 * Verifica si un usuario puede exportar, aprobar, firmar, etc.
 * Basado en roles del tenant y configuración por output definition.
 */

export type DocExportPermission =
  | 'doc-export:export'
  | 'doc-export:export-controlled'
  | 'doc-export:manage-templates'
  | 'doc-export:manage-outputs'
  | 'doc-export:manage-code-rules'
  | 'doc-export:manage-categories'
  | 'doc-export:manage-retention'
  | 'doc-export:create-revision'
  | 'doc-export:approve'
  | 'doc-export:reject'
  | 'doc-export:sign'
  | 'doc-export:bulk-export'
  | 'doc-export:view-history'
  | 'doc-export:view-dashboard'
  | 'doc-export:validate-public';

const ROLE_PERMISSIONS: Record<string, DocExportPermission[]> = {
  ADMIN: [
    'doc-export:export', 'doc-export:export-controlled',
    'doc-export:manage-templates', 'doc-export:manage-outputs',
    'doc-export:manage-code-rules', 'doc-export:manage-categories',
    'doc-export:manage-retention',
    'doc-export:create-revision', 'doc-export:approve', 'doc-export:reject',
    'doc-export:sign', 'doc-export:bulk-export',
    'doc-export:view-history', 'doc-export:view-dashboard',
  ],
  MANAGER: [
    'doc-export:export', 'doc-export:export-controlled',
    'doc-export:manage-templates', 'doc-export:manage-outputs',
    'doc-export:create-revision', 'doc-export:approve', 'doc-export:reject',
    'doc-export:sign', 'doc-export:bulk-export',
    'doc-export:view-history', 'doc-export:view-dashboard',
  ],
  EDITOR: [
    'doc-export:export', 'doc-export:export-controlled',
    'doc-export:create-revision', 'doc-export:sign',
    'doc-export:view-history', 'doc-export:view-dashboard',
  ],
  VIEWER: [
    'doc-export:export',
    'doc-export:view-history', 'doc-export:view-dashboard',
  ],
  AUDITOR: [
    'doc-export:export', 'doc-export:export-controlled',
    'doc-export:approve', 'doc-export:reject', 'doc-export:sign',
    'doc-export:view-history', 'doc-export:view-dashboard',
  ],
};

export function hasDocExportPermission(
  userRole: string | undefined,
  permission: DocExportPermission
): boolean {
  if (!userRole) return false;
  const perms = ROLE_PERMISSIONS[userRole.toUpperCase()] || ROLE_PERMISSIONS.VIEWER;
  return perms.includes(permission);
}

export function getDocExportPermissions(userRole: string | undefined): DocExportPermission[] {
  if (!userRole) return [];
  return ROLE_PERMISSIONS[userRole.toUpperCase()] || ROLE_PERMISSIONS.VIEWER;
}

export function canExportControlled(userRole: string | undefined): boolean {
  return hasDocExportPermission(userRole, 'doc-export:export-controlled');
}

export function canApprove(userRole: string | undefined): boolean {
  return hasDocExportPermission(userRole, 'doc-export:approve');
}

export function canSign(userRole: string | undefined): boolean {
  return hasDocExportPermission(userRole, 'doc-export:sign');
}

export function canBulkExport(userRole: string | undefined): boolean {
  return hasDocExportPermission(userRole, 'doc-export:bulk-export');
}
