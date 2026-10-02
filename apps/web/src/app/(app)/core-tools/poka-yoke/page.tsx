'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  ShieldCheck, Plus, X, CheckCircle2, XCircle, AlertTriangle,
  MapPin, Cog, Calendar, History, Trash2,
} from 'lucide-react';

interface PokaYokeDevice {
  id: string;
  code: string;
  name: string;
  type: 'CONTROL' | 'WARNING';
  location?: string | null;
  process?: string | null;
  defectPrevented?: string | null;
  status: string;
  isActive: boolean;
  verificationFrequencyDays: number;
  verificationMethod?: string | null;
  lastVerifiedAt?: string | null;
  lastVerificationResult?: string | null;
  nextVerificationAt?: string | null;
  verificationsCount?: number;
  verificationDue?: boolean;
}

interface Verification {
  id: string;
  result: 'PASS' | 'FAIL';
  verifiedBy?: string | null;
  notes?: string | null;
  verifiedAt: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Activo', cls: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Falla', cls: 'bg-red-100 text-red-700' },
  OUT_OF_SERVICE: { label: 'Fuera de servicio', cls: 'bg-gray-100 text-gray-600' },
};

export default function PokaYokePage() {
  const [devices, setDevices] = useState<PokaYokeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<PokaYokeDevice | null>(null);
  const [historyTarget, setHistoryTarget] = useState<PokaYokeDevice | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);

  const [form, setForm] = useState({
    name: '', type: 'CONTROL', location: '', process: '',
    defectPrevented: '', verificationFrequencyDays: '30', verificationMethod: '',
  });
  const [verifyForm, setVerifyForm] = useState({ result: 'PASS', verifiedBy: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ devices: PokaYokeDevice[] }>('/poka-yoke');
      setDevices(res?.devices || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/poka-yoke', {
        method: 'POST',
        json: {
          name: form.name,
          type: form.type,
          location: form.location || null,
          process: form.process || null,
          defectPrevented: form.defectPrevented || null,
          verificationFrequencyDays: parseInt(form.verificationFrequencyDays) || 30,
          verificationMethod: form.verificationMethod || null,
        },
      });
      setShowCreate(false);
      setForm({ name: '', type: 'CONTROL', location: '', process: '', defectPrevented: '', verificationFrequencyDays: '30', verificationMethod: '' });
      await load();
    } catch {
      alert('Error al crear el dispositivo');
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/poka-yoke/${verifyTarget.id}/verify`, {
        method: 'POST',
        json: {
          result: verifyForm.result,
          verifiedBy: verifyForm.verifiedBy || null,
          notes: verifyForm.notes || null,
        },
      });
      setVerifyTarget(null);
      setVerifyForm({ result: 'PASS', verifiedBy: '', notes: '' });
      await load();
    } catch {
      alert('Error al registrar la verificación');
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(d: PokaYokeDevice) {
    setHistoryTarget(d);
    try {
      const res = await apiFetch<{ verifications: Verification[] }>(`/poka-yoke/${d.id}/verifications`);
      setVerifications(res?.verifications || []);
    } catch {
      setVerifications([]);
    }
  }

  async function handleDelete(d: PokaYokeDevice) {
    if (!confirm(`¿Eliminar ${d.code} — ${d.name}?`)) return;
    try {
      await apiFetch(`/poka-yoke/${d.id}`, { method: 'DELETE' });
      await load();
    } catch {
      alert('Error al eliminar');
    }
  }

  const dueCount = devices.filter((d) => d.verificationDue && d.isActive).length;
  const failedCount = devices.filter((d) => d.status === 'FAILED').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-600" /> Poka-Yoke — A prueba de error
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Dispositivos y métodos error-proofing con verificación periódica <span className="text-gray-400">(IATF 10.2.4)</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Nuevo dispositivo
        </button>
      </div>

      {(dueCount > 0 || failedCount > 0) && (
        <div className="flex gap-3">
          {dueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4" /> {dueCount} dispositivo{dueCount !== 1 ? 's' : ''} con verificación vencida
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <XCircle className="w-4 h-4" /> {failedCount} en estado de falla
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No hay dispositivos poka-yoke registrados</p>
          <p className="text-sm text-gray-400 mt-1">Registrá los métodos a prueba de error de tus procesos (plantillas, sensores, guías, límites…)</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((d) => (
            <div key={d.id} className={`bg-white rounded-xl border p-4 space-y-3 ${d.verificationDue && d.isActive ? 'border-amber-300' : d.status === 'FAILED' ? 'border-red-300' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">{d.code}</span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${d.type === 'CONTROL' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                      {d.type === 'CONTROL' ? 'Control' : 'Advertencia'}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_BADGE[d.status]?.cls || 'bg-gray-100'}`}>
                      {STATUS_BADGE[d.status]?.label || d.status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-1">{d.name}</h3>
                </div>
                <button onClick={() => handleDelete(d)} className="text-gray-300 hover:text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {d.defectPrevented && (
                <p className="text-xs text-gray-600"><span className="text-gray-400">Previene:</span> {d.defectPrevented}</p>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                {d.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.location}</span>}
                {d.process && <span className="flex items-center gap-1"><Cog className="w-3 h-3" />{d.process}</span>}
              </div>

              <div className="border-t border-gray-100 pt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Última verificación</span>
                  <span className={d.lastVerificationResult === 'FAIL' ? 'text-red-600 font-medium' : 'text-gray-700'}>
                    {d.lastVerifiedAt ? `${new Date(d.lastVerifiedAt).toLocaleDateString('es-AR')} ${d.lastVerificationResult === 'PASS' ? '✓' : '✗'}` : 'Nunca'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Próxima verificación</span>
                  <span className={d.verificationDue ? 'text-amber-700 font-semibold' : 'text-gray-700'}>
                    {d.nextVerificationAt ? new Date(d.nextVerificationAt).toLocaleDateString('es-AR') : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Frecuencia / verificaciones</span>
                  <span className="text-gray-700">c/{d.verificationFrequencyDays}d · {d.verificationsCount ?? 0}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setVerifyTarget(d); setVerifyForm({ result: 'PASS', verifiedBy: '', notes: '' }); }}
                  className="flex-1 text-xs px-2 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-medium"
                >
                  Verificar
                </button>
                <button
                  onClick={() => openHistory(d)}
                  className="flex items-center gap-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <History className="w-3 h-3" /> Historial
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Nuevo dispositivo poka-yoke</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Ej: Plantilla de montaje asimétrica L2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="CONTROL">Control (impide el error)</option>
                    <option value="WARNING">Advertencia (alerta del error)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia verificación (días)</label>
                  <input type="number" min="1" value={form.verificationFrequencyDays} onChange={(e) => setForm({ ...form, verificationFrequencyDays: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: Línea 2, estación 4" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proceso</label>
                  <input type="text" value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: Ensamble" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Defecto que previene</label>
                <input type="text" value={form.defectPrevented} onChange={(e) => setForm({ ...form, defectPrevented: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Ej: montaje invertido del conector" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de verificación</label>
                <input type="text" value={form.verificationMethod} onChange={(e) => setForm({ ...form, verificationMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Ej: pieza patrón defectuosa al inicio del turno" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal verificar */}
      {verifyTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Verificar {verifyTarget.code}</h2>
              <button onClick={() => setVerifyTarget(null)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleVerify} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">{verifyTarget.name}</p>
              {verifyTarget.verificationMethod && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">Método: {verifyTarget.verificationMethod}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resultado *</label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 cursor-pointer text-sm font-medium ${verifyForm.result === 'PASS' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                    <input type="radio" className="sr-only" checked={verifyForm.result === 'PASS'} onChange={() => setVerifyForm({ ...verifyForm, result: 'PASS' })} />
                    <CheckCircle2 className="w-4 h-4" /> Funciona
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 cursor-pointer text-sm font-medium ${verifyForm.result === 'FAIL' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                    <input type="radio" className="sr-only" checked={verifyForm.result === 'FAIL'} onChange={() => setVerifyForm({ ...verifyForm, result: 'FAIL' })} />
                    <XCircle className="w-4 h-4" /> Falla
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verificado por</label>
                <input type="text" value={verifyForm.verifiedBy} onChange={(e) => setVerifyForm({ ...verifyForm, verifiedBy: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Nombre del verificador" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea rows={2} value={verifyForm.notes} onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {verifyForm.result === 'FAIL' && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  Una falla marca el dispositivo como FAILED. Evaluá generar una NCR y suspender la producción hasta repararlo.
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setVerifyTarget(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Registrar verificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal historial */}
      {historyTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Historial — {historyTarget.code}</h2>
              <button onClick={() => setHistoryTarget(null)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              {verifications.length === 0 ? (
                <p className="text-sm text-gray-500">Sin verificaciones registradas</p>
              ) : (
                <div className="space-y-2">
                  {verifications.map((v) => (
                    <div key={v.id} className={`rounded-lg border p-3 text-sm ${v.result === 'PASS' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${v.result === 'PASS' ? 'text-green-700' : 'text-red-700'}`}>
                          {v.result === 'PASS' ? '✓ Funciona' : '✗ Falla'}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{new Date(v.verifiedAt).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      {v.verifiedBy && <p className="text-xs text-gray-500 mt-1">Por: {v.verifiedBy}</p>}
                      {v.notes && <p className="text-xs text-gray-600 mt-1">{v.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
