'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import {
  Bell, MessageSquare, ChevronDown, Loader2, Menu,
  Check, CheckCheck, AlertTriangle, Shield, BrainCircuit,
  BookOpen, Users, AlertCircle, X,
} from 'lucide-react';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Inicio', subtitle: 'Resumen ejecutivo del sistema de gestión' },
  '/panel': { title: 'Panel General', subtitle: 'Análisis integral de cumplimiento y desempeño' },
  '/project360': { title: 'PROJECT360', subtitle: 'Gestión de planes de acción y mejora continua' },
  '/mantenimiento': { title: 'Mantenimiento', subtitle: 'Gestión integral de mantenimiento industrial' },
  '/simulacros': { title: 'Simulacros', subtitle: 'Planes de contingencia y emergencias' },
  '/documents': { title: 'Documentos', subtitle: 'Gestión documental del sistema integrado' },
  '/normativos': { title: 'Normativos', subtitle: 'Normas y estándares aplicables' },
  '/audit': { title: 'Auditoría IA', subtitle: 'Análisis inteligente de cumplimiento' },
  '/no-conformidades': { title: 'No Conformidades', subtitle: 'Gestión de NCRs y acciones correctivas' },
  '/riesgos': { title: 'Riesgos', subtitle: 'Matriz de riesgos y oportunidades' },
  '/indicadores': { title: 'Indicadores', subtitle: 'KPIs y métricas de desempeño' },
  '/capacitaciones': { title: 'Capacitaciones', subtitle: 'Programa de formación y competencias' },
  '/reportes': { title: 'Reportes', subtitle: 'Generación de informes y análisis' },
  '/integraciones': { title: 'Integraciones', subtitle: 'Conectores y plataformas externas' },
  '/configuracion': { title: 'Configuración', subtitle: 'Ajustes del sistema y administración' },
  '/notificaciones': { title: 'Notificaciones', subtitle: 'Historial de alertas y avisos del sistema' },
  '/admin': { title: 'Super Admin', subtitle: 'Gestión de tenants, planes y suscripciones' },
  '/select-tenant': { title: 'Seleccionar Organización', subtitle: 'Elegí la organización con la que querés trabajar' },
};

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  NCR_ASSIGNED: <AlertTriangle className="h-4 w-4 text-red-500" />,
  NCR_STATUS_CHANGED: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  NCR_OVERDUE: <AlertCircle className="h-4 w-4 text-red-600" />,
  RISK_CRITICAL: <Shield className="h-4 w-4 text-red-500" />,
  AUDIT_COMPLETED: <BrainCircuit className="h-4 w-4 text-green-500" />,
  AUDIT_FAILED: <BrainCircuit className="h-4 w-4 text-red-500" />,
  FINDING_NEW: <AlertCircle className="h-4 w-4 text-amber-500" />,
  TRAINING_SCHEDULED: <BookOpen className="h-4 w-4 text-blue-500" />,
  TRAINING_REMINDER: <BookOpen className="h-4 w-4 text-amber-500" />,
  MEMBER_INVITED: <Users className="h-4 w-4 text-brand-500" />,
  SYSTEM_ALERT: <AlertCircle className="h-4 w-4 text-neutral-500" />,
};

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, tenant, tenantRole } = useAuth();

  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Match pathname to page title
  const match = PAGE_TITLES[pathname] ||
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key + '/'))?.[1] ||
    { title: 'SGI 360', subtitle: '' };

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || '?';

  // Poll unread count every 30s
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiFetch<{ unreadCount: number }>('/notifications/count');
      setUnreadCount(res.unreadCount);
    } catch {
      // Silently ignore — notifications are not critical
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchUnreadCount]);

  async function loadNotifications() {
    setLoadingNotifs(true);
    try {
      const res = await apiFetch<{ notifications: Notification[]; unreadCount: number }>('/notifications?limit=20');
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoadingNotifs(false);
    }
  }

  function toggleNotifications() {
    if (!showNotifs) {
      loadNotifications();
    }
    setShowNotifs(!showNotifs);
  }

  async function markAllRead() {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST', json: {} });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  }

  async function handleNotifClick(notif: Notification) {
    // Mark as read
    if (!notif.isRead) {
      try {
        await apiFetch('/notifications/mark-read', { method: 'POST', json: { ids: [notif.id] } });
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch {
        // ignore
      }
    }
    // Navigate if has link
    if (notif.link) {
      setShowNotifs(false);
      router.push(notif.link);
    }
  }

  function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'ahora';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return `hace ${Math.floor(diff / 86400)}d`;
  }

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-neutral-200/60 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={onMenuClick}
            aria-label="Abrir menú"
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{match.title}</h2>
            {match.subtitle && <p className="text-sm text-neutral-500 hidden sm:block">{match.subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={toggleNotifications}
              aria-label="Notificaciones"
              className="relative rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 top-11 z-50 w-96 rounded-xl border border-neutral-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                  <h3 className="font-semibold text-neutral-900 text-sm">Notificaciones</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifs(false)}
                      className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {loadingNotifs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell className="mx-auto h-8 w-8 text-neutral-200" />
                      <p className="mt-2 text-sm text-neutral-400">Sin notificaciones</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-50 ${
                          !n.isRead ? 'bg-brand-50/30' : ''
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {NOTIF_ICONS[n.type] || NOTIF_ICONS.SYSTEM_ALERT}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${!n.isRead ? 'text-neutral-900' : 'text-neutral-600'}`}>
                              {n.title}
                            </span>
                            {!n.isRead && <span className="h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-xs text-neutral-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <button
                  onClick={() => { setShowNotifs(false); router.push('/notificaciones'); }}
                  className="w-full border-t border-neutral-100 px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  Ver todas las notificaciones
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/audit/chat')}
            title="Chat Auditor IA"
            aria-label="Chat Auditor IA"
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
          <div className="ml-2 h-6 w-px bg-neutral-200" />
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="Menú de usuario"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-100 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : userInitial}
              </div>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-neutral-200 bg-white shadow-xl">
                <div className="border-b border-neutral-100 px-4 py-3">
                  <p className="text-sm font-medium text-neutral-900 truncate">{user?.email}</p>
                  {tenant && (
                    <p className="text-xs text-neutral-400 mt-0.5 truncate">{tenant.name} · {tenantRole === 'TENANT_ADMIN' ? 'Administrador' : 'Usuario'}</p>
                  )}
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setShowUserMenu(false); router.push('/configuracion'); }}
                    className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    Mi perfil y configuración
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); router.push('/select-tenant'); }}
                    className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    Cambiar organización
                  </button>
                  {user?.globalRole === 'SUPER_ADMIN' && (
                    <button
                      onClick={() => { setShowUserMenu(false); router.push('/admin'); }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <Shield className="h-3.5 w-3.5" /> Super Admin
                    </button>
                  )}
                </div>
                <div className="border-t border-neutral-100 py-1">
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Click outside to close dropdowns */}
      {(showNotifs || showUserMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifs(false); setShowUserMenu(false); }} />
      )}
    </>
  );
}
