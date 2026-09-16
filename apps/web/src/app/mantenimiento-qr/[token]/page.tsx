'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Wrench, Gauge, CalendarClock, History, Send, ChevronDown } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

type Tipo = { id: string; name: string; category: string };
type Preventivo = { id: string; code: string; title: string; type: string; estado: 'VENCIDO' | 'PROXIMO' | 'AL_DIA'; detalle: string };
type Ultima = { id: string; tiposLabel: string[]; descripcion?: string; odometro?: number; performedAt: string; performedByName: string; cumplioPreventivo: boolean };

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
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setError(d.error || 'Error al registrar'); setPaso('error'); return; }
      localStorage.setItem('mant_qr_nombre', nombre.trim());
      if (email.trim()) localStorage.setItem('mant_qr_email', email.trim());
      if (phone.trim()) localStorage.setItem('mant_qr_phone', phone.trim());
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
      <button onClick={() => { setSelTipos(new Set()); setSelPlan(''); setDescripcion(''); setPaso('form'); }}
        style={{ ...S.btn, background: primary, marginTop: 24 }}>
        Registrar otra intervención
      </button>
    </div></div>
  );

  const activo = data.activo;
  const preventivos: Preventivo[] = data.preventivos ?? [];
  const pendientes = preventivos.filter(p => p.estado !== 'AL_DIA');
  const ultimas: Ultima[] = data.ultimasIntervenciones ?? [];

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
          {Object.entries(tiposPorCategoria).map(([cat, tipos]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>{cat}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tipos.map(t => {
                  const sel = selTipos.has(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => toggleTipo(t.id)}
                      style={{
                        padding: '8px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                        border: sel ? `2px solid ${primary}` : '1px solid #D1D5DB',
                        background: sel ? `${primary}15` : '#fff',
                        color: sel ? primary : '#374151', fontWeight: sel ? 600 : 400,
                      }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

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
            <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} placeholder="Observaciones (repuestos usados, detalles…)" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

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
