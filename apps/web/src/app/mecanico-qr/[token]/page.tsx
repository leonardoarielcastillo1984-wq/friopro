'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, HardHat, Truck, Clock, PlayCircle, Send, Package, Minus, Plus, X } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

type Vehiculo = { id: string; dominio: string; marca?: string | null; modelo?: string | null; tipo?: string };
type Activo = { id: string; name: string; code?: string | null; currentOdometer?: number | null };
type Orden = {
  id: string; code: string; title: string; description?: string | null;
  type: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; status: string;
  scheduledDate: string | null; startedAt: string | null; completedAt: string | null;
  estimatedDuration: number | null;
  activo: Activo | null; activoNombreLibre: string | null; vehiculo: Vehiculo | null;
};
type Repuesto = { id: string; code: string; name: string; currentStock: number; unitCost: number };

const PRIORIDAD_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  CRITICAL: { bg: '#FEE2E2', color: '#DC2626', label: 'Crítica' },
  HIGH: { bg: '#FFEDD5', color: '#EA580C', label: 'Alta' },
  MEDIUM: { bg: '#FEF3C7', color: '#D97706', label: 'Media' },
  LOW: { bg: '#DCFCE7', color: '#16A34A', label: 'Baja' },
};

const ESTADO_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En curso', ON_HOLD: 'En espera', COMPLETED: 'Completada',
};

export default function MecanicoQRPage() {
  const { token } = useParams() as { token: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState<Orden | null>(null);
  const [notas, setNotas] = useState('');
  const [odometro, setOdometro] = useState('');
  const [selRepuestos, setSelRepuestos] = useState<Record<string, number>>({});
  const [repuestoAAgregar, setRepuestoAAgregar] = useState('');
  const [cantidadAAgregar, setCantidadAAgregar] = useState('1');
  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState('');

  const cargar = useCallback(() => {
    fetch(`${API_BASE}/mecanico-qr/public/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);
        setLoading(false);
      })
      .catch(() => { setError('No se pudo cargar la información'); setLoading(false); });
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const iniciar = async (orden: Orden) => {
    setBusyId(orden.id);
    try {
      const res = await fetch(`${API_BASE}/mecanico-qr/public/${token}/ordenes/${orden.id}/iniciar`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'No se pudo iniciar la orden');
      cargar();
    } catch (e: any) {
      alert(e?.message || 'Error al iniciar la orden');
    } finally {
      setBusyId(null);
    }
  };

  const abrirCierre = (orden: Orden) => {
    setCerrando(orden);
    setNotas('');
    setOdometro(orden.activo?.currentOdometer != null ? String(Math.round(orden.activo.currentOdometer)) : '');
    setSelRepuestos({});
    setMensajeOk('');
  };

  const repuestosDisponibles: Repuesto[] = data?.repuestosDisponibles ?? [];
  const repuestosNoAgregados = repuestosDisponibles.filter((r) => !(r.id in selRepuestos));

  const agregarRepuesto = () => {
    if (!repuestoAAgregar) return;
    const parte = repuestosDisponibles.find((r) => r.id === repuestoAAgregar);
    if (!parte) return;
    const cant = Math.max(1, Math.min(parte.currentStock, parseInt(cantidadAAgregar) || 1));
    setSelRepuestos((prev) => ({ ...prev, [repuestoAAgregar]: cant }));
    setRepuestoAAgregar('');
    setCantidadAAgregar('1');
  };

  const quitarRepuesto = (id: string) => {
    setSelRepuestos((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const finalizar = async () => {
    if (!cerrando) return;
    setEnviando(true);
    try {
      const res = await fetch(`${API_BASE}/mecanico-qr/public/${token}/ordenes/${cerrando.id}/completar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notas: notas.trim() || undefined,
          odometro: odometro ? parseFloat(odometro) : undefined,
          repuestos: Object.entries(selRepuestos).filter(([, qty]) => qty > 0).map(([sparePartId, quantity]) => ({ sparePartId, quantity })),
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'No se pudo finalizar la orden');
      setMensajeOk(d.mensaje || 'Orden completada');
      setTimeout(() => { setCerrando(null); cargar(); }, 1200);
    } catch (e: any) {
      alert(e?.message || 'Error al finalizar la orden');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return (
    <div style={S.page}><div style={S.center}><div style={S.spinner} /><p style={S.muted}>Cargando tus tareas…</p></div></div>
  );

  if (error) return (
    <div style={S.page}><div style={S.center}>
      <AlertCircle size={48} color="#DC2626" />
      <h2 style={{ margin: '12px 0 4px' }}>No disponible</h2>
      <p style={S.muted}>{error}</p>
    </div></div>
  );

  const ordenes: Orden[] = data.ordenes ?? [];
  const completadasHoy: Orden[] = data.completadasHoy ?? [];

  const nombreActivo = (o: Orden) => o.vehiculo?.dominio || o.activo?.name || o.activoNombreLibre || 'Sin unidad asignada';

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={{ ...S.card, textAlign: 'center', borderTop: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <HardHat size={22} color="#2563eb" />
            <h1 style={{ margin: 0, fontSize: 19, color: '#111827' }}>{data.mecanico?.name}</h1>
          </div>
          <p style={{ ...S.muted, marginTop: 6 }}>
            {data.mecanico?.code}{data.mecanico?.specialization ? ` · ${data.mecanico.specialization}` : ''}
          </p>
        </div>

        <h3 style={{ margin: '4px 4px 0', fontSize: 15, color: '#111827' }}>Tus tareas asignadas ({ordenes.length})</h3>

        {ordenes.length === 0 && (
          <div style={{ ...S.card, textAlign: 'center' }}>
            <CheckCircle2 size={32} color="#16A34A" style={{ marginBottom: 8 }} />
            <p style={S.muted}>No tenés órdenes de trabajo pendientes. ¡Buen trabajo!</p>
          </div>
        )}

        {ordenes.map((o) => {
          const pr = PRIORIDAD_STYLE[o.priority] || PRIORIDAD_STYLE.MEDIUM;
          return (
            <div key={o.id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{o.code}</span>
                  <h3 style={{ margin: '2px 0 4px', fontSize: 16, color: '#111827' }}>{o.title}</h3>
                </div>
                <span style={{ ...S.badge, background: pr.bg, color: pr.color, whiteSpace: 'nowrap' }}>{pr.label}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', marginTop: 4 }}>
                <Truck size={14} color="#6B7280" /> {nombreActivo(o)}
              </div>

              {o.scheduledDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  <Clock size={13} /> Programada: {new Date(o.scheduledDate).toLocaleDateString('es-AR')}
                </div>
              )}

              {o.description && <p style={{ fontSize: 13, color: '#374151', marginTop: 8, whiteSpace: 'pre-wrap' }}>{o.description}</p>}

              <div style={{ marginTop: 10 }}>
                <span style={{ ...S.badge, background: '#EFF6FF', color: '#2563EB' }}>{ESTADO_LABEL[o.status] || o.status}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {(o.status === 'PENDING' || o.status === 'ON_HOLD') && (
                  <button onClick={() => iniciar(o)} disabled={busyId === o.id}
                    style={{ ...S.btn, flex: 1, background: '#2563eb', opacity: busyId === o.id ? 0.6 : 1 }}>
                    <PlayCircle size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                    {busyId === o.id ? 'Iniciando…' : 'Iniciar'}
                  </button>
                )}
                <button onClick={() => abrirCierre(o)}
                  style={{ ...S.btn, flex: 1, background: '#16A34A' }}>
                  <CheckCircle2 size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                  Finalizar
                </button>
              </div>
            </div>
          );
        })}

        {completadasHoy.length > 0 && (
          <div style={S.card}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#374151' }}>Completadas hoy</h3>
            {completadasHoy.map((o) => (
              <div key={o.id} style={{ borderTop: '1px solid #F3F4F6', padding: '8px 0', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{o.title}</span>
                  <span style={{ color: '#16A34A', fontSize: 12 }}>✓ {ESTADO_LABEL[o.status]}</span>
                </div>
                <p style={{ ...S.muted, margin: '2px 0 0', fontSize: 12 }}>{nombreActivo(o)}{o.completedAt ? ` · ${new Date(o.completedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
              </div>
            ))}
          </div>
        )}

        <p style={{ ...S.muted, textAlign: 'center', fontSize: 11, marginTop: 8 }}>Centro de trabajo · Flota 360 · SGI 360</p>
      </div>

      {cerrando && (
        <div style={S.overlay} onClick={() => !enviando && setCerrando(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#111827' }}>Finalizar {cerrando.code}</h3>
              <button onClick={() => setCerrando(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#9CA3AF" /></button>
            </div>

            {mensajeOk ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle2 size={40} color="#16A34A" />
                <p style={{ marginTop: 10, color: '#111827' }}>{mensajeOk}</p>
              </div>
            ) : (
              <>
                <label style={S.label}>Odómetro actual (km)</label>
                <input style={S.input} type="number" min="0" placeholder="km" value={odometro} onChange={(e) => setOdometro(e.target.value)} />

                <label style={{ ...S.label, marginTop: 10 }}>Observaciones del trabajo realizado</label>
                <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} placeholder="Detalle lo realizado, repuestos usados, hallazgos…" value={notas} onChange={(e) => setNotas(e.target.value)} />

                {repuestosDisponibles.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Package size={15} color="#2563eb" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Repuestos utilizados (opcional)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={repuestoAAgregar} onChange={(e) => setRepuestoAAgregar(e.target.value)} style={{ ...S.input, flex: 1 }}>
                        <option value="">Seleccionar repuesto…</option>
                        {repuestosNoAgregados.map((r) => (
                          <option key={r.id} value={r.id} disabled={r.currentStock <= 0}>{r.name} ({r.code}) — stock: {r.currentStock}</option>
                        ))}
                      </select>
                      <input type="number" min={1} value={cantidadAAgregar} onChange={(e) => setCantidadAAgregar(e.target.value)} style={{ ...S.input, width: 60, textAlign: 'center' }} />
                      <button type="button" onClick={agregarRepuesto} disabled={!repuestoAAgregar} style={{ ...S.btn, background: '#2563eb', padding: '0 14px', opacity: !repuestoAAgregar ? 0.5 : 1 }}>
                        <Plus size={16} />
                      </button>
                    </div>
                    {Object.keys(selRepuestos).length > 0 && (
                      <div style={{ border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
                        {Object.entries(selRepuestos).map(([id, qty]) => {
                          const r = repuestosDisponibles.find((x) => x.id === id);
                          if (!r) return null;
                          return (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderTop: '1px solid #F3F4F6' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{r.name}</p>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>x{qty}</span>
                              <button type="button" onClick={() => quitarRepuesto(id)} style={{ width: 22, height: 22, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer' }}>
                                <Minus size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button onClick={finalizar} disabled={enviando} style={{ ...S.btn, width: '100%', background: '#16A34A', marginTop: 16, opacity: enviando ? 0.6 : 1 }}>
                  <Send size={16} style={{ marginRight: 8, verticalAlign: -3 }} />
                  {enviando ? 'Guardando…' : 'Confirmar finalización'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F3F4F6', padding: '16px 12px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  container: { maxWidth: 520, margin: '0 auto', display: 'grid', gap: 12 },
  center: { minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  card: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  muted: { color: '#6B7280', fontSize: 13, margin: 0 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 },
  btn: { border: 'none', color: '#fff', fontWeight: 600, fontSize: 14, padding: '11px 16px', borderRadius: 10, cursor: 'pointer' },
  badge: { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 },
  spinner: { width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 },
  sheet: { background: '#fff', borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
};
