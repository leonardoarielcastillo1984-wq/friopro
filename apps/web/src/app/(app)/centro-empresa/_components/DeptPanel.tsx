'use client';
// ============================================================
// Panel lateral de un departamento / conexión seleccionada.
// Datos siempre del agregador real — sin valores ficticios.
// ============================================================
import { SALUD_META, LAYER_META } from './types';
import type { DeptResumen, EmpresaConn } from './types';
import { X, ExternalLink, TrendingUp, Bell, Target } from 'lucide-react';

export function DeptPanel({ dept, onClose }: { dept: DeptResumen; onClose: () => void }) {
  const s = SALUD_META[dept.salud];
  return (
    <aside className="ce-panel">
      <header>
        <div>
          <h3>{dept.name}</h3>
          {dept.sub && <small>{dept.sub}</small>}
        </div>
        <button onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
      </header>
      <div className="ce-panel-body">
        <div className="ce-row">
          <span className="ce-k">Estado</span>
          <span className={`ce-salud ${dept.salud}`}><i />{s.label}</span>
        </div>
        <div className="ce-row">
          <span className="ce-k">Proceso</span>
          <span>{LAYER_META[dept.layer]?.label ?? '—'}</span>
        </div>
        <div className="ce-row">
          <span className="ce-k">Responsable</span>
          <span>{dept.responsable || 'Sin asignar'}</span>
        </div>

        {dept.kpis.length > 0 && (
          <div className="ce-block">
            <b><TrendingUp size={12} /> Indicadores</b>
            {dept.kpis.map((k, i) => (
              <div key={i} className="ce-row"><span className="ce-k">{k.label}</span><span>{k.value}</span></div>
            ))}
          </div>
        )}

        {dept.alertas.length > 0 && (
          <div className="ce-block">
            <b><Bell size={12} /> Alertas</b>
            {dept.alertas.map((a, i) => (
              <div key={i} className={`ce-alert ${a.nivel}`}>{a.label}</div>
            ))}
          </div>
        )}

        {dept.kpis.length === 0 && dept.alertas.length === 0 && (
          <p className="ce-muted">Sin indicadores configurados para este departamento todavía.</p>
        )}

        {dept.moduleHref && (
          <a className="ce-modlink" href={dept.moduleHref}>
            <ExternalLink size={12} /> Abrir módulo
          </a>
        )}

        {/* Vista de impacto — prevista, pendiente de implementación */}
        <button className="ce-impact" disabled title="Disponible próximamente">
          <Target size={12} /> Ver impacto <em>próximamente</em>
        </button>
      </div>
    </aside>
  );
}

export function ConnPanel({ conn, depts, onClose }: { conn: EmpresaConn; depts: DeptResumen[]; onClose: () => void }) {
  const name = (k: string) => depts.find((d) => d.key === k)?.name ?? k.toUpperCase();
  return (
    <aside className="ce-panel">
      <header>
        <div>
          <h3>{name(conn.from)} → {name(conn.to)}</h3>
          {conn.tipo && <small>{conn.tipo}</small>}
        </div>
        <button onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
      </header>
      <div className="ce-panel-body">
        <div className="ce-row"><span className="ce-k">Origen</span><span>{name(conn.from)}</span></div>
        <div className="ce-row"><span className="ce-k">Destino</span><span>{name(conn.to)}</span></div>
        {conn.label && <div className="ce-row"><span className="ce-k">Intercambio</span><span>{conn.label}</span></div>}
        <p className="ce-muted">
          Relación configurada en el mapa de procesos. Los indicadores y riesgos
          asociados se conectarán en la próxima iteración.
        </p>
      </div>
    </aside>
  );
}
