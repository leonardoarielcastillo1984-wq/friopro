'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Bell, CheckCircle, AlertTriangle, Clock, Calendar, Filter, Settings, Trash2 } from 'lucide-react';

type Notification = {
  id: string;
  type: 'AUDIT_DUE' | 'FINDING_OVERDUE' | 'ACTION_DUE' | 'AUDIT_COMPLETED' | 'NEW_FINDING';
  title: string;
  message: string;
  entityType: 'AUDIT' | 'FINDING' | 'ACTION';
  entityId: string;
  isRead: boolean;
  createdAt: string;
  dueDate?: string;
};

const TYPE_CONFIG = {
  AUDIT_DUE: { label: 'Auditoría Próxima', color: 'bg-blue-100 text-blue-800', icon: Calendar },
  FINDING_OVERDUE: { label: 'Hallazgo Vencido', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  ACTION_DUE: { label: 'Acción Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  AUDIT_COMPLETED: { label: 'Auditoría Completada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  NEW_FINDING: { label: 'Nuevo Hallazgo', color: 'bg-purple-100 text-purple-800', icon: AlertTriangle },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      setLoading(true);
      // Simulación de notificaciones - en producción vendrían de la API
      const mockNotifications: Notification[] = [
        {
          id: '1',
          type: 'AUDIT_DUE',
          title: 'Auditoría programada para mañana',
          message: 'La auditoría AUD-2026-005 está programada para iniciar el 31/03/2026',
          entityType: 'AUDIT',
          entityId: 'audit-1',
          isRead: false,
          createdAt: new Date().toISOString(),
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '2',
          type: 'FINDING_OVERDUE',
          title: 'Hallazgo crítico vencido',
          message: 'El hallazgo H-003 lleva 5 días sin acciones correctivas registradas',
          entityType: 'FINDING',
          entityId: 'finding-1',
          isRead: false,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '3',
          type: 'ACTION_DUE',
          title: 'Acción correctiva próxima a vencer',
          message: 'La acción AC-012 vence en 3 días. Responsable: Juan Pérez',
          entityType: 'ACTION',
          entityId: 'action-1',
          isRead: true,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '4',
          type: 'AUDIT_COMPLETED',
          title: 'Auditoría finalizada',
          message: 'La auditoría AUD-2026-004 ha sido completada. Revisa el informe.',
          entityType: 'AUDIT',
          entityId: 'audit-2',
          isRead: true,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
      setNotifications(mockNotifications);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    ));
  }

  async function markAllAsRead() {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  }

  async function deleteNotification(id: string) {
    setNotifications(notifications.filter(n => n.id !== id));
  }

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'READ') return n.isRead;
    return true;
  }).filter(n => {
    if (typeFilter === 'ALL') return true;
    return n.type === typeFilter;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
            <p className="text-gray-500">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Marcar todo como leído
          </button>
          <Link
            href="/notificaciones/configuracion"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configuración
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'ALL', label: 'Todas' },
          { key: 'UNREAD', label: 'Sin leer' },
          { key: 'READ', label: 'Leídas' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        
        <div className="h-6 w-px bg-gray-300 mx-2" />
        
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Todos los tipos</option>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-200">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => {
              const config = TYPE_CONFIG[notification.type];
              const Icon = config.icon;
              
              return (
                <div
                  key={notification.id}
                  className={`p-6 flex items-start gap-4 ${
                    !notification.isRead ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className={`p-3 rounded-lg ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 text-xs rounded-full ${config.color}`}>
                        {config.label}
                      </span>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full" />
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                    <p className="text-gray-600 mt-1">{notification.message}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span>{new Date(notification.createdAt).toLocaleDateString()}</span>
                      {notification.dueDate && (
                        <span className="flex items-center gap-1 text-red-600">
                          <Clock className="w-4 h-4" />
                          Vence: {new Date(notification.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Marcar como leído
                        </button>
                      )}
                      <Link
                        href={`/auditorias/${notification.entityId}`}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        Ver detalle →
                      </Link>
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-sm text-red-600 hover:text-red-800 ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay notificaciones</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
