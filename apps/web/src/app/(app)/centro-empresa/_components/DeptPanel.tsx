'use client';
// ============================================================
// Panel lateral de un departamento / conexión seleccionada.
// Datos siempre del agregador real — sin valores ficticios.
// ============================================================
import { SALUD_META, LAYER_META } from './types';
import type { DeptResumen, EmpresaConn } from './types';
import { X, ExternalLink, TrendingUp, Bell, Target } from 'lucide-react';

export function DeptPanel({ dept, onClose, onImpact }: { dept: DeptResumen; onClose: () => void; onImpact?: () => void }) {
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

        {dept.proceso && (
          <div className="ce-block">
            <b><Target size={12} /> Proceso SGI</b>
            <div className="ce-row"><span className="ce-k">Proceso</span><span>{dept.proceso.code ? `${dept.proceso.code} ` : ''}{dept.proceso.name}</span></div>
            {dept.proceso.owner && <div className="ce-row"><span className="ce-k">Dueño</span><span>{dept.proceso.owner}</span></div>}
            {!!dept.subprocesos?.length && (
              <>
                <span className="ce-k" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>Subprocesos ({dept.subprocesos.length})</span>
                {dept.subprocesos.map((sp) => (
                  <div key={sp.id} className="ce-sub">{sp.code ? <em>{sp.code}</em> : null}{sp.name}</div>
                ))}
              </>
            )}
          </div>
        )}

        {dept.kpis.length === 0 && dept.alertas.length === 0 && !dept.proceso && (
          <p className="ce-muted">Sin indicadores configurados para este departamento todavía.</p>
        )}

        {dept.moduleHref && (
          <a className="ce-modlink" href={dept.moduleHref}>
            <ExternalLink size={12} /> Abrir módulo
          </a>
        )}

        {onImpact && (
          <button className="ce-impact on" onClick={onImpact}>
            <Target size={12} /> Ver impacto
          </button>
        )}
      </div>
    </aside>
  );
}

export function ConnPanel({ conn, depts, onClose }: { conn: EmpresaConn; depts: DeptResumen[]; onClose: () => void }) {
  const dept = (k: string) => depts.find((d) => d.key === k);
  const name = (k: string) => dept(k)?.name ?? k.toUpperCase();
  const from = dept(conn.from), to = dept(conn.to);
  const affected = from && (from.salud === 'crit' || from.salud === 'warn');
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
        <div className="ce-row">
          <span className="ce-k">Origen</span>
          <span>{name(conn.from)}{from && <> <span className={`ce-salud ${from.salud}`}><i />{SALUD_META[from.salud].label}</span></>}</span>
        </div>
        <div className="ce-row">
          <span className="ce-k">Destino</span>
          <span>{name(conn.to)}{to && <> <span className={`ce-salud ${to.salud}`}><i />{SALUD_META[to.salud].label}</span></>}</span>
        </div>
        {conn.label && <div className="ce-row"><span className="ce-k">Intercambio</span><span>{conn.label}</span></div>}

        {affected && (
          <div className={`ce-alert ${from!.salud === 'crit' ? 'crit' : ''}`}>
            El origen está en {SALUD_META[from!.salud].label.toLowerCase()} —
            posible impacto sobre {name(conn.to)}.
          </div>
        )}
        {from && from.alertas.length > 0 && (
          <div className="ce-block">
            <b><Bell size={12} /> Alertas del origen</b>
            {from.alertas.map((a, i) => <div key={i} className={`ce-alert ${a.nivel}`}>{a.label}</div>)}
          </div>
        )}
      </div>
    </aside>
  );
}
