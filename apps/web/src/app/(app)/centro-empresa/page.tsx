'use client';
// ============================================================
// Centro Empresarial — Vista general.
// Panel ejecutivo + selector de plantilla (persistido).
// ============================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Network, Check } from 'lucide-react';
import { fetchConfig, fetchResumen, templatePref, saveTemplatePref, saveConfig } from './_components/data';
import type { EmpresaConfig, ResumenResponse, TemplateKey } from './_components/types';
import './centro.css';

export default function VistaGeneralPage() {
  const router = useRouter();
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [tpl, setTpl] = useState<TemplateKey>('campus');
  const [savingDefault, setSavingDefault] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ config: c }, r, pref] = await Promise.all([fetchConfig(), fetchResumen(), templatePref()]);
        setConfig(c);
        setData(r);
        setTpl(pref ?? c.defaultTemplate);
      } catch { /* mostrar vacío */ }
    })();
  }, []);

  const choose = (t: TemplateKey) => {
    setTpl(t);
    void saveTemplatePref(t);
    router.push(t === 'campus' ? '/centro-empresa/campus' : '/centro-empresa/procesos');
  };

  const setDefault = async () => {
    if (!config) return;
    setSavingDefault(true);
    try {
      const next = { ...config, defaultTemplate: tpl };
      await saveConfig(next);
      setConfig(next);
    } catch (e: any) {
      alert('No se pudo guardar: ' + (e?.message || 'error'));
    } finally { setSavingDefault(false); }
  };

  const r = data?.resumen;

  return (
    <div className="ce-root">
      <header className="ce-header">
        <div className="ce-title">
          <h1>CENTRO<span> EMPRESARIAL</span></h1>
          <small>Vista consolidada de la organización</small>
        </div>
      </header>

      {r && (
        <div className="ce-score">
          {(() => {
            const score = r.departamentos ? Math.round((r.enObjetivo / r.departamentos) * 100) : 0;
            const cls = r.criticos > 0 ? 'crit' : r.conDesvio > 0 ? 'warn' : 'ok';
            return <><span className={`num ${cls}`}>{score}%</span><small>Salud del campus<br />{r.enObjetivo} de {r.departamentos} departamentos en objetivo</small></>;
          })()}
          <div className="ce-badges">
            <span className={`ce-badge ${r.criticos === 0 && r.departamentos > 0 ? 'earned' : ''}`}>🛡️ Sin críticos</span>
            <span className={`ce-badge ${r.conDesvio === 0 && r.criticos === 0 && r.departamentos > 0 ? 'earned' : ''}`}>✨ Campus impecable</span>
            <span className={`ce-badge ${r.sinDatos === 0 && r.departamentos > 0 ? 'earned' : ''}`}>📊 Datos completos</span>
            <span className={`ce-badge ${(r.ncVencidas ?? -1) === 0 ? 'earned' : ''}`}>⏱️ Nada vencido</span>
          </div>
        </div>
      )}

      {r && (
        <div className="ce-kpis">
          <div className="ce-kpi accent"><b>{r.departamentos}</b><small>Departamentos</small></div>
          <div className="ce-kpi ok"><b>{r.enObjetivo}</b><small>En objetivo</small></div>
          <div className="ce-kpi warn"><b>{r.conDesvio}</b><small>Con desvíos</small></div>
          <div className="ce-kpi crit"><b>{r.criticos}</b><small>Críticos</small></div>
          <div className="ce-kpi"><b>{r.sinDatos}</b><small>Sin datos</small></div>
          {r.objetivos?.total !== null && r.objetivos && (
            <div className="ce-kpi"><b>{r.objetivos.activos ?? '—'}/{r.objetivos.total}</b><small>Objetivos activos</small></div>
          )}
          {r.ncAbiertas !== null && (
            <div className="ce-kpi"><b>{r.ncAbiertas}</b><small>NCs abiertas</small></div>
          )}
          {r.procesosEnMapa !== null && (
            <div className="ce-kpi"><b>{r.procesosEnMapa}</b><small>Procesos en el mapa</small></div>
          )}
        </div>
      )}

      {data?.atencion && data.atencion.length > 0 && (
        <div className="ce-section" style={{ borderTop: 'none', paddingTop: 0 }}>
          <h4>Atención hoy — qué atender primero</h4>
          <table className="ce-table">
            <thead><tr><th>#</th><th>Qué atender</th><th>Área</th><th>Impacto</th><th>Severidad</th></tr></thead>
            <tbody>
              {data.atencion.map((p, i) => (
                <tr key={i} style={{ cursor: p.ref ? 'pointer' : 'default' }} onClick={() => p.ref && router.push(p.ref)}>
                  <td><b>{i + 1}</b></td>
                  <td>{p.motivo}</td>
                  <td>{p.depto}</td>
                  <td>{p.impacto != null && p.impacto > 0 ? `$${Math.round(p.impacto / 1000).toLocaleString('es-AR')}k${p.moneda ? ` ${p.moneda}` : ''}` : '—'}</td>
                  <td><span className={`ce-salud ${p.nivel}`}><i />{p.nivel === 'crit' ? 'Crítico' : 'Atención'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ce-section">
        <h4>Elegí la plantilla visual</h4>
        <div className="ce-cards">
          <button className={`ce-card ${tpl === 'campus' ? 'sel' : ''}`} onClick={() => choose('campus')}>
            <Building2 size={22} className="ce-card-icon" />
            <h4>Campus Empresarial 3D</h4>
            <p>La organización como ciudad: cada edificio es un departamento con su estado, indicadores y alertas.</p>
          </button>
          <button className={`ce-card ${tpl === 'procesos' ? 'sel' : ''}`} onClick={() => choose('procesos')}>
            <Network size={22} className="ce-card-icon" />
            <h4>Mapa de Procesos 3D</h4>
            <p>Los mismos edificios organizados en procesos estratégicos, operativos y de apoyo (ISO 9001 / IATF 16949), con sus relaciones.</p>
          </button>
        </div>
        {config && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="ce-btn ghost" onClick={setDefault} disabled={savingDefault || tpl === config.defaultTemplate}>
              <Check size={13} />
              {savingDefault ? 'Guardando…' : tpl === config.defaultTemplate ? 'Es la plantilla predeterminada' : 'Establecer como predeterminada de empresa'}
            </button>
            <small className="ce-muted" style={{ margin: 0 }}>
              Tu elección queda guardada en este navegador; la predeterminada aplica a toda la empresa.
            </small>
          </div>
        )}
      </div>

      {data && data.departments.some((d) => d.salud === 'crit' || d.salud === 'warn') && (
        <div className="ce-section">
          <h4>Departamentos que requieren atención</h4>
          <table className="ce-table">
            <thead><tr><th>Departamento</th><th>Estado</th><th>Alertas</th></tr></thead>
            <tbody>
              {data.departments.filter((d) => d.salud === 'crit' || d.salud === 'warn').map((d) => (
                <tr key={d.key}>
                  <td><b>{d.name}</b></td>
                  <td><span className={`ce-salud ${d.salud}`}><i />{d.salud === 'crit' ? 'Crítico' : 'Seguimiento'}</span></td>
                  <td>{d.alertas.map((a) => a.label).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
