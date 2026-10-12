'use client';
// ============================================================
// Indicadores por departamento — vista tabular del agregador.
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchResumen } from '../_components/data';
import { SALUD_META, LAYER_META } from '../_components/types';
import type { ResumenResponse } from '../_components/types';
import '../centro.css';

export default function IndicadoresPage() {
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResumen().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="ce-root">
      <header className="ce-header">
        <div className="ce-title">
          <h1>INDI<span>CADORES</span></h1>
          <small>Datos consolidados por departamento — sin valores simulados</small>
        </div>
      </header>

      {loading && <p className="ce-muted">Cargando…</p>}

      {data && (
        <table className="ce-table">
          <thead>
            <tr><th>Departamento</th><th>Proceso</th><th>Estado</th><th>Indicadores</th><th></th></tr>
          </thead>
          <tbody>
            {data.departments.map((d) => (
              <tr key={d.key}>
                <td><b>{d.name}</b>{d.responsable ? <div style={{ color: 'var(--ce-dim)', fontSize: 10.5 }}>{d.responsable}</div> : null}</td>
                <td>{LAYER_META[d.layer]?.label ?? '—'}</td>
                <td><span className={`ce-salud ${d.salud}`}><i />{SALUD_META[d.salud].label}</span></td>
                <td>{d.kpis.length ? d.kpis.map((k) => `${k.label}: ${k.value}`).join(' · ') : <span className="ce-muted" style={{ margin: 0 }}>Sin indicadores</span>}</td>
                <td>{d.moduleHref && <Link className="ce-modlink" href={d.moduleHref}>Abrir</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
