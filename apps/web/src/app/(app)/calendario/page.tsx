'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Event {
  id: string;
  source: string;
  type: string;
  title: string;
  date: string;
  status: string;
  link: string;
}

const SOURCE_COLORS: Record<string, string> = {
  'Acciones': 'bg-blue-100 text-blue-700 border-blue-200',
  'No Conformidades': 'bg-red-100 text-red-700 border-red-200',
  'Calibraciones': 'bg-purple-100 text-purple-700 border-purple-200',
  'Proveedores': 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

export default function CalendarioPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const from = new Date();
      const to = new Date(Date.now() + 365 * 24 * 3600 * 1000);
      const res = await apiFetch<{ events: Event[] }>(`/calendar?from=${from.toISOString()}&to=${to.toISOString()}`);
      setEvents(res?.events || []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Group by month
  const grouped = events.reduce<Record<string, Event[]>>((acc, ev) => {
    const d = new Date(ev.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    (acc[key] = acc[key] || []).push(ev);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Calendario integrado</h1>
              <p className="text-sm text-gray-500">
                Acciones, no conformidades, calibraciones y evaluaciones de proveedores con vencimientos próximos
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Recargar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        {loading ? (
          <div className="bg-white border rounded-xl p-12 text-center text-gray-500">Cargando...</div>
        ) : events.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center text-gray-500">
            No hay eventos con vencimientos en los próximos 12 meses.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).sort().map(([monthKey, evs]) => {
              const [yy, mm] = monthKey.split('-');
              const monthName = new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
              return (
                <div key={monthKey} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-gray-900 capitalize">
                    {monthName}
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {evs.map((ev) => {
                      const d = new Date(ev.date);
                      const isOverdue = d.getTime() < Date.now();
                      return (
                        <li key={ev.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
                          <div className="text-center min-w-[48px]">
                            <div className={`text-lg font-bold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                              {d.getDate()}
                            </div>
                            <div className="text-[10px] uppercase text-gray-500">
                              {d.toLocaleDateString('es-AR', { weekday: 'short' })}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={ev.link} className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block">
                              {ev.title}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${SOURCE_COLORS[ev.source] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                {ev.source}
                              </span>
                              {isOverdue && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-[10px] font-medium">
                                  Vencido
                                </span>
                              )}
                              <span className="text-[10px] text-gray-500">{ev.status}</span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
