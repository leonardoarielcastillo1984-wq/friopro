'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useCompany } from '@/lib/company-context';
import { ArrowLeft, Users, Search, Download, ZoomIn, ZoomOut, Maximize2, Building2, Layers, Tags, Hash } from 'lucide-react';
import Link from 'next/link';

interface OrgChartEmployee {
  id: string;
  firstName: string;
  lastName: string;
  position?: { name: string };
  department?: { name: string };
  supervisorId: string | null;
  subordinates: { id: string }[];
  email?: string;
  phone?: string;
  hireDate?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'VACANT';
  orgLevel?: number | null;
  children?: OrgChartEmployee[];
}

type ChartMode = 'dept' | 'hierarchy' | 'manual';

// ── Hierarchy colors (by tree depth) ──────────────────────────────────────
const HIERARCHY_PALETTE = [
  { bg: '#EFF6FF', border: '#1D4ED8', text: '#1E3A8A', avatar: '#1D4ED8', label: 'Dirección' },
  { bg: '#F0FDF4', border: '#16A34A', text: '#14532D', avatar: '#16A34A', label: 'Gerencia' },
  { bg: '#FFF7ED', border: '#EA580C', text: '#7C2D12', avatar: '#EA580C', label: 'Supervisión' },
  { bg: '#FAF5FF', border: '#9333EA', text: '#581C87', avatar: '#9333EA', label: 'Jefatura' },
  { bg: '#F1F5F9', border: '#64748B', text: '#1E293B', avatar: '#64748B', label: 'Staff' },
];

function getHierarchyLevelFromPosition(positionName: string = ''): number {
  const p = positionName.toLowerCase();
  // Level 0 — Dirección
  if (
    p.includes('director') || p.includes('directora') ||
    p.includes('presidente') || p.includes('ceo') ||
    p.includes('vicepresidente') || p.includes('socio') ||
    p.includes('propietario') || p.includes('titular')
  ) return 0;
  // Level 1 — Gerencia
  if (
    p.includes('gerente') || p.includes('gerencia') ||
    p.includes('responsable') || p.includes('coordinador') ||
    p.includes('coordinadora') || p.includes('jefe') ||
    p.includes('jefa') || p.includes('encargado') ||
    p.includes('encargada') || p.includes('manager')
  ) return 1;
  // Level 2 — Supervisión
  if (
    p.includes('supervisor') || p.includes('supervisora') ||
    p.includes('lider') || p.includes('líder') ||
    p.includes('team lead') || p.includes('referente')
  ) return 2;
  // Level 3 — Jefatura / Técnico senior
  if (
    p.includes('senior') || p.includes('analista') ||
    p.includes('especialista') || p.includes('técnico') ||
    p.includes('tecnico') || p.includes('asistente de gerencia') ||
    p.includes('administrativo') || p.includes('administrativo senior')
  ) return 3;
  // Level 4 — Staff
  return 4;
}

function getHierarchyColor(positionName?: string, depth?: number) {
  const level = positionName ? getHierarchyLevelFromPosition(positionName) : Math.min(depth ?? 4, 4);
  return HIERARCHY_PALETTE[level];
}

// ── Department colors (by area) ────────────────────────────────────────────
const DEPT_COLORS: Record<string, { bg: string; border: string; text: string; avatar: string }> = {};
const COLOR_PALETTE = [
  { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', avatar: '#3B82F6' },
  { bg: '#F0FDF4', border: '#22C55E', text: '#166534', avatar: '#22C55E' },
  { bg: '#FFF7ED', border: '#F97316', text: '#9A3412', avatar: '#F97316' },
  { bg: '#FAF5FF', border: '#A855F7', text: '#6B21A8', avatar: '#A855F7' },
  { bg: '#FFF1F2', border: '#F43F5E', text: '#9F1239', avatar: '#F43F5E' },
  { bg: '#F0F9FF', border: '#0EA5E9', text: '#0C4A6E', avatar: '#0EA5E9' },
  { bg: '#FEFCE8', border: '#EAB308', text: '#713F12', avatar: '#EAB308' },
  { bg: '#FDF4FF', border: '#D946EF', text: '#701A75', avatar: '#D946EF' },
  { bg: '#F0FDFA', border: '#14B8A6', text: '#134E4A', avatar: '#14B8A6' },
  { bg: '#FFF5F5', border: '#EF4444', text: '#991B1B', avatar: '#EF4444' },
];

function getDeptColor(deptName: string) {
  if (!DEPT_COLORS[deptName]) {
    const idx = Object.keys(DEPT_COLORS).length % COLOR_PALETTE.length;
    DEPT_COLORS[deptName] = COLOR_PALETTE[idx];
  }
  return DEPT_COLORS[deptName];
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function flattenTree(nodes: OrgChartEmployee[]): OrgChartEmployee[] {
  const result: OrgChartEmployee[] = [];
  const traverse = (arr: OrgChartEmployee[]) => {
    arr.forEach(n => {
      result.push(n);
      if (n.children) traverse(n.children);
    });
  };
  traverse(nodes);
  return result;
}

// Card dimensions
const CARD_W = 180;
const CARD_H = 92;
const H_GAP = 40;    // horizontal gap between siblings
const V_GAP = 80;    // vertical gap between levels (tree mode)
const V_GAP_H = 140; // vertical gap in hierarchy mode (levels further apart)

interface LayoutNode {
  emp: OrgChartEmployee;
  x: number;
  y: number;
  width: number;
  depth: number;
}

function computeRow(node: OrgChartEmployee, depth: number, mode: ChartMode): number {
  if (mode === 'hierarchy') return getHierarchyLevelFromPosition(node.position?.name);
  if (mode === 'manual') {
    // Manual line number is 1-based; fall back to auto-hierarchy level when not set.
    return node.orgLevel != null ? Math.max(0, node.orgLevel - 1) : getHierarchyLevelFromPosition(node.position?.name);
  }
  return depth;
}

function layoutTree(
  node: OrgChartEmployee,
  depth: number,
  expanded: Set<string>,
  mode: ChartMode = 'dept'
): { nodes: LayoutNode[]; width: number } {
  const posLevel = computeRow(node, depth, mode);
  const rowH = mode === 'dept' ? (CARD_H + V_GAP) : (CARD_H + V_GAP_H);
  const hasChildren = node.children && node.children.length > 0 && expanded.has(node.id);

  if (!hasChildren) {
    return {
      nodes: [{ emp: node, x: 0, y: posLevel * rowH, width: CARD_W, depth: posLevel }],
      width: CARD_W,
    };
  }

  const childLayouts = node.children!.map(child => layoutTree(child, depth + 1, expanded, mode));
  const totalChildrenWidth = childLayouts.reduce((sum, l) => sum + l.width, 0) + H_GAP * (childLayouts.length - 1);
  const myWidth = Math.max(CARD_W, totalChildrenWidth);

  let xCursor = (myWidth - totalChildrenWidth) / 2;
  const allNodes: LayoutNode[] = [];

  childLayouts.forEach(cl => {
    cl.nodes.forEach(n => allNodes.push({ ...n, x: n.x + xCursor }));
    xCursor += cl.width + H_GAP;
  });

  const parentX = (myWidth - CARD_W) / 2;
  allNodes.push({ emp: node, x: parentX, y: posLevel * rowH, width: CARD_W, depth: posLevel });

  return { nodes: allNodes, width: myWidth };
}

function OrgNode({
  node,
  onToggle,
  expanded,
  highlighted,
  colorMode,
}: {
  node: LayoutNode;
  onToggle: (id: string) => void;
  expanded: Set<string>;
  highlighted: string | null;
  colorMode: ChartMode;
}) {
  const [tooltip, setTooltip] = useState(false);
  const emp = node.emp;
  const hasChildren = emp.children && emp.children.length > 0;
  const isExpanded = expanded.has(emp.id);
  const dept = emp.department?.name || '';
  const colors = colorMode === 'hierarchy' ? getHierarchyColor(emp.position?.name) : getDeptColor(dept || 'default');
  const isHighlighted = highlighted === emp.id;

  return (
    <g transform={`translate(${node.x},${node.y})`}>
      {/* Card background */}
      <rect
        x={0} y={0}
        width={CARD_W} height={CARD_H}
        rx={10} ry={10}
        fill={isHighlighted ? '#DBEAFE' : 'white'}
        stroke={isHighlighted ? '#3B82F6' : colors.border}
        strokeWidth={isHighlighted ? 2.5 : 1.5}
        filter="url(#shadow)"
        style={{ cursor: 'default' }}
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
      />

      {/* Left color bar */}
      <rect x={0} y={0} width={5} height={CARD_H} rx={4} ry={0} fill={colors.avatar} />
      <rect x={0} y={0} width={5} height={CARD_H} fill={colors.avatar} />
      {/* round only left corners */}
      <rect x={0} y={0} width={5} height={10} fill={colors.avatar} />
      <rect x={0} y={CARD_H - 10} width={5} height={10} fill={colors.avatar} />

      {/* Avatar circle */}
      <circle cx={32} cy={CARD_H / 2} r={20} fill={colors.bg} stroke={colors.border} strokeWidth={1.5} />
      <text
        x={32} y={CARD_H / 2}
        textAnchor="middle" dominantBaseline="central"
        fontSize={12} fontWeight="700" fill={colors.text}
      >
        {getInitials(emp.firstName, emp.lastName)}
      </text>

      {/* Name — 2 lines: Apellido / Nombre */}
      <text x={60} y={14} fontSize={10.5} fontWeight="700" fill="#111827" style={{ pointerEvents: 'none' }}>
        {emp.lastName.length > 17 ? emp.lastName.substring(0, 16) + '…' : emp.lastName}
      </text>
      <text x={60} y={27} fontSize={10} fontWeight="500" fill="#374151" style={{ pointerEvents: 'none' }}>
        {emp.firstName.length > 17 ? emp.firstName.substring(0, 16) + '…' : emp.firstName}
      </text>

      {/* Position — clickable link */}
      <text
        x={60} y={44}
        fontSize={9} fill="#2563EB"
        textDecoration="underline"
        style={{ cursor: 'pointer' }}
        onClick={() => window.open(`/rrhh/perfiles?search=${encodeURIComponent(emp.position?.name || '')}`, '_blank')}
      >
        {(emp.position?.name || 'Sin puesto').length > 23
          ? (emp.position?.name || 'Sin puesto').substring(0, 22) + '…'
          : emp.position?.name || 'Sin puesto'}
      </text>

      {/* Department badge */}
      <rect x={60} y={52} width={Math.min(dept.length * 5.2 + 10, 110)} height={13} rx={6} fill={colors.bg} />
      <text x={65} y={62} fontSize={8.5} fill={colors.text} fontWeight="500">
        {dept.length > 17 ? dept.substring(0, 16) + '…' : dept}
      </text>

      {/* Subordinates count */}
      {(emp.subordinates?.length || 0) > 0 && (
        <>
          <circle cx={CARD_W - 16} cy={14} r={10} fill={colors.avatar} />
          <text x={CARD_W - 16} y={14} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight="700" fill="white">
            {emp.subordinates.length}
          </text>
        </>
      )}

      {/* Manual org line number badge (supports decimals e.g. 2.5) */}
      {emp.orgLevel != null && (
        <g>
          <circle cx={16} cy={13} r={11} fill="#111827" stroke="white" strokeWidth={1.5} />
          <text x={16} y={13} textAnchor="middle" dominantBaseline="central" fontSize={String(emp.orgLevel).length >= 3 ? 7.5 : 9} fontWeight="700" fill="white">
            {emp.orgLevel}
          </text>
        </g>
      )}

      {/* Expand/collapse button */}
      {hasChildren && (
        <g
          transform={`translate(${CARD_W / 2 - 10}, ${CARD_H - 4})`}
          onClick={() => onToggle(emp.id)}
          style={{ cursor: 'pointer' }}
        >
          <circle cx={10} cy={10} r={10} fill={colors.avatar} />
          <text x={10} y={10} textAnchor="middle" dominantBaseline="central" fontSize={14} fill="white" fontWeight="bold">
            {isExpanded ? '−' : '+'}
          </text>
        </g>
      )}

      {/* Tooltip */}
      {tooltip && (
        <g transform={`translate(${CARD_W + 8}, 0)`}>
          <rect x={0} y={0} width={200} height={110} rx={8} fill="white" stroke="#E5E7EB" strokeWidth={1} filter="url(#shadow)" />
          <text x={12} y={22} fontSize={11} fontWeight="700" fill="#111827">{emp.lastName} {emp.firstName}</text>
          <text x={12} y={38} fontSize={9.5} fill="#6B7280">{emp.position?.name || 'Sin puesto'}</text>
          <line x1={12} y1={45} x2={188} y2={45} stroke="#F3F4F6" strokeWidth={1} />
          <text x={12} y={60} fontSize={9} fill="#6B7280">📧 {(emp.email || 'Sin email').substring(0, 26)}</text>
          <text x={12} y={75} fontSize={9} fill="#6B7280">📞 {emp.phone || 'Sin teléfono'}</text>
          <text x={12} y={90} fontSize={9} fill="#6B7280">🏢 {(dept || 'Sin área').substring(0, 26)}</text>
          <text x={12} y={105} fontSize={9} fill="#6B7280">👥 {emp.subordinates?.length || 0} reportes directos</text>
        </g>
      )}
    </g>
  );
}

export default function OrgChartPage() {
  const { settings: companySettings } = useCompany();
  const [orgChart, setOrgChart] = useState<OrgChartEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [zoom, setZoom] = useState(1);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ChartMode>('dept');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadOrgChart(); }, []);

  const loadOrgChart = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ orgChart: OrgChartEmployee[] }>('/hr/org-chart');
      const chart = res.orgChart || [];
      setOrgChart(chart);
      // Expand first 2 levels by default
      const ids = new Set<string>();
      const collect = (nodes: OrgChartEmployee[], depth: number) => {
        nodes.forEach(n => {
          if (depth < 2) { ids.add(n.id); if (n.children) collect(n.children, depth + 1); }
        });
      };
      collect(chart, 0);
      setExpanded(ids);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar organigrama');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  const allFlat = useMemo(() => flattenTree(orgChart), [orgChart]);

  const departments = useMemo(() => {
    const d = new Set(allFlat.map(e => e.department?.name).filter(Boolean));
    return ['ALL', ...Array.from(d)] as string[];
  }, [allFlat]);

  // Filter: rebuild tree with only matching employees visible as roots/subtrees
  const filteredRoots = useMemo(() => {
    if (searchTerm === '' && selectedDepartment === 'ALL') return orgChart;
    const term = searchTerm.toLowerCase();
    const matches = (emp: OrgChartEmployee): boolean => {
      const nameMatch = `${emp.firstName} ${emp.lastName} ${emp.position?.name || ''}`.toLowerCase().includes(term);
      const deptMatch = selectedDepartment === 'ALL' || emp.department?.name === selectedDepartment;
      return nameMatch && deptMatch;
    };
    // Collect IDs of matching nodes
    const matchIds = new Set(allFlat.filter(matches).map(e => e.id));
    if (matchIds.size > 0) setHighlighted(matchIds.size === 1 ? [...matchIds][0] : null);
    return orgChart;
  }, [orgChart, allFlat, searchTerm, selectedDepartment]);

  const highlightedId = useMemo(() => {
    if (!searchTerm && selectedDepartment === 'ALL') return null;
    const term = searchTerm.toLowerCase();
    const matches = allFlat.filter(e => {
      const nameMatch = `${e.firstName} ${e.lastName} ${e.position?.name || ''}`.toLowerCase().includes(term);
      const deptMatch = selectedDepartment === 'ALL' || e.department?.name === selectedDepartment;
      return nameMatch && deptMatch;
    });
    return matches.length === 1 ? matches[0].id : null;
  }, [allFlat, searchTerm, selectedDepartment]);

  // Layout: tree always — hierarchy mode uses position-level for Y row
  const { allNodes, svgWidth, svgHeight, connections, bandLabels } = useMemo(() => {
    const connections: { x1: number; y1: number; x2: number; y2: number; midY: number }[] = [];
    const bandLabels: { label: string; y: number; color: string }[] = [];
    const rowsByLevel = colorMode !== 'dept';
    const rowH = rowsByLevel ? (CARD_H + V_GAP_H) : (CARD_H + V_GAP);

    // ── Build tree layout ─────────────────────────────────────────────────────
    const allNodes: LayoutNode[] = [];
    let xOffset = 0;
    const TREE_GAP = 60;

    filteredRoots.forEach(root => {
      const layout = layoutTree(root, 0, expanded, colorMode);
      layout.nodes.forEach(n => allNodes.push({ ...n, x: n.x + xOffset }));
      xOffset += layout.width + TREE_GAP;
    });

    // Build connections — mid-point is halfway between actual Y positions
    allNodes.forEach(n => {
      if (!n.emp.children || !expanded.has(n.emp.id)) return;
      n.emp.children.forEach(child => {
        const childNode = allNodes.find(c => c.emp.id === child.id);
        if (!childNode) return;
        const px = n.x + CARD_W / 2;
        const py = n.y + CARD_H;
        const cx = childNode.x + CARD_W / 2;
        const cy = childNode.y;
        const midY = (py + cy) / 2; // true midpoint so lines follow actual Y gap
        connections.push({ x1: px, y1: py, x2: cx, y2: cy, midY });
      });
    });

    // ── Row labels for hierarchy mode ─────────────────────────────────────────
    if (colorMode === 'hierarchy') {
      HIERARCHY_PALETTE.forEach((p, i) => {
        const rowY = i * rowH;
        // Only add label if there's at least one node on this row
        if (allNodes.some(n => n.depth === i)) {
          bandLabels.push({ label: p.label, y: rowY, color: p.avatar });
        }
      });
    } else if (colorMode === 'manual') {
      // ── Numeric line labels for manual mode (1-based) ──
      const maxDepth = allNodes.reduce((m, n) => Math.max(m, n.depth), 0);
      for (let i = 0; i <= maxDepth; i++) {
        if (allNodes.some(n => n.depth === i)) {
          bandLabels.push({ label: `Línea ${i + 1}`, y: i * rowH, color: '#111827' });
        }
      }
    }

    const maxX = allNodes.reduce((m, n) => Math.max(m, n.x + CARD_W), 0);
    const maxY = allNodes.reduce((m, n) => Math.max(m, n.y + CARD_H), 0);
    return { allNodes, svgWidth: maxX + 60, svgHeight: maxY + 80, connections, bandLabels };
  }, [filteredRoots, expanded, colorMode]);

  const exportToPDF = () => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svgEl) return;
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const isoYear = today.getFullYear();
    const isoMonth = String(today.getMonth() + 1).padStart(2, '0');
    const docCode = `RRHH-ORG-001`;
    const revision = `Rev. ${isoYear}.${isoMonth}`;
    const companyName = companySettings?.companyName || 'Organización';
    const logoUrl = companySettings?.logoUrl || '';
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="max-height:56px;max-width:120px;object-fit:contain;" alt="Logo" />`
      : `<div style="width:56px;height:56px;background:#1D4ED8;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;">${companyName.charAt(0)}</div>`;
    const vb = svgEl.getAttribute('viewBox') || `0 0 ${svgWidth} ${svgHeight}`;
    const innerSVG = svgEl.innerHTML;
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Organigrama \u2014 ${companyName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: white; color: #111827; padding: 12px; }
    @page { size: A3 landscape; margin: 12mm; }
    @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    .iso-header { display: flex; align-items: stretch; border: 2px solid #1D4ED8; border-radius: 4px; margin-bottom: 14px; overflow: hidden; }
    .iso-logo { padding: 10px 16px; display: flex; align-items: center; justify-content: center; background: #F8FAFF; border-right: 1px solid #CBD5E1; min-width: 140px; }
    .iso-title { flex: 1; padding: 8px 16px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #CBD5E1; }
    .iso-title h1 { font-size: 15px; font-weight: 700; color: #1D4ED8; text-transform: uppercase; letter-spacing: 0.5px; }
    .iso-title p { font-size: 11px; color: #6B7280; margin-top: 3px; }
    .iso-meta { display: flex; flex-direction: column; justify-content: center; min-width: 190px; }
    .iso-meta-row { display: flex; align-items: center; padding: 4px 12px; border-bottom: 1px solid #E5E7EB; font-size: 10px; }
    .iso-meta-row:last-child { border-bottom: none; }
    .iso-meta-label { color: #6B7280; width: 90px; flex-shrink: 0; }
    .iso-meta-value { font-weight: 600; color: #111827; }
    .chart-container { overflow: visible; }
    .iso-footer { margin-top: 10px; border-top: 1px solid #E5E7EB; padding-top: 7px; display: flex; justify-content: space-between; font-size: 8.5px; color: #9CA3AF; }
    .print-btn { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 10px 0; padding: 8px 20px; background: #1D4ED8; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .print-btn:hover { background: #1e40af; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">\uD83D\uDDA8\uFE0F Imprimir / Guardar como PDF</button>
  <div class="iso-header">
    <div class="iso-logo">${logoHtml}</div>
    <div class="iso-title">
      <h1>Organigrama Institucional</h1>
      <p>${companyName}</p>
    </div>
    <div class="iso-meta">
      <div class="iso-meta-row"><span class="iso-meta-label">C\u00f3digo:</span><span class="iso-meta-value">${docCode}</span></div>
      <div class="iso-meta-row"><span class="iso-meta-label">Revisi\u00f3n:</span><span class="iso-meta-value">${revision}</span></div>
      <div class="iso-meta-row"><span class="iso-meta-label">Fecha:</span><span class="iso-meta-value">${dateStr}</span></div>
      <div class="iso-meta-row"><span class="iso-meta-label">Norma:</span><span class="iso-meta-value">ISO 9001:2015</span></div>
      <div class="iso-meta-row"><span class="iso-meta-label">Secci\u00f3n:</span><span class="iso-meta-value">7.3 \u2014 RRHH</span></div>
      <div class="iso-meta-row"><span class="iso-meta-label">Aprobado por:</span><span class="iso-meta-value">Direcci\u00f3n</span></div>
    </div>
  </div>
  <div class="chart-container">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" style="max-width:100%;height:auto;display:block;">${innerSVG}</svg>
  </div>
  <div class="iso-footer">
    <span>Documento controlado \u2014 No v\u00e1lido si es impresi\u00f3n no autorizada</span>
    <span>${companyName} \u00b7 Sistema de Gesti\u00f3n Integrado \u00b7 ${docCode} \u00b7 ${revision}</span>
    <span>Emitido el ${dateStr}</span>
  </div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando organigrama...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-500 text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Error al cargar organigrama</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={loadOrgChart} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Reintentar</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 no-print">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/rrhh" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Organigrama</h1>
                <p className="text-xs text-gray-500">{allFlat.length} colaboradores · {departments.length - 1} áreas</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar persona o puesto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
                />
              </div>

              {/* Department */}
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {departments.map(d => (
                  <option key={d} value={d}>{d === 'ALL' ? 'Todos los departamentos' : d}</option>
                ))}
              </select>

              {/* Zoom */}
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
                <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1.5 hover:bg-gray-100 transition-colors">
                  <ZoomOut className="h-4 w-4 text-gray-600" />
                </button>
                <span className="px-2 text-xs font-medium text-gray-700 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 hover:bg-gray-100 transition-colors">
                  <ZoomIn className="h-4 w-4 text-gray-600" />
                </button>
              </div>

              <button onClick={() => setZoom(1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Restablecer zoom">
                <Maximize2 className="h-4 w-4 text-gray-600" />
              </button>

              {/* View mode selector */}
              <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
                <button
                  onClick={() => setColorMode('dept')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-all ${colorMode === 'dept' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  title="Agrupar por departamento"
                >
                  <Tags className="h-3.5 w-3.5" /> Departamento
                </button>
                <button
                  onClick={() => setColorMode('hierarchy')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 border-l border-gray-300 transition-all ${colorMode === 'hierarchy' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  title="Ordenar por jerarquía automática (según el puesto)"
                >
                  <Layers className="h-3.5 w-3.5" /> Jerarquía
                </button>
                <button
                  onClick={() => setColorMode('manual')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 border-l border-gray-300 transition-all ${colorMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  title="Ordenar por la línea manual asignada a cada persona"
                >
                  <Hash className="h-3.5 w-3.5" /> Línea manual
                </button>
              </div>

              <button onClick={exportToPDF} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Imprimir / Exportar PDF">
                <Download className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Legend bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-4 flex-wrap flex-shrink-0 no-print">
        {colorMode === 'dept' ? (
          <>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Áreas:</span>
            {departments.filter(d => d !== 'ALL').map(d => {
              const c = getDeptColor(d);
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDepartment(selectedDepartment === d ? 'ALL' : d)}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all"
                  style={{
                    backgroundColor: selectedDepartment === d ? c.avatar : c.bg,
                    borderColor: c.border,
                    color: selectedDepartment === d ? 'white' : c.text,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedDepartment === d ? 'white' : c.avatar }} />
                  {d}
                </button>
              );
            })}
          </>
        ) : colorMode === 'hierarchy' ? (
          <>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Niveles:</span>
            {HIERARCHY_PALETTE.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border" style={{ backgroundColor: h.bg, borderColor: h.border, color: h.text }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: h.avatar }} />
                {h.label}
              </div>
            ))}
          </>
        ) : (
          <>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Línea manual:</span>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] font-bold">N</span>
              La fila la define el número asignado a cada persona en <strong className="mx-1">RRHH → Empleados</strong>. Admite intermedios (2.5 = entre la 2 y la 3). Sin número = nivel automático.
            </div>
          </>
        )}
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div style={{ minWidth: svgWidth * zoom + 80, minHeight: svgHeight * zoom + 80, padding: 40 }}>
          <svg
            width={svgWidth * zoom}
            height={svgHeight * zoom}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ display: 'block', transformOrigin: 'top left' }}
          >
            <defs>
              <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000015" />
              </filter>
            </defs>

            {/* Row labels for each hierarchy level */}
            {bandLabels.map((band, i) => (
              <g key={i}>
                <line x1={0} y1={band.y - 10} x2={svgWidth} y2={band.y - 10} stroke={band.color} strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />
                <rect x={0} y={band.y - 26} width={100} height={18} rx={4} fill={band.color} opacity={0.12} />
                <text x={8} y={band.y - 12} fontSize={10} fontWeight="700" fill={band.color} letterSpacing="0.5">
                  {band.label.toUpperCase()}
                </text>
              </g>
            ))}

            {/* Connector lines */}
            {connections.map((c, i) => (
              <path
                key={i}
                d={`M${c.x1},${c.y1} L${c.x1},${c.midY} L${c.x2},${c.midY} L${c.x2},${c.y2}`}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth={1.5}
                strokeDasharray="none"
              />
            ))}

            {/* Nodes */}
            {allNodes.map(n => (
              <OrgNode
                key={n.emp.id}
                node={n}
                onToggle={toggleExpand}
                expanded={expanded}
                highlighted={highlightedId}
                colorMode={colorMode}
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Footer stats */}
      <div className="bg-white border-t border-gray-200 px-6 py-2 flex items-center gap-6 flex-shrink-0 no-print text-xs text-gray-500">
        <span>👥 <strong className="text-gray-700">{allFlat.length}</strong> empleados</span>
        <span>🏢 <strong className="text-gray-700">{departments.length - 1}</strong> departamentos</span>
        <span>👔 <strong className="text-gray-700">{allFlat.filter(e => (e.subordinates?.length || 0) > 0).length}</strong> jefes directos</span>
        <span className="ml-auto text-gray-400">Clic en <strong>+/−</strong> para expandir · Hover para detalles</span>
      </div>
    </div>
  );
}
