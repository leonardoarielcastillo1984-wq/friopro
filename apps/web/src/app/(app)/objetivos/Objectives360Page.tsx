'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  Plus,
  Search,
  Filter,
  X,
  Pencil,
  Trash2,
  Eye,
  BarChart3,
  Activity,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Calendar,
  FileText,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  ArrowRight,
} from 'lucide-react';

/* ─── Types ─── */
interface Objective {
  id: string;
  code: string;
  title: string;
  description?: string;
  year: number;
  standard?: string;
  target: string;
  targetValue?: number;
  unit?: string;
  type?: string;
  scope?: string;
  sites?: string[];
  responsibleId?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  progress: number;
  indicatorId?: string;
  notes?: string;
  policyId?: string;
  processId?: string;
  priority?: string;
  kpiName?: string;
  kpiTarget?: number;
  kpiUnit?: string;
  owner?: string;
  responsible?: string;
  sede?: string;
  tags?: string;
  policy?: { id: string; name: string } | null;
  process?: { id: string; name: string } | null;
  activities?: ObjectiveActivity[];
  indicators?: ObjectiveIndicator[];
  audits?: ObjectiveAudit[];
  capas?: ObjectiveCAPA[];
  risks?: ObjectiveRisk[];
  createdAt: string;
  updatedAt: string;
}

interface ObjectiveActivity {
  id: string;
  name: string;
  responsibleId?: string;
  startDate?: string;
  endDate?: string;
  status: string;
}

interface ObjectiveIndicator {
  id: string;
  indicatorId: string;
  indicator?: { id: string; name: string };
}

interface ObjectiveAudit {
  id: string;
  auditId: string;
  audit?: { id: string; title: string };
}

interface ObjectiveCAPA {
  id: string;
  capaId: string;
  capa?: { id: string; title: string };
}

interface ObjectiveRisk {
  id: string;
  riskId: string;
  risk?: { id: string; description: string };
}

interface Policy {
  id: string;
  name: string;
  scope?: string;
  active: boolean;
}

interface DashboardStats {
  total: number;
  inProgress: number;
  achieved: number;
  planned: number;
  notAchieved: number;
  cancelled: number;
  atRisk: number;
  delayed: number;
  averageProgress: number;
}

interface FilterState {
  search: string;
  year: string;
  status: string;
  policyId: string;
  processId: string;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planificado',
  IN_PROGRESS: 'En progreso',
  ACHIEVED: 'Logrado',
  NOT_ACHIEVED: 'No logrado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-800 border-slate-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
  ACHIEVED: 'bg-green-100 text-green-800 border-green-300',
  NOT_ACHIEVED: 'bg-red-100 text-red-800 border-red-300',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
};

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
};

/* ─── Component ─── */
export default function Objectives360Page() {
  const currentYear = new Date().getFullYear();

  /* State */
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    year: String(currentYear),
    status: '',
    policyId: '',
    processId: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [detailObjective, setDetailObjective] = useState<Objective | null>(null);
  const [formData, setFormData] = useState<Partial<Objective>>({
    year: currentYear,
    status: 'PLANNED',
    progress: 0,
    sites: [],
  });
  const [activeTab, setActiveTab] = useState('info');

  /* Load data */
  const loadObjectives = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set('year', filters.year);
      if (filters.status) params.set('status', filters.status);
      if (filters.policyId) params.set('policyId', filters.policyId);
      if (filters.processId) params.set('processId', filters.processId);
      if (filters.search) params.set('search', filters.search);
      const res = await apiFetch(`/objectives?${params.toString()}`) as { items?: Objective[] };
      setObjectives(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadPolicies = useCallback(async () => {
    try {
      const res = (await apiFetch('/objectives/policies')) as Policy[];
      setPolicies(Array.isArray(res) ? res : []);
    } catch {
      setPolicies([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch(`/objectives/stats/summary?year=${filters.year}`) as DashboardStats;
      setStats(res);
    } catch (e) {
      console.error(e);
    }
  }, [filters.year]);

  useEffect(() => {
    loadObjectives();
    loadPolicies();
    loadStats();
  }, [loadObjectives, loadPolicies, loadStats]);

  /* Actions */
  const handleCreate = () => {
    setEditingObjective(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      year: currentYear,
      standard: 'ISO 9001',
      target: '',
      targetValue: undefined,
      unit: '',
      type: 'STRATEGIC',
      sites: [],
      startDate: '',
      endDate: '',
      status: 'PLANNED',
      progress: 0,
      notes: '',
      policyId: '',
      processId: '',
    });
    setShowForm(true);
  };

  const handleEdit = (obj: Objective) => {
    setEditingObjective(obj);
    setFormData({
      ...obj,
      startDate: obj.startDate ? obj.startDate.split('T')[0] : '',
      endDate: obj.endDate ? obj.endDate.split('T')[0] : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const payload: any = { ...formData, sites: formData.sites || [] };
      // Strip relation objects and auto-managed fields
      delete payload.id;
      delete payload.policy;
      delete payload.process;
      delete payload.activities;
      delete payload.indicators;
      delete payload.audits;
      delete payload.capas;
      delete payload.risks;
      delete payload.createdAt;
      delete payload.updatedAt;
      // Normalize empty strings to undefined for optional nullable fields
      const normalize = (val: any) => (val === '' || val === null ? undefined : val);
      payload.description = normalize(payload.description);
      payload.standard = normalize(payload.standard);
      payload.unit = normalize(payload.unit);
      payload.type = normalize(payload.type);
      payload.status = normalize(payload.status);
      payload.notes = normalize(payload.notes);
      payload.startDate = normalize(payload.startDate);
      payload.endDate = normalize(payload.endDate);
      payload.responsibleId = normalize(payload.responsibleId);
      payload.indicatorId = normalize(payload.indicatorId);
      payload.policyId = normalize(payload.policyId);
      payload.processId = normalize(payload.processId);
      if (editingObjective) {
        await apiFetch(`/objectives/${editingObjective.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/objectives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      loadObjectives();
      loadStats();
    } catch (e: any) {
      console.error(e);
      alert('Error al guardar objetivo: ' + (e?.message || ''));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este objetivo?')) return;
    try {
      await apiFetch(`/objectives/${id}`, { method: 'DELETE' });
      loadObjectives();
      loadStats();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDetail = async (obj: Objective) => {
    try {
      const res = await apiFetch(`/objectives/${obj.id}`) as { item: Objective };
      setDetailObjective(res.item);
      setActiveTab('info');
    } catch (e) {
      console.error(e);
    }
  };

  const filteredObjectives = useMemo(() => {
    return objectives.filter((o) => {
      const matchSearch = !filters.search ||
        o.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        o.code.toLowerCase().includes(filters.search.toLowerCase());
      return matchSearch;
    });
  }, [objectives, filters.search]);

  /* Render helpers */
  const renderStatusBadge = (status: string) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );

  const renderProgressBar = (progress: number) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className="bg-blue-600 h-2.5 rounded-full transition-all"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );

  /* ─── Dashboard ─── */
  const Dashboard = () => {
    if (!stats) return null;
    const cards = [
      { label: 'Total objetivos', value: stats.total, icon: Target, color: 'text-blue-600' },
      { label: 'En curso', value: stats.inProgress, icon: Activity, color: 'text-amber-600' },
      { label: 'Cumplidos', value: stats.achieved, icon: CheckCircle2, color: 'text-green-600' },
      { label: 'En riesgo', value: stats.atRisk, icon: AlertTriangle, color: 'text-red-600' },
      { label: 'Retrasados', value: stats.delayed, icon: XCircle, color: 'text-orange-600' },
      { label: 'Progreso promedio', value: `${stats?.averageProgress ?? 0}%`, icon: TrendingUp, color: 'text-purple-600' },
    ];
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={`w-8 h-8 ${c.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  /* ─── Filters ─── */
  const FiltersPanel = () => (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título o código..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="pl-8"
        />
      </div>
      <Input
        type="number"
        placeholder="Año"
        value={filters.year}
        onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
        className="w-24"
      />
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={filters.status}
        onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
      >
        <option value="">Todos los estados</option>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={filters.policyId}
        onChange={(e) => setFilters((f) => ({ ...f, policyId: e.target.value }))}
      >
        <option value="">Todas las políticas</option>
        {policies.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <Button variant="outline" onClick={() => {
        setFilters({ search: '', year: String(currentYear), status: '', policyId: '', processId: '' });
      }}>
        <X className="w-4 h-4 mr-1" /> Limpiar
      </Button>
    </div>
  );

  /* ─── Table ─── */
  const TableSection = () => (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Código</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Objetivo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Política</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Proceso</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Meta</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Progreso</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fin</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredObjectives.map((obj) => (
              <tr key={obj.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenDetail(obj)}>
                <td className="px-4 py-3 font-mono text-xs">{obj.code}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{obj.title}</div>
                  <div className="text-xs text-muted-foreground">{obj.standard}</div>
                </td>
                <td className="px-4 py-3">{obj.policy?.name || '—'}</td>
                <td className="px-4 py-3">{obj.process?.name || '—'}</td>
                <td className="px-4 py-3">
                  {obj.target} {obj.targetValue ? `(${obj.targetValue}${obj.unit || ''})` : ''}
                </td>
                <td className="px-4 py-3 w-32">
                  {renderProgressBar(obj.progress ?? 0)}
                  <span className="text-xs text-muted-foreground">{obj.progress ?? 0}%</span>
                </td>
                <td className="px-4 py-3">{renderStatusBadge(obj.status)}</td>
                <td className="px-4 py-3 text-xs">{obj.endDate ? new Date(obj.endDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleOpenDetail(obj); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(obj); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(obj.id); }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredObjectives.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No hay objetivos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ─── Form ─── */
  const FormDialog = () => {
    if (!showForm) return null;
    const update = (key: string, val: any) => setFormData((d) => ({ ...d, [key]: val }));
    return (
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingObjective ? 'Editar objetivo' : 'Nuevo objetivo'}</DialogTitle>
          </DialogHeader>
          <div className="w-full">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Información</TabsTrigger>
                <TabsTrigger value="indicators">Indicadores</TabsTrigger>
                <TabsTrigger value="owner">Responsable</TabsTrigger>
                <TabsTrigger value="details">Detalles</TabsTrigger>
              </TabsList>
            <TabsContent value="basic" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Código</Label>
                  <Input value={formData.code || ''} onChange={(e) => update('code', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Título</Label>
                  <Input value={formData.title || ''} onChange={(e) => update('title', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descripción</Label>
                  <Input value={formData.description || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.type || 'STRATEGIC'}
                    onChange={(e) => update('type', e.target.value)}
                  >
                    <option value="STRATEGIC">Estratégico</option>
                    <option value="OPERATIONAL">Operativo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Alcance</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.scope || 'QUALITY'}
                    onChange={(e) => update('scope', e.target.value)}
                  >
                    <option value="QUALITY">Calidad</option>
                    <option value="ENVIRONMENT">Medio Ambiente</option>
                    <option value="SAFETY">Seguridad</option>
                    <option value="INTEGRATED">Integrado</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Norma</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.standard || 'ISO 9001'}
                    onChange={(e) => update('standard', e.target.value)}
                  >
                    <option>ISO 9001</option>
                    <option>ISO 14001</option>
                    <option>ISO 45001</option>
                    <option>MULTIPLE</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Input type="number" value={formData.year || ''} onChange={(e) => update('year', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Inicio</Label>
                  <Input type="date" value={formData.startDate || ''} onChange={(e) => update('startDate', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fin</Label>
                  <Input type="date" value={formData.endDate || ''} onChange={(e) => update('endDate', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.status || 'PLANNED'}
                    onChange={(e) => update('status', e.target.value)}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.priority || 'MEDIUM'}
                    onChange={(e) => update('priority', e.target.value)}
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
                {policies.length > 0 && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Política SGI</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={formData.policyId || ''}
                      onChange={(e) => update('policyId', e.target.value || undefined)}
                    >
                      <option value="">— Sin política —</option>
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label>Meta *</Label>
                  <Input value={formData.target || ''} onChange={(e) => update('target', e.target.value)} placeholder="Descripción de la meta" />
                </div>
                <div className="space-y-2">
                  <Label>Valor meta</Label>
                  <Input type="number" value={formData.targetValue || ''} onChange={(e) => update('targetValue', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Unidad</Label>
                  <Input value={formData.unit || ''} onChange={(e) => update('unit', e.target.value)} placeholder="Ej: %, días, unidades" />
                </div>
                <div className="space-y-2">
                  <Label>Progreso (%)</Label>
                  <Input type="number" min={0} max={100} value={formData.progress || 0} onChange={(e) => update('progress', Number(e.target.value))} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="indicators" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nombre del KPI</Label>
                  <Input value={formData.kpiName || ''} onChange={(e) => update('kpiName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Meta del KPI</Label>
                  <Input type="number" value={formData.kpiTarget || ''} onChange={(e) => update('kpiTarget', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Unidad del KPI</Label>
                  <Input value={formData.kpiUnit || ''} onChange={(e) => update('kpiUnit', e.target.value)} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="owner" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Proceso</Label>
                  <Input value={formData.processId || ''} onChange={(e) => update('processId', e.target.value)} placeholder="ID del proceso" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Responsable</Label>
                  <Input value={formData.owner || ''} onChange={(e) => update('owner', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Responsable alternativo</Label>
                  <Input value={formData.responsible || ''} onChange={(e) => update('responsible', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Sede</Label>
                  <Input value={formData.sede || ''} onChange={(e) => update('sede', e.target.value)} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="details" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Notas</Label>
                  <Input value={formData.notes || ''} onChange={(e) => update('notes', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Etiquetas</Label>
                  <Input value={formData.tags || ''} onChange={(e) => update('tags', e.target.value)} placeholder="Separadas por comas" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  /* ─── Detail Drawer / Dialog ─── */
  const DetailDialog = () => {
    if (!detailObjective) return null;
    const obj = detailObjective;
    return (
      <Dialog open={!!detailObjective} onOpenChange={() => setDetailObjective(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              {obj.code} — {obj.title}
            </DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="info">Información</TabsTrigger>
              <TabsTrigger value="activities">Actividades ({obj.activities?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="indicators">Indicadores ({obj.indicators?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="links">Vínculos</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">Estado:</span> {renderStatusBadge(obj.status)}</div>
                <div><span className="font-medium">Progreso:</span> {obj.progress}%</div>
                <div><span className="font-medium">Norma:</span> {obj.standard || '—'}</div>
                <div><span className="font-medium">Tipo:</span> {obj.type || '—'}</div>
                <div><span className="font-medium">Meta:</span> {obj.target} {obj.targetValue ? `(${obj.targetValue}${obj.unit || ''})` : ''}</div>
                <div><span className="font-medium">Año:</span> {obj.year}</div>
                <div><span className="font-medium">Inicio:</span> {obj.startDate ? new Date(obj.startDate).toLocaleDateString() : '—'}</div>
                <div><span className="font-medium">Fin:</span> {obj.endDate ? new Date(obj.endDate).toLocaleDateString() : '—'}</div>
                <div><span className="font-medium">Política:</span> {obj.policy?.name || '—'}</div>
                <div><span className="font-medium">Proceso:</span> {obj.process?.name || '—'}</div>
              </div>
              {obj.description && (
                <div className="text-sm">
                  <span className="font-medium">Descripción:</span>
                  <p className="mt-1 text-muted-foreground">{obj.description}</p>
                </div>
              )}
              {obj.notes && (
                <div className="text-sm">
                  <span className="font-medium">Notas:</span>
                  <p className="mt-1 text-muted-foreground">{obj.notes}</p>
                </div>
              )}
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full transition-all" style={{ width: `${Math.min(obj.progress ?? 0, 100)}%` }} />
              </div>
            </TabsContent>
            <TabsContent value="activities" className="py-4">
              {(obj.activities && obj.activities.length > 0) ? (
                <div className="space-y-2">
                  {obj.activities.map((a) => (
                    <Card key={a.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{a.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.startDate && new Date(a.startDate).toLocaleDateString()} — {a.endDate && new Date(a.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline">{ACTIVITY_STATUS_LABELS[a.status] || a.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin actividades registradas</p>
              )}
            </TabsContent>
            <TabsContent value="indicators" className="py-4">
              {(obj.indicators && obj.indicators.length > 0) ? (
                <div className="space-y-2">
                  {obj.indicators.map((ind) => (
                    <Card key={ind.id}>
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{ind.indicator?.name || `Indicador ${ind.indicatorId.slice(0, 8)}`}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin indicadores vinculados</p>
              )}
            </TabsContent>
            <TabsContent value="links" className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Auditorías ({obj.audits?.length ?? 0})</h4>
                  {obj.audits && obj.audits.length > 0 ? obj.audits.map((a) => (
                    <div key={a.id} className="text-xs border rounded p-2 mb-1">{a.audit?.title || a.auditId}</div>
                  )) : <p className="text-xs text-muted-foreground">Sin auditorías</p>}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">CAPA ({obj.capas?.length ?? 0})</h4>
                  {obj.capas && obj.capas.length > 0 ? obj.capas.map((c) => (
                    <div key={c.id} className="text-xs border rounded p-2 mb-1">{c.capa?.title || c.capaId}</div>
                  )) : <p className="text-xs text-muted-foreground">Sin CAPA</p>}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Riesgos ({obj.risks?.length ?? 0})</h4>
                  {obj.risks && obj.risks.length > 0 ? obj.risks.map((r) => (
                    <div key={r.id} className="text-xs border rounded p-2 mb-1">{r.risk?.description || r.riskId}</div>
                  )) : <p className="text-xs text-muted-foreground">Sin riesgos</p>}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  };

  /* ─── Main Layout ─── */
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6" />
            Objetivos SGI 360
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión integral de objetivos estratégicos — ISO 9001/14001/45001 §6.2
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo objetivo
        </Button>
      </div>

      {Dashboard()}
      {FiltersPanel()}
      {TableSection()}
      {FormDialog()}
      {DetailDialog()}
    </div>
  );
}
