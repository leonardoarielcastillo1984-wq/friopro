'use client';

import { useMemo } from 'react';
import { lsKey } from '@/lib/api';

export type PermissionLevel = 'none' | 'view' | 'edit';

export function useModulePermission(moduleKey: string): PermissionLevel {
  return useMemo(() => {
    if (typeof window === 'undefined') return 'none';
    
    try {
      const perms = window.localStorage.getItem(lsKey('userPermissions'));
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
    const perms = window.localStorage.getItem(lsKey('userPermissions'));
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

// Sub-permiso dentro de un módulo (ej. 'flota-360-centro-control' dentro de
// 'flota-360'). Reglas:
//   · Si el módulo padre no tiene acceso → el hijo tampoco (nunca excede).
//   · Si el hijo tiene valor explícito → manda ese ('none' bloquea).
//   · Si el hijo no está configurado → hereda el acceso del padre
//     (los permisos guardados antes del sub-permiso siguen funcionando).
export function hasSubModulePermission(childKey: string, parentKey: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!hasModulePermission(parentKey)) return false;

  try {
    const perms = window.localStorage.getItem(lsKey('userPermissions'));
    if (!perms) return true; // padre con acceso y sin granularidad → permitido

    const parsed = JSON.parse(perms);
    const level = parsed[childKey];

    let actualLevel: string | undefined;
    if (typeof level === 'string') {
      actualLevel = level;
    } else if (level?.access) {
      actualLevel = level.access;
    }

    if (actualLevel === 'none') return false;
    return true; // 'view' | 'edit' | sin valor → hereda el acceso del padre
  } catch {
    return false;
  }
}
