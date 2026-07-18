'use client';

import { useState, useEffect, useCallback } from 'react';

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
  | 'doc-export:view-dashboard';

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

export function useDocExportPermissions() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setRole(user.role || user.userRole || 'VIEWER');
        } catch {
          setRole('VIEWER');
        }
      } else {
        setRole('VIEWER');
      }
    }
  }, []);

  const has = useCallback(
    (perm: DocExportPermission): boolean => {
      if (!role) return false;
      const perms = ROLE_PERMISSIONS[role.toUpperCase()] || ROLE_PERMISSIONS.VIEWER;
      return perms.includes(perm);
    },
    [role]
  );

  const can = useCallback(
    (perm: DocExportPermission): boolean => has(perm),
    [has]
  );

  return { role, has, can };
}
