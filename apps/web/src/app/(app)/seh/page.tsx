'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  HardHat, Plus, Trash2, X, Pencil, Building2, Search,
  ShieldAlert, ClipboardCheck, AlertTriangle, Users, Shirt,
  GraduationCap, Scale, ListChecks, Siren, FileCheck, TrendingUp, BrainCircuit, Loader2,
} from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────
type Client = { id: string; name: string; cuit?: string; activity?: string; province?: string; status?: string };
type Row = Record<string, any>;
type Field = {
  key: string; label: string; type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'employee';
  options?: { v: string; l: string }[]; required?: boolean; placeholder?: string;
};
type ModuleConf = {
  key: string; label: string; icon: any; path: string; listKey: string;
  columns: { key: string; label: string; render?: (r: Row) => any }[];
  fields: Field[];
};

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-AR') : '—';
const riskBadge = (n?: number) => {
  if (!n) return 'bg-gray-100 text-gray-500';
  if (n >= 15) return 'bg-red-100 text-red-700';
  if (n >= 8) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const SEV = [
  { v: 'LEVE', l: 'Leve' }, { v: 'MODERADO', l: 'Moderado' },
  { v: 'GRAVE', l: 'Grave' }, { v: 'CRITICO', l: 'Crítico' }, { v: 'FATAL', l: 'Fatal' },
];
const INSP_TYPES = [
  { v: 'GENERAL', l: 'General' }, { v: 'SPECIFIC', l: 'Específica' },
  { v: 'REACTIVE', l: 'Reactiva' }, { v: 'ROUTINE', l: 'Rutinaria' },
];
const MODALITY = [
  { v: 'PRESENCIAL', l: 'Presencial' }, { v: 'VIRTUAL', l: 'Virtual' },
  { v: 'MIXTA', l: 'Mixta' }, { v: 'E_LEARNING', l: 'E-learning' },
];
const FREQ = [
  { v: 'DAILY', l: 'Diaria' }, { v: 'WEEKLY', l: 'Semanal' }, { v: 'MONTHLY', l: 'Mensual' },
  { v: 'QUARTERLY', l: 'Trimestral' }, { v: 'YEARLY', l: 'Anual' },
];
const PRIO = [
  { v: 'LOW', l: 'Baja' }, { v: 'MEDIUM', l: 'Media' }, { v: 'HIGH', l: 'Alta' }, { v: 'CRITICAL', l: 'Crítica' },
];

const MODULES: ModuleConf[] = [
  {
    key: 'risks', label: 'Riesgos', icon: ShieldAlert, path: 'risks', listKey: 'risks',
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'title', label: 'Riesgo' },
      { key: 'activity', label: 'Actividad' },
      { key: 'riskLevel', label: 'Nivel', render: r => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskBadge(r.riskLevel)}`}>{r.riskLevel ?? '—'}</span> },
      { key: 'residualLevel', label: 'Residual', render: r => r.residualLevel ?? '—' },
    ],
    fields: [
      { key: 'code', label: 'Código', type: 'text', required: true, placeholder: 'R-001' },
      { key: 'title', label: 'Riesgo', type: 'text', required: true, placeholder: 'Caída a distinto nivel' },
      { key: 'activity', label: 'Actividad', type: 'text' },
      { key: 'task', label: 'Tarea', type: 'text' },
      { key: 'probability', label: 'Probabilidad (1-5)', type: 'number', required: true },
      { key: 'consequence', label: 'Consecuencia (1-5)', type: 'number', required: true },
      { key: 'controlMeasure', label: 'Medida de control', type: 'textarea' },
      { key: 'controlType', label: 'Tipo de control', type: 'select', options: [
        { v: 'ELIMINACION', l: 'Eliminación' }, { v: 'SUSTITUCION', l: 'Sustitución' },
        { v: 'INGENIERIA', l: 'Ingeniería' }, { v: 'ADMINISTRATIVO', l: 'Administrativo' }, { v: 'EPP', l: 'EPP' },
      ]},
      { key: 'residualProb', label: 'Prob. residual (1-5)', type: 'number' },
      { key: 'residualCons', label: 'Cons. residual (1-5)', type: 'number' },
      { key: 'description', label: 'Descripción', type: 'textarea' },
    ],
  },
  {
    key: 'incidents', label: 'Incidentes', icon: Siren, path: 'incidents', listKey: 'incidents',
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'title', label: 'Incidente' },
      { key: 'severity', label: 'Severidad' },
      { key: 'date', label: 'Fecha', render: r => fmtDate(r.date) },
      { key: 'injuredCount', label: 'Lesionados' },
      { key: 'daysLost', label: 'Días perd.' },
    ],
    fields: [
      { key: 'code', label: 'Código', type: 'text', required: true, placeholder: 'INC-001' },
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'severity', label: 'Severidad', type: 'select', options: SEV, required: true },
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'area', label: 'Área', type: 'text' },
      { key: 'injuredCount', label: 'Lesionados', type: 'number' },
      { key: 'daysLost', label: 'Días perdidos', type: 'number' },
      { key: 'description', label: 'Descripción', type: 'textarea' },
    ],
  },
  {
    key: 'inspections', label: 'Inspecciones', icon: ClipboardCheck, path: 'inspections', listKey: 'inspections',
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'title', label: 'Inspección' },
      { key: 'type', label: 'Tipo' },
      { key: 'inspector', label: 'Inspector' },
      { key: 'plannedDate', label: 'Fecha', render: r => fmtDate(r.plannedDate) },
      { key: 'status', label: 'Estado' },
    ],
    fields: [
      { key: 'code', label: 'Código', type: 'text', required: true, placeholder: 'INSP-001' },
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'select', options: INSP_TYPES, required: true },
      { key: 'inspector', label: 'Inspector', type: 'text' },
      { key: 'plannedDate', label: 'Fecha planificada', type: 'date' },
    ],
  },
  {
    key: 'employees', label: 'Empleados', icon: Users, path: 'employees', listKey: 'employees',
    columns: [
      { key: 'lastName', label: 'Apellido' },
      { key: 'firstName', label: 'Nombre' },
      { key: 'dni', label: 'DNI' },
      { key: 'position', label: 'Puesto' },
      { key: 'hireDate', label: 'Ingreso', render: r => fmtDate(r.hireDate) },
    ],
    fields: [
      { key: 'firstName', label: 'Nombre', type: 'text', required: true },
      { key: 'lastName', label: 'Apellido', type: 'text', required: true },
      { key: 'dni', label: 'DNI', type: 'text', required: true },
      { key: 'cuil', label: 'CUIL', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Teléfono', type: 'text' },
      { key: 'position', label: 'Puesto', type: 'text' },
      { key: 'hireDate', label: 'Fecha de ingreso', type: 'date' },
    ],
  },
  {
    key: 'epps', label: 'EPP', icon: Shirt, path: 'epps', listKey: 'epps',
    columns: [
      { key: 'name', label: 'EPP' },
      { key: 'type', label: 'Tipo' },
      { key: 'brand', label: 'Marca' },
      { key: 'size', label: 'Talle' },
      { key: 'expiryDate', label: 'Vence', render: r => fmtDate(r.expiryDate) },
    ],
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Casco' },
      { key: 'type', label: 'Tipo', type: 'text', required: true, placeholder: 'Cabeza' },
      { key: 'employeeId', label: 'Asignado a (empleado)', type: 'employee' },
      { key: 'brand', label: 'Marca', type: 'text' },
      { key: 'size', label: 'Talle', type: 'text' },
      { key: 'expiryDate', label: 'Vencimiento', type: 'date' },
    ],
  },
  {
    key: 'trainings', label: 'Capacitaciones', icon: GraduationCap, path: 'trainings', listKey: 'trainings',
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'title', label: 'Capacitación' },
      { key: 'category', label: 'Categoría' },
      { key: 'modality', label: 'Modalidad' },
      { key: 'scheduledDate', label: 'Fecha', render: r => fmtDate(r.scheduledDate) },
    ],
    fields: [
      { key: 'code', label: 'Código', type: 'text', required: true, placeholder: 'CAP-001' },
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'category', label: 'Categoría', type: 'text', required: true, placeholder: 'Altura, extintores...' },
      { key: 'modality', label: 'Modalidad', type: 'select', options: MODALITY, required: true },
      { key: 'instructor', label: 'Instructor', type: 'text' },
      { key: 'durationHours', label: 'Duración (horas)', type: 'number', required: true },
      { key: 'scheduledDate', label: 'Fecha', type: 'date' },
    ],
  },
  {
    key: 'legal', label: 'Matriz legal', icon: Scale, path: 'legal-requirements', listKey: 'legal-requirements',
    columns: [
      { key: 'normative', label: 'Norma' },
      { key: 'description', label: 'Requisito', render: r => <span className="line-clamp-2">{r.description}</span> },
      { key: 'jurisdiction', label: 'Jurisdicción' },
      { key: 'enforcingAuthority', label: 'Fiscaliza' },
      { key: 'status', label: 'Estado' },
    ],
    fields: [
      { key: 'normative', label: 'Norma / fuente', type: 'text', required: true, placeholder: 'Ley 19.587, DS 594...' },
      { key: 'description', label: 'Requisito', type: 'textarea', required: true },
      { key: 'jurisdiction', label: 'Jurisdicción', type: 'text', placeholder: 'Nacional, CABA...' },
      { key: 'article', label: 'Artículo', type: 'text' },
      { key: 'activity', label: 'Actividad', type: 'text' },
      { key: 'enforcingAuthority', label: 'Autoridad fiscalizadora', type: 'text', placeholder: 'SRT, DT, Seremi...' },
      { key: 'status', label: 'Estado', type: 'select', options: [
        { v: 'PENDING', l: 'Pendiente' }, { v: 'COMPLIANT', l: 'Cumple' },
        { v: 'PARTIAL', l: 'Parcial' }, { v: 'NON_COMPLIANT', l: 'No cumple' },
      ]},
    ],
  },
  {
    key: 'plans', label: 'Planes de acción', icon: ListChecks, path: 'action-plans', listKey: 'action-plans',
    columns: [
      { key: 'title', label: 'Plan' },
      { key: 'sourceType', label: 'Origen' },
      { key: 'responsible', label: 'Responsable' },
      { key: 'dueDate', label: 'Vence', render: r => fmtDate(r.dueDate) },
      { key: 'priority', label: 'Prioridad' },
      { key: 'status', label: 'Estado' },
    ],
    fields: [
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'sourceType', label: 'Origen', type: 'select', required: true, options: [
        { v: 'RISK', l: 'Riesgo' }, { v: 'INCIDENT', l: 'Incidente' },
        { v: 'INSPECTION', l: 'Inspección' }, { v: 'AUDIT', l: 'Auditoría' }, { v: 'OTHER', l: 'Otro' },
      ]},
      { key: 'responsible', label: 'Responsable', type: 'text' },
      { key: 'dueDate', label: 'Vencimiento', type: 'date' },
      { key: 'priority', label: 'Prioridad', type: 'select', options: PRIO },
      { key: 'containment', label: 'Contención', type: 'textarea' },
      { key: 'corrective', label: 'Acción correctiva', type: 'textarea' },
      { key: 'preventive', label: 'Acción preventiva', type: 'textarea' },
    ],
  },
  {
    key: 'drills', label: 'Simulacros', icon: AlertTriangle, path: 'drills', listKey: 'drills',
    columns: [
      { key: 'name', label: 'Simulacro' },
      { key: 'type', label: 'Tipo' },
      { key: 'status', label: 'Estado' },
    ],
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'text', required: true, placeholder: 'Evacuación, incendio...' },
      { key: 'status', label: 'Estado', type: 'select', options: [
        { v: 'PLANNED', l: 'Planificado' }, { v: 'DONE', l: 'Realizado' }, { v: 'CANCELLED', l: 'Cancelado' },
      ]},
      { key: 'description', label: 'Descripción', type: 'textarea' },
    ],
  },
  {
    key: 'permits', label: 'Permisos', icon: FileCheck, path: 'work-permits', listKey: 'work-permits',
    columns: [
      { key: 'title', label: 'Permiso' },
      { key: 'type', label: 'Tipo' },
      { key: 'status', label: 'Estado' },
      { key: 'startDate', label: 'Desde', render: r => fmtDate(r.startDate) },
      { key: 'endDate', label: 'Hasta', render: r => fmtDate(r.endDate) },
    ],
    fields: [
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'text', required: true, placeholder: 'Trabajo en altura, caliente...' },
      { key: 'status', label: 'Estado', type: 'select', options: [
        { v: 'PENDING', l: 'Pendiente' }, { v: 'APPROVED', l: 'Aprobado' },
        { v: 'REJECTED', l: 'Rechazado' }, { v: 'CLOSED', l: 'Cerrado' },
      ]},
      { key: 'startDate', label: 'Desde', type: 'date' },
      { key: 'endDate', label: 'Hasta', type: 'date' },
    ],
  },
  {
    key: 'indicators', label: 'Indicadores', icon: TrendingUp, path: 'indicators', listKey: 'indicators',
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Indicador' },
      { key: 'category', label: 'Categoría' },
      { key: 'unit', label: 'Unidad' },
      { key: 'targetValue', label: 'Meta' },
    ],
    fields: [
      { key: 'code', label: 'Código', type: 'text', required: true, placeholder: 'IF-001' },
      { key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Índice de frecuencia' },
      { key: 'category', label: 'Categoría', type: 'text', required: true, placeholder: 'Accidentalidad' },
      { key: 'unit', label: 'Unidad', type: 'text', required: true, placeholder: '%, casos, horas' },
      { key: 'frequency', label: 'Frecuencia', type: 'select', options: FREQ, required: true },
      { key: 'targetValue', label: 'Valor meta', type: 'number' },
      { key: 'minValue', label: 'Valor mínimo', type: 'number' },
      { key: 'maxValue', label: 'Valor máximo', type: 'number' },
    ],
  },
  {
    key: 'audits', label: 'Auditorías', icon: BrainCircuit, path: 'audits', listKey: 'audits',
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'title', label: 'Auditoría' },
      { key: 'type', label: 'Tipo' },
      { key: 'auditor', label: 'Auditor' },
      { key: 'plannedDate', label: 'Fecha', render: r => fmtDate(r.plannedDate) },
    ],
    fields: [
      { key: 'code', label: 'Código', type: 'text', required: true, placeholder: 'AUD-001' },
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'text', placeholder: 'Interna, externa, ART...' },
      { key: 'auditor', label: 'Auditor', type: 'text' },
      { key: 'plannedDate', label: 'Fecha planificada', type: 'date' },
      { key: 'description', label: 'Descripción', type: 'textarea' },
    ],
  },
];

// ── Página ───────────────────────────────────────────────────────────
export default function SehPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<string>('');
  const [tab, setTab] = useState('risks');
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [clientForm, setClientForm] = useState({ name: '', cuit: '', activity: '', province: '', responsible: '' });
  const [itemForm, setItemForm] = useState<Row>({});
  const [saving, setSaving] = useState(false);
  const [libMsg, setLibMsg] = useState('');

  const conf = MODULES.find(m => m.key === tab)!;

  const loadClients = useCallback(async () => {
    const r = await apiFetch<{ clients: Client[] }>('/seh360/clients');
    const list = r?.clients || [];
    setClients(list);
    setActiveClient(prev => prev || list[0]?.id || '');
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const q = activeClient ? `?clientId=${activeClient}` : '';
      const r = await apiFetch<Row>(`/seh360/${conf.path}${q}`);
      setRows((r as any)?.[conf.listKey] || []);
    } finally { setLoading(false); }
  }, [conf.path, conf.listKey, activeClient]);

  const loadEmployees = useCallback(async () => {
    const q = activeClient ? `?clientId=${activeClient}` : '';
    const r = await apiFetch<Row>(`/seh360/employees${q}`);
    setEmployees((r as any)?.employees || []);
  }, [activeClient]);

  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => { if (activeClient) { loadRows(); loadEmployees(); } }, [activeClient, tab, loadRows, loadEmployees]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const c = await apiFetch<Client>('/seh360/clients', { method: 'POST', json: clientForm });
      if (c?.id) { setClients(prev => [c, ...prev]); setActiveClient(c.id); }
      setShowClientModal(false); setClientForm({ name: '', cuit: '', activity: '', province: '', responsible: '' });
    } finally { setSaving(false); }
  }

  function openCreate() {
    setEditRow(null);
    const init: Row = {};
    conf.fields.forEach(f => { if (f.type === 'select' && f.options?.length) init[f.key] = f.options[0].v; });
    setItemForm(init); setShowItemModal(true);
  }
  function openEdit(r: Row) {
    setEditRow(r);
    const init: Row = {};
    conf.fields.forEach(f => {
      let v = r[f.key] ?? '';
      if (f.type === 'date' && v) v = String(v).split('T')[0];
      init[f.key] = v;
    });
    setItemForm(init); setShowItemModal(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const body: Row = { ...itemForm, clientId: activeClient };
      conf.fields.forEach(f => {
        if (f.type === 'number' && body[f.key] !== '' && body[f.key] !== undefined) body[f.key] = Number(body[f.key]);
        if (f.type === 'date' && body[f.key]) body[f.key] = new Date(body[f.key]).toISOString();
        if (body[f.key] === '' ) body[f.key] = f.type === 'select' ? body[f.key] : undefined;
      });
      if (editRow) {
        await apiFetch(`/seh360/${conf.path}/${editRow.id}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch(`/seh360/${conf.path}`, { method: 'POST', json: body });
      }
      setShowItemModal(false); setEditRow(null);
      await loadRows();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar el registro?')) return;
    await apiFetch(`/seh360/${conf.path}/${id}`, { method: 'DELETE' });
    await loadRows();
  }

  // Importar normas de la biblioteca compartida a la matriz del cliente activo
  async function importLibrary() {
    setLibMsg('Importando normas de la biblioteca…');
    try {
      const lib = await apiFetch<{ items: Row[] }>('/legal-requirements/library');
      const items = (lib?.items || []).filter((i: any) => !i.imported);
      if (!items.length) { setLibMsg('No hay normas nuevas en la biblioteca para tu país'); return; }
      let ok = 0;
      for (const i of items) {
        await apiFetch('/seh360/legal-requirements', { method: 'POST', json: {
          clientId: activeClient,
          normative: i.source, description: i.title + (i.description ? ` — ${i.description}` : ''),
          jurisdiction: i.jurisdiction || i.country, enforcingAuthority: i.enforcingAuthority,
          isLibrary: true, librarySource: 'LegalLibrary', status: 'PENDING',
        }}).then(() => ok++).catch(() => {});
      }
      setLibMsg(`Se importaron ${ok} norma(s) a la matriz legal`);
      await loadRows();
    } catch (e: any) { setLibMsg(e?.message || 'Error al importar'); }
  }

  const client = clients.find(c => c.id === activeClient);

  return (
    <div className="space-y-5">
      {/* Header + selector de empresa */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-orange-100 p-3 border border-orange-200"><HardHat className="h-6 w-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">SEH360 — Seguridad e Higiene</h1>
            <p className="mt-1 text-sm text-gray-500">Gestión de riesgos, inspecciones, incidentes y cumplimiento por empresa</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select value={activeClient} onChange={e => setActiveClient(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm min-w-[180px]">
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowClientModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100">
            <Building2 className="h-4 w-4" /> Nueva empresa
          </button>
        </div>
      </div>

      {/* Chips del cliente activo */}
      {client && (
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 flex-wrap">
          <span className="font-medium text-gray-900">{client.name}</span>
          {client.cuit && <span>CUIT {client.cuit}</span>}
          {client.activity && <span>{client.activity}</span>}
          {client.province && <span>{client.province}</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {MODULES.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.key} onClick={() => setTab(m.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${tab === m.key ? 'bg-orange-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Icon className="h-4 w-4" /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Barra de acciones del módulo */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <conf.icon className="h-5 w-5 text-orange-600" /> {conf.label}
          <span className="text-sm font-normal text-gray-400">({rows.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          {tab === 'legal' && (
            <button onClick={importLibrary}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
              <Search className="h-4 w-4" /> Importar de biblioteca
            </button>
          )}
          <button onClick={openCreate} disabled={!activeClient}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Nuevo
          </button>
        </div>
      </div>

      {libMsg && tab === 'legal' && <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg px-4 py-2">{libMsg}</p>}

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Cargando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                {conf.columns.map(c => <th key={c.key} className="px-4 py-3">{c.label}</th>)}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr><td colSpan={conf.columns.length + 1} className="px-4 py-10 text-center text-gray-400">
                  Sin registros{tab === 'legal' ? ' — usá "Importar de biblioteca" para traer las normas de tu país' : ''}.
                </td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  {conf.columns.map(c => (
                    <td key={c.key} className="px-4 py-3">
                      {c.render ? c.render(r) : (r[c.key] ?? '—')}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(r.id)} className="rounded p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva empresa */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={createClient} className="w-full max-w-md rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Nueva empresa gestionada</h3>
              <button type="button" onClick={() => setShowClientModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3 p-4">
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
                <input required className={inputCls} value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">CUIT / RUT</label>
                <input className={inputCls} value={clientForm.cuit} onChange={e => setClientForm({ ...clientForm, cuit: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Actividad</label>
                  <input className={inputCls} value={clientForm.activity} onChange={e => setClientForm({ ...clientForm, activity: e.target.value })} /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Provincia / Región</label>
                  <input className={inputCls} value={clientForm.province} onChange={e => setClientForm({ ...clientForm, province: e.target.value })} /></div>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Responsable SyH</label>
                <input className={inputCls} value={clientForm.responsible} onChange={e => setClientForm({ ...clientForm, responsible: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowClientModal(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Crear'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal crear/editar item */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveItem} className="w-full max-w-2xl rounded-xl bg-white max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">{editRow ? 'Editar' : 'Nuevo'} — {conf.label}</h3>
              <button type="button" onClick={() => setShowItemModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {conf.fields.map(f => {
                const wide = f.type === 'textarea';
                return (
                  <div key={f.key} className={wide ? 'col-span-2' : ''}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}{f.required && ' *'}</label>
                    {f.type === 'textarea' ? (
                      <textarea rows={2} className={inputCls} required={f.required} placeholder={f.placeholder}
                        value={itemForm[f.key] ?? ''} onChange={e => setItemForm({ ...itemForm, [f.key]: e.target.value })} />
                    ) : f.type === 'select' ? (
                      <select className={inputCls} required={f.required} value={itemForm[f.key] ?? ''} onChange={e => setItemForm({ ...itemForm, [f.key]: e.target.value })}>
                        {!f.required && <option value="">—</option>}
                        {f.options?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ) : f.type === 'employee' ? (
                      <select className={inputCls} value={itemForm[f.key] ?? ''} onChange={e => setItemForm({ ...itemForm, [f.key]: e.target.value || undefined })}>
                        <option value="">Sin asignar</option>
                        {employees.map((emp: Row) => <option key={emp.id} value={emp.id}>{emp.lastName} {emp.firstName}</option>)}
                      </select>
                    ) : (
                      <input type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                        className={inputCls} required={f.required} placeholder={f.placeholder}
                        value={itemForm[f.key] ?? ''} onChange={e => setItemForm({ ...itemForm, [f.key]: e.target.value })} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowItemModal(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
