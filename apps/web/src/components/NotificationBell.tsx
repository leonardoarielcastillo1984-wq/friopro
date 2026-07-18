'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Bell, CheckCheck, X } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: Notification[]; unreadCount: number }>('/doc-export/notifications?unreadOnly=false&limit=20');
      setItems(data.data);
      setUnread(data.unreadCount);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markRead(id: string) {
    try { await apiFetch(`/doc-export/notifications/${id}/read`, { method: 'POST' }); load(); } catch { /* ignore */ }
  }

  async function markAllRead() {
    try { await apiFetch('/doc-export/notifications/read-all', { method: 'POST' }); load(); } catch { /* ignore */ }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        title="Notificaciones de exportación"
      >
        <Bell className="h-5 w-5 text-neutral-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-neutral-200 z-50 max-h-96 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-800">Notificaciones</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <CheckCheck className="h-3 w-3" /> Marcar todas
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-neutral-400">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                Sin notificaciones
              </div>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer ${!n.readAt ? 'bg-blue-50/30' : ''}`}
                  onClick={() => { if (!n.readAt) markRead(n.id); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{n.title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-neutral-400 mt-1">{new Date(n.createdAt).toLocaleString('es-AR')}</p>
                    </div>
                    {!n.readAt && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
