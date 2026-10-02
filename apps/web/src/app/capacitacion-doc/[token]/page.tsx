'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { GraduationCap, FileText, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE || '/api';

type DocData = {
  training: { title: string; code: string };
  materialUrl: string | null;
  attendeeName: string | null;
  materialSentAt: string | null;
  materialReadAt: string | null;
  alreadyRead: boolean;
};

export default function CapacitacionDocPage() {
  const { token } = useParams() as { token: string };
  const [data, setData] = useState<DocData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/trainings/public/material/${token}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'No se pudo cargar');
        setData(d);
        if (d.materialReadAt) setReadAt(d.materialReadAt);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const confirmarLectura = async () => {
    setConfirming(true);
    try {
      const r = await fetch(`${API}/trainings/public/material/${token}/read`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo registrar');
      setReadAt(d.readAt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConfirming(false);
    }
  };

  const S: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#F3F4F6', padding: '16px 12px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
    card: { background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: 520, margin: '0 auto' },
    muted: { color: '#6B7280', fontSize: 13 },
    btn: { border: 'none', color: '#fff', fontWeight: 600, fontSize: 15, padding: '13px 20px', borderRadius: 12, cursor: 'pointer', width: '100%' },
  };

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={36} color="#2563EB" className="animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <AlertCircle size={48} color="#DC2626" style={{ margin: '0 auto' }} />
        <h2 style={{ margin: '12px 0 4px' }}>Enlace no disponible</h2>
        <p style={S.muted}>{error || 'El enlace es inválido o expiró.'}</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={22} color="#4F46E5" />
          </div>
          <div>
            <p style={{ ...S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Material de capacitación</p>
            <h1 style={{ fontSize: 17, margin: 0, color: '#111827' }}>{data.training.title}</h1>
          </div>
        </div>

        {data.attendeeName && <p style={{ ...S.muted, marginBottom: 12 }}>Asignado a: <strong>{data.attendeeName}</strong></p>}

        {data.materialUrl ? (
          <a href={data.materialUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', borderRadius: 10, border: '1px solid #E5E7EB', textDecoration: 'none', marginBottom: 16 }}>
            <FileText size={20} color="#0891B2" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Abrir material didáctico</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Leé el documento completo antes de confirmar</div>
            </div>
            <ExternalLink size={16} color="#9CA3AF" />
          </a>
        ) : (
          <p style={{ ...S.muted, marginBottom: 16 }}>La capacitación no tiene un enlace de material cargado.</p>
        )}

        {readAt ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', borderRadius: 10, background: '#DCFCE7', border: '1px solid #86EFAC' }}>
            <CheckCircle2 size={22} color="#16A34A" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>Lectura confirmada</div>
              <div style={{ fontSize: 12, color: '#15803D' }}>
                Acuse registrado el {new Date(readAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ) : (
          <button onClick={confirmarLectura} disabled={confirming} style={{ ...S.btn, background: '#16A34A', opacity: confirming ? 0.7 : 1 }}>
            {confirming ? 'Registrando…' : '✓ Leí el material — confirmar lectura'}
          </button>
        )}

        <p style={{ ...S.muted, fontSize: 11, marginTop: 14, textAlign: 'center' }}>
          Este acuse queda registrado como evidencia (ISO 9001 §7.2 / IATF 16949) · SGI 360
        </p>
      </div>
    </div>
  );
}
