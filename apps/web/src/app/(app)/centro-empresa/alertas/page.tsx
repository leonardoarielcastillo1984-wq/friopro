'use client';
// ============================================================
// Alertas consolidadas — solo lo que reportan los módulos.
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellOff } from 'lucide-react';
import { fetchResumen } from '../_components/data';
import type { ResumenResponse } from '../_components/types';
import '../centro.css';

export default function AlertasPage() {
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResumen().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const items = data?.departments.flatMap((d) =>
    d.alertas.map((a) => ({ dept: d.name, href: d.moduleHref, ...a }))
  ) ?? [];

  return (
    <div className="ce-root">
      <header className="ce-header">
        <div className="ce-title">
          <h1>ALER<span>TAS</span></h1>
          <small>Desvíos activos reportados por los módulos</small>
        </div>
      </header>

      {loading && <p className="ce-muted">Cargando…</p>}

      {!loading && items.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 40, color: 'var(--ce-dim)' }}>
          <BellOff size={28} />
          <p className="ce-muted" style={{ margin: 0 }}>Sin alertas activas — los módulos no reportan desvíos.</p>
        </div>
      )}

      {items.length > 0 && (
        <table className="ce-table">
          <thead><tr><th>Departamento</th><th>Alerta</th><th>Nivel</th><th></th></tr></thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={i}>
                <td><b>{a.dept}</b></td>
                <td>{a.label}</td>
                <td><span className={`ce-salud ${a.nivel}`}><i />{a.nivel === 'crit' ? 'Crítico' : 'Seguimiento'}</span></td>
                <td>{a.href && <Link className="ce-modlink" href={a.href}>Resolver</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
