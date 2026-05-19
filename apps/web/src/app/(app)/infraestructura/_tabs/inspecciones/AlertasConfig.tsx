'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Bell, Plus, Trash2, Mail, Save, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react';

type AlertEmail = { email: string; nombre: string; alertaHallazgo: boolean; alertaOT: boolean };

export default function AlertasConfig() {
  const [list, setList] = useState<AlertEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNombre, setNewNombre] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await apiFetch('/inspecciones/alert-config');
      setList(Array.isArray(r.alertEmails) ? r.alertEmails : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = () => {
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) { alert('Ingresá un email válido'); return; }
    if (list.some(e => e.email === newEmail.trim())) { alert('Ese email ya está en la lista'); return; }
    setList(p => [...p, { email: newEmail.trim(), nombre: newNombre.trim() || newEmail.trim(), alertaHallazgo: true, alertaOT: true }]);
    setNewEmail(''); setNewNombre('');
  };

  const toggle = (i: number, field: 'alertaHallazgo' | 'alertaOT') => {
    setList(p => p.map((e, j) => j === i ? { ...e, [field]: !e[field] } : e));
  };

  const remove = (i: number) => setList(p => p.filter((_, j) => j !== i));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/inspecciones/alert-config', { method: 'PATCH', json: { alertEmails: list } });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          Configuración de alertas por email
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Agregá destinatarios que recibirán emails automáticos cuando se detecten hallazgos o se creen órdenes de trabajo desde inspecciones.
          Los administradores del sistema siempre reciben las notificaciones.
        </p>
      </div>

      {/* Leyenda tipos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700">Alerta de Hallazgo</p>
            <p className="text-xs text-amber-600 mt-0.5">Se envía cuando un inspector detecta un problema vía QR</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
          <Wrench className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-700">Alerta de OT</p>
            <p className="text-xs text-blue-600 mt-0.5">Se envía cuando se genera una orden de trabajo desde un hallazgo</p>
          </div>
        </div>
      </div>

      {/* Agregar nuevo */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <p className="text-xs font-semibold text-gray-600 mb-3">Agregar destinatario</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            placeholder="email@empresa.com *"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 min-w-[180px] text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={newNombre}
            onChange={e => setNewNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="w-40 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading
        ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
        : list.length === 0
          ? (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl">
              <Mail className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Sin destinatarios configurados</p>
              <p className="text-xs text-gray-400 mt-1">Agregá un email arriba para recibir alertas</p>
            </div>
          )
          : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Destinatario</span>
                <span className="text-center w-24">Hallazgo</span>
                <span className="text-center w-24">OT</span>
                <span className="w-8" />
              </div>
              {list.map((item, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center shadow-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{item.email}</p>
                  </div>
                  <div className="w-24 flex justify-center">
                    <button
                      onClick={() => toggle(i, 'alertaHallazgo')}
                      className={`w-16 h-7 rounded-full transition-all text-xs font-semibold ${item.alertaHallazgo ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                    >
                      {item.alertaHallazgo ? 'Activo' : 'Off'}
                    </button>
                  </div>
                  <div className="w-24 flex justify-center">
                    <button
                      onClick={() => toggle(i, 'alertaOT')}
                      className={`w-16 h-7 rounded-full transition-all text-xs font-semibold ${item.alertaOT ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                    >
                      {item.alertaOT ? 'Activo' : 'Off'}
                    </button>
                  </div>
                  <button onClick={() => remove(i)} className="w-8 flex justify-center text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

      {/* Guardar */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Guardado correctamente
          </span>
        )}
      </div>
    </div>
  );
}
