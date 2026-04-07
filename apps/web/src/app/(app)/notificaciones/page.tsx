'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Notification } from '@/lib/types';
import {
  Bell, CheckCheck, AlertTriangle, Shield, BrainCircuit,
  BookOpen, Users, AlertCircle, Loader2, Filter, X, RefreshCw,
  GraduationCap, FileText
} from 'lucide-react';

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
  TRAINING: <GraduationCap className="h-4 w-4 text-blue-500" />,
  DOCUMENT: <FileText className="h-4 w-4 text-green-500" />,
  NCR: <AlertTriangle className="h-4 w-4 text-red-500" />,
  MEMBER_INVITED: <Users className="h-4 w-4 text-brand-500" />,
  SYSTEM_ALERT: <AlertCircle className="h-4 w-4 text-neutral-500" />,
  GENERAL: <Bell className="h-4 w-4 text-neutral-500" />,
};

const TYPE_LABELS: Record<string, string> = {
  NCR_ASSIGNED: 'NCR asignada',
  NCR_STATUS_CHANGED: 'NCR actualizada',
  NCR_OVERDUE: 'NCR vencida',
  RISK_CRITICAL: 'Riesgo crítico',
  AUDIT_COMPLETED: 'Auditoría completada',
  AUDIT_FAILED: 'Auditoría fallida',
  FINDING_NEW: 'Nuevo hallazgo',
  TRAINING_SCHEDULED: 'Capacitación programada',
  TRAINING_REMINDER: 'Recordatorio capacitación',
  TRAINING: 'Capacitación',
  DOCUMENT: 'Documento',
  NCR: 'No Conformidad',
  MEMBER_INVITED: 'Miembro invitado',
  SYSTEM_ALERT: 'Alerta del sistema',
  GENERAL: 'General',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function NotificacionesPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ notifications: Notification[]; unreadCount: number }>('/notifications?limit=100');
      setNotifications(res?.notifications ?? []);
    } catch {
      setNotifications([]);
      setError('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generateNotifications() {
    setGenerating(true);
    try {
      await apiFetch('/notifications/generate', { method: 'GET' });
      await load(); // Reload notifications
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function markAllRead() {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST', json: {} });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  }

  async function handleClick(notif: Notification) {
    if (!notif.isRead) {
      try {
        await apiFetch('/notifications/mark-read', { method: 'POST', json: { ids: [notif.id] } });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch { /* ignore */ }
    }
    if (notif.link) router.push(notif.link);
  }

  const filtered = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notificaciones</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateNotifications}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} /> 
            {generating ? 'Generando...' : 'Generar Notificaciones'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <CheckCheck className="h-4 w-4" /> Marcar todas como leídas
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            filter === 'unread' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Sin leer {unreadCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Notification list */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto h-10 w-10 text-neutral-200" />
            <p className="mt-3 text-sm text-neutral-400">
              {filter === 'unread' ? 'No tenés notificaciones sin leer' : 'No hay notificaciones'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filtered.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-neutral-50 ${
                  !n.isRead ? 'bg-brand-50/20' : ''
                }`}
              >
                <div className="mt-0.5 flex-shrink-0 rounded-lg bg-neutral-100 p-2">
                  {NOTIF_ICONS[n.type] || NOTIF_ICONS.SYSTEM_ALERT}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${!n.isRead ? 'text-neutral-900' : 'text-neutral-600'}`}>
                      {n.title}
                    </span>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-neutral-500 mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-neutral-400">{timeAgo(n.createdAt)}</span>
                    <span className="text-xs text-neutral-300 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {TYPE_LABELS[n.type] || n.type}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
