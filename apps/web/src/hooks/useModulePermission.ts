'use client';

import { useMemo } from 'react';

export type PermissionLevel = 'none' | 'view' | 'edit';

export function useModulePermission(moduleKey: string): PermissionLevel {
  return useMemo(() => {
    if (typeof window === 'undefined') return 'none';
    
    try {
      const perms = window.localStorage.getItem('userPermissions');
      if (!perms) return 'none';
      
      const parsed = JSON.parse(perms);
      const level = parsed[moduleKey];
      
      if (level === 'edit' || level === 'view' || level === 'none') {
        return level;
      }
      
      // Legacy format: { access: 'view'|'edit'|'none' }
      if (level?.access) {
        return level.access;
      }
      
      return 'none';
    } catch {
      return 'none';
    }
  }, [moduleKey]);
}

export function hasModulePermission(moduleKey: string, required: 'view' | 'edit' = 'view'): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const perms = window.localStorage.getItem('userPermissions');
    if (!perms) return false;
    
    const parsed = JSON.parse(perms);
    const level = parsed[moduleKey];
    
    let actualLevel: string;
    if (typeof level === 'string') {
      actualLevel = level;
    } else if (level?.access) {
      actualLevel = level.access;
    } else {
      return false;
    }
    
    if (required === 'edit') {
      return actualLevel === 'edit';
    }
    
    return actualLevel === 'view' || actualLevel === 'edit';
  } catch {
    return false;
  }
}
