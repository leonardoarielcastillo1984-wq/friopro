'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Wrench, Gauge, CalendarClock, History, Send, ChevronDown, Package, Minus, Plus } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

type Tipo = { id: string; name: string; category: string };
type Preventivo = { id: string; code: string; title: string; type: string; estado: 'VENCIDO' | 'PROXIMO' | 'AL_DIA'; detalle: string };
type Ultima = { id: string; tiposLabel: string[]; descripcion?: string; odometro?: number; performedAt: string; performedByName: string; cumplioPreventivo: boolean };
type Repuesto = { id: string; code: string; name: string; currentStock: number; unitCost: number };

const ESTADO_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  VENCIDO: { bg: '#FEE2E2', color: '#DC2626', label: 'Vencido' },
  PROXIMO: { bg: '#FEF3C7', color: '#D97706', label: 'Próximo' },
  AL_DIA: { bg: '#DCFCE7', color: '#16A34A', label: 'Al día' },
};

export default function MantenimientoQRPage() {
  const { token } = useParams() as { token: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [paso, setPaso] = useState<'form' | 'enviando' | 'ok' | 'error'>('form');
  const [resultado, setResultado] = useState<any>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [km, setKm] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState('');
  const [selTipos, setSelTipos] = useState<Set<string>>(new Set());
  const [selPlan, setSelPlan] = useState<string>('');
  const [showHistorial, setShowHistorial] = useState(false);
  const [selRepuestos, setSelRepuestos] = useState<Record<string, number>>({});
  const [repuestoAAgregar, setRepuestoAAgregar] = useState('');
  const [cantidadAAgregar, setCantidadAAgregar] = useState('1');
  const [estadoOp, setEstadoOp] = useState<string | null>(null);
  const [estadoSaving, setEstadoSaving] = useState<string | null>(null);
  const [estadoMsg, setEstadoMsg] = useState('');
  // Cambio/rotación de neumáticos: posKey "eje-lado-posicion" → neumaticoId a montar
  const [cambios, setCambios] = useState<Record<string, string>>({});
  const [pickerPos, setPickerPos] = useState<{ eje: number; lado: string; posicion: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/maintenance-interventions/public/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);
        if (d.activo?.currentOdometer) setKm(String(d.activo.currentOdometer));
        setLoading(false);
      })
      .catch(() => { setError('No se pudo cargar la información'); setLoading(false); });
  }, [token]);

  useEffect(() => {
    const saved = localStorage.getItem('mant_qr_nombre');
    if (saved) setNombre(saved);
    const savedEmail = localStorage.getItem('mant_qr_email');
    if (savedEmail) setEmail(savedEmail);
    const savedPhone = localStorage.getItem('mant_qr_phone');
    if (savedPhone) setPhone(savedPhone);
  }, []);

  const tiposPorCategoria = useMemo(() => {
    const map: Record<string, Tipo[]> = {};
    for (const t of (data?.tipos ?? []) as Tipo[]) {
      (map[t.category] = map[t.category] || []).push(t);
    }
    return map;
  }, [data]);

  const toggleTipo = (id: string) => {
    setSelTipos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Diagrama de cambio/rotación de neumáticos ──────────────────────────────
  const cubiertas: any[] = data?.cubiertas ?? [];
  const neumaticosStock: any[] = data?.neumaticosStock ?? [];
  const vehiculoFlotaData = data?.vehiculoFlota ?? null;
  // ¿Se seleccionó una tarea de la categoría NEUMATICOS?
  const esNeumaticosSel = useMemo(() => {
    const tipos: Tipo[] = data?.tipos ?? [];
    return tipos.some(t => selTipos.has(t.id) && (t.category || '').toUpperCase() === 'NEUMATICOS');
  }, [data, selTipos]);

  const esSemi = (vehiculoFlotaData?.tipo || '').toUpperCase() === 'SEMI';
  const numSteering = esSemi ? 0 : ((vehiculoFlotaData?.configEjes || '').trim().startsWith('8') ? 2 : 1);
  const maxEjeMontado = cubiertas.reduce((m, c) => Math.max(m, c.eje || 0), 0);
  const totalEjes = Math.max(vehiculoFlotaData?.cantEjes ?? 2, maxEjeMontado);
  const ejes = useMemo(() => Array.from({ length: totalEjes }, (_, i) => i + 1), [totalEjes]);
  const esDual = (eje: number) => {
    if (cubiertas.some(c => c.eje === eje && (c.posicion === 'EXT' || c.posicion === 'INT'))) return true;
    if (cubiertas.some(c => c.eje === eje && c.posicion === 'SIMPLE')) return false;
    return esSemi ? true : eje > numSteering;
  };
  const posKey = (eje: number, lado: string, posicion: string) => `${eje}-${lado}-${posicion}`;
  const montadaEn = (eje: number, lado: string, posicion: string) => cubiertas.find(c => c.eje === eje && c.lado === lado && c.posicion === posicion);
  // Cubierta que se muestra en un slot: la asignada en el cambio, o la que ya está montada
  const cubiertaEnSlot = (eje: number, lado: string, posicion: string) => {
    const asignada = cambios[posKey(eje, lado, posicion)];
    if (asignada) {
      const deStock = neumaticosStock.find(n => n.id === asignada);
      const montada = cubiertas.find(c => c.neumaticoId === asignada);
      return { id: asignada, codigo: deStock?.codigo || montada?.codigo || '…', esCambio: true };
    }
    const m = montadaEn(eje, lado, posicion);
    return m?.neumaticoId ? { id: m.neumaticoId, codigo: m.codigo, esCambio: false } : null;
  };
  const asignar = (eje: number, lado: string, posicion: string, neumaticoId: string) => {
    setCambios(prev => ({ ...prev, [posKey(eje, lado, posicion)]: neumaticoId }));
    setPickerPos(null);
  };
  const quitarCambio = (eje: number, lado: string, posicion: string) => {
    setCambios(prev => { const c = { ...prev }; delete c[posKey(eje, lado, posicion)]; return c; });
  };
  // Opciones del picker: stock disponible + cubiertas montadas en otra posición (rotación)
  const opcionesPicker = useMemo(() => {
    const usadasEnCambios = new Set(Object.values(cambios));
    const stock = neumaticosStock.filter(n => !usadasEnCambios.has(n.id)).map(n => ({ id: n.id, label: `${n.codigo}${n.condicion === 'RECAPADA' ? ' (recapada)' : ''}`, sub: n.medida || n.marca || '', origen: 'stock' as const }));
    const montadas = cubiertas
      .filter(c => c.neumaticoId && !usadasEnCambios.has(c.neumaticoId) && !(pickerPos && c.eje === pickerPos.eje && c.lado === pickerPos.lado && c.posicion === pickerPos.posicion))
      .map(c => ({ id: c.neumaticoId, label: `${c.codigo} (montada E${c.eje} ${c.lado === 'IZQ' ? 'izq' : 'der'})`, sub: c.medida || '', origen: 'montada' as const }));
    return { stock, montadas };
  }, [cambios, cubiertas, neumaticosStock, pickerPos]);

  const enviar = async () => {
    if (!nombre.trim()) { alert('Ingresá tu nombre'); return; }
    if (selTipos.size === 0) { alert('Seleccioná al menos una tarea realizada'); return; }
    setPaso('enviando');
    try {
      const res = await fetch(`${API_BASE}/maintenance-interventions/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performedByName: nombre.trim(),
          performedByEmail: email.trim() || undefined,
          performedByPhone: phone.trim() || undefined,
          tipoIds: Array.from(selTipos),
          descripcion: descripcion.trim() || undefined,
          odometro: km ? parseFloat(km) : undefined,
          performedAt: fecha ? new Date(fecha + 'T12:00:00').toISOString() : undefined,
          planId: selPlan || null,
          repuestos: Object.entries(selRepuestos)
            .filter(([, qty]) => qty > 0)
            .map(([sparePartId, quantity]) => ({ sparePartId, quantity })),
          neumaticoCambios: Object.entries(cambios).map(([key, neumaticoId]) => {
            const [eje, lado, posicion] = key.split('-');
            return { eje: parseInt(eje), lado, posicion, neumaticoId };
          }),
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setError(d.error || 'Error al registrar'); setPaso('error'); return; }
      localStorage.setItem('mant_qr_nombre', nombre.trim());
      if (email.trim()) localStorage.setItem('mant_qr_email', email.trim());
      if (phone.trim()) localStorage.setItem('mant_qr_phone', phone.trim());
      setSelRepuestos({});
      setResultado(d);
      setPaso('ok');
    } catch {
      setError('Error de conexión');
      setPaso('error');
    }
  };

  const primary = data?.empresa?.primaryColor || '#2563eb';

  if (loading) return (
    <div style={S.page}><div style={S.center}><div style={S.spinner} /><p style={S.muted}>Cargando ficha del activo…</p></div></div>
  );

  if (error && paso === 'form') return (
    <div style={S.page}><div style={S.center}>
      <AlertCircle size={48} color="#DC2626" />
      <h2 style={{ margin: '12px 0 4px' }}>No disponible</h2>
      <p style={S.muted}>{error}</p>
    </div></div>
  );

  if (paso === 'ok') return (
    <div style={S.page}><div style={S.center}>
      <CheckCircle2 size={64} color="#16A34A" />
      <h2 style={{ margin: '16px 0 8px' }}>¡Intervención registrada!</h2>
      <p style={{ ...S.muted, maxWidth: 340 }}>{resultado?.mensaje}</p>
      {resultado?.cumplioPreventivo && (
        <div style={{ ...S.badge, background: '#DCFCE7', color: '#16A34A', marginTop: 12 }}>
          Preventivo cumplido: {resultado.planTitle}
        </div>
      )}
      {resultado?.otEmergencia && (
        <div style={{ ...S.badge, background: '#FEE2E2', color: '#DC2626', marginTop: 12 }}>
          Se generó la OT de emergencia {resultado.otEmergencia} — la empresa ya fue notificada
        </div>
      )}
      <button onClick={() => { setSelTipos(new Set()); setSelPlan(''); setDescripcion(''); setPaso('form'); }}
        style={{ ...S.btn, background: primary, marginTop: 24 }}>
        Registrar otra intervención
      </button>
    </div></div>
  );

  const activo = data.activo;
  const vehiculoFlota = data.vehiculoFlota ?? null;
  const estadoActual = estadoOp ?? vehiculoFlota?.estadoOperativo ?? null;

  const cambiarEstadoOp = async (estado: string) => {
    setEstadoSaving(estado);
    setEstadoMsg('');
    try {
      const res = await fetch(`${API_BASE}/maintenance-interventions/public/${token}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, mecanicoNombre: nombre || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'No se pudo cambiar el estado');
      setEstadoOp(json.estadoOperativo ?? estado);
      setEstadoMsg(json.sinCambio ? 'La unidad ya estaba en ese estado' : 'Estado actualizado');
    } catch (e: any) {
      setEstadoMsg(e?.message || 'Error al cambiar el estado');
    } finally {
      setEstadoSaving(null);
    }
  };

  const preventivos: Preventivo[] = data.preventivos ?? [];
  const pendientes = preventivos.filter(p => p.estado !== 'AL_DIA');
  const ultimas: Ultima[] = data.ultimasIntervenciones ?? [];
  const repuestosDisponibles: Repuesto[] = data.repuestosDisponibles ?? [];

  const repuestosNoAgregados = repuestosDisponibles.filter(r => !(r.id in selRepuestos));

  const agregarRepuesto = () => {
    if (!repuestoAAgregar) return;
    const parte = repuestosDisponibles.find(r => r.id === repuestoAAgregar);
    if (!parte) return;
    const cant = Math.max(1, Math.min(parte.currentStock, parseInt(cantidadAAgregar) || 1));
    setSelRepuestos(prev => ({ ...prev, [repuestoAAgregar]: cant }));
    setRepuestoAAgregar('');
    setCantidadAAgregar('1');
  };

  const quitarRepuesto = (id: string) => {
    setSelRepuestos(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={{ ...S.card, textAlign: 'center', borderTop: `4px solid ${primary}` }}>
          {data.empresa?.logoUrl
            ? <img src={data.empresa.logoUrl} alt={data.empresa.nombre} style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', margin: '0 auto 8px' }} />
            : <h1 style={{ fontSize: 20, margin: '0 0 4px', color: '#111827' }}>{data.empresa?.nombre}</h1>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <Wrench size={20} color={primary} />
            <h2 style={{ margin: 0, fontSize: 18, color: '#111827' }}>{data.qr.titulo || 'Registro de intervención'}</h2>
          </div>
          <p style={{ ...S.muted, marginTop: 6 }}>
            <strong style={{ color: '#111827' }}>{activo.name}</strong>
            {activo.code ? ` · ${activo.code}` : ''}
            {activo.manufacturer ? ` · ${activo.manufacturer} ${activo.model || ''}` : ''}
          </p>
          {activo.currentOdometer != null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: '#F3F4F6', borderRadius: 8, padding: '4px 12px', fontSize: 13, color: '#374151' }}>
              <Gauge size={14} /> {Number(activo.currentOdometer).toLocaleString('es-AR')} km
            </div>
          )}
          {data.qr.instrucciones && <p style={{ ...S.muted, marginTop: 8, fontStyle: 'italic' }}>{data.qr.instrucciones}</p>}
        </div>

        {/* Estadío operativo de la unidad */}
        {vehiculoFlota && (
          <div style={S.card}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111827' }}>Estadío de la unidad</h3>
            <p style={{ ...S.muted, margin: '0 0 10px', fontSize: 12 }}>
              Estado actual: <strong style={{ color: '#111827' }}>
                {estadoActual === 'EN_TALLER' ? 'En taller' : estadoActual === 'EN_REPARACION' ? 'En reparación' : 'Operativo'}
              </strong>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { k: 'OPERATIVO', label: 'Operativo', color: '#16A34A', bg: '#F0FDF4' },
                { k: 'EN_TALLER', label: 'En taller', color: '#D97706', bg: '#FFFBEB' },
                { k: 'EN_REPARACION', label: 'En reparación', color: '#2563EB', bg: '#EFF6FF' },
              ] as const).map((e) => {
                const activo2 = (estadoActual ?? 'OPERATIVO') === e.k;
                return (
                  <button key={e.k} type="button" onClick={() => cambiarEstadoOp(e.k)}
                    disabled={estadoSaving !== null || activo2}
                    style={{
                      flex: 1, minWidth: 100, padding: '10px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: activo2 ? 'default' : 'pointer',
                      border: activo2 ? `2px solid ${e.color}` : '1px solid #D1D5DB',
                      background: activo2 ? e.bg : '#fff', color: activo2 ? e.color : '#374151',
                      opacity: estadoSaving !== null && estadoSaving !== e.k ? 0.6 : 1,
                    }}>
                    {estadoSaving === e.k ? 'Guardando…' : e.label}
                  </button>
                );
              })}
            </div>
            {estadoMsg && <p style={{ ...S.muted, fontSize: 12, marginTop: 8 }}>{estadoMsg}</p>}
          </div>
        )}

        {/* Preventivos pendientes */}
        {pendientes.length > 0 && (
          <div style={{ ...S.card, borderLeft: '4px solid #D97706' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CalendarClock size={18} color="#D97706" />
              <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>Mantenimientos preventivos pendientes</h3>
            </div>
            {pendientes.map(p => {
              const st = ESTADO_STYLE[p.estado];
              return (
                <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: '1px solid #F3F4F6', cursor: 'pointer' }}>
                  <input type="radio" name="plan" checked={selPlan === p.id} onChange={() => setSelPlan(selPlan === p.id ? '' : p.id)}
                    onClick={() => { if (selPlan === p.id) setSelPlan(''); }}
                    style={{ marginTop: 3, accentColor: primary }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{p.title}</span>
                      <span style={{ ...S.badge, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p style={{ ...S.muted, margin: '2px 0 0', fontSize: 12 }}>{p.detalle}</p>
                  </div>
                </label>
              );
            })}
            <p style={{ ...S.muted, fontSize: 12, marginTop: 8 }}>Marcá el preventivo si esta intervención lo cumple.</p>
          </div>
        )}

        {/* Formulario */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#111827' }}>¿Qué se le hizo al activo?</h3>
          {Object.entries(tiposPorCategoria)
            .sort(([a], [b]) => (a === 'EMERGENCIA' ? -1 : b === 'EMERGENCIA' ? 1 : 0))
            .map(([cat, tipos]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: cat === 'EMERGENCIA' ? '#DC2626' : '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>
                {cat === 'EMERGENCIA' ? 'Emergencia en ruta — genera OT urgente' : cat}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tipos.map(t => {
                  const sel = selTipos.has(t.id);
                  const esEmerg = cat === 'EMERGENCIA';
                  return (
                    <button key={t.id} type="button" onClick={() => toggleTipo(t.id)}
                      style={{
                        padding: '8px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                        border: sel ? `2px solid ${esEmerg ? '#DC2626' : primary}` : esEmerg ? '1px solid #FCA5A5' : '1px solid #D1D5DB',
                        background: sel ? (esEmerg ? '#FEE2E2' : `${primary}15`) : esEmerg ? '#FEF2F2' : '#fff',
                        color: sel ? (esEmerg ? '#DC2626' : primary) : esEmerg ? '#B91C1C' : '#374151', fontWeight: sel ? 600 : 400,
                      }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Diagrama de cambio/rotación de neumáticos — aparece al elegir una tarea de NEUMATICOS */}
          {esNeumaticosSel && vehiculoFlotaData && (
            <div style={{ marginTop: 16, border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>¿En qué posición pusiste cada cubierta?</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>Tocá la posición y elegí la cubierta nueva/recapada (o una montada para rotarla).</p>
              </div>
              <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                {ejes.map(eje => {
                  const dual = esDual(eje);
                  const slots: { lado: 'IZQ' | 'DER'; posicion: 'SIMPLE' | 'EXT' | 'INT' }[] = dual
                    ? [{ lado: 'IZQ', posicion: 'EXT' }, { lado: 'IZQ', posicion: 'INT' }, { lado: 'DER', posicion: 'INT' }, { lado: 'DER', posicion: 'EXT' }]
                    : [{ lado: 'IZQ', posicion: 'SIMPLE' }, { lado: 'DER', posicion: 'SIMPLE' }];
                  return (
                    <div key={eje} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', width: 22 }}>E{eje}</span>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${slots.length},1fr)`, gap: 6 }}>
                        {slots.map(s => {
                          const c = cubiertaEnSlot(eje, s.lado, s.posicion);
                          const esCambio = !!cambios[posKey(eje, s.lado, s.posicion)];
                          return (
                            <button key={posKey(eje, s.lado, s.posicion)} type="button"
                              onClick={() => setPickerPos({ eje, lado: s.lado, posicion: s.posicion })}
                              style={{
                                padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                border: esCambio ? `2px solid ${primary}` : '1px solid #D1D5DB',
                                background: esCambio ? `${primary}15` : c ? '#F3F4F6' : '#fff',
                                color: esCambio ? primary : c ? '#111827' : '#9CA3AF',
                                minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                              }}>
                              <span style={{ fontSize: 9, fontWeight: 400, color: '#9CA3AF' }}>{s.lado === 'IZQ' ? 'Izq' : 'Der'}{s.posicion !== 'SIMPLE' ? ` ${s.posicion === 'EXT' ? 'ext' : 'int'}` : ''}</span>
                              <span>{c ? c.codigo : 'vacía'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {Object.keys(cambios).length > 0 && (
                <div style={{ padding: '8px 12px', borderTop: '1px solid #E5E7EB', background: '#FFFBEB' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#92400E' }}>
                    {Object.keys(cambios).length} cambio(s) marcado(s).{' '}
                    <button type="button" onClick={() => setCambios({})} style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Limpiar</button>
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <input style={S.input} placeholder="Tu nombre y apellido *" value={nombre} onChange={e => setNombre(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input style={S.input} placeholder="Email (opcional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={S.input} placeholder="Teléfono (opcional)" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={S.label}>Kilometraje actual</label>
                <input style={S.input} type="number" min="0" placeholder="km" value={km} onChange={e => setKm(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Fecha</label>
                <input style={S.input} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
            </div>
            <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} placeholder="Observaciones (detalles adicionales…)" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

          {repuestosDisponibles.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Package size={16} color={primary} />
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>Repuestos utilizados (opcional)</h4>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={repuestoAAgregar}
                  onChange={e => setRepuestoAAgregar(e.target.value)}
                  style={{ ...S.input, flex: 1 }}
                >
                  <option value="">Seleccionar repuesto…</option>
                  {repuestosNoAgregados.map(r => (
                    <option key={r.id} value={r.id} disabled={r.currentStock <= 0}>
                      {r.name} ({r.code}) — stock: {r.currentStock}
                    </option>
                  ))}
                </select>
                <input
                  type="number" min={1}
                  value={cantidadAAgregar}
                  onChange={e => setCantidadAAgregar(e.target.value)}
                  style={{ ...S.input, width: 64, textAlign: 'center' }}
                />
                <button type="button" onClick={agregarRepuesto} disabled={!repuestoAAgregar}
                  style={{ ...S.btn, background: primary, padding: '0 16px', opacity: !repuestoAAgregar ? 0.5 : 1 }}>
                  <Plus size={16} />
                </button>
              </div>

              {Object.keys(selRepuestos).length > 0 && (
                <div style={{ border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden', marginTop: 10 }}>
                  {Object.entries(selRepuestos).map(([id, qty]) => {
                    const r = repuestosDisponibles.find(x => x.id === id);
                    if (!r) return null;
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{r.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>{r.code}</p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>x{qty}</span>
                        <button type="button" onClick={() => quitarRepuesto(id)}
                          style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Minus size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {paso === 'error' && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 10 }}>{error}</p>}

          <button onClick={enviar} disabled={paso === 'enviando'}
            style={{ ...S.btn, background: primary, width: '100%', marginTop: 16, opacity: paso === 'enviando' ? 0.6 : 1 }}>
            <Send size={16} style={{ marginRight: 8, verticalAlign: -3 }} />
            {paso === 'enviando' ? 'Registrando…' : 'Registrar intervención'}
          </button>
        </div>

        {/* Historial reciente */}
        {ultimas.length > 0 && (
          <div style={S.card}>
            <button onClick={() => setShowHistorial(!showHistorial)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <History size={16} color="#6B7280" />
              <h3 style={{ margin: 0, fontSize: 14, color: '#374151', flex: 1, textAlign: 'left' }}>Últimas intervenciones</h3>
              <ChevronDown size={16} color="#6B7280" style={{ transform: showHistorial ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </button>
            {showHistorial && ultimas.map(u => (
              <div key={u.id} style={{ borderTop: '1px solid #F3F4F6', padding: '10px 0', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{u.tiposLabel.join(' + ')}</span>
                  <span style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{new Date(u.performedAt).toLocaleDateString('es-AR')}</span>
                </div>
                <p style={{ ...S.muted, margin: '2px 0 0', fontSize: 12 }}>
                  {u.performedByName}{u.odometro ? ` · ${Number(u.odometro).toLocaleString('es-AR')} km` : ''}
                  {u.cumplioPreventivo && <span style={{ color: '#16A34A' }}> · ✓ preventivo</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        <p style={{ ...S.muted, textAlign: 'center', fontSize: 11, marginTop: 8 }}>Registro de intervenciones · SGI 360</p>
      </div>

      {/* Picker de cubierta para la posición tocada */}
      {pickerPos && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setPickerPos(null)}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 520, borderRadius: '16px 16px 0 0', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
                Eje {pickerPos.eje} · {pickerPos.lado === 'IZQ' ? 'Izquierda' : 'Derecha'}{pickerPos.posicion !== 'SIMPLE' ? ` ${pickerPos.posicion === 'EXT' ? 'externa' : 'interna'}` : ''}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>¿Qué cubierta va en esta posición?</p>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 12px' }}>
              {cambios[posKey(pickerPos.eje, pickerPos.lado, pickerPos.posicion)] && (
                <button type="button" onClick={() => { quitarCambio(pickerPos.eje, pickerPos.lado, pickerPos.posicion); }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, borderRadius: 10, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ✕ Quitar cambio (dejar como estaba)
                </button>
              )}
              {opcionesPicker.stock.length > 0 && (
                <p style={{ margin: '6px 4px 4px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>De stock</p>
              )}
              {opcionesPicker.stock.map(o => (
                <button key={o.id} type="button" onClick={() => asignar(pickerPos.eje, pickerPos.lado, pickerPos.posicion, o.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '11px 12px', marginBottom: 4, borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>{o.label}</p>
                  {o.sub && <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>{o.sub}</p>}
                </button>
              ))}
              {opcionesPicker.montadas.length > 0 && (
                <p style={{ margin: '10px 4px 4px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Rotar desde otra posición</p>
              )}
              {opcionesPicker.montadas.map(o => (
                <button key={o.id} type="button" onClick={() => asignar(pickerPos.eje, pickerPos.lado, pickerPos.posicion, o.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '11px 12px', marginBottom: 4, borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>{o.label}</p>
                  {o.sub && <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>{o.sub}</p>}
                </button>
              ))}
              {opcionesPicker.stock.length === 0 && opcionesPicker.montadas.length === 0 && (
                <p style={{ padding: '16px', fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>No hay cubiertas disponibles ni montadas para mover.</p>
              )}
            </div>
            <button type="button" onClick={() => setPickerPos(null)}
              style={{ margin: 12, padding: '12px', borderRadius: 12, border: 'none', background: '#F3F4F6', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
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
  card: { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  muted: { color: '#6B7280', fontSize: 13, margin: 0 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 },
  btn: { border: 'none', color: '#fff', fontWeight: 600, fontSize: 15, padding: '13px 20px', borderRadius: 12, cursor: 'pointer' },
  badge: { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 },
  spinner: { width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' },
};
