'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, ChevronRight, Send, ClipboardCheck } from 'lucide-react';
import AssetDiagram from '@/components/inspecciones/AssetDiagram';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

type Item = { id: string; label: string; tipo: string; seccion?: string; isRequerido: boolean; triggerHallazgo: boolean; opciones?: string[] };
type Respuesta = { itemId: string; valor: any; esOk?: boolean; observacion?: string };

export default function InspeccionarPage() {
  const { token } = useParams() as { token: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [paso, setPaso] = useState<'intro' | 'form' | 'enviando' | 'ok' | 'error'>('intro');
  const [inspector, setInspector] = useState({ nombre: '', email: '', phone: '', dominioTractor: '', dominioSemi: '', ruta: '', km: '' });
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({});
  const [notas, setNotas] = useState('');
  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/inspecciones/public/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);
        const init: Record<string, Respuesta> = {};
        for (const item of (d.plantilla?.items || [])) {
          init[item.id] = { itemId: item.id, valor: null, esOk: undefined, observacion: '' };
        }
        setRespuestas(init);
        setLoading(false);
      })
      .catch(() => { setError('No se pudo cargar la inspección.'); setLoading(false); });
  }, [token]);

  const items: Item[] = data?.plantilla?.items || [];
  const primary = data?.empresa?.primaryColor || '#2563eb';

  const setResp = (itemId: string, patch: Partial<Respuesta>) => {
    setRespuestas(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const puntaje = () => {
    const total = items.filter(i => i.tipo === 'SI_NO' || i.tipo === 'CHECKBOX').length;
    if (total === 0) return 100;
    const ok = Object.values(respuestas).filter(r => r.esOk === true).length;
    return Math.round((ok / total) * 100);
  };

  const handleSubmit = async () => {
    if (!inspector.nombre.trim()) { alert('Ingresá tu nombre para continuar'); return; }
    const requiredMissing = items.filter(i => i.isRequerido && respuestas[i.id]?.valor === null && respuestas[i.id]?.esOk === undefined);
    if (requiredMissing.length > 0) { alert(`Completá todos los campos obligatorios (${requiredMissing.length} pendientes)`); return; }
    setPaso('enviando');
    try {
      const res = await fetch(`${API_BASE}/inspecciones/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectorNombre: inspector.nombre,
          inspectorEmail: inspector.email || undefined,
          inspectorPhone: inspector.phone || undefined,
          kmReported: inspector.km ? parseFloat(inspector.km) : undefined,
          notas: [
            inspector.dominioTractor ? `Dominio tractor: ${inspector.dominioTractor}` : '',
            inspector.dominioSemi ? `Dominio semi: ${inspector.dominioSemi}` : '',
            inspector.ruta ? `Ruta: ${inspector.ruta}` : '',
            inspector.km ? `Km: ${parseInt(inspector.km).toLocaleString('es-AR')}` : '',
            notas,
          ].filter(Boolean).join(' | ') || undefined,
          respuestas: Object.values(respuestas).filter(r => r.valor !== null || r.esOk !== undefined),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setPaso('error'); return; }
      setResultado(json); setPaso('ok');
    } catch { setPaso('error'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900 p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="font-bold text-gray-900 mb-2">QR no encontrado</h2>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </div>
  );

  if (paso === 'ok') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900 p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Inspección enviada!</h2>
        <p className="text-sm text-gray-500 mb-4">{resultado?.mensaje}</p>
        {resultado?.puntaje !== undefined && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-3xl font-bold mb-1" style={{ color: primary }}>{resultado.puntaje}%</p>
            <p className="text-xs text-gray-500">Puntaje de cumplimiento</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="h-2 rounded-full" style={{ width: `${resultado.puntaje}%`, backgroundColor: resultado.puntaje >= 80 ? '#10b981' : resultado.puntaje >= 60 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>
        )}
        {resultado?.hallazgosCount > 0 && (
          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 mb-4">
            ⚠️ Se detectaron <strong>{resultado.hallazgosCount} hallazgo(s)</strong>. El responsable fue notificado.
          </div>
        )}
        <p className="text-xs text-gray-400">Podés cerrar esta página</p>
      </div>
    </div>
  );

  if (paso === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900 p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="font-bold text-gray-900 mb-2">Error al enviar</h2>
        <p className="text-sm text-gray-500 mb-4">No se pudo registrar la inspección. Intentá nuevamente.</p>
        <button onClick={() => setPaso('form')} className="text-sm font-medium text-blue-600 hover:underline">← Volver</button>
      </div>
    </div>
  );

  if (paso === 'enviando') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4" />
        <p className="text-sm opacity-80">Enviando inspección...</p>
      </div>
    </div>
  );

  const secciones = [...new Set(items.map(i => i.seccion || 'General'))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/10 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {data?.empresa?.logoUrl && <img src={data.empresa.logoUrl} alt="Logo" className="h-8 w-auto object-contain rounded" />}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{data?.qr?.activoNombre}</p>
            <p className="text-white/60 text-xs truncate">{data?.plantilla?.nombre}</p>
          </div>
          <ClipboardCheck className="w-5 h-5 text-white/60 shrink-0" />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4 pb-24">
        {/* Intro card */}
        {paso === 'intro' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="h-2" style={{ backgroundColor: primary }} />
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ClipboardCheck className="w-8 h-8" style={{ color: primary }} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">{data?.qr?.titulo || 'Inspección de activo'}</h1>
              <p className="text-sm text-gray-500 mb-1">{data?.qr?.activoNombre}</p>
              {data?.qr?.sector && <p className="text-xs text-blue-500 mb-4">📍 {data?.qr?.sector}</p>}
              {data?.qr?.instrucciones && <p className="text-sm text-gray-600 mb-4">{data?.qr?.instrucciones}</p>}

              <div className="bg-gray-50 rounded-xl p-4 text-left mb-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del inspector</p>
                <input placeholder="Nombre y apellido *" value={inspector.nombre} onChange={e => setInspector(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" />
                <input placeholder="Email (opcional)" type="email" value={inspector.email} onChange={e => setInspector(p => ({ ...p, email: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" />
                <input placeholder="Teléfono (opcional)" type="tel" value={inspector.phone} onChange={e => setInspector(p => ({ ...p, phone: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" />
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del viaje</p>
                <input placeholder="Dominio tractor" value={inspector.dominioTractor} onChange={e => setInspector(p => ({ ...p, dominioTractor: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none uppercase" />
                <input placeholder="Dominio semi (opcional)" value={inspector.dominioSemi} onChange={e => setInspector(p => ({ ...p, dominioSemi: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none uppercase" />
                <input placeholder="Ruta" value={inspector.ruta} onChange={e => setInspector(p => ({ ...p, ruta: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" />
                <div className="relative">
                  <input placeholder="Kilometraje actual del vehículo *" type="number" min="0" value={inspector.km} onChange={e => setInspector(p => ({ ...p, km: e.target.value }))}
                    className="w-full text-sm border border-blue-300 bg-blue-50 rounded-xl px-3 py-2.5 outline-none font-semibold" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-medium">km</span>
                </div>
              </div>
              <button onClick={() => { if (!inspector.nombre.trim()) { alert('Ingresá tu nombre para continuar'); return; } setPaso('form'); }}
                className="w-full text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
                style={{ backgroundColor: primary }}>
                Comenzar inspección <ChevronRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-gray-400 mt-3">{items.length} items · {data?.empresa?.nombre}</p>
            </div>
          </div>
        )}

        {/* Formulario */}
        {paso === 'form' && (
          <>
            {/* Resumen inspector + viaje */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold shrink-0" style={{ color: primary }}>
                  {inspector.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{inspector.nombre}</p>
                  <p className="text-xs text-gray-400">{data?.qr?.activoNombre} · {new Date().toLocaleDateString('es-AR')}</p>
                </div>
              </div>
              {(inspector.dominioTractor || inspector.dominioSemi || inspector.ruta) && (
                <div className="flex flex-wrap gap-2">
                  {inspector.dominioTractor && (
                    <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg border border-blue-100">
                      🚛 Tractor: {inspector.dominioTractor.toUpperCase()}
                    </span>
                  )}
                  {inspector.dominioSemi && (
                    <span className="text-xs bg-slate-50 text-slate-700 font-semibold px-2.5 py-1 rounded-lg border border-slate-100">
                      🚜 Semi: {inspector.dominioSemi.toUpperCase()}
                    </span>
                  )}
                  {inspector.ruta && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-lg border border-emerald-100">
                      📍 Ruta: {inspector.ruta}
                    </span>
                  )}
                  {inspector.km && (
                    <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg border border-blue-100">
                      🔢 {parseInt(inspector.km).toLocaleString('es-AR')} km
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Diagrama de puntos de control */}
            {data?.plantilla?.diagramaFotos?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Diagrama de control del activo</p>
                </div>
                <div className="p-2">
                  <AssetDiagram
                    categoria={data.plantilla.categoria}
                    logoUrl={data?.empresa?.logoUrl}
                    companyName={data?.empresa?.nombre}
                    primaryColor={primary}
                    diagramaFotos={data.plantilla.diagramaFotos}
                  />
                </div>
              </div>
            )}

            {secciones.map(seccion => {
              const secItems = items.filter(i => (i.seccion || 'General') === seccion);
              return (
                <div key={seccion} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{seccion}</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {secItems.map(item => {
                      const resp = respuestas[item.id] || { itemId: item.id, valor: null, esOk: undefined, observacion: '' };
                      return (
                        <div key={item.id} className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="text-sm text-gray-800 flex-1">{item.label}{item.isRequerido && <span className="text-red-400 ml-1">*</span>}</p>
                          </div>

                          {(item.tipo === 'SI_NO' || item.tipo === 'CHECKBOX') && (
                            <div className="flex gap-2">
                              <button onClick={() => setResp(item.id, { esOk: true, valor: true })}
                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${resp.esOk === true ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 text-gray-600 hover:bg-emerald-50'}`}>
                                ✓ Cumple
                              </button>
                              <button onClick={() => setResp(item.id, { esOk: false, valor: false })}
                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${resp.esOk === false ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:bg-red-50'}`}>
                                ✗ No cumple
                              </button>
                            </div>
                          )}

                          {item.tipo === 'TEXTO' && (
                            <textarea value={resp.observacion || ''} onChange={e => setResp(item.id, { observacion: e.target.value, valor: e.target.value, esOk: true })}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none h-16" placeholder="Ingresá tu observación..." />
                          )}

                          {item.tipo === 'NUMERO' && (
                            <input type="number" value={resp.valor ?? ''} onChange={e => setResp(item.id, { valor: e.target.value, esOk: true })}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" placeholder="0" />
                          )}

                          {item.tipo === 'ESCALA' && (
                            <div className="flex gap-2">
                              {(item.opciones || ['1', '2', '3', '4', '5']).map(op => (
                                <button key={op} onClick={() => setResp(item.id, { valor: op, esOk: true })}
                                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${resp.valor === op ? 'text-white border-transparent' : 'border-gray-200 text-gray-600'}`}
                                  style={resp.valor === op ? { backgroundColor: primary } : {}}>
                                  {op}
                                </button>
                              ))}
                            </div>
                          )}

                          {item.tipo === 'FECHA' && (
                            <input type="date" value={resp.valor ?? ''} onChange={e => setResp(item.id, { valor: e.target.value, esOk: true })}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" />
                          )}

                          {resp.esOk === false && item.triggerHallazgo && (
                            <div className="mt-2">
                              <input placeholder="Describí el problema detectado..." value={resp.observacion || ''}
                                onChange={e => setResp(item.id, { observacion: e.target.value })}
                                className="w-full text-xs border border-red-200 bg-red-50 rounded-xl px-3 py-2 outline-none placeholder:text-red-300" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Notas y puntaje */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-xs font-medium text-gray-600 mb-2">Observaciones generales (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none h-16" placeholder="Ingresá cualquier observación adicional..." />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <span className="text-sm text-gray-600">Puntaje estimado</span>
              <span className="text-lg font-bold" style={{ color: primary }}>{puntaje()}%</span>
            </div>
          </>
        )}
      </div>

      {/* Footer fijo botón enviar */}
      {paso === 'form' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 shadow-lg">
          <div className="max-w-xl mx-auto">
            <button onClick={handleSubmit}
              className="w-full text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-all"
              style={{ backgroundColor: primary }}>
              <Send className="w-4 h-4" />Enviar inspección
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
