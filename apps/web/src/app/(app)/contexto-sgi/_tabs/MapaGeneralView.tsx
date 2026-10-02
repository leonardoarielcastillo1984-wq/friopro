'use client';
import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, MapPin, X, ArrowRight, ArrowDown, ArrowUp, ChevronRight, AlertTriangle,
  Target, Cog, Users, Layers, Network, FileText, Shield, BarChart3,
  ArrowLeft, ExternalLink, ListTree, ShoppingCart, PanelRightClose, PanelRightOpen,
  Truck, Package, Boxes, Wrench, Monitor, Landmark, Compass, ClipboardCheck,
  Plus, Pencil, Trash2, TrendingUp, BookOpen,
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
  // Norma a la que aplica el mapa: 'ISO9001' | 'IATF16949' | null (= ambas)
  norm?: string | null;
  processes: GenProcess[];
};

type Band = 'STRATEGIC' | 'OPERATIONAL' | 'COMMERCIAL' | 'SUPPORT';
type Sel = { kind: 'map'; mapId: string } | { kind: 'process'; processId: string } | null;
type PanelTab = 'subs' | 'docs' | 'kpis' | 'risks';

const BAND_META: Record<Band, { label: string; desc: string; band: string; border: string; text: string; badge: string; icon: any }> = {
  STRATEGIC:   { label: 'Estratégicos', desc: 'Definen el rumbo, aseguran recursos y la mejora del sistema', band: 'bg-blue-200/70', border: 'border-blue-300', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', icon: Target },
  OPERATIONAL: { label: 'Operativos', desc: 'Transforman requisitos en ruedas conformes para el cliente', band: 'bg-emerald-200/60', border: 'border-emerald-300', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', icon: Cog },
  COMMERCIAL:  { label: 'Comercial', desc: 'Gestión de solicitudes y requisitos', band: 'bg-violet-200/70', border: 'border-violet-300', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-700', icon: ShoppingCart },
  SUPPORT:     { label: 'Soporte', desc: 'Proveen recursos, controles y servicios para el funcionamiento del sistema', band: 'bg-neutral-200/80', border: 'border-neutral-300', text: 'text-neutral-600', badge: 'bg-neutral-100 text-neutral-600', icon: Users },
};

const LAYER_LABEL: Record<string, string> = { STRATEGIC: 'Estratégico', OPERATIONAL: 'Operativo', SUPPORT: 'Soporte' };

function normalize(s?: string | null) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Clasifica el mapa en su banda del Mapa General. Prioriza el campo `mapBand`
// (editable desde "Editar mapa"); sin valor → heurística por nombre + capa dominante.
// COMMERCIAL quedó deprecado: los mapas comerciales caen en OPERATIONAL.
function classifyMapBand(map: GenMap): Band {
  if (map.mapBand === 'STRATEGIC' || map.mapBand === 'OPERATIONAL' || map.mapBand === 'SUPPORT') {
    return map.mapBand;
  }
  const n = normalize(map.name);
  if (/(comercial|ventas?|cotizaci|marketing|clientes)/.test(n)) return 'OPERATIONAL';
  if (/(direcci|gerenc|estrateg|planeam|gobern|comit)/.test(n)) return 'STRATEGIC';
  if (/(rrhh|recurso|compra|sistema|tecnolog|calidad|document|manten|administ|finanz|legal|seguridad|capacit|soporte|contratac)/.test(n)) return 'SUPPORT';
  const counts: Record<Band, number> = { STRATEGIC: 0, OPERATIONAL: 0, COMMERCIAL: 0, SUPPORT: 0 };
  map.processes.filter(p => !p.parentId).forEach(p => { counts[(p.layer as Band) || 'OPERATIONAL']++; });
  const top = (Object.keys(counts) as Band[]).sort((a, b) => counts[b] - counts[a])[0];
  return counts[top] > 0 && top !== 'COMMERCIAL' ? top : 'OPERATIONAL';
}

const toBullets = (s?: string | null) => (s || '').split(/[\n,;•]+/).map(x => x.trim()).filter(Boolean);

// Icono cosmético por nombre del mapa/proceso (solo visual, no afecta datos).
function iconFor(name?: string | null) {
  const n = normalize(name);
  if (/(trafico|transport|logist|flota|distrib)/.test(n)) return Truck;
  if (/(rueda|armado|ensambl|produc|fabric)/.test(n)) return Cog;
  if (/(ckd|kit|materia|almacen|deposito|stock)/.test(n)) return Boxes;
  if (/(comercial|ventas|cotiz|cliente)/.test(n)) return ShoppingCart;
  if (/(compra|adquisi|proveed)/.test(n)) return Package;
  if (/(manten|taller|repuesto)/.test(n)) return Wrench;
  if (/(sistema|tecnolog|informatic|digital|ti\b)/.test(n)) return Monitor;
  if (/(finanz|contab|adminis|tesorer|pagos)/.test(n)) return Landmark;
  if (/(direccion|gerenc|estrateg|planeam)/.test(n)) return Compass;
  if (/(calidad|hseq|seguridad|medio amb)/.test(n)) return ClipboardCheck;
  if (/(recursos humanos|rrhh|personal|capacit)/.test(n)) return Users;
  if (/(document|legal|contrat|contrato)/.test(n)) return FileText;
  return Network;
}

// Rama del mapa general: si el mapa tiene un único proceso raíz, ese es el head
// y sus subprocesos forman la cadena. Si tiene varias raíces, el head es el mapa
// y la cadena son las raíces ordenadas.
function flowNodesOf(map: GenMap): { head: GenProcess | null; nodes: GenProcess[] } {
  const roots = map.processes
    .filter(p => !p.parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  if (roots.length === 0) return { head: null, nodes: [] };
  if (roots.length === 1) {
    const subs = map.processes
      .filter(p => p.parentId === roots[0].id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
    return { head: roots[0], nodes: subs };
  }
  return { head: null, nodes: roots };
}

export default function MapaGeneralView({
  maps,
  employees,
  docOptions,
  riskOptions,
  indicatorOptions,
  onOpenMap,
  onOpenProcessFicha,
  onEditProcess,
  onDeleteProcess,
  onNewProcess,
  onOpenLinks,
  onNewMap,
  onEditMap,
  onDeleteMap,
  onMoveMap,
  normLock,
}: {
  maps: GenMap[];
  employees: { id: string; firstName: string; lastName: string; email: string }[];
  docOptions: { id: string; label: string }[];
  riskOptions: { id: string; label: string }[];
  indicatorOptions: { id: string; label: string }[];
  onOpenMap: (m: GenMap) => void;
  onOpenProcessFicha: (p: GenProcess) => void;
  onEditProcess: (p: GenProcess) => void;
  onDeleteProcess: (p: GenProcess) => void;
  onNewProcess: (mapId: string, parentId: string | null) => void;
  onOpenLinks: () => void;
  // opts.mapBand pre-setea la banda del mapa nuevo (botón "+" del header de cada banda)
  onNewMap: (opts?: { mapBand?: Band | null }) => void;
  onEditMap: (m: GenMap) => void;
  onDeleteMap: (m: GenMap) => void;
  // Drag & drop: mover un mapa a otra banda (persiste mapBand)
  onMoveMap: (m: GenMap, band: Band) => void;
  // Cuando viene seteado, la vista muestra SOLO mapas de esa norma (pestañas ISO/IATF)
  // y se oculta el selector interno de norma.
  normLock?: 'ISO9001' | 'IATF16949' | null;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Sel>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('subs');
  const [query, setQuery] = useState('');
  const [site, setSite] = useState('');
  // Filtro por norma: '' = todas | 'ISO9001' | 'IATF16949' (mapas sin norma pasan todos los filtros).
  // Con normLock (pestañas ISO/IATF) el filtro es ESTRICTO: solo mapas con esa norma exacta.
  const [normScope, setNormScope] = useState<string>('');
  // Drag & drop entre bandas: id del mapa arrastrado + banda destino resaltada
  const [dragMapId, setDragMapId] = useState<string | null>(null);
  const [dropBand, setDropBand] = useState<Band | null>(null);
  // Panel lateral "Detalle": el usuario puede ocultarlo/mostrarlo a voluntad.
  const [showPanel, setShowPanel] = useState(true);

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
      // Filtro por norma: un mapa tagueado solo aparece en su vista; sin norma = aplica a todas.
      // Con normLock (pestaña dedicada) el mapa DEBE tener esa norma exacta.
      if (normLock ? m.norm !== normLock : (normScope && m.norm && m.norm !== normScope)) return;
      if (!m.processes.some(matchesSite)) return;
      const nameHit = q && normalize(m.name).includes(q);
      if (nameHit) mapNameSet.add(m.id);
      if (q) m.processes.forEach(p => { if (matchesSearch(p, q)) matchSet.add(p.id); });
      if (q && !nameHit && !m.processes.some(p => matchSet.has(p.id))) return;
      bands[classifyMapBand(m)].push(m);
    });
    return { bands, matchSet, mapNameSet, totalMatches: matchSet.size + mapNameSet.size };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, q, site, normScope, normLock]);

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

  // Sedes únicas donde se ejecutan los procesos del mapa (para cards de banda).
  const sitesOf = (map: GenMap): string[] =>
    [...new Set(map.processes.flatMap(p => p.sites || []))];

  // Operativos: separa "habilitadores" (industrialización, ingeniería, validación,
  // cambios) que se dibujan arriba de la cadena, del resto que forma la cadena.
  const enablerRe = /(industrializ|ingenier|desarrollo|apqp|amfe|validaci|cambio)/;
  const opEnablers = bands.OPERATIONAL.filter(m => enablerRe.test(normalize(m.name)));
  const opChainRest = bands.OPERATIONAL.filter(m => !enablerRe.test(normalize(m.name)));
  const opChain = opChainRest.length ? opChainRest : bands.OPERATIONAL;
  const opTop = opChainRest.length ? opEnablers : [];

  function StatusDot({ status }: { status?: string }) {
    return (
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${status === 'inactive' ? 'bg-neutral-300' : 'bg-emerald-500'}`}
      />
    );
  }

  // Mini-toolbar lápiz/tacho que aparece al hover sobre una card (hermano del botón,
  // no hijo — HTML no permite botones anidados).
  function CardActions({ onEdit, onDelete, title }: { onEdit: () => void; onDelete: () => void; title: string }) {
    return (
      <div className="absolute -top-1.5 -right-1.5 z-10 hidden group-hover:flex gap-0.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title={`Editar ${title}`}
          aria-label={`Editar ${title}`}
          className="h-5 w-5 rounded-md border border-neutral-200 bg-white shadow-sm flex items-center justify-center text-neutral-400 hover:text-indigo-600 hover:border-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Pencil className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title={`Eliminar ${title}`}
          aria-label={`Eliminar ${title}`}
          className="h-5 w-5 rounded-md border border-neutral-200 bg-white shadow-sm flex items-center justify-center text-neutral-400 hover:text-red-600 hover:border-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
        </button>
      </div>
    );
  }

  // Chip de norma: solo se muestra cuando el mapa está tagueado (ISO9001 / IATF16949).
  function NormChip({ norm }: { norm?: string | null }) {
    if (!norm) return null;
    return (
      <span className="text-[8px] font-bold px-1 py-px rounded bg-indigo-50 text-indigo-600 border border-indigo-100 flex-shrink-0">
        {norm === 'IATF16949' ? 'IATF' : 'ISO 9001'}
      </span>
    );
  }

  // Bullets de una card "tortuga": nombres de los subprocesos del mapa.
  const bulletsOf = (map: GenMap, limit = 8) => {
    const names = map.processes
      .filter(p => p.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
      .map(p => p.name);
    return names.slice(0, limit).join(' · ') + (names.length > limit ? '…' : '');
  };

  // Chip de sede estilo manual ("Casa central / Córdoba" | "Sede por confirmar").
  function SiteChip({ sites }: { sites: string[] }) {
    const label = sites.length ? sites.join(' / ') : 'Sede por confirmar';
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
        <MapPin className="h-2.5 w-2.5" aria-hidden />{label}
      </span>
    );
  }

  // Nodo de la cadena operativa: card "tortuga" del mapa (o de su macro raíz)
  // con bullets de subprocesos y chip de sede.
  function OpCard({ map }: { map: GenMap }) {
    const { head, nodes } = flowNodesOf(map);
    const isSel = head ? selProc?.id === head.id : selMap?.id === map.id;
    const nameHit = mapNameSet.has(map.id);
    const Icon = iconFor(head?.name || map.name);
    const title = head?.name || map.name;
    const bullets = nodes.map(n => n.name).join(' · ');
    const dim = !!(q && !nameHit && !map.processes.some(p => matchSet.has(p.id)));
    return (
      <div
        className={`relative group flex-1 min-w-[150px] max-w-[210px] ${dragMapId === map.id || dim ? 'opacity-40 saturate-50' : ''}`}
        draggable
        onDragStart={startMapDrag(map)}
        onDragEnd={endMapDrag}
        title="Arrastrar para cambiar de franja"
      >
      <button
        type="button"
        onClick={() => (head ? selectProc(head) : selectMap(map))}
        aria-pressed={isSel}
        title={head?.description || map.description || map.name}
        className={`w-full h-full text-left bg-white border rounded-lg px-3 py-2.5 min-h-[64px] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isSel
            ? 'border-indigo-400 ring-2 ring-indigo-500/60 bg-indigo-50 shadow-sm'
            : 'border-emerald-300/80 hover:border-indigo-300 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start justify-center gap-1.5">
          <Icon className="h-4 w-4 flex-shrink-0 mt-px text-emerald-600" aria-hidden />
          <span className={`text-[11px] font-bold leading-tight break-words text-center ${isSel ? 'text-indigo-800' : 'text-neutral-800'}`}>{title}</span>
          <StatusDot status={head?.status} />
        </div>
        {bullets && <p className="text-[9px] text-neutral-500 mt-1 leading-snug break-words text-center">{bullets}</p>}
        <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
          <SiteChip sites={head?.sites?.length ? head.sites : sitesOf(map)} />
          <NormChip norm={map.norm} />
        </div>
      </button>
      {head
        ? CardActions({ onEdit: () => onEditProcess(head), onDelete: () => onDeleteProcess(head), title: head.name })
        : CardActions({ onEdit: () => onEditMap(map), onDelete: () => onDeleteMap(map), title: map.name })}
      </div>
    );
  }

  // Flecha de la cadena con etiqueta (lo que "viaja" entre procesos).
  function ChainArrow({ label }: { label?: string }) {
    return (
      <div className="flex flex-col items-center justify-center self-center w-14 sm:w-16 flex-shrink-0 px-0.5">
        <span className="text-[8px] text-neutral-500 text-center leading-tight mb-0.5 min-h-[16px] break-words w-full">{label || ''}</span>
        <div className="flex items-center w-full">
          <div className="h-px flex-1 bg-neutral-300" />
          <ArrowRight className="h-3 w-3 text-neutral-400 -ml-0.5 flex-shrink-0" aria-hidden />
        </div>
      </div>
    );
  }

  // Caja de extremo de la cadena: CLIENTE / ENTRADAS y CLIENTE / RESULTADOS
  // (una línea por ítem, como en el manual).
  function EndBox({ kind }: { kind: 'in' | 'out' }) {
    const isIn = kind === 'in';
    const labels = [...new Set(bands.OPERATIONAL.flatMap(m => toBullets(isIn ? m.inputLabel : m.outputLabel)))];
    const fallback = isIn
      ? ['Requisitos y CSR', 'Especificaciones', 'Programas de entrega']
      : ['Productos conformes', 'Entregas acordadas', 'Trazabilidad'];
    const lines = (labels.length ? labels : fallback).slice(0, 4);
    return (
      <div className="flex-shrink-0 w-28 lg:w-32 self-stretch flex">
        <div className="bg-white border-2 border-emerald-300/80 rounded-md px-2 py-3 w-full flex flex-col items-center justify-center text-center shadow-sm">
          <p className="text-[10px] font-extrabold text-neutral-800 uppercase leading-tight">Cliente /</p>
          <p className="text-[10px] font-extrabold text-neutral-800 uppercase leading-tight">{isIn ? 'Entradas' : 'Resultados'}</p>
          <ul className="mt-1.5 space-y-0.5">
            {lines.map(l => <li key={l} className="text-[8px] text-neutral-500 leading-snug break-words">{l}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  // Barra conectora entre bandas (flechas de interacción del mapa tipo tortuga).
  function BandConnector({ kind }: { kind: 'strategic' | 'support' }) {
    if (kind === 'strategic') {
      return (
        <div className="flex items-center justify-between px-10 sm:px-16 py-1 text-[9px] font-semibold">
          <span className="flex items-center gap-1.5 text-blue-700">
            Objetivos, decisiones y recursos
            <ArrowDown className="h-4 w-4 text-blue-600" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="flex items-center gap-1.5 text-emerald-700">
            <ArrowUp className="h-4 w-4 text-emerald-600" strokeWidth={2.5} aria-hidden />
            Indicadores y resultados
          </span>
        </div>
      );
    }
    return (
      <div className="relative flex items-center justify-center py-1.5">
        <span className="flex items-center gap-2 text-[9px] font-semibold text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-full px-4 py-1">
          Recursos y controles <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          <span className="text-neutral-300" aria-hidden>•</span>
          Necesidades y resultados <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        </span>
        {/* Flecha punteada hacia "Procesos externalizados" (borde derecho de Soporte) */}
        <div className="absolute right-8 top-0 flex flex-col items-center" aria-hidden>
          <div className="w-px h-3 border-l border-dashed border-neutral-400" />
          <ArrowDown className="h-3 w-3 text-neutral-400 -mt-0.5" />
        </div>
      </div>
    );
  }

  // Lazo lateral del mapa tortuga: retroalimentación de la cadena hacia los
  // procesos habilitadores ("Desempeño, reclamos y cambios").
  function LoopTag() {
    return (
      <div className="w-20 flex-shrink-0 flex flex-col items-center justify-end gap-0.5 pb-1">
        <span className="text-[8px] text-neutral-500 text-center leading-tight">Desempeño, reclamos y cambios</span>
        <ArrowUp className="h-4 w-4 text-emerald-500" aria-hidden />
      </div>
    );
  }

  // Caja punteada "Procesos externalizados" dentro de Soporte (del manual).
  function ExtBox() {
    return (
      <div className="flex-1 min-w-[170px] max-w-[220px] rounded-lg border-2 border-dashed border-neutral-300 bg-white/50 px-3 py-2.5 text-center flex flex-col justify-center">
        <p className="text-[9px] font-bold text-neutral-500 uppercase leading-tight">Procesos externalizados, si aplican</p>
        <p className="text-[8px] text-neutral-400 mt-1 leading-snug">Identificar proveedor, proceso, controles e interfaces</p>
      </div>
    );
  }

  // Card "tortuga" para Estratégicos/Soporte: nombre + bullets de subprocesos + chip de sede.
  function MapCard({ map, band }: { map: GenMap; band: Band }) {
    const meta = BAND_META[band];
    const Icon = iconFor(map.name);
    const isSel = selMap?.id === map.id;
    const nameHit = mapNameSet.has(map.id);
    const mapHasMatch = q && (nameHit || map.processes.some(p => matchSet.has(p.id)));
    const bullets = bulletsOf(map);
    return (
      <div
        className={`relative group flex-1 min-w-[170px] ${band === 'STRATEGIC' ? 'max-w-[560px]' : 'max-w-[250px]'} ${dragMapId === map.id ? 'opacity-40' : ''}`}
        draggable
        onDragStart={startMapDrag(map)}
        onDragEnd={endMapDrag}
        title="Arrastrar para cambiar de franja"
      >
      <button
        type="button"
        onClick={() => selectMap(map)}
        aria-pressed={isSel}
        title={map.description || map.name}
        className={`w-full h-full text-left bg-white border rounded-lg px-3 py-2.5 min-h-[56px] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isSel
            ? 'border-indigo-400 ring-2 ring-indigo-500/60 bg-indigo-50 shadow-sm'
            : mapHasMatch
              ? 'border-amber-300 ring-1 ring-amber-300 hover:border-indigo-300'
              : 'border-neutral-300 hover:border-indigo-300 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start justify-center gap-1.5">
          <Icon className={`h-4 w-4 flex-shrink-0 mt-px ${meta.text}`} aria-hidden />
          <span className={`text-[11px] font-bold leading-tight break-words text-center ${isSel ? 'text-indigo-800' : 'text-neutral-800'} ${nameHit ? 'underline decoration-amber-400 decoration-2 underline-offset-2' : ''}`}>
            {map.name}
          </span>
          <StatusDot />
        </div>
        {bullets && <p className="text-[9px] text-neutral-500 mt-1 leading-snug break-words text-center">{bullets}</p>}
        <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
          <SiteChip sites={sitesOf(map)} />
          <NormChip norm={map.norm} />
        </div>
      </button>
      {CardActions({ onEdit: () => onEditMap(map), onDelete: () => onDeleteMap(map), title: map.name })}
      </div>
    );
  }

  // Drag & drop: helpers de arrastre/soltar entre bandas.
  function startMapDrag(map: GenMap) {
    return (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', map.id);
      e.dataTransfer.effectAllowed = 'move';
      setDragMapId(map.id);
    };
  }
  function endMapDrag() {
    setDragMapId(null);
    setDropBand(null);
  }
  function onBandDragOver(band: Band) {
    return (e: React.DragEvent) => {
      if (!dragMapId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropBand(band);
    };
  }
  function onBandDrop(band: Band) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragMapId;
      const m = maps.find(x => x.id === id);
      const cur = m ? classifyMapBand(m) : null;
      if (m && cur !== band) onMoveMap(m, band);
      endMapDrag();
    };
  }

  // Contenedor de banda estilo "tortuga": riel de color a la izquierda con el
  // nombre + descripción de la franja; contenido a la derecha. Zona de drop DnD.
  function BandSection({ band, children }: { band: Band; children: React.ReactNode }) {
    const meta = BAND_META[band];
    const Icon = meta.icon;
    const isTarget = dropBand === band;
    return (
      <section
        aria-label={meta.label}
        onDragOver={onBandDragOver(band)}
        onDragLeave={e => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDropBand(null); }}
        onDrop={onBandDrop(band)}
        className={`flex items-stretch rounded-xl border ${meta.border} overflow-hidden transition-shadow ${isTarget ? 'ring-2 ring-indigo-400 shadow-md' : ''}`}
      >
        <div className={`w-24 lg:w-28 flex-shrink-0 ${meta.band} px-2.5 py-3 flex flex-col`}>
          <div className={`flex items-center gap-1 ${meta.text}`}>
            <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            <span className="text-[10px] font-extrabold uppercase tracking-wide leading-tight">{meta.label}</span>
          </div>
          <p className={`text-[8px] leading-snug mt-1 ${meta.text} opacity-80`}>{meta.desc}</p>
          <button
            type="button"
            onClick={() => onNewMap({ mapBand: band })}
            title={`Agregar mapa a ${meta.label}`}
            aria-label={`Agregar mapa a ${meta.label}`}
            className="mt-auto self-start h-6 w-6 rounded-md border border-neutral-300/70 bg-white/80 flex items-center justify-center text-neutral-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 min-w-0 bg-white/40 p-2.5 flex flex-col justify-center">
          {children}
        </div>
      </section>
    );
  }

  // Placeholder de banda vacía: mantiene la franja visible con CTA para agregar un mapa.
  function BandEmpty({ band }: { band: Band }) {
    const meta = BAND_META[band];
    return (
      <button
        type="button"
        onClick={() => onNewMap({ mapBand: band })}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 bg-white/40 py-3 text-xs text-neutral-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar mapa a {meta.label}
      </button>
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
      const MapIcon = iconFor(selMap.name);
      return (
        <div className="px-4 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.badge}`}>
                <MapIcon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <h3 className="text-sm font-bold text-neutral-900 truncate">{selMap.name}</h3>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
            {selMap.norm && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 ml-1">
                {selMap.norm === 'IATF16949' ? 'IATF 16949' : 'ISO 9001'}
              </span>
            )}
            {selMap.scope && <p className="text-[11px] text-neutral-500 mt-1.5"><span className="font-medium">Alcance:</span> {selMap.scope}</p>}
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
              <ul className="space-y-0.5">
                {macros.map((macro, i) => (
                  <li key={macro.id}>
                    <button
                      type="button"
                      onClick={() => selectProc(macro)}
                      className="flex items-center gap-2.5 w-full text-left rounded-lg px-1.5 py-1.5 -mx-1.5 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group"
                    >
                      <span className="text-[10px] font-mono font-semibold text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5 w-7 text-center flex-shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 text-xs text-neutral-700 group-hover:text-indigo-600 truncate">{macro.name}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-300 flex-shrink-0" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNewProcess(selMap.id, null)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Nuevo proceso en {selMap.name}
          </button>
          <button
            type="button"
            onClick={() => onOpenMap(selMap)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir mapa {selMap.name}
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
            <div className="flex items-center gap-2 mb-1.5">
              {(() => { const PIcon = iconFor(selProc.name); return (
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isSub ? 'bg-neutral-100 text-neutral-500' : 'bg-indigo-100 text-indigo-600'}`}>
                  <PIcon className="h-3.5 w-3.5" aria-hidden />
                </span>
              ); })()}
              <h3 className="text-sm font-bold text-neutral-900 truncate">{selProc.name}</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isSub ? 'bg-neutral-100 text-neutral-600' : 'bg-indigo-100 text-indigo-700'}`}>
                {isSub ? 'Subproceso' : LAYER_LABEL[selProc.layer] || selProc.layer}
              </span>
              {selProc.status === 'inactive' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Inactivo</span>
              )}
              {selProc.code && <span className="text-[10px] font-mono text-neutral-400">{selProc.code}</span>}
            </div>
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
              <ul className="space-y-0.5">
                {subs.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => selectProc(s)}
                      className="flex items-center gap-2.5 w-full text-left rounded-lg px-1.5 py-1.5 -mx-1.5 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group"
                    >
                      <span className="text-[10px] font-mono font-semibold text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5 w-7 text-center flex-shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 text-xs text-neutral-700 group-hover:text-indigo-600 truncate">{s.name}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-300 flex-shrink-0" aria-hidden />
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

        <div className="px-4 py-3 border-t border-neutral-100 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEditProcess(selProc)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
            </button>
            {!isSub && (
              <button
                type="button"
                onClick={() => onNewProcess(selProcMap.id, selProc.id)}
                title="Agregar subproceso"
                className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Sub
              </button>
            )}
            <button
              type="button"
              onClick={() => { onDeleteProcess(selProc); setSel(null); }}
              title="Eliminar proceso"
              className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/riesgos?nature=OPPORTUNITY&crear=1&proceso=${encodeURIComponent(selProc.name)}`)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Registrar oportunidad
          </button>
          <button
            type="button"
            onClick={() => onOpenProcessFicha(selProc)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir ficha de {selProc.name}
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
        {/* Título + buscador + filtro sede */}
        <div className="mb-3">
          <h2 className="text-base font-bold text-neutral-900">
            Mapa general de procesos{normLock === 'ISO9001' ? ' — ISO 9001' : normLock === 'IATF16949' ? ' — IATF 16949' : ''}
          </h2>
          <p className="text-xs text-neutral-400">Operaciones independientes, procesos conectados</p>
        </div>
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
          {!normLock && (
          <div className="relative">
            <BookOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" aria-hidden />
            <select
              value={normScope}
              onChange={e => setNormScope(e.target.value)}
              aria-label="Filtrar por norma"
              className="pl-7 pr-6 py-2 text-xs border border-neutral-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              <option value="">Todas las normas</option>
              <option value="ISO9001">ISO 9001</option>
              <option value="IATF16949">IATF 16949</option>
            </select>
          </div>
          )}
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
          <button
            type="button"
            onClick={() => setShowPanel(v => !v)}
            aria-pressed={showPanel}
            title={showPanel ? 'Ocultar panel de detalle' : 'Mostrar panel de detalle'}
            aria-label={showPanel ? 'Ocultar panel de detalle' : 'Mostrar panel de detalle'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              showPanel ? 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100' : 'text-neutral-500 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {showPanel
              ? <PanelRightClose className="h-3.5 w-3.5" aria-hidden />
              : <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />}
            Detalle
          </button>
        </div>

        {maps.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-xl py-16 text-center">
            <Layers className="h-10 w-10 text-neutral-300 mb-3" aria-hidden />
            <p className="text-sm font-medium text-neutral-500">Todavía no hay mapas de procesos</p>
            <p className="text-xs text-neutral-400 mt-1 mb-4">Creá mapas para ver el mapa general de la organización.</p>
            <button type="button" onClick={() => onNewMap()} className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              Crear primer mapa
            </button>
          </div>
        ) : filteredEmpty && (!normLock || q || site) ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-xl py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-neutral-300 mb-3" aria-hidden />
            <p className="text-sm font-medium text-neutral-500">Sin resultados</p>
            <p className="text-xs text-neutral-400 mt-1 mb-3">
              {normLock
                ? `No hay mapas asignados a ${normLock === 'IATF16949' ? 'IATF 16949' : 'ISO 9001'}. Editá un mapa y asignale la norma.`
                : 'Ningún mapa o proceso coincide con los filtros actuales.'}
            </p>
            <button type="button" onClick={() => { setQuery(''); setSite(''); setNormScope(''); }} className="text-xs text-indigo-600 underline hover:text-indigo-700">
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="min-w-[960px] pb-4">
              {/* Franja Estratégicos */}
              <BandSection band="STRATEGIC">
                {bands.STRATEGIC.length === 0 ? <BandEmpty band="STRATEGIC" /> : (
                  <div className="flex flex-wrap items-stretch gap-2">
                    {bands.STRATEGIC.map(m => <Fragment key={m.id}>{MapCard({ map: m, band: 'STRATEGIC' })}</Fragment>)}
                  </div>
                )}
              </BandSection>

              {/* Conector Estratégicos ↔ Operativos */}
              <BandConnector kind="strategic" />

              {/* Franja Operativos: habilitadores arriba + cadena Entradas → mapas → Resultados */}
              <BandSection band="OPERATIONAL">
                {bands.OPERATIONAL.length === 0 ? <BandEmpty band="OPERATIONAL" /> : (
                  <div className="rounded-lg border-2 border-emerald-300/70 bg-emerald-50/40 p-2">
                    {/* Habilitadores arriba de la cadena + lazos laterales */}
                    {opTop.length > 0 && (
                      <div className="flex items-stretch">
                        <LoopTag />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-stretch justify-center gap-2">
                            {opTop.map(m => <Fragment key={m.id}>{OpCard({ map: m })}</Fragment>)}
                          </div>
                          <div className="flex justify-center gap-10 mt-0.5">
                            {opTop.map(m => (
                              <span key={m.id} className="flex flex-col items-center w-24">
                                <ArrowDown className="h-4 w-4 text-emerald-600" strokeWidth={2.5} aria-hidden />
                                <span className="text-[8px] text-neutral-500 leading-tight text-center">
                                  {toBullets(flowNodesOf(m).head?.outputs)[0] || 'Proceso validado'}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <LoopTag />
                      </div>
                    )}
                    {/* Cadena: Entradas → mapas → Resultados */}
                    <div className="flex items-stretch gap-1 overflow-x-auto py-1">
                      {EndBox({ kind: 'in' })}
                      {opChain.map((m, i) => {
                        const prev = opChain[i - 1];
                        const label = prev
                          ? toBullets(flowNodesOf(prev).head?.outputs)[0] || ''
                          : toBullets(flowNodesOf(m).head?.inputs)[0] || '';
                        return (
                          <Fragment key={m.id}>
                            <ChainArrow label={label} />
                            {OpCard({ map: m })}
                          </Fragment>
                        );
                      })}
                      <ChainArrow label={toBullets(flowNodesOf(opChain[opChain.length - 1]).head?.outputs)[0] || ''} />
                      {EndBox({ kind: 'out' })}
                    </div>
                    {/* Línea de retroalimentación bajo la cadena */}
                    <div className="flex items-center gap-1.5 px-6">
                      <ArrowUp className="h-3 w-3 text-emerald-600 flex-shrink-0" aria-hidden />
                      <div className="h-px flex-1 bg-emerald-400/70" />
                      <span className="text-[8px] text-neutral-500 whitespace-nowrap">Desempeño, reclamos y cambios</span>
                      <div className="h-px flex-1 bg-emerald-400/70" />
                      <ArrowUp className="h-3 w-3 text-emerald-600 flex-shrink-0" aria-hidden />
                    </div>
                  </div>
                )}
              </BandSection>

              {/* Conector Operativos ↔ Soporte */}
              <BandConnector kind="support" />

              {/* Franja Soporte + procesos externalizados */}
              <BandSection band="SUPPORT">
                {bands.SUPPORT.length === 0 ? <BandEmpty band="SUPPORT" /> : (
                  <div className="flex flex-wrap items-stretch gap-2">
                    {bands.SUPPORT.map(m => <Fragment key={m.id}>{MapCard({ map: m, band: 'SUPPORT' })}</Fragment>)}
                    {ExtBox()}
                  </div>
                )}
              </BandSection>

              {/* Leyenda al pie (como en el manual) */}
              <div className="flex items-start justify-between gap-6 px-1 pt-2">
                <p className="text-[8px] text-neutral-400 leading-snug">* Ubicación presunta: validar por planta.</p>
                <p className="text-[8px] text-neutral-400 leading-snug text-right">Cada proceso se vincula a su ficha: responsable, entradas/salidas, riesgos, controles e indicadores.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel lateral (ocultable desde la toolbar) */}
      {showPanel && (
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
      )}
    </div>
  );
}
