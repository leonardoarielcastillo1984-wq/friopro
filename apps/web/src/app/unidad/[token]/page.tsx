'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2, AlertCircle, Truck, Gauge, ClipboardCheck, AlertTriangle,
  Fuel, PlayCircle, StopCircle, FileText, ArrowLeft, Send,
  Camera, Loader2, MapPin, Wrench, ChevronRight, X, HeartPulse, Clock,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE || '/api';
type Vista = 'hub' | 'incidente' | 'combustible' | 'servicio' | 'documentos' | 'control';

const TIPOS_INC = [
  { id: 'ACCIDENTE_TRANSITO', label: 'Accidente de tránsito', icon: '🚗' },
  { id: 'LESION_PERSONAL', label: 'Lesión personal', icon: '🩹' },
  { id: 'ROBO_HURTO', label: 'Robo / hurto', icon: '🚨' },
  { id: 'PROBLEMA_CARGA', label: 'Problema con la carga', icon: '📦' },
  { id: 'CONTROL_TRANSITO', label: 'Control / multa', icon: '👮' },
  { id: 'DEMORA', label: 'Demora carga/descarga', icon: '⏱️' },
  { id: 'OTRO', label: 'Otro evento', icon: '❗' },
];
const GRAV = [
  { id: 'BAJA', label: 'Baja', c: '#16A34A' }, { id: 'MEDIA', label: 'Media', c: '#D97706' },
  { id: 'ALTA', label: 'Alta', c: '#EA580C' }, { id: 'CRITICA', label: 'Crítica', c: '#DC2626' },
];
const CAT_L: Record<string, string> = { SEGURIDAD_HIGIENE: 'Seguridad e higiene', COMUNICADO: 'Comunicados', DOCUMENTO_UNIDAD: 'Doc. de la unidad', GENERAL: 'General' };
const VTO_L: Record<string, string> = { VTV: 'VTV', SEGURO: 'Seguro', HABILITACION: 'Habilitación', RUTA: 'RUTA', OTRO: 'Otro' };

export default function UnidadHubPage() {
  const { token } = useParams() as { token: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [vista, setVista] = useState<Vista>('hub');
  const [paso, setPaso] = useState<'form' | 'enviando' | 'ok' | 'error'>('form');
  const [resultado, setResultado] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [conductorId, setConductorId] = useState('');
  const [otroChofer, setOtroChofer] = useState(false);
  // incidente
  const [iTipo, setITipo] = useState(''); const [iGrav, setIGrav] = useState('MEDIA');
  const [iDesc, setIDesc] = useState(''); const [iLes, setILes] = useState(false);
  const [iLesDet, setILesDet] = useState(''); const [iTerc, setITerc] = useState('');
  const [iKm, setIKm] = useState(''); const [iFotos, setIFotos] = useState<string[]>([]);
  // combustible
  const [cModo, setCModo] = useState<'litros' | 'monto'>('litros');
  const [cLitros, setCLitros] = useState(''); const [cMonto, setCMonto] = useState('');
  const [cPrecio, setCPrecio] = useState(''); const [cKm, setCKm] = useState('');
  const [cEst, setCEst] = useState(''); const [cUrea, setCUrea] = useState(''); const [cTicket, setCTicket] = useState('');
  const [cTipo, setCTipo] = useState<string | null>(null); // null = usar el tipo declarado del vehículo
  const tipoComb = cTipo || data?.vehiculo?.tipoCombustible || 'DIESEL';
  const unComb = tipoComb === 'GNC' ? 'm³' : 'L';
  // servicio
  const [sTipo, setSTipo] = useState<'INICIO_SERVICIO' | 'FIN_SERVICIO'>('INICIO_SERVICIO');
  const [sKm, setSKm] = useState(''); const [sNotas, setSNotas] = useState('');
  const [sOrigen, setSOrigen] = useState(''); const [sDestino, setSDestino] = useState(''); const [sCarga, setSCarga] = useState('');
  // control pre-servicio (aptitud)
  const [pSis, setPSis] = useState(''); const [pDia, setPDia] = useState('');
  const [pAlc, setPAlc] = useState(''); const [pTemp, setPTemp] = useState('');
  const [pDesc, setPDesc] = useState(''); const [pFatiga, setPFatiga] = useState(0);
  const [pMed, setPMed] = useState(false); const [pMedDet, setPMedDet] = useState('');
  const [pObs, setPObs] = useState('');
  // docs
  const [docs, setDocs] = useState<any>(null); const [docsLoad, setDocsLoad] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fotoTarget = useRef<'i' | 't'>('i');

  useEffect(() => {
    fetch(`${API}/driver-hub/public/${token}`).then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); setLoading(false); return; }
      setData(d);
      const km = d.vehiculo?.currentOdometer;
      if (km) { setIKm(String(Math.round(km))); setCKm(String(Math.round(km))); setSKm(String(Math.round(km))); }
      // Restaurar chofer identificado
      const cid = localStorage.getItem('hub_conductor_id');
      if (cid && d.choferes?.some((c: any) => c.id === cid)) {
        setConductorId(cid);
        const c = d.choferes.find((x: any) => x.id === cid);
        if (c) setNombre(c.nombre);
      } else if (localStorage.getItem('hub_nombre')) {
        setOtroChofer(true);
      }
      setLoading(false);
    }).catch(() => { setError('No se pudo cargar'); setLoading(false); });
  }, [token]);
  useEffect(() => {
    const n = localStorage.getItem('hub_nombre'); if (n) setNombre(n);
    const t = localStorage.getItem('hub_telefono'); if (t) setTelefono(t);
  }, []);

  const gps = (): Promise<any> => new Promise(res => {
    if (!navigator.geolocation) return res({});
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 5000 });
  });
  const subirFoto = async (f: File) => {
    setSubiendo(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const d = await (await fetch(`${API}/driver-hub/public/${token}/upload`, { method: 'POST', body: fd })).json();
      if (d.url) { if (fotoTarget.current === 'i') setIFotos(p => [...p, d.url]); else setCTicket(d.url); }
    } catch { }
    setSubiendo(false);
  };
  const irA = (v: Vista) => {
    setPaso('form'); setResultado(null); setError('');
    if (v === 'documentos' && !docs) { setDocsLoad(true); fetch(`${API}/driver-hub/public/${token}/documentos`).then(r => r.json()).then(setDocs).catch(() => setDocs({ documentos: [], vencimientos: [] })).finally(() => setDocsLoad(false)); }
    setVista(v);
  };
  const post = async (path: string, body: any) => {
    setPaso('enviando');
    try {
      const res = await fetch(`${API}/driver-hub/public/${token}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok || d.error) { setError(d.error || 'Error'); setPaso('error'); return; }
      localStorage.setItem('hub_nombre', nombre.trim()); if (telefono.trim()) localStorage.setItem('hub_telefono', telefono.trim());
      if (conductorId) localStorage.setItem('hub_conductor_id', conductorId); else localStorage.removeItem('hub_conductor_id');
      setResultado(d); setPaso('ok');
    } catch { setError('Error de conexión'); setPaso('error'); }
  };

  const envInc = async () => {
    if (!nombre.trim()) return alert('Ingresá tu nombre');
    if (!iTipo) return alert('Seleccioná el tipo');
    post('incidente', { tipo: iTipo, gravedad: iGrav, descripcion: iDesc.trim() || undefined, hayLesionados: iLes, lesionadosDetalle: iLesDet.trim() || undefined, tercerosInvolucrados: iTerc.trim() || undefined, ...(await gps()), odometro: iKm ? +iKm : undefined, fotos: iFotos.map(url => ({ url })), reportadoPorNombre: nombre.trim(), reportadoPorTelefono: telefono.trim() || undefined });
  };
  const envComb = async () => {
    if (!nombre.trim()) return alert('Ingresá tu nombre');
    if (cModo === 'litros' && !cLitros) return alert('Ingresá los litros');
    if (cModo === 'monto' && !cMonto) return alert('Ingresá el monto');
    post('combustible', { litros: cModo === 'litros' && cLitros ? +cLitros : undefined, montoTotal: cModo === 'monto' && cMonto ? +cMonto : undefined, precioPorLitro: cPrecio ? +cPrecio : undefined, odometro: cKm ? +cKm : undefined, estacion: cEst.trim() || undefined, tipoCombustible: tipoComb, litrosUrea: cUrea ? +cUrea : undefined, fotoTicket: cTicket || undefined, conductorId: conductorId || undefined, reportadoPorNombre: nombre.trim() });
  };
  const envServ = async () => {
    if (!nombre.trim()) return alert('Ingresá tu nombre');
    post('servicio', { tipo: sTipo, odometro: sKm ? +sKm : undefined, notas: sNotas.trim() || undefined, ...(await gps()), conductorId: conductorId || undefined, origen: sTipo === 'INICIO_SERVICIO' ? sOrigen.trim() || undefined : undefined, destino: sTipo === 'INICIO_SERVICIO' ? sDestino.trim() || undefined : undefined, carga: sTipo === 'INICIO_SERVICIO' ? sCarga.trim() || undefined : undefined, reportadoPorNombre: nombre.trim(), reportadoPorTelefono: telefono.trim() || undefined });
  };
  const envControl = async () => {
    if (!nombre.trim()) return alert('Ingresá tu nombre');
    if (!pSis && !pAlc && !pDesc && !pFatiga) return alert('Completá al menos una medición');
    post('control', {
      presionSistolica: pSis ? +pSis : undefined,
      presionDiastolica: pDia ? +pDia : undefined,
      alcoholemia: pAlc !== '' ? +pAlc : undefined,
      temperatura: pTemp ? +pTemp : undefined,
      horasDescanso: pDesc ? +pDesc : undefined,
      nivelFatiga: pFatiga || undefined,
      tomaMedicamentos: pMed,
      medicamentosDetalle: pMedDet.trim() || undefined,
      observaciones: pObs.trim() || undefined,
      conductorId: conductorId || undefined,
      reportadoPorNombre: nombre.trim(),
      reportadoPorTelefono: telefono.trim() || undefined,
    });
  };

  const primary = data?.empresa?.color || '#2563eb';
  if (loading) return <div style={S.page}><div style={S.center}><div style={S.spinner} /><p style={S.muted}>Cargando unidad…</p></div></div>;
  if (!data) return <div style={S.page}><div style={S.center}><AlertCircle size={48} color="#DC2626" /><h2 style={{ margin: '12px 0 4px' }}>No disponible</h2><p style={S.muted}>{error}</p></div></div>;
  if (paso === 'ok') return (
    <div style={S.page}><div style={S.center}>
      <CheckCircle2 size={64} color="#16A34A" /><h2 style={{ margin: '16px 0 8px' }}>¡Listo!</h2>
      <p style={{ ...S.muted, maxWidth: 340 }}>{resultado?.mensaje}</p>
      {resultado?.rendimiento && <div style={{ ...S.badge, background: '#DCFCE7', color: '#16A34A', marginTop: 12 }}>Rendimiento: {resultado.rendimiento} km/L</div>}
      {resultado?.horasTrabajadas != null && <div style={{ ...S.badge, background: '#EFF6FF', color: '#2563EB', marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> Jornada: {resultado.horasTrabajadas} h</div>}
      {resultado?.descansoInsuficiente && <div style={{ ...S.badge, background: '#FEE2E2', color: '#DC2626', marginTop: 12 }}>Descanso insuficiente: {resultado.horasDescanso}h (mínimo 12h)</div>}
      <button onClick={() => irA('hub')} style={{ ...S.btn, background: primary, marginTop: 24 }}>Volver al inicio</button>
    </div></div>
  );

  const veh = data.vehiculo; const act = data.activo;
  const HubBtn = ({ icon, label, sub, color, onClick, href }: any) => {
    const inner = <><div style={{ ...S.hubIcon, background: `${color}18`, color }}>{icon}</div><div style={{ flex: 1, textAlign: 'left' }}><div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{label}</div>{sub && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{sub}</div>}</div><ChevronRight size={18} color="#D1D5DB" /></>;
    return href ? <a href={href} style={{ ...S.hubBtn, textDecoration: 'none' }}>{inner}</a> : <button onClick={onClick} style={S.hubBtn}>{inner}</button>;
  };
  const FotoBtn = ({ t }: { t: 'i' | 't' }) => (
    <>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ''; }} />
      <button type="button" onClick={() => { fotoTarget.current = t; fileRef.current?.click(); }} disabled={subiendo} style={{ ...S.btnOutline, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        {subiendo ? <Loader2 size={16} /> : <Camera size={16} />} {subiendo ? 'Subiendo…' : 'Adjuntar foto'}
      </button>
    </>
  );
  const Thumbs = ({ urls, rm }: { urls: string[]; rm: (u: string) => void }) => !urls.length ? null : (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {urls.map(u => <div key={u} style={{ position: 'relative' }}><img src={u} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #E5E7EB' }} /><button onClick={() => rm(u)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button></div>)}
    </div>
  );
  const choferSel = data?.choferes?.find((c: any) => c.id === conductorId) || null;
  const docAlertas: string[] = [];
  if (choferSel) {
    const hoy = Date.now();
    if (choferSel.licenciaVto && new Date(choferSel.licenciaVto).getTime() < hoy) docAlertas.push('la licencia VENCIDA');
    if (choferSel.psicofisicoVto && new Date(choferSel.psicofisicoVto).getTime() < hoy) docAlertas.push('el psicofísico VENCIDO');
  }
  const Chofer = (
    <div style={{ display: 'grid', gap: 10 }}>
      {data?.choferes?.length > 0 && !otroChofer ? (
        <select style={S.input} value={conductorId} onChange={e => {
          const v = e.target.value;
          if (v === '__otro') { setOtroChofer(true); setConductorId(''); setNombre(''); }
          else { setConductorId(v); const c = data.choferes.find((x: any) => x.id === v); if (c) setNombre(c.nombre); }
        }}>
          <option value="">¿Quién sos? *</option>
          {data.choferes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          <option value="__otro">Otro / no estoy en la lista</option>
        </select>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
          <input style={S.input} placeholder="Tu nombre *" value={nombre} onChange={e => setNombre(e.target.value)} />
          {data?.choferes?.length > 0 && <button type="button" onClick={() => setOtroChofer(false)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Elegir de la lista</button>}
        </div>
      )}
      {docAlertas.length > 0 && <p style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, margin: 0 }}>⚠ Tenés {docAlertas.join(' y ')} — avisá a la empresa antes de salir.</p>}
      <input style={S.input} placeholder="Teléfono (opc.)" value={telefono} onChange={e => setTelefono(e.target.value)} />
    </div>
  );
  const Volver = <button onClick={() => irA('hub')} style={{ ...S.btnOutline, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}><ArrowLeft size={16} /> Volver</button>;
  const Err = paso === 'error' && error ? <p style={{ color: '#DC2626', fontSize: 13, marginTop: 10 }}>{error}</p> : null;
  const Env = paso === 'enviando';

  return (
    <div style={S.page}><div style={S.container}>
      <div style={{ ...S.card, textAlign: 'center', borderTop: `4px solid ${primary}` }}>
        {data.empresa?.logo ? <img src={data.empresa.logo} alt="" style={{ maxHeight: 44, maxWidth: 150, objectFit: 'contain', margin: '0 auto 6px' }} /> : <h1 style={{ fontSize: 18, margin: '0 0 4px', color: '#111827' }}>{data.empresa?.nombre || 'SGI 360'}</h1>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}><Truck size={20} color={primary} /><h2 style={{ margin: 0, fontSize: 18, color: '#111827' }}>{veh?.dominio || act?.nombre}</h2></div>
        <p style={{ ...S.muted, marginTop: 4 }}>{[veh?.marca, veh?.modelo, veh?.tipo].filter(Boolean).join(' · ') || act?.codigo || ''}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {veh?.currentOdometer != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F3F4F6', borderRadius: 8, padding: '3px 10px', fontSize: 12, color: '#374151' }}><Gauge size={13} /> {Number(veh.currentOdometer).toLocaleString('es-AR')} km</span>}
          {veh?.conductor && <span style={{ fontSize: 12, color: '#6B7280' }}>Chofer: {veh.conductor}</span>}
        </div>
      </div>

      {vista === 'hub' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {data.checklistUrl && <HubBtn href={data.checklistUrl} color="#2563EB" icon={<ClipboardCheck size={22} />} label="Checklist pre-viaje" sub="Verificación de la unidad antes de salir" />}
          <HubBtn onClick={() => irA('incidente')} color="#DC2626" icon={<AlertTriangle size={22} />} label="Reportar incidente" sub="Accidente, lesión, robo, carga, control…" />
          <HubBtn onClick={() => irA('combustible')} color="#D97706" icon={<Fuel size={22} />} label="Cargué combustible" sub="Litros o monto gastado" />
          <HubBtn onClick={() => irA('control')} color="#E11D48" icon={<HeartPulse size={22} />} label="Control pre-servicio" sub="Presión arterial, alcoholemia y aptitud" />
          <HubBtn onClick={() => { setSTipo('INICIO_SERVICIO'); irA('servicio'); }} color="#16A34A" icon={<PlayCircle size={22} />} label="Inicio / fin de servicio" sub="Tomar o cerrar la jornada" />
          <HubBtn onClick={() => irA('documentos')} color="#0891B2" icon={<FileText size={22} />} label="Documentación" sub="Seguridad, comunicados y docs de la unidad" />
          <HubBtn href={data.intervencionUrl} color="#6B7280" icon={<Wrench size={22} />} label="Intervención mecánica" sub="Service, reparación o emergencia mecánica" />
        </div>
      )}

      {vista === 'incidente' && (
        <div style={S.card}>{Volver}
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#111827' }}>Reportar incidente</h3>
          <p style={S.label}>¿Qué pasó? *</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {TIPOS_INC.map(t => <button key={t.id} type="button" onClick={() => setITipo(t.id)} style={{ padding: '10px 8px', borderRadius: 10, fontSize: 13, cursor: 'pointer', textAlign: 'left', border: iTipo === t.id ? '2px solid #DC2626' : '1px solid #D1D5DB', background: iTipo === t.id ? '#FEE2E2' : '#fff', color: iTipo === t.id ? '#DC2626' : '#374151', fontWeight: iTipo === t.id ? 600 : 400 }}>{t.icon} {t.label}</button>)}
          </div>
          <p style={S.label}>Gravedad</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {GRAV.map(g => <button key={g.id} type="button" onClick={() => setIGrav(g.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600, border: iGrav === g.id ? `2px solid ${g.c}` : '1px solid #D1D5DB', background: iGrav === g.id ? `${g.c}15` : '#fff', color: iGrav === g.id ? g.c : '#6B7280' }}>{g.label}</button>)}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} placeholder="Describí lo que pasó (opcional)" value={iDesc} onChange={e => setIDesc(e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer' }}><input type="checkbox" checked={iLes} onChange={e => setILes(e.target.checked)} style={{ accentColor: '#DC2626', width: 18, height: 18 }} />Hay personas lesionadas</label>
            {iLes && <input style={S.input} placeholder="¿Quién / cuántos? (opc.)" value={iLesDet} onChange={e => setILesDet(e.target.value)} />}
            <input style={S.input} placeholder="Terceros involucrados (opc.)" value={iTerc} onChange={e => setITerc(e.target.value)} />
            <div><label style={S.label}>Kilometraje actual</label><input style={S.input} type="number" min="0" placeholder="km" value={iKm} onChange={e => setIKm(e.target.value)} /></div>
            {Chofer}<FotoBtn t="i" /><Thumbs urls={iFotos} rm={u => setIFotos(p => p.filter(x => x !== u))} />
            <p style={{ ...S.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> Se adjunta tu ubicación GPS</p>
          </div>
          {Err}
          <button onClick={envInc} disabled={Env} style={{ ...S.btn, background: '#DC2626', width: '100%', marginTop: 14, opacity: Env ? 0.6 : 1 }}><Send size={16} style={{ marginRight: 8, verticalAlign: -3 }} />{Env ? 'Enviando…' : 'Reportar incidente'}</button>
        </div>
      )}

      {vista === 'combustible' && (
        <div style={S.card}>{Volver}
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#111827' }}>Cargué combustible</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[{ id: 'DIESEL', l: 'Diésel' }, { id: 'NAFTA', l: 'Nafta' }, { id: 'GNC', l: 'GNC' }].map(t => <button key={t.id} type="button" onClick={() => setCTipo(t.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, cursor: 'pointer', fontWeight: 600, border: tipoComb === t.id ? '2px solid #0F766E' : '1px solid #D1D5DB', background: tipoComb === t.id ? '#0F766E12' : '#fff', color: tipoComb === t.id ? '#0F766E' : '#6B7280' }}>{t.l}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[{ id: 'litros', l: `Por ${unComb}` }, { id: 'monto', l: 'Por monto ($)' }].map(m => <button key={m.id} type="button" onClick={() => setCModo(m.id as any)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 600, border: cModo === m.id ? `2px solid ${primary}` : '1px solid #D1D5DB', background: cModo === m.id ? `${primary}12` : '#fff', color: cModo === m.id ? primary : '#6B7280' }}>{m.l}</button>)}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {cModo === 'litros'
              ? <div><label style={S.label}>{unComb === 'm³' ? 'm³ cargados *' : 'Litros cargados *'}</label><input style={S.input} type="number" min="0" step="0.1" placeholder="Ej: 120" value={cLitros} onChange={e => setCLitros(e.target.value)} /></div>
              : <div><label style={S.label}>Monto gastado ($) *</label><input style={S.input} type="number" min="0" placeholder="Ej: 85000" value={cMonto} onChange={e => setCMonto(e.target.value)} /></div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={S.label}>Precio/{unComb} (opc.)</label><input style={S.input} type="number" min="0" placeholder={`$/${unComb}`} value={cPrecio} onChange={e => setCPrecio(e.target.value)} /></div>
              <div><label style={S.label}>Kilometraje</label><input style={S.input} type="number" min="0" placeholder="km" value={cKm} onChange={e => setCKm(e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input style={S.input} placeholder="Estación (opc.)" value={cEst} onChange={e => setCEst(e.target.value)} />
              <input style={S.input} type="number" min="0" placeholder="UREA litros (opc.)" value={cUrea} onChange={e => setCUrea(e.target.value)} />
            </div>
            {Chofer}<FotoBtn t="t" />
            {cTicket && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#16A34A' }}><CheckCircle2 size={14} /> Foto del ticket adjunta<button onClick={() => setCTicket('')} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}>quitar</button></div>}
          </div>
          {Err}
          <button onClick={envComb} disabled={Env} style={{ ...S.btn, background: '#D97706', width: '100%', marginTop: 14, opacity: Env ? 0.6 : 1 }}><Send size={16} style={{ marginRight: 8, verticalAlign: -3 }} />{Env ? 'Registrando…' : 'Registrar carga'}</button>
        </div>
      )}

      {vista === 'servicio' && (
        <div style={S.card}>{Volver}
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111827' }}>Registro de servicio</h3>
          <p style={{ ...S.muted, marginBottom: 14 }}>Se registra fecha y hora automáticamente. Al cerrar, se calcula tu jornada; al iniciar, se verifican tus 12h de descanso.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[{ id: 'INICIO_SERVICIO', l: 'Inicio', i: <PlayCircle size={15} />, c: '#16A34A' }, { id: 'FIN_SERVICIO', l: 'Fin', i: <StopCircle size={15} />, c: '#DC2626' }].map(t =>
              <button key={t.id} type="button" onClick={() => setSTipo(t.id as any)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: sTipo === t.id ? `2px solid ${t.c}` : '1px solid #D1D5DB', background: sTipo === t.id ? `${t.c}12` : '#fff', color: sTipo === t.id ? t.c : '#6B7280' }}>{t.i} {t.l}</button>)}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {sTipo === 'INICIO_SERVICIO' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={S.input} placeholder="Origen (opc.)" value={sOrigen} onChange={e => setSOrigen(e.target.value)} />
                <input style={S.input} placeholder="Destino (opc.)" value={sDestino} onChange={e => setSDestino(e.target.value)} />
                <input style={{ ...S.input, gridColumn: '1 / -1' }} placeholder="Carga / mercadería (opc.)" value={sCarga} onChange={e => setSCarga(e.target.value)} />
              </div>
            )}
            <div><label style={S.label}>Kilometraje actual</label><input style={S.input} type="number" min="0" placeholder="km" value={sKm} onChange={e => setSKm(e.target.value)} /></div>
            <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} placeholder="Observaciones (opcional)" value={sNotas} onChange={e => setSNotas(e.target.value)} />
            {Chofer}
            <p style={{ ...S.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> Se adjunta tu ubicación GPS</p>
          </div>
          {Err}
          <button onClick={envServ} disabled={Env} style={{ ...S.btn, background: sTipo === 'FIN_SERVICIO' ? '#DC2626' : '#16A34A', width: '100%', marginTop: 14, opacity: Env ? 0.6 : 1 }}><Send size={16} style={{ marginRight: 8, verticalAlign: -3 }} />{Env ? 'Registrando…' : `Registrar ${sTipo === 'INICIO_SERVICIO' ? 'inicio' : 'fin'}`}</button>
        </div>
      )}

      {vista === 'control' && (
        <div style={S.card}>{Volver}
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111827' }}>Control pre-servicio</h3>
          <p style={{ ...S.muted, marginBottom: 14 }}>Registrá tus mediciones antes de tomar servicio. El sistema evalúa tu aptitud automáticamente.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label style={S.label}>Presión arterial (mmHg)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={S.input} type="number" min="50" max="260" placeholder="Sistólica (ej: 120)" value={pSis} onChange={e => setPSis(e.target.value)} />
                <input style={S.input} type="number" min="30" max="180" placeholder="Diastólica (ej: 80)" value={pDia} onChange={e => setPDia(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={S.label}>Alcoholemia (g/L)</label><input style={S.input} type="number" min="0" max="5" step="0.01" placeholder="0.00" value={pAlc} onChange={e => setPAlc(e.target.value)} /></div>
              <div><label style={S.label}>Temperatura (°C)</label><input style={S.input} type="number" min="30" max="45" step="0.1" placeholder="36.5" value={pTemp} onChange={e => setPTemp(e.target.value)} /></div>
            </div>
            <div><label style={S.label}>Horas de descanso previas</label><input style={S.input} type="number" min="0" max="24" step="0.5" placeholder="Ej: 8" value={pDesc} onChange={e => setPDesc(e.target.value)} /></div>
            <div>
              <label style={S.label}>Nivel de fatiga / somnolencia (1 = alerta · 9 = muy somnoliento)</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button key={n} type="button" onClick={() => setPFatiga(pFatiga === n ? 0 : n)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: pFatiga === n ? `2px solid ${n >= 7 ? '#DC2626' : n >= 5 ? '#D97706' : '#16A34A'}` : '1px solid #D1D5DB', background: pFatiga === n ? (n >= 7 ? '#FEE2E2' : n >= 5 ? '#FEF3C7' : '#DCFCE7') : '#fff', color: pFatiga === n ? (n >= 7 ? '#DC2626' : n >= 5 ? '#D97706' : '#16A34A') : '#6B7280' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={pMed} onChange={e => setPMed(e.target.checked)} style={{ accentColor: '#E11D48', width: 18, height: 18 }} />
              Estoy tomando medicamentos que pueden afectar la conducción
            </label>
            {pMed && <input style={S.input} placeholder="¿Cuáles? (opc.)" value={pMedDet} onChange={e => setPMedDet(e.target.value)} />}
            <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} placeholder="Observaciones (opcional)" value={pObs} onChange={e => setPObs(e.target.value)} />
            {Chofer}
          </div>
          {Err}
          <button onClick={envControl} disabled={Env} style={{ ...S.btn, background: '#E11D48', width: '100%', marginTop: 14, opacity: Env ? 0.6 : 1 }}><Send size={16} style={{ marginRight: 8, verticalAlign: -3 }} />{Env ? 'Registrando…' : 'Registrar control'}</button>
        </div>
      )}

      {vista === 'documentos' && (
        <div style={S.card}>{Volver}
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#111827' }}>Documentación</h3>
          {docsLoad && <p style={S.muted}>Cargando…</p>}
          {docs && <>
            {docs.vencimientos?.length > 0 && <div style={{ marginBottom: 16 }}>
              <p style={{ ...S.label, marginBottom: 8 }}>Documentos de la unidad</p>
              {docs.vencimientos.map((v: any) => {
                const dias = Math.ceil((new Date(v.fechaVto).getTime() - Date.now()) / 86400000);
                const venc = dias < 0; const prox = !venc && dias <= (v.alertaDias || 30);
                return <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #F3F4F6' }}>
                  <FileText size={18} color={venc ? '#DC2626' : prox ? '#D97706' : '#16A34A'} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{VTO_L[v.tipo] || v.tipo}</div>{v.descripcion && <div style={{ fontSize: 12, color: '#6B7280' }}>{v.descripcion}</div>}</div>
                  <span style={{ ...S.badge, background: venc ? '#FEE2E2' : prox ? '#FEF3C7' : '#DCFCE7', color: venc ? '#DC2626' : prox ? '#D97706' : '#16A34A' }}>{venc ? 'Venció' : 'Vence'} {new Date(v.fechaVto).toLocaleDateString('es-AR')}</span>
                </div>;
              })}
            </div>}
            {docs.documentos?.length > 0 ? <>
              <p style={{ ...S.label, marginBottom: 8 }}>Documentos para consultar</p>
              {docs.documentos.map((d: any) => (
                <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid #F3F4F6', textDecoration: 'none' }}>
                  <div style={{ ...S.hubIcon, background: '#0891B218', color: '#0891B2', width: 36, height: 36 }}><FileText size={18} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{d.titulo}</div><div style={{ fontSize: 11, color: '#6B7280' }}>{CAT_L[d.categoria] || d.categoria}{d.vehiculoId ? ' · esta unidad' : ' · general'} · {new Date(d.createdAt).toLocaleDateString('es-AR')}</div></div>
                  <ChevronRight size={16} color="#D1D5DB" />
                </a>
              ))}
            </> : !docs.vencimientos?.length && <p style={S.muted}>No hay documentos disponibles.</p>}
          </>}
        </div>
      )}
      <p style={{ ...S.muted, textAlign: 'center', fontSize: 11 }}>Hub del chofer · SGI 360</p>
    </div></div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F3F4F6', padding: '16px 12px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  container: { maxWidth: 520, margin: '0 auto', display: 'grid', gap: 12 },
  center: { minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  card: { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  muted: { color: '#6B7280', fontSize: 13, margin: 0 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  btn: { border: 'none', color: '#fff', fontWeight: 600, fontSize: 15, padding: '13px 20px', borderRadius: 12, cursor: 'pointer' },
  btnOutline: { border: '1px solid #D1D5DB', color: '#374151', fontWeight: 500, fontSize: 13, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', background: '#fff' },
  badge: { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 },
  hubBtn: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', background: '#fff', borderRadius: 14, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'pointer' },
  hubIcon: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  spinner: { width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' },
};
