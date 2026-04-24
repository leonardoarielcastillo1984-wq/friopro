'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCompany } from '@/lib/company-context';
import { useLicense, type PlanTier } from '@/hooks/useLicense';
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  BookOpen,
  BrainCircuit,
  Shield,
  TrendingUp,
  GraduationCap,
  FileBarChart,
  Puzzle,
  Settings,
  LogOut,
  Globe,
  Loader2,
  Bell,
  X,
  Search,
  Users,
  ClipboardCheck,
  ChevronDown,
  Headphones,
  Lock,
  HelpCircle,
  Compass,
  Truck,
  CalendarDays,
  Package,
  Target,
} from 'lucide-react';

const mainNav = [
  // 1. Visión general
  { label: 'Inicio', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Calendario', icon: CalendarDays, href: '/calendario' },
  { label: 'Proyectos', icon: BarChart3, href: '/project360' },

  // 2. Contexto estratégico (ISO §4, §6)
  { label: 'Contexto del SGI', icon: Compass, href: '/contexto-sgi' },
  { label: 'Objetivos SGI', icon: Target, href: '/objetivos' },
  { label: 'Políticas SGI', icon: FileText, href: '/objetivos/politicas' },

  // 3. Personas y proveedores
  { label: 'RRHH', icon: Users, href: '/rrhh' },
  { label: 'Capacitaciones', icon: GraduationCap, href: '/capacitaciones' },
  { label: 'Clientes', icon: Headphones, href: '/clientes' },
  { label: 'Proveedores', icon: Truck, href: '/proveedores' },

  // 4. Marco normativo
  { label: 'Cumplimiento', icon: BookOpen, href: '/cumplimiento' },
  { label: 'Documentos', icon: FileText, href: '/documents' },

  // 5. Seguridad & Ambiente
  { label: 'Seguridad & Ambiente', icon: Shield, href: '/seguridad' },
  { label: 'Indicadores', icon: TrendingUp, href: '/indicadores' },

  // 6. Calidad y mejora continua
  { label: 'Calidad / Mejora', icon: ClipboardCheck, href: '/calidad' },
  { label: 'Auditorías', icon: BrainCircuit, href: '/auditoria' },
  { label: 'Revisión por la Dirección', icon: FileBarChart, href: '/revision-direccion' },

  // 7. Infraestructura
  { label: 'Infraestructura', icon: Package, href: '/infraestructura' },

  // 8. Admin
  { label: 'Reportes', icon: FileBarChart, href: '/reportes' },
  { label: 'Modo de Uso', icon: HelpCircle, href: '/modo-de-uso' },
];

const bottomNav = [
  { label: 'Notificaciones', icon: Bell, href: '/notificaciones' },
  { label: 'Configuración', icon: Settings, href: '/configuracion' },
  { label: 'Integraciones', icon: Puzzle, href: '/integraciones' },
  { label: 'Configuración de la empresa', icon: Settings, href: '/configuracion/empresa' },
];

// Configuración de acceso a módulos por plan
const MODULE_PLAN_REQUIREMENTS: Record<string, PlanTier> = {
  '/dashboard': 'BASIC',
  '/panel': 'BASIC',
  '/documents': 'BASIC',
  '/contexto-sgi': 'BASIC',
  '/objetivos': 'BASIC',
  '/calidad': 'BASIC',
  '/seguridad': 'BASIC',
  '/indicadores': 'BASIC',
  '/cumplimiento': 'PROFESSIONAL',
  '/infraestructura': 'PROFESSIONAL',
  '/project360': 'PROFESSIONAL',
  '/capacitaciones': 'PROFESSIONAL',
  '/clientes': 'PROFESSIONAL',
  '/reportes': 'PROFESSIONAL',
  '/auditoria': 'PREMIUM',
  '/revision-direccion': 'PROFESSIONAL',
  '/rrhh': 'PREMIUM',
};

const PLAN_HIERARCHY: PlanTier[] = ['BASIC', 'PROFESSIONAL', 'PREMIUM'];

function getModuleRequiredPlan(href: string): PlanTier | null {
  // Buscar coincidencia exacta o parcial
  for (const [path, plan] of Object.entries(MODULE_PLAN_REQUIREMENTS)) {
    if (href === path || href.startsWith(path + '/')) {
      return plan;
    }
  }
  return null;
}

function hasAccessToModule(currentPlan: PlanTier | null, href: string): boolean {
  if (!currentPlan) return false;
  const requiredPlan = getModuleRequiredPlan(href);
  if (!requiredPlan) return true; // Sin requisitos específicos
  
  const currentIndex = PLAN_HIERARCHY.indexOf(currentPlan);
  const requiredIndex = PLAN_HIERARCHY.indexOf(requiredPlan);
  return currentIndex >= requiredIndex;
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const allPages = [...mainNav, ...bottomNav];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, tenantRole, logout, loading } = useAuth();
  const { settings: companySettings } = useCompany();
  const { status: licenseStatus, hasAccessToModule: checkLicenseAccess } = useLicense();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const currentPlan = licenseStatus.planTier;
  const isSetupRequired = licenseStatus.setupRequired;

  // Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && searchFocused) {
        setSearchQuery('');
        setSearchFocused(false);
        searchRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchFocused]);

  const searchablePages = user?.globalRole === 'SUPER_ADMIN'
    ? [...allPages, { label: 'Super Admin', icon: Globe, href: '/admin' }]
    : allPages;

  const searchResults = searchQuery.trim()
    ? searchablePages.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  function navigate(href: string) {
    // SUPER_ADMIN tiene acceso a TODO sin restricciones
    if (user?.globalRole === 'SUPER_ADMIN') {
      router.push(href);
      setSearchQuery('');
      setSearchFocused(false);
      onClose?.();
      return;
    }

    // Verificar si el setup está pendiente
    if (isSetupRequired && href !== '/planes') {
      router.push('/planes?setup=1');
      onClose?.();
      return;
    }

    // Verificar acceso al módulo (para usuarios no SUPER_ADMIN)
    if (!hasAccessToModule(currentPlan, href) && href !== '/planes') {
      // Redirigir a la página de planes con el módulo bloqueado
      const requiredPlan = getModuleRequiredPlan(href);
      router.push(`/planes?module=${encodeURIComponent(href)}&required=${requiredPlan}`);
      onClose?.();
      return;
    }

    router.push(href);
    setSearchQuery('');
    setSearchFocused(false);
    onClose?.();
  }

  function isActive(href: string) {
    if (pathname === href) return true;
    if (pathname.startsWith(href + '/')) {
      // Si existe un item de navegación más específico que también matchea,
      // no marcar este como activo (para evitar que /objetivos se active en /objetivos/politicas)
      const hasMoreSpecific = allPages.some(
        (p) =>
          p.href !== href &&
          p.href !== '/' &&
          (pathname === p.href || pathname.startsWith(p.href + '/'))
      );
      if (hasMoreSpecific) return false;
      return true;
    }
    return false;
  }

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || '?';
  const displayName = user?.email?.split('@')[0] || 'Usuario';
  const displayRole = tenantRole === 'TENANT_ADMIN' ? 'Administrador' :
    tenantRole === 'TENANT_USER' ? 'Usuario' :
    user?.globalRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Usuario';

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-sidebar-bg transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      {/* Logo / Company Brand */}
      <div className="flex items-center gap-3 px-6 py-5">
        {companySettings?.logoUrl ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white overflow-hidden">
            <img 
              src={companySettings.logoUrl} 
              alt={companySettings.companyName} 
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <Globe className="h-5 w-5 text-white" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-bold text-white">
            {companySettings?.companyName || 'SGI'} <span className="text-brand-400">360</span>
          </h1>
          {tenant && (
            <p className="text-[10px] text-sidebar-text truncate max-w-[150px]">{tenant.name}</p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-4 relative">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-hover px-3 py-2">
          <Search className="h-4 w-4 text-sidebar-text flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Buscar en SGI 360..."
            className="w-full bg-transparent text-sm text-white placeholder:text-sidebar-text outline-none"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }} className="text-sidebar-text hover:text-white" aria-label="Limpiar búsqueda">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {searchFocused && searchQuery.trim() && (
          <div className="absolute left-4 right-4 top-full mt-1 rounded-lg border border-white/10 bg-sidebar-bg shadow-xl z-50 overflow-hidden">
            {searchResults.length === 0 ? (
              <div className="px-3 py-3 text-xs text-sidebar-text">Sin resultados</div>
            ) : (
              searchResults.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onMouseDown={() => navigate(item.href)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            // SUPER_ADMIN nunca tiene módulos bloqueados
            const isLocked = user?.globalRole === "SUPER_ADMIN" ? false : !hasAccessToModule(currentPlan, item.href);
            const requiredPlan = getModuleRequiredPlan(item.href);
            
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-600 text-white'
                    : isLocked 
                      ? 'text-slate-500 hover:bg-slate-800/50 cursor-not-allowed'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                }`}
                title={isLocked ? `Disponible en plan ${requiredPlan}` : item.label}
              >
                <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isLocked ? 'opacity-50' : ''}`} />
                <span className={isLocked ? 'opacity-70' : ''}>{item.label}</span>
                {isLocked && (
                  <Lock className="h-3.5 w-3.5 ml-auto text-slate-500" />
                )}
              </button>
            );
          })}
        </div>

        <div className="my-4 border-t border-white/10" />

        <div className="space-y-1">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                }`}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
          {user?.globalRole === 'SUPER_ADMIN' && (
            <button
              onClick={() => navigate('/admin')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'bg-red-600 text-white'
                  : 'text-red-300 hover:bg-red-900/30 hover:text-red-200'
              }`}
            >
              <Shield className="h-[18px] w-[18px] flex-shrink-0" />
              Super Admin
            </button>
          )}
        </div>
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="truncate text-xs text-sidebar-text">{displayRole}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-1.5 text-sidebar-text hover:bg-sidebar-hover hover:text-white"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
