'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import { getTenantId } from '@/lib/api';
import { useCompany } from '@/lib/company-context';
import { X, Download, FileText, Plus, Trash2, Sparkles, Target, Cog, Users } from 'lucide-react';

type Layer = 'STRATEGIC' | 'OPERATIONAL' | 'SUPPORT';

interface MiniProcess {
  id: string;
  layer: Layer;
  name: string;
  inputs?: string;
  outputs?: string;
  status: 'active' | 'inactive';
}
interface MiniMap {
  id: string;
  name: string;
  description?: string;
  inputLabel?: string;
  outputLabel?: string;
  processes: MiniProcess[];
}

interface MacroLink { from: string; to: string; }

const LAYER_META: Record<Layer, { label: string; band: string; node: string; text: string; icon: any; accent: string }> = {
  STRATEGIC: { label: 'Estratégicos', band: '#EFF6FF', node: '#3B82F6', text: '#1E3A8A', icon: Target, accent: '#2563EB' },
  OPERATIONAL: { label: 'Operativos', band: '#F0FDF4', node: '#22C55E', text: '#14532D', icon: Cog, accent: '#16A34A' },
  SUPPORT: { label: 'Soporte', band: '#FFF7ED', node: '#F97316', text: '#7C2D12', icon: Users, accent: '#EA580C' },
};

// ── Layout constants ───────────────────────────────────────────────
const NODE_W = 190;
const NODE_H = 78;
const H_GAP = 52;
const BAND_PAD_Y = 26;
const BAND_GAP = 34;
const SIDE_W = 132;
const SIDE_GAP = 48;
const TOP = 40;
const BAND_H = NODE_H + BAND_PAD_Y * 2;

const STOPWORDS = new Set(['para', 'con', 'que', 'una', 'uno', 'por', 'como', 'del', 'los', 'las', 'sus', 'esta', 'este', 'sobre', 'entre', 'cada', 'segun']);

function normalize(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function tokens(s?: string): Set<string> {
  const set = new Set<string>();
  normalize(s || '').split(/[^a-z0-9]+/).forEach(w => { if (w.length > 4 && !STOPWORDS.has(w)) set.add(w); });
  return set;
}

function classifyLayer(map: MiniMap): Layer {
  const n = normalize(map.name);
  if (/(direcci|gerenc|estrateg|planeam|gobern|comit)/.test(n)) return 'STRATEGIC';
  if (/(rrhh|recurso|compra|sistema|tecnolog|calidad|document|manten|administ|finanz|legal|seguridad|capacit|soporte)/.test(n)) return 'SUPPORT';
  // Fallback: dominant layer among its processes
  const counts: Record<Layer, number> = { STRATEGIC: 0, OPERATIONAL: 0, SUPPORT: 0 };
  map.processes.forEach(p => { counts[p.layer] = (counts[p.layer] || 0) + 1; });
  const top = (Object.keys(counts) as Layer[]).sort((a, b) => counts[b] - counts[a])[0];
  return counts[top] > 0 ? top : 'OPERATIONAL';
}

function edgePoint(cx: number, cy: number, hw: number, hh: number, tx: number, ty: number) {
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

export default function MapaGeneralModal({ maps, onClose }: { maps: MiniMap[]; onClose: () => void }) {
  const { settings: companySettings } = useCompany();
  const svgRef = useRef<SVGSVGElement>(null);
  const storageKey = `pm_macro_links_${getTenantId() || 'default'}`;

  const [links, setLinks] = useState<MacroLink[]>([]);
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      if (raw) setLinks(JSON.parse(raw));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: MacroLink[]) {
    setLinks(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const classified = useMemo(() => maps.map(m => ({ map: m, layer: classifyLayer(m) })), [maps]);

  // ── Compute layout ────────────────────────────────────────────────
  const layout = useMemo(() => {
    const byLayer: Record<Layer, { map: MiniMap }[]> = { STRATEGIC: [], OPERATIONAL: [], SUPPORT: [] };
    classified.forEach(c => byLayer[c.layer].push({ map: c.map }));

    const bandWidth = (n: number) => (n > 0 ? n * NODE_W + (n - 1) * H_GAP : NODE_W);
    const contentW = Math.max(bandWidth(byLayer.STRATEGIC.length), bandWidth(byLayer.OPERATIONAL.length), bandWidth(byLayer.SUPPORT.length), NODE_W);
    const leftPad = SIDE_W + SIDE_GAP;
    const rightPad = SIDE_W + SIDE_GAP;
    const totalWidth = leftPad + contentW + rightPad;

    const bandY: Record<Layer, number> = {
      STRATEGIC: TOP,
      OPERATIONAL: TOP + BAND_H + BAND_GAP,
      SUPPORT: TOP + (BAND_H + BAND_GAP) * 2,
    };
    const totalHeight = bandY.SUPPORT + BAND_H + TOP;

    const nodes: Record<string, { map: MiniMap; layer: Layer; x: number; y: number }> = {};
    (['STRATEGIC', 'OPERATIONAL', 'SUPPORT'] as Layer[]).forEach(layer => {
      const arr = byLayer[layer];
      const bw = bandWidth(arr.length);
      const startX = leftPad + (contentW - bw) / 2;
      arr.forEach((item, i) => {
        nodes[item.map.id] = {
          map: item.map,
          layer,
          x: startX + i * (NODE_W + H_GAP),
          y: bandY[layer] + BAND_PAD_Y,
        };
      });
    });

    return { byLayer, contentW, leftPad, rightPad, totalWidth, bandY, totalHeight, nodes };
  }, [classified]);

  // Operational chain (sequential left→right)
  const chain = useMemo(() => {
    const ops = layout.byLayer.OPERATIONAL.map(o => layout.nodes[o.map.id]).sort((a, b) => a.x - b.x);
    const segs: { from: string; to: string }[] = [];
    for (let i = 0; i < ops.length - 1; i++) segs.push({ from: ops[i].map.id, to: ops[i + 1].map.id });
    return segs;
  }, [layout]);

  function suggestFromSipoc() {
    const agg = maps.map(m => ({
      id: m.id,
      out: tokens([m.outputLabel, ...m.processes.map(p => p.outputs || '')].join(' ')),
      inp: tokens([m.inputLabel, ...m.processes.map(p => p.inputs || '')].join(' ')),
    }));
    const found: MacroLink[] = [];
    for (const a of agg) for (const b of agg) {
      if (a.id === b.id) continue;
      let overlap = 0;
      a.out.forEach(w => { if (b.inp.has(w)) overlap++; });
      if (overlap >= 1) found.push({ from: a.id, to: b.id });
    }
    const key = (l: MacroLink) => `${l.from}->${l.to}`;
    const seen = new Set(links.map(key));
    const merged = [...links];
    found.forEach(l => { if (!seen.has(key(l))) { seen.add(key(l)); merged.push(l); } });
    persist(merged);
  }

  function addLink() {
    if (!newFrom || !newTo || newFrom === newTo) return;
    const key = (l: MacroLink) => `${l.from}->${l.to}`;
    if (links.some(l => key(l) === `${newFrom}->${newTo}`)) return;
    persist([...links, { from: newFrom, to: newTo }]);
    setNewFrom(''); setNewTo('');
  }
  function removeLink(idx: number) { persist(links.filter((_, i) => i !== idx)); }

  const mapName = (id: string) => maps.find(m => m.id === id)?.name || id;

  // ── Export PDF (print window) ─────────────────────────────────────
  function exportPDF() {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const revision = `Rev. ${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}`;
    const companyName = companySettings?.companyName || 'Organización';
    const logoUrl = companySettings?.logoUrl || '';
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="max-height:56px;max-width:120px;object-fit:contain;" alt="Logo" />`
      : `<div style="width:56px;height:56px;background:#1D4ED8;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;">${companyName.charAt(0)}</div>`;
    const vb = svgEl.getAttribute('viewBox') || `0 0 ${layout.totalWidth} ${layout.totalHeight}`;
    const innerSVG = svgEl.innerHTML;
    const rows = classified.map(c => `<tr><td>${c.map.name}</td><td>${LAYER_META[c.layer].label}</td><td style="text-align:center">${c.map.processes.length}</td></tr>`).join('');
    const linkRows = links.length
      ? links.map(l => `<li>${mapName(l.from)} &rarr; ${mapName(l.to)}</li>`).join('')
      : '<li style="color:#9CA3AF">Sin vínculos definidos</li>';
    const w = window.open('', '_blank', 'width=1200,height=900');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><title>Mapa General de Procesos — ${companyName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; color: #111827; padding: 12px; }
  @page { size: A3 landscape; margin: 10mm; }
  @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  .iso-header { display: flex; align-items: stretch; border: 2px solid #1D4ED8; border-radius: 4px; margin-bottom: 14px; overflow: hidden; }
  .iso-logo { padding: 10px 16px; display: flex; align-items: center; background: #F8FAFF; border-right: 1px solid #CBD5E1; min-width: 140px; }
  .iso-title { flex: 1; padding: 8px 16px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #CBD5E1; }
  .iso-title h1 { font-size: 15px; font-weight: 700; color: #1D4ED8; text-transform: uppercase; letter-spacing: .5px; }
  .iso-title p { font-size: 11px; color: #6B7280; margin-top: 3px; }
  .iso-meta { display: flex; flex-direction: column; justify-content: center; min-width: 190px; }
  .iso-meta-row { display: flex; padding: 4px 12px; border-bottom: 1px solid #E5E7EB; font-size: 10px; }
  .iso-meta-row:last-child { border-bottom: none; }
  .iso-meta-label { color: #6B7280; width: 90px; }
  .iso-meta-value { font-weight: 600; }
  svg { max-width: 100%; height: auto; display: block; }
  h4 { font-size: 12px; margin: 16px 0 6px; color: #1D4ED8; text-transform: uppercase; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #E5E7EB; padding: 5px 8px; text-align: left; }
  th { background: #F8FAFF; }
  ul { font-size: 11px; columns: 2; padding-left: 18px; }
  .iso-footer { margin-top: 14px; border-top: 1px solid #E5E7EB; padding-top: 7px; display: flex; justify-content: space-between; font-size: 8.5px; color: #9CA3AF; }
  .print-btn { display: inline-flex; gap: 6px; margin: 0 0 10px; padding: 8px 20px; background: #1D4ED8; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
</style></head><body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
  <div class="iso-header">
    <div class="iso-logo">${logoHtml}</div>
    <div class="iso-title"><h1>Mapa General de Procesos</h1><p>${companyName} — Interacción de procesos (ISO 9001:2015 §4.4)</p></div>
    <div class="iso-meta">
      <div class="iso-meta-row"><span class="iso-meta-label">Código:</span><span class="iso-meta-value">SGI-MP-000</span></div>
      <div class="iso-meta-row"><span class="iso-meta-label">Revisión:</span><span class="iso-meta-value">${revision}</span></div>
      <div class="iso-meta-row"><span class="iso-meta-label">Fecha:</span><span class="iso-meta-value">${dateStr}</span></div>
      <div class="iso-meta-row"><span class="iso-meta-label">Norma:</span><span class="iso-meta-value">ISO 9001:2015</span></div>
    </div>
  </div>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${innerSVG}</svg>
  <h4>Resumen de procesos por área</h4>
  <table><thead><tr><th>Área / Macroproceso</th><th>Capa</th><th>N° procesos</th></tr></thead><tbody>${rows}</tbody></table>
  <h4>Vínculos entre áreas (entradas / salidas)</h4>
  <ul>${linkRows}</ul>
  <div class="iso-footer"><span>Documento controlado — No válido si es impresión no autorizada</span><span>${companyName} · Sistema de Gestión Integrado</span><span>Emitido el ${dateStr}</span></div>
</body></html>`);
    w.document.close();
    w.focus();
  }

  function downloadSVG() {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mapa-general-procesos.svg';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Helper to render a link path
  function linkPath(from: string, to: string) {
    const a = layout.nodes[from], b = layout.nodes[to];
    if (!a || !b) return null;
    const acx = a.x + NODE_W / 2, acy = a.y + NODE_H / 2;
    const bcx = b.x + NODE_W / 2, bcy = b.y + NODE_H / 2;
    const s = edgePoint(acx, acy, NODE_W / 2, NODE_H / 2, bcx, bcy);
    const e = edgePoint(bcx, bcy, NODE_W / 2 + 7, NODE_H / 2 + 7, acx, acy);
    const mx = (s.x + e.x) / 2, my = (s.y + e.y) / 2;
    const dx = e.x - s.x, dy = e.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = Math.min(46, len * 0.22);
    const cx = mx + (-dy / len) * off, cy = my + (dx / len) * off;
    return `M ${s.x} ${s.y} Q ${cx} ${cy} ${e.x} ${e.y}`;
  }

  const sideY = layout.bandY.STRATEGIC;
  const sideH = layout.bandY.SUPPORT + BAND_H - layout.bandY.STRATEGIC;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 no-print">
        <div>
          <h3 className="font-semibold text-neutral-900">Mapa General de Procesos</h3>
          <p className="text-xs text-neutral-500">Interacción de todas las áreas — ISO 9001 §4.4</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadSVG} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">
            <Download className="h-3.5 w-3.5" /> SVG
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <FileText className="h-3.5 w-3.5" /> Exportar PDF
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100"><X className="h-5 w-5 text-neutral-400" /></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-neutral-50 p-6">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.totalWidth} ${layout.totalHeight}`}
            width={layout.totalWidth}
            height={layout.totalHeight}
            style={{ maxWidth: '100%', height: 'auto', background: 'white' }}
          >
            <defs>
              <marker id="mg-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L8,3 L0,6 Z" fill="#94A3B8" />
              </marker>
              <marker id="mg-arrow-link" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L8,3 L0,6 Z" fill="#6366F1" />
              </marker>
            </defs>

            {/* Bands */}
            {(['STRATEGIC', 'OPERATIONAL', 'SUPPORT'] as Layer[]).map(layer => {
              const meta = LAYER_META[layer];
              return (
                <g key={layer}>
                  <rect x={layout.leftPad - 16} y={layout.bandY[layer]} width={layout.contentW + 32} height={BAND_H} rx={12} fill={meta.band} stroke={meta.node} strokeOpacity={0.3} />
                  <text x={layout.leftPad - 6} y={layout.bandY[layer] + 16} fontSize={11} fontWeight={700} fill={meta.accent} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>{meta.label}</text>
                </g>
              );
            })}

            {/* Entrada / Salida columns */}
            <g>
              <rect x={8} y={sideY} width={SIDE_W} height={sideH} rx={12} fill="white" stroke="#CBD5E1" />
              <text x={8 + SIDE_W / 2} y={sideY + 26} textAnchor="middle" fontSize={11} fontWeight={700} fill="#475569">ENTRADAS</text>
              <text x={8 + SIDE_W / 2} y={sideY + sideH / 2} textAnchor="middle" fontSize={10} fill="#64748B">Requisitos del</text>
              <text x={8 + SIDE_W / 2} y={sideY + sideH / 2 + 14} textAnchor="middle" fontSize={10} fill="#64748B">cliente / PI</text>
            </g>
            <g>
              <rect x={layout.totalWidth - SIDE_W - 8} y={sideY} width={SIDE_W} height={sideH} rx={12} fill="white" stroke="#CBD5E1" />
              <text x={layout.totalWidth - SIDE_W - 8 + SIDE_W / 2} y={sideY + 26} textAnchor="middle" fontSize={11} fontWeight={700} fill="#475569">SALIDAS</text>
              <text x={layout.totalWidth - SIDE_W - 8 + SIDE_W / 2} y={sideY + sideH / 2} textAnchor="middle" fontSize={10} fill="#64748B">Satisfacción del</text>
              <text x={layout.totalWidth - SIDE_W - 8 + SIDE_W / 2} y={sideY + sideH / 2 + 14} textAnchor="middle" fontSize={10} fill="#64748B">cliente / PI</text>
            </g>
            {/* Entrada → system / system → salida */}
            <line x1={8 + SIDE_W} y1={layout.bandY.OPERATIONAL + BAND_H / 2} x2={layout.leftPad - 18} y2={layout.bandY.OPERATIONAL + BAND_H / 2} stroke="#94A3B8" strokeWidth={2} markerEnd="url(#mg-arrow)" />
            <line x1={layout.leftPad + layout.contentW + 16} y1={layout.bandY.OPERATIONAL + BAND_H / 2} x2={layout.totalWidth - SIDE_W - 10} y2={layout.bandY.OPERATIONAL + BAND_H / 2} stroke="#94A3B8" strokeWidth={2} markerEnd="url(#mg-arrow)" />

            {/* Operational chain arrows */}
            {chain.map((seg, i) => {
              const p = linkPath(seg.from, seg.to);
              return p ? <path key={`c${i}`} d={p} fill="none" stroke="#94A3B8" strokeWidth={2} markerEnd="url(#mg-arrow)" /> : null;
            })}

            {/* Manual / suggested links */}
            {links.map((l, i) => {
              const p = linkPath(l.from, l.to);
              return p ? <path key={`l${i}`} d={p} fill="none" stroke="#6366F1" strokeWidth={1.8} strokeDasharray="5 4" markerEnd="url(#mg-arrow-link)" opacity={0.85} /> : null;
            })}

            {/* Nodes */}
            {Object.values(layout.nodes).map(n => {
              const meta = LAYER_META[n.layer];
              const Icon = meta.icon;
              return (
                <g key={n.map.id}>
                  <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={12} fill="white" stroke={meta.node} strokeWidth={2} />
                  <rect x={n.x} y={n.y} width={5} height={NODE_H} rx={2.5} fill={meta.node} />
                  <text x={n.x + 16} y={n.y + 28} fontSize={13} fontWeight={700} fill="#1F2937">
                    {n.map.name.length > 22 ? n.map.name.slice(0, 21) + '…' : n.map.name}
                  </text>
                  <text x={n.x + 16} y={n.y + 48} fontSize={10.5} fill={meta.accent}>{meta.label}</text>
                  <text x={n.x + 16} y={n.y + 64} fontSize={10} fill="#9CA3AF">{n.map.processes.length} {n.map.processes.length === 1 ? 'proceso' : 'procesos'}</text>
                </g>
              );
            })}

            {/* Mejora continua loop label */}
            <text x={layout.totalWidth / 2} y={layout.totalHeight - 10} textAnchor="middle" fontSize={11} fill="#64748B" fontWeight={600}>↻ Mejora continua (PHVA)</text>
          </svg>
        </div>

        {/* Editor panel */}
        <div className="w-72 flex-shrink-0 border-l border-neutral-200 overflow-y-auto p-4 space-y-4 no-print">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Vínculos entre áreas</h4>
              <button onClick={suggestFromSipoc} title="Sugerir vínculos según entradas/salidas (SIPOC)" className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium">
                <Sparkles className="h-3 w-3" /> Sugerir
              </button>
            </div>
            <p className="text-[11px] text-neutral-400 mb-3">Las flechas punteadas muestran cómo la salida de un área alimenta a otra. Se guardan en este navegador.</p>

            <div className="space-y-2 mb-3">
              <select value={newFrom} onChange={e => setNewFrom(e.target.value)} className="w-full text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="">Origen…</option>
                {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={newTo} onChange={e => setNewTo(e.target.value)} className="w-full text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="">Destino…</option>
                {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={addLink} disabled={!newFrom || !newTo || newFrom === newTo} className="w-full flex items-center justify-center gap-1 text-xs bg-indigo-600 text-white rounded-lg py-1.5 hover:bg-indigo-700 disabled:opacity-40">
                <Plus className="h-3.5 w-3.5" /> Agregar vínculo
              </button>
            </div>

            <div className="space-y-1.5">
              {links.length === 0 && <p className="text-[11px] text-neutral-400 italic">Sin vínculos. Usá "Sugerir" o agregalos manualmente.</p>}
              {links.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-neutral-50 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] text-neutral-700 truncate">{mapName(l.from)} → {mapName(l.to)}</span>
                  <button onClick={() => removeLink(i)} className="p-0.5 rounded hover:bg-white"><Trash2 className="h-3 w-3 text-red-400" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100">
            <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-2">Áreas por capa</h4>
            {(['STRATEGIC', 'OPERATIONAL', 'SUPPORT'] as Layer[]).map(layer => (
              <div key={layer} className="mb-2">
                <span className="text-[11px] font-semibold" style={{ color: LAYER_META[layer].accent }}>{LAYER_META[layer].label} ({layout.byLayer[layer].length})</span>
                <p className="text-[11px] text-neutral-500">{layout.byLayer[layer].map(o => o.map.name).join(', ') || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
