'use client';
import { Fragment, useMemo, useState } from 'react';
import {
  Search, MapPin, X, ArrowRight, ChevronRight, AlertTriangle,
  Target, Cog, Users, Layers, Network, FileText, Shield, BarChart3,
  LogIn, LogOut, CheckCircle, ArrowLeft, ExternalLink, ListTree, ShoppingCart,
} from 'lucide-react';

// ── Tipos (mínimos, alineados al shape de GET /process-maps) ──────────────────
export type GenProcess = {
  id: string;
  parentId?: string | null;
  layer: 'STRATEGIC' | 'OPERATIONAL' | 'SUPPORT';
  name: string;
  code?: string | null;
  status?: string;
  description?: string | null;
  owner?: string | null;
  inputs?: string | null;
  outputs?: string | null;
  sites?: string[];
  order?: number;
  processIndicators?: { id: string; indicatorId: string }[];
  processDocuments?: { id: string; documentId: string }[];
  processRisks?: { id: string; riskId: string }[];
  indicators?: string | null;
  documents?: string | null;
  risks?: string | null;
};

export type GenMap = {
  id: string;
  name: string;
  description?: string | null;
  scope?: string | null;
  inputLabel?: string | null;
  outputLabel?: string | null;
  mapBand?: string | null;
  processes: GenProcess[];
};

type Band = 'STRATEGIC' | 'OPERATIONAL' | 'COMMERCIAL' | 'SUPPORT';
type Sel = { kind: 'map'; mapId: string } | { kind: 'process'; processId: string } | null;
type PanelTab = 'subs' | 'docs' | 'kpis' | 'risks';

const BAND_META: Record<Band, { label: string; desc: string; band: string; border: string; text: string; badge: string; icon: any }> = {
  STRATEGIC:   { label: 'Estratégicos', desc: 'Dirección y gestión del negocio', band: 'bg-blue-50/70', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: Target },
  OPERATIONAL: { label: 'Operaciones', desc: 'Procesos centrales en paralelo — operaciones independientes', band: 'bg-emerald-50/60', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', icon: Cog },
  COMMERCIAL:  { label: 'Comercial', desc: 'Banda transversal — vincula clientes con las operaciones', band: 'bg-violet-50/70', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', icon: ShoppingCart },
  SUPPORT:     { label: 'Soporte', desc: 'Procesos de apoyo a las operaciones', band: 'bg-orange-50/70', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', icon: Users },
};

const LAYER_LABEL: Record<string, string> = { STRATEGIC: 'Estratégico', OPERATIONAL: 'Operativo', SUPPORT: 'Soporte' };

function normalize(s?: string | null) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Clasifica el mapa en su banda del Mapa General. Prioriza el campo `mapBand`
// (editable desde "Editar mapa"); sin valor → heurística por nombre + capa dominante.
function classifyMapBand(map: GenMap): Band {
  if (map.mapBand === 'STRATEGIC' || map.mapBand === 'OPERATIONAL' || map.mapBand === 'COMMERCIAL' || map.mapBand === 'SUPPORT') {
    return map.mapBand;
  }
  const n = normalize(map.name);
  if (/(comercial|ventas?|cotizaci|marketing|clientes)/.test(n)) return 'COMMERCIAL';
  if (/(direcci|gerenc|estrateg|planeam|gobern|comit)/.test(n)) return 'STRATEGIC';
  if (/(rrhh|recurso|compra|sistema|tecnolog|calidad|document|manten|administ|finanz|legal|seguridad|capacit|soporte|contratac)/.test(n)) return 'SUPPORT';
  const counts: Record<Band, number> = { STRATEGIC: 0, OPERATIONAL: 0, COMMERCIAL: 0, SUPPORT: 0 };
  map.processes.filter(p => !p.parentId).forEach(p => { counts[(p.layer as Band) || 'OPERATIONAL']++; });
  const top = (Object.keys(counts) as Band[]).sort((a, b) => counts[b] - counts[a])[0];
  return counts[top] > 0 && top !== 'COMMERCIAL' ? top : 'OPERATIONAL';
}

const toBullets = (s?: string | null) => (s || '').split(/[\n,;•]+/).map(x => x.trim()).filter(Boolean);

// Secuencia real: flechas solo si los subprocesos tienen `order` con valores distintos.
// Si todos comparten el mismo order (p.ej. default 0) se muestran agrupados sin inventar conexiones.
const hasRealOrder = (subs: GenProcess[]) => new Set(subs.map(s => s.order ?? 0)).size > 1;

export default function MapaGeneralView({
  maps,
  employees,
  docOptions,
  riskOptions,
  indicatorOptions,
  onOpenMap,
  onOpenProcessFicha,
  onOpenLinks,
  onNewMap,
}: {
  maps: GenMap[];
  employees: { id: string; firstName: string; lastName: string; email: string }[];
  docOptions: { id: string; label: string }[];
  riskOptions: { id: string; label: string }[];
  indicatorOptions: { id: string; label: string }[];
  onOpenMap: (m: GenMap) => void;
  onOpenProcessFicha: (p: GenProcess) => void;
  onOpenLinks: () => void;
  onNewMap: () => void;
}) {
  const [sel, setSel] = useState<Sel>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('subs');
  const [query, setQuery] = useState('');
  const [site, setSite] = useState('');

  // ── Índices derivados ────────────────────────────────────────────────────
  const byId = useMemo(() => {
    const idx = new Map<string, { p: GenProcess; map: GenMap }>();
    maps.forEach(m => m.processes.forEach(p => idx.set(p.id, { p, map: m })));
    return idx;
  }, [maps]);

  const allSites = useMemo(() => {
    const s = new Set<string>();
    maps.forEach(m => m.processes.forEach(p => (p.sites || []).forEach(x => s.add(x))));
    return Array.from(s).sort();
  }, [maps]);

  const subsOf = (mapId: string, macroId: string) =>
    (maps.find(m => m.id === mapId)?.processes ?? [])
      .filter(p => p.parentId === macroId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const macrosOf = (map: GenMap, layer?: string) =>
    map.processes.filter(p => !p.parentId && (!layer || p.layer === layer)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const matchesSearch = (p: GenProcess, q: string) =>
    normalize(p.name).includes(q) || normalize(p.code).includes(q);

  const matchesSite = (p: GenProcess) => !site || !p.sites?.length || p.sites.includes(site);

  // ── Clasificación en bandas + filtros combinados (búsqueda × sede) ─────────
  const q = normalize(query.trim());
  const { bands, matchSet, mapNameSet, totalMatches } = useMemo(() => {
    const bands: Record<Band, GenMap[]> = { STRATEGIC: [], OPERATIONAL: [], COMMERCIAL: [], SUPPORT: [] };
    const matchSet = new Set<string>();
    const mapNameSet = new Set<string>();
    maps.forEach(m => {
      if (!m.processes.some(matchesSite)) return;
      const nameHit = q && normalize(m.name).includes(q);
      if (nameHit) mapNameSet.add(m.id);
      if (q) m.processes.forEach(p => { if (matchesSearch(p, q)) matchSet.add(p.id); });
      if (q && !nameHit && !m.processes.some(p => matchSet.has(p.id))) return;
      bands[classifyMapBand(m)].push(m);
    });
    return { bands, matchSet, mapNameSet, totalMatches: matchSet.size + mapNameSet.size };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, q, site]);

  // Selección resuelta contra datos frescos: si el elemento ya no existe tras recargar, queda sin panel.
  const selMap = sel?.kind === 'map' ? maps.find(m => m.id === sel.mapId) ?? null : null;
  const selProcEntry = sel?.kind === 'process' ? byId.get(sel.processId) ?? null : null;
  const selProc = selProcEntry?.p ?? null;
  const selProcMap = selProcEntry?.map ?? null;
  const selParent = selProc?.parentId ? byId.get(selProc.parentId)?.p ?? null : null;
  const panelOpen = !!(selMap || selProc);

  function getEmployeeName(id?: string | null) {
    if (!id) return null;
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}`.trim() || emp.email : null;
  }

  function selectMap(m: GenMap) { setSel({ kind: 'map', mapId: m.id }); }
  function selectProc(p: GenProcess) {
    setSel({ kind: 'process', processId: p.id });
    setPanelTab(p.parentId ? 'docs' : 'subs');
  }

  const dimIf = (id: string) => (q && !matchSet.has(id) ? 'opacity-40 saturate-50' : '');

  function ProcCard({ p, macro }: { p: GenProcess; macro?: boolean }) {
    const isSel = selProc?.id === p.id;
    const isParent = selParent?.id === p.id;
    const matched = matchSet.has(p.id);
    return (
      <button
        type="button"
        onClick={() => selectProc(p)}
        aria-pressed={isSel}
        aria-label={`${macro ? 'Proceso' : 'Subproceso'} ${p.name}`}
        title={p.description || p.name}
        className={`group relative text-left rounded-lg border px-3 py-2 transition-all bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isSel
            ? 'border-indigo-400 ring-2 ring-indigo-500/60 bg-indigo-50 shadow-sm'
            : isParent
              ? 'border-indigo-300 bg-indigo-50/50 shadow-sm'
              : matched
                ? 'border-amber-300 ring-1 ring-amber-300 bg-amber-50/60 hover:border-indigo-300'
                : 'border-neutral-200 hover:border-indigo-300 hover:shadow-sm'
        } ${dimIf(p.id)}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isSel && <CheckCircle className="h-3 w-3 text-indigo-600 flex-shrink-0" aria-hidden />}
          <span className={`text-xs font-medium truncate ${isSel ? 'text-indigo-800' : 'text-neutral-800'}`}>{p.name}</span>
        </div>
        {p.code && <p className="text-[10px] text-neutral-400 mt-0.5 font-mono truncate">{p.code}</p>}
      </button>
    );
  }

  function MacroGroup({ map, macro }: { map: GenMap; macro: GenProcess }) {
    const subs = subsOf(map.id, macro.id);
    const ordered = hasRealOrder(subs);
    const visibleSubs = subs.filter(matchesSite);
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => selectProc(macro)}
          aria-pressed={selProc?.id === macro.id}
          className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 rounded-md px-1.5 py-0.5 -ml-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors ${
            selProc?.id === macro.id ? 'text-indigo-700 bg-indigo-50' : 'text-neutral-600 hover:text-indigo-600'
          } ${dimIf(macro.id)}`}
        >
          <Network className="h-3 w-3 flex-shrink-0" aria-hidden />
          <span className="truncate">{macro.name}</span>
          {macro.code && <span className="text-[9px] font-mono font-normal text-neutral-400">{macro.code}</span>}
        </button>
        {visibleSubs.length === 0 ? (
          <div className={dimIf(macro.id)}>
            {subs.length === 0 ? (
              <div className="max-w-[200px]">{ProcCard({ p: macro, macro: true })}</div>
            ) : (
              <p className="text-[10px] text-neutral-400 italic px-1">Sin subprocesos en esta sede</p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-stretch gap-1.5">
            {visibleSubs.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                {i > 0 && ordered && <ArrowRight className="h-3 w-3 text-neutral-300 flex-shrink-0" aria-hidden />}
                {ProcCard({ p: s })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  // Carril: un mapa (área) = una fila horizontal. Sin flechas entre carriles (operaciones independientes).
  function Lane({ map, band }: { map: GenMap; band: Band }) {
    const meta = BAND_META[band];
    const opMacros = macrosOf(map, 'OPERATIONAL');
    // Macros de otras capas dentro de un carril operativo/comercial: accesibles vía panel del mapa.
    const extraMacros = map.processes.filter(p => !p.parentId && p.layer !== 'OPERATIONAL');
    const isSel = selMap?.id === map.id;
    const nameHit = mapNameSet.has(map.id);
    const visibleOps = opMacros.filter(macro =>
      matchesSite(macro) || subsOf(map.id, macro.id).some(matchesSite)
    );
    return (
      <section
        aria-label={`${meta.label}: ${map.name}`}
        className={`rounded-xl border ${meta.border} ${meta.band} p-3 transition-opacity`}
      >
        <button
          type="button"
          onClick={() => selectMap(map)}
          aria-pressed={isSel}
          title={map.description || map.name}
          className={`flex items-center gap-2 w-full text-left rounded-lg px-1.5 py-0.5 -ml-1.5 mb-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            isSel ? 'text-indigo-700' : `${meta.text} hover:opacity-80`
          }`}
        >
          <Layers className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <span className={`text-xs font-bold uppercase tracking-wide truncate ${nameHit ? 'underline decoration-amber-400 decoration-2 underline-offset-2' : ''}`}>
            {map.name}
          </span>
          {map.scope && <span className="text-[10px] font-normal text-neutral-400 truncate hidden sm:inline">· {map.scope}</span>}
          {isSel && <CheckCircle className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" aria-hidden />}
          <ChevronRight className="h-3.5 w-3.5 text-neutral-300 ml-auto flex-shrink-0" aria-hidden />
        </button>

        {visibleOps.length === 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-neutral-400 italic">
              {opMacros.length === 0 ? 'Sin procesos operativos en este mapa' : 'Sin procesos para el filtro de sede actual'}
            </p>
            {extraMacros.length > 0 && (
              <button type="button" onClick={() => selectMap(map)} className="text-[10px] text-neutral-500 underline hover:text-indigo-600">
                +{extraMacros.length} de otras capas
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-4">
            {visibleOps.map(macro => <Fragment key={macro.id}>{MacroGroup({ map, macro })}</Fragment>)}
            {extraMacros.length > 0 && (
              <button
                type="button"
                onClick={() => selectMap(map)}
                className="self-end text-[10px] text-neutral-500 underline hover:text-indigo-600 text-left"
              >
                +{extraMacros.length} {extraMacros.length === 1 ? 'proceso' : 'procesos'} de otras capas
              </button>
            )}
          </div>
        )}
      </section>
    );
  }

  // Tarjeta compacta de mapa para bandas horizontales (estratégicos / soporte / comercial).
  function MapCard({ map, band }: { map: GenMap; band: Band }) {
    const meta = BAND_META[band];
    const Icon = meta.icon;
    const isSel = selMap?.id === map.id;
    const nameHit = mapNameSet.has(map.id);
    const nMacros = map.processes.filter(p => !p.parentId).length;
    const mapHasMatch = q && (nameHit || map.processes.some(p => matchSet.has(p.id)));
    const hitCount = map.processes.filter(p => matchSet.has(p.id)).length;
    return (
      <button
        type="button"
        onClick={() => selectMap(map)}
        aria-pressed={isSel}
        title={map.description || map.name}
        className={`text-left rounded-lg border bg-white px-3 py-2.5 w-44 flex-shrink-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isSel
            ? 'border-indigo-400 ring-2 ring-indigo-500/60 bg-indigo-50 shadow-sm'
            : mapHasMatch
              ? `border-amber-300 ring-1 ring-amber-300 hover:border-indigo-300`
              : `${meta.border} hover:border-indigo-300 hover:shadow-sm`
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${meta.text}`} aria-hidden />
          <span className={`text-xs font-semibold truncate ${isSel ? 'text-indigo-800' : 'text-neutral-800'}`}>{map.name}</span>
        </div>
        <p className="text-[10px] text-neutral-400 mt-1 truncate">
          {nMacros} {nMacros === 1 ? 'proceso' : 'procesos'}
          {q && hitCount > 0 ? ` · ${hitCount} coincidencia${hitCount === 1 ? '' : 's'}` : ''}
        </p>
      </button>
    );
  }

  // Fila de banda con etiqueta + tarjetas de mapas (estratégicos, soporte, comercial).
  function BandRow({ band, maps: bandMaps }: { band: Band; maps: GenMap[] }) {
    if (bandMaps.length === 0) return null;
    const meta = BAND_META[band];
    const Icon = meta.icon;
    return (
      <section aria-label={meta.label} className={`rounded-xl border ${meta.border} ${meta.band} p-3`}>
        <div className="flex items-center gap-2 mb-2.5 px-0.5">
          <Icon className={`h-3.5 w-3.5 ${meta.text}`} aria-hidden />
          <span className={`text-[11px] font-bold uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
          <span className="text-[10px] text-neutral-400">{meta.desc}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {bandMaps.map(m => <Fragment key={m.id}>{MapCard({ map: m, band })}</Fragment>)}
        </div>
      </section>
    );
  }

  // Columna Entradas / Resultados: prioriza la selección; si no, deduplica etiquetas de los mapas.
  function FlowColumn({ kind }: { kind: 'in' | 'out' }) {
    const isIn = kind === 'in';
    const Icon = isIn ? LogIn : LogOut;
    let title: string;
    let items: string[];
    if (selProc) {
      title = isIn ? 'Entradas del proceso' : 'Resultados del proceso';
      items = toBullets(isIn ? selProc.inputs : selProc.outputs);
    } else if (selMap) {
      title = isIn ? (selMap.inputLabel || 'Entradas') : (selMap.outputLabel || 'Resultados');
      items = [];
    } else {
      title = isIn ? 'Entradas' : 'Resultados';
      const uniq = new Set<string>();
      maps.forEach(m => {
        const v = (isIn ? m.inputLabel : m.outputLabel)?.trim();
        if (v) uniq.add(v);
      });
      items = Array.from(uniq).slice(0, 5);
    }
    return (
      <aside aria-label={isIn ? 'Entradas' : 'Resultados'} className="flex flex-col items-center justify-center w-24 lg:w-28 flex-shrink-0 self-stretch">
        <div className="bg-white border border-neutral-200 rounded-xl px-2.5 py-4 text-center shadow-sm w-full h-full flex flex-col items-center justify-center">
          <Icon className={`h-4 w-4 mb-1.5 ${isIn ? 'text-blue-500' : 'text-emerald-500'}`} aria-hidden />
          <p className="text-[10px] font-semibold text-neutral-600 leading-tight">{title}</p>
          {items.length > 0 && (
            <ul className="mt-2 text-[9px] text-neutral-400 text-left space-y-0.5 w-full">
              {items.slice(0, 4).map((it, i) => <li key={i} className="truncate">• {it}</li>)}
            </ul>
          )}
        </div>
      </aside>
    );
  }

  // ── Panel lateral de detalle ─────────────────────────────────────────────
  const PANEL_TABS: { id: PanelTab; label: string; icon: any }[] = [
    { id: 'subs', label: 'Subprocesos', icon: ListTree },
    { id: 'docs', label: 'Documentos', icon: FileText },
    { id: 'kpis', label: 'Indicadores', icon: BarChart3 },
    { id: 'risks', label: 'Riesgos', icon: Shield },
  ];

  function Panel() {
    if (!panelOpen) {
      return (
        <div className="text-center text-neutral-400 pt-10 px-4">
          <Layers className="h-8 w-8 mx-auto mb-3 text-neutral-300" aria-hidden />
          <p className="text-xs leading-relaxed">Seleccioná un mapa, proceso o subproceso para ver el detalle.</p>
        </div>
      );
    }

    // Detalle de MAPA
    if (selMap && !selProc) {
      const band = classifyMapBand(selMap);
      const meta = BAND_META[band];
      const macros = macrosOf(selMap);
      const bandCounts: Record<string, number> = {};
      macros.forEach(p => { bandCounts[p.layer] = (bandCounts[p.layer] || 0) + 1; });
      return (
        <div className="px-4 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
            </div>
            <h3 className="text-sm font-bold text-neutral-900">{selMap.name}</h3>
            {selMap.scope && <p className="text-[11px] text-neutral-500 mt-1"><span className="font-medium">Alcance:</span> {selMap.scope}</p>}
            {selMap.description && <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{selMap.description}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(bandCounts) as [string, number][]).map(([layer, n]) => (
              <span key={layer} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                {LAYER_LABEL[layer] || layer}: {n}
              </span>
            ))}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {selMap.processes.filter(p => p.parentId).length} subprocesos
            </span>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Procesos</p>
            {macros.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">Sin procesos en este mapa</p>
            ) : (
              <ul className="space-y-1">
                {macros.map(macro => (
                  <li key={macro.id}>
                    <button
                      type="button"
                      onClick={() => selectProc(macro)}
                      className="flex items-center gap-1.5 w-full text-left text-xs text-neutral-700 hover:text-indigo-600 rounded px-1 py-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <ChevronRight className="h-3 w-3 text-neutral-300 flex-shrink-0" aria-hidden />
                      <span className="truncate">{macro.name}</span>
                      {macro.code && <span className="text-[9px] font-mono text-neutral-400">{macro.code}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenMap(selMap)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir mapa
          </button>
        </div>
      );
    }

    // Detalle de PROCESO / SUBPROCESO
    if (!selProc || !selProcMap) return null;
    const isSub = !!selProc.parentId;
    const subs = subsOf(selProcMap.id, selProc.id);
    const ownerName = getEmployeeName(selProc.owner);
    const docLinks = (selProc.processDocuments || [])
      .map(l => ({ id: l.documentId, label: docOptions.find(d => d.id === l.documentId)?.label || 'Documento' }));
    const riskLinks = (selProc.processRisks || [])
      .map(l => ({ id: l.riskId, label: riskOptions.find(r => r.id === l.riskId)?.label || 'Riesgo' }));
    const kpiLinks = (selProc.processIndicators || [])
      .map(l => ({ id: l.indicatorId, label: indicatorOptions.find(i => i.id === l.indicatorId)?.label || 'Indicador' }));
    const freeDocs = toBullets(selProc.documents).map((t, i) => ({ id: `d${i}`, label: t }));
    const freeRisks = toBullets(selProc.risks).map((t, i) => ({ id: `r${i}`, label: t }));
    const freeKpis = toBullets(selProc.indicators).map((t, i) => ({ id: `k${i}`, label: t }));
    const tabCounts: Record<PanelTab, number> = {
      subs: subs.length,
      docs: docLinks.length + freeDocs.length,
      kpis: kpiLinks.length + freeKpis.length,
      risks: riskLinks.length + freeRisks.length,
    };

    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-4 space-y-3 border-b border-neutral-100">
          <nav aria-label="Ruta del proceso" className="flex items-center gap-1 text-[10px] text-neutral-400 flex-wrap">
            <button type="button" onClick={() => selectMap(selProcMap)} className="hover:text-indigo-600 focus:outline-none focus-visible:underline">
              {selProcMap.name}
            </button>
            {selParent && (
              <>
                <ChevronRight className="h-2.5 w-2.5" aria-hidden />
                <button type="button" onClick={() => selectProc(selParent)} className="hover:text-indigo-600 focus:outline-none focus-visible:underline truncate max-w-[100px]">
                  {selParent.name}
                </button>
              </>
            )}
          </nav>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isSub ? 'bg-neutral-100 text-neutral-600' : 'bg-indigo-100 text-indigo-700'}`}>
                {isSub ? 'Subproceso' : LAYER_LABEL[selProc.layer] || selProc.layer}
              </span>
              {selProc.status === 'inactive' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Inactivo</span>
              )}
            </div>
            <h3 className="text-sm font-bold text-neutral-900">{selProc.name}</h3>
            {selProc.code && <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{selProc.code}</p>}
          </div>
          {selProc.description && <p className="text-xs text-neutral-500 leading-relaxed">{selProc.description}</p>}
          <dl className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <dt className="text-neutral-400">Responsable</dt>
              <dd className="text-neutral-700 font-medium truncate">{ownerName || 'Sin asignar'}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Sede</dt>
              <dd className="text-neutral-700 font-medium truncate">
                {selProc.sites?.length ? selProc.sites.join(', ') : 'Todas'}
              </dd>
            </div>
          </dl>
          {selParent && (
            <button
              type="button"
              onClick={() => selectProc(selParent)}
              className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 focus:outline-none focus-visible:underline"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden /> Volver al proceso padre
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-100" role="tablist">
          {PANEL_TABS.map(t => {
            const Icon = t.icon;
            const active = panelTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPanelTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-2 text-[9px] font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                  active ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
                {tabCounts[t.id] > 0 && <span className="text-[9px] text-neutral-400">({tabCounts[t.id]})</span>}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {panelTab === 'subs' && (
            subs.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">{isSub ? 'Los subprocesos no tienen nivel inferior' : 'Sin subprocesos cargados'}</p>
            ) : (
              <ul className="space-y-1">
                {subs.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-1.5">
                    {hasRealOrder(subs) && <span className="text-[9px] text-neutral-300 w-3 text-right flex-shrink-0">{i + 1}.</span>}
                    <button
                      type="button"
                      onClick={() => selectProc(s)}
                      className="flex-1 text-left text-xs text-neutral-700 hover:text-indigo-600 rounded px-1.5 py-1 -mx-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 truncate"
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
          {panelTab === 'docs' && (
            (docLinks.length + freeDocs.length) === 0 ? (
              <p className="text-xs text-neutral-400 italic">Sin documentos asociados</p>
            ) : (
              <ul className="space-y-1">
                {docLinks.map(d => <li key={d.id} className="flex items-center gap-1.5 text-xs text-neutral-700 px-1.5 py-1"><FileText className="h-3 w-3 text-neutral-300 flex-shrink-0" aria-hidden /><span className="truncate">{d.label}</span></li>)}
                {freeDocs.map(d => <li key={d.id} className="flex items-center gap-1.5 text-xs text-neutral-500 px-1.5 py-1"><FileText className="h-3 w-3 text-neutral-300 flex-shrink-0" aria-hidden /><span className="truncate">{d.label}</span></li>)}
              </ul>
            )
          )}
          {panelTab === 'kpis' && (
            (kpiLinks.length + freeKpis.length) === 0 ? (
              <p className="text-xs text-neutral-400 italic">Sin indicadores asociados</p>
            ) : (
              <ul className="space-y-1">
                {kpiLinks.map(d => <li key={d.id} className="flex items-center gap-1.5 text-xs text-neutral-700 px-1.5 py-1"><BarChart3 className="h-3 w-3 text-neutral-300 flex-shrink-0" aria-hidden /><span className="truncate">{d.label}</span></li>)}
                {freeKpis.map(d => <li key={d.id} className="flex items-center gap-1.5 text-xs text-neutral-500 px-1.5 py-1"><BarChart3 className="h-3 w-3 text-neutral-300 flex-shrink-0" aria-hidden /><span className="truncate">{d.label}</span></li>)}
              </ul>
            )
          )}
          {panelTab === 'risks' && (
            (riskLinks.length + freeRisks.length) === 0 ? (
              <p className="text-xs text-neutral-400 italic">Sin riesgos asociados</p>
            ) : (
              <ul className="space-y-1">
                {riskLinks.map(d => <li key={d.id} className="flex items-center gap-1.5 text-xs text-neutral-700 px-1.5 py-1"><Shield className="h-3 w-3 text-neutral-300 flex-shrink-0" aria-hidden /><span className="truncate">{d.label}</span></li>)}
                {freeRisks.map(d => <li key={d.id} className="flex items-center gap-1.5 text-xs text-neutral-500 px-1.5 py-1"><Shield className="h-3 w-3 text-neutral-300 flex-shrink-0" aria-hidden /><span className="truncate">{d.label}</span></li>)}
              </ul>
            )
          )}
        </div>

        <div className="px-4 py-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={() => onOpenProcessFicha(selProc)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir ficha del proceso
          </button>
        </div>
      </div>
    );
  }

  // ── JSX principal ────────────────────────────────────────────────────────
  const filteredEmpty = Object.values(bands).every(b => b.length === 0);
  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Área del mapa */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Buscador + filtro sede */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar proceso o subproceso por nombre o código…"
              aria-label="Buscar proceso o subproceso"
              className="w-full pl-9 pr-8 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-neutral-100">
                <X className="h-3.5 w-3.5 text-neutral-400" />
              </button>
            )}
          </div>
          {allSites.length > 0 && (
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" aria-hidden />
              <select
                value={site}
                onChange={e => setSite(e.target.value)}
                aria-label="Filtrar por sede"
                className="pl-7 pr-6 py-2 text-xs border border-neutral-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="">Todas las sedes</option>
                {allSites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {q && (
            <span className="text-[11px] text-neutral-500" role="status">
              {totalMatches === 1 ? '1 coincidencia' : `${totalMatches} coincidencias`}
            </span>
          )}
          <button
            type="button"
            onClick={onOpenLinks}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Network className="h-3.5 w-3.5" aria-hidden /> Vínculos entre áreas
          </button>
        </div>

        {maps.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-xl py-16 text-center">
            <Layers className="h-10 w-10 text-neutral-300 mb-3" aria-hidden />
            <p className="text-sm font-medium text-neutral-500">Todavía no hay mapas de procesos</p>
            <p className="text-xs text-neutral-400 mt-1 mb-4">Creá mapas para ver el mapa general de la organización.</p>
            <button type="button" onClick={onNewMap} className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              Crear primer mapa
            </button>
          </div>
        ) : filteredEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-xl py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-neutral-300 mb-3" aria-hidden />
            <p className="text-sm font-medium text-neutral-500">Sin resultados</p>
            <p className="text-xs text-neutral-400 mt-1 mb-3">Ningún mapa o proceso coincide con los filtros actuales.</p>
            <button type="button" onClick={() => { setQuery(''); setSite(''); }} className="text-xs text-indigo-600 underline hover:text-indigo-700">
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="flex items-stretch gap-3 min-w-[900px] pb-4">
              {FlowColumn({ kind: 'in' })}
              <div className="flex flex-col justify-center flex-shrink-0"><ArrowRight className="h-4 w-4 text-neutral-300" aria-hidden /></div>
              <div className="flex-1 space-y-3 min-w-0">
                {BandRow({ band: 'STRATEGIC', maps: bands.STRATEGIC })}
                {bands.OPERATIONAL.length > 0 && (
                  <section aria-label={BAND_META.OPERATIONAL.label} className="space-y-3">
                    <div className="flex items-center gap-2 px-0.5">
                      <Cog className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{BAND_META.OPERATIONAL.label}</span>
                      <span className="text-[10px] text-neutral-400">{BAND_META.OPERATIONAL.desc}</span>
                    </div>
                    {bands.OPERATIONAL.map(m => <Fragment key={m.id}>{Lane({ map: m, band: 'OPERATIONAL' })}</Fragment>)}
                  </section>
                )}
                {bands.COMMERCIAL.length > 0 && (
                  <section aria-label={BAND_META.COMMERCIAL.label} className="space-y-3">
                    <div className="flex items-center gap-2 px-0.5">
                      <ShoppingCart className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-violet-700">{BAND_META.COMMERCIAL.label}</span>
                      <span className="text-[10px] text-neutral-400">{BAND_META.COMMERCIAL.desc}</span>
                    </div>
                    {bands.COMMERCIAL.map(m => <Fragment key={m.id}>{Lane({ map: m, band: 'COMMERCIAL' })}</Fragment>)}
                  </section>
                )}
                {BandRow({ band: 'SUPPORT', maps: bands.SUPPORT })}
              </div>
              <div className="flex flex-col justify-center flex-shrink-0"><ArrowRight className="h-4 w-4 text-neutral-300" aria-hidden /></div>
              {FlowColumn({ kind: 'out' })}
            </div>
          </div>
        )}
      </div>

      {/* Panel lateral */}
      <aside
        aria-label="Detalle de selección"
        className={`bg-white border border-neutral-200 rounded-xl shadow-sm flex-shrink-0 overflow-hidden flex flex-col w-80 max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-2xl max-lg:rounded-none max-lg:border-0 ${!panelOpen ? 'max-lg:hidden' : ''}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Detalle</span>
          {panelOpen && (
            <button type="button" onClick={() => setSel(null)} aria-label="Cerrar panel" className="p-1 rounded-lg hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <X className="h-4 w-4 text-neutral-400" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{Panel()}</div>
      </aside>
    </div>
  );
}
