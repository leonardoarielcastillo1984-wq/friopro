'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Risk, RiskStats } from '@/lib/types';
import {
  Shield, Plus, X, Search, AlertCircle, CheckCircle2, AlertTriangle, TrendingUp, 
  LayoutGrid, Table2, Download, Upload, FileSpreadsheet, Bell,
  Filter, ChevronDown, BarChart3, PieChart, Activity, Target,
  ArrowDown, ArrowUp, Minus, Clock, RefreshCw, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { exportRisksToExcel } from '@/lib/exportToExcel';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  IDENTIFIED: { label: 'Identificado', color: 'text-neutral-700', bg: 'bg-neutral-100 border-neutral-200' },
  ASSESSED: { label: 'Evaluado', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  MITIGATING: { label: 'Mitigando', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  MONITORED: { label: 'Monitoreado', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  CLOSED: { label: 'Cerrado', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

const CATEGORIES = ['Operacional', 'Legal', 'Ambiental', 'Seguridad Vial', 'Calidad', 'Financiero', 'Tecnológico', 'Otro'];
const PROB_LABELS = ['', 'Raro', 'Improbable', 'Posible', 'Probable', 'Casi seguro'];
const IMPACT_LABELS = ['', 'Insignificante', 'Menor', 'Moderado', 'Mayor', 'Catastrófico'];
const RISK_LEVELS = ['Bajo', 'Medio', 'Alto', 'Crítico'];

function getRiskColor(level: number): string {
  if (level >= 20) return 'bg-red-600 text-white';
  if (level >= 12) return 'bg-orange-500 text-white';
  if (level >= 5) return 'bg-amber-400 text-neutral-900';
  return 'bg-green-500 text-white';
}

function getRiskLabel(level: number): string {
  if (level >= 20) return 'Crítico';
  if (level >= 12) return 'Alto';
  if (level >= 5) return 'Medio';
  return 'Bajo';
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
}

export default function RiesgosPage() {
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [stats, setStats] = useState<RiskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAspectType, setFilterAspectType] = useState<string>('');
  const [filterStrategy, setFilterStrategy] = useState<string>('');
  const [filterLegalRequirement, setFilterLegalRequirement] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // View modes
  const [viewMode, setViewMode] = useState<'matrix' | 'table' | 'process' | 'trends'>('matrix');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [importing, setImporting] = useState(false);
  
  // Notifications
  const [notifications, setNotifications] = useState<{id: string; message: string; type: 'warning' | 'info'; read: boolean}[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  function getReadNotificationIds(): Record<string, true> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem('risks.notifications.read');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') return parsed;
      return {};
    } catch {
      return {};
    }
  }

  function markNotificationRead(id: string) {
    if (typeof window === 'undefined') return;
    const map = getReadNotificationIds();
    map[id] = true;
    window.localStorage.setItem('risks.notifications.read', JSON.stringify(map));
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }
  
  const [form, setForm] = useState({
    title: '', description: '', category: 'Operacional', probability: 3, impact: 3,
    treatmentPlan: '', controls: '', standard: '', process: '', inherentProbability: 3, inherentImpact: 3,
    // ISO fields
    aspectType: undefined, strategy: undefined, legalRequirement: false, requirement: '',
    legalReference: '', riskSource: undefined, environmentalAspect: '', hazard: '',
    responsible: '', effectiveness: undefined,
  });

  async function load() {
    setError(null); setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      if (filterAspectType) params.set('aspectType', filterAspectType);
      if (filterStrategy) params.set('strategy', filterStrategy);
      if (filterLegalRequirement) params.set('legalRequirement', filterLegalRequirement);

      if (filterLevel) {
        if (filterLevel === 'Bajo') { params.set('minLevel', '1'); params.set('maxLevel', '4'); }
        if (filterLevel === 'Medio') { params.set('minLevel', '5'); params.set('maxLevel', '11'); }
        if (filterLevel === 'Alto') { params.set('minLevel', '12'); params.set('maxLevel', '19'); }
        if (filterLevel === 'Crítico') { params.set('minLevel', '20'); params.set('maxLevel', '25'); }
      }

      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const qs = params.toString();
      const risksPath = qs ? `/risks?${qs}` : '/risks';
      const statsPath = qs ? `/risks/stats?${qs}` : '/risks/stats';

      const [risksRes, statsRes] = await Promise.all([
        apiFetch<{ risks: Risk[] }>(risksPath),
        apiFetch<{ stats: RiskStats }>(statsPath),
      ]);
      setRisks(risksRes.risks ?? []); 
      setStats(statsRes.stats ?? null);
      generateNotifications(risksRes.risks ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'Error'); 
      if (err?.message === 'Unauthorized') router.push('/login');
    } finally { 
      setLoading(false); 
    }
  }

  function generateNotifications(risks: Risk[]) {
    const notifs: {id: string; message: string; type: 'warning' | 'info'; read: boolean}[] = [];
    const readMap = getReadNotificationIds();
    
    const criticalNoAction = risks.filter(r => r.riskLevel >= 20 && !r.treatmentPlan && r.status !== 'CLOSED');
    if (criticalNoAction.length > 0) {
      notifs.push({
        id: 'critical_no_plan',
        message: `${criticalNoAction.length} riesgo(s) crítico(s) sin plan de mitigación`,
        type: 'warning',
        read: !!readMap['critical_no_plan']
      });
    }
    
    const oldHighRisks = risks.filter(r => r.riskLevel >= 12 && r.status === 'IDENTIFIED');
    if (oldHighRisks.length > 0) {
      notifs.push({
        id: 'high_not_assessed',
        message: `${oldHighRisks.length} riesgo(s) alto(s) sin evaluar`,
        type: 'warning',
        read: !!readMap['high_not_assessed']
      });
    }

    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    const overdueReview = risks.filter(r => {
      if (r.status === 'CLOSED') return false;
      if (!r.reviewDate) return false;
      const d = new Date(r.reviewDate);
      return d < now;
    });

    if (overdueReview.length > 0) {
      notifs.push({
        id: 'review_overdue',
        message: `${overdueReview.length} riesgo(s) con revisión vencida`,
        type: 'warning',
        read: !!readMap['review_overdue'],
      });
    }

    const upcomingReview = risks.filter(r => {
      if (r.status === 'CLOSED') return false;
      if (!r.reviewDate) return false;
      const d = new Date(r.reviewDate);
      return d >= now && d <= in7Days;
    });

    if (upcomingReview.length > 0) {
      notifs.push({
        id: 'review_soon',
        message: `${upcomingReview.length} riesgo(s) con revisión en los próximos 7 días`,
        type: 'info',
        read: !!readMap['review_soon'],
      });
    }
    
    setNotifications(notifs);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    apiFetch<{ departments: Array<{ id: string; name: string }> }>('/departments')
      .then((res) => setDepartments((res as any).departments ?? []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    // reload when filters change (server-side filtering)
    void load();
  }, [filterCategory, filterLevel, filterStatus, filterAspectType, filterStrategy, filterLegalRequirement, filterDateFrom, filterDateTo]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); 
    setCreating(true); 
    setError(null);
    try {
      await apiFetch('/risks', { 
        method: 'POST', 
        json: { 
          ...form, 
          probability: Number(form.probability), 
          impact: Number(form.impact),
          inherentProbability: Number(form.inherentProbability),
          inherentImpact: Number(form.inherentImpact),
        } 
      });
      setSuccess('Riesgo creado correctamente'); 
      setShowCreate(false);
      setForm({ 
        title: '', description: '', category: 'Operacional', 
        probability: 3, impact: 3, inherentProbability: 3, inherentImpact: 3,
        treatmentPlan: '', controls: '', standard: '', process: '',
        // Reset ISO fields
        aspectType: undefined, strategy: undefined, legalRequirement: false, requirement: '',
        legalReference: '', riskSource: undefined, environmentalAspect: '', hazard: '',
        responsible: '', effectiveness: undefined,
      });
      await load();
    } catch (err: any) { 
      setError(err?.message ?? 'Error al crear'); 
    } finally { 
      setCreating(false); 
    }
  }

  // Export to Excel
  async function exportToExcel() {
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('format', 'xlsx');
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      if (filterAspectType) params.set('aspectType', filterAspectType);
      if (filterStrategy) params.set('strategy', filterStrategy);
      if (filterLegalRequirement) params.set('legalRequirement', filterLegalRequirement);

      if (filterLevel) {
        if (filterLevel === 'Bajo') { params.set('minLevel', '1'); params.set('maxLevel', '4'); }
        if (filterLevel === 'Medio') { params.set('minLevel', '5'); params.set('maxLevel', '11'); }
        if (filterLevel === 'Alto') { params.set('minLevel', '12'); params.set('maxLevel', '19'); }
        if (filterLevel === 'Crítico') { params.set('minLevel', '20'); params.set('maxLevel', '25'); }
      }

      const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
      const tenantId = typeof window !== 'undefined' ? window.localStorage.getItem('tenantId') : null;

      const res = await fetch(`${apiBase()}/export/risks?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const filename = `Riesgos_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(blob, filename);
      setSuccess('Exportación exitosa');
    } catch (err: any) {
      setError(err?.message ?? 'Error al exportar');
    }
  }

  // Import from Excel
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setImporting(true);

    try {
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
      const tenantId = typeof window !== 'undefined' ? window.localStorage.getItem('tenantId') : null;

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiBase()}/risks/import`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const result = data?.result;
      const created = result?.created ?? 0;
      const failed = result?.failed ?? 0;
      setSuccess(`Importación completada: ${created} creados, ${failed} con error`);

      setShowImport(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Error al importar el archivo');
    } finally {
      setImporting(false);
      if (e.target) e.target.value = '';
    }
  }

  // Apply filters
  const filtered = useMemo(() => {
    return risks.filter(r => {
      const matchesSearch = !searchTerm || 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !filterCategory || r.category === filterCategory;
      const matchesLevel = !filterLevel || getRiskLabel(r.riskLevel) === filterLevel;
      const matchesStatus = !filterStatus || r.status === filterStatus;

      const matchesAspectType = !filterAspectType || (r.aspectType || '') === filterAspectType;
      const matchesStrategy = !filterStrategy || (r.strategy || '') === filterStrategy;
      const matchesLegalRequirement = !filterLegalRequirement || String(!!r.legalRequirement) === filterLegalRequirement;
      
      const riskDate = new Date(r.createdAt);
      const matchesDateFrom = !filterDateFrom || riskDate >= new Date(filterDateFrom);
      const matchesDateTo = !filterDateTo || riskDate <= new Date(filterDateTo);
      
      return (
        matchesSearch &&
        matchesCategory &&
        matchesLevel &&
        matchesStatus &&
        matchesAspectType &&
        matchesStrategy &&
        matchesLegalRequirement &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [risks, searchTerm, filterCategory, filterLevel, filterStatus, filterAspectType, filterStrategy, filterLegalRequirement, filterDateFrom, filterDateTo]);

  // Build 5x5 matrix data
  const matrixCounts: Record<string, number> = {};
  const matrixRisks: Record<string, Risk[]> = {};
  risks.forEach(r => { 
    const key = `${r.probability}-${r.impact}`; 
    matrixCounts[key] = (matrixCounts[key] || 0) + 1;
    if (!matrixRisks[key]) matrixRisks[key] = [];
    matrixRisks[key].push(r);
  });

  // Group by process for process view
  const processData = useMemo(() => {
    const grouped: Record<string, { risks: Risk[]; highCount: number; criticalCount: number }> = {};
    risks.forEach(r => {
      const process = r.process || 'Sin proceso asignado';
      if (!grouped[process]) grouped[process] = { risks: [], highCount: 0, criticalCount: 0 };
      grouped[process].risks.push(r);
      if (r.riskLevel >= 20) grouped[process].criticalCount++;
      else if (r.riskLevel >= 12) grouped[process].highCount++;
    });
    return grouped;
  }, [risks]);

  const clearFilters = () => {
    setFilterCategory('');
    setFilterLevel('');
    setFilterStatus('');
    setFilterAspectType('');
    setFilterStrategy('');
    setFilterLegalRequirement('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchTerm('');
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-4">
      {/* Header with notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Gestión de Riesgos</h1>
          <p className="mt-1 text-sm text-neutral-500">Identificación, evaluación y tratamiento de riesgos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <Bell className="h-5 w-5 text-neutral-600" />
              {unreadNotifications > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-neutral-200 z-50">
                <div className="p-3 border-b border-neutral-200">
                  <h3 className="font-semibold text-sm">Notificaciones</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-3 text-sm text-neutral-500 text-center">Sin notificaciones</p>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-3 border-b border-neutral-100 cursor-pointer ${n.type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'} ${n.read ? 'opacity-60' : ''}`}
                        onClick={() => markNotificationRead(n.id)}
                      >
                        <div className="flex items-start gap-2">
                          {n.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" /> : <Bell className="h-4 w-4 text-blue-600 mt-0.5" />}
                          <p className="text-sm text-neutral-700">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Export/Import buttons */}
          <div className="relative group">
            <button className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
              <Download className="h-4 w-4" /> Exportar
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button onClick={() => exportRisksToExcel(risks)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
              </button>
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('type', 'risks');
                  if (filterStatus) params.set('status', filterStatus);
                  if (filterCategory) params.set('category', filterCategory);
                  if (filterAspectType) params.set('aspectType', filterAspectType);
                  if (filterStrategy) params.set('strategy', filterStrategy);
                  if (filterLegalRequirement) params.set('legalRequirement', filterLegalRequirement);
                  if (filterLevel) {
                    if (filterLevel === 'Bajo') { params.set('minLevel', '1'); params.set('maxLevel', '4'); }
                    if (filterLevel === 'Medio') { params.set('minLevel', '5'); params.set('maxLevel', '11'); }
                    if (filterLevel === 'Alto') { params.set('minLevel', '12'); params.set('maxLevel', '19'); }
                    if (filterLevel === 'Crítico') { params.set('minLevel', '20'); params.set('maxLevel', '25'); }
                  }
                  if (filterDateFrom) params.set('dateFrom', filterDateFrom);
                  if (filterDateTo) params.set('dateTo', filterDateTo);
                  window.open(`/reportes/export?${params.toString()}`, '_blank');
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <FileText className="h-4 w-4 text-neutral-700" /> PDF
              </button>
              <button onClick={() => setShowImport(true)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                <Upload className="h-4 w-4 text-blue-600" /> Importar Excel
              </button>
            </div>
          </div>
          
          <button onClick={() => { setShowCreate(!showCreate); setError(null); setSuccess(null); }} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors">
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
            {showCreate ? 'Cancelar' : 'Nuevo riesgo'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-brand-50 p-1.5"><Shield className="h-4 w-4 text-brand-600" /></div>
              <div><div className="text-xl font-bold">{stats.total}</div><div className="text-xs text-neutral-500">Total riesgos</div></div>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-red-100 p-1.5"><AlertTriangle className="h-4 w-4 text-red-600" /></div>
              <div><div className="text-xl font-bold text-red-700">{stats.critical}</div><div className="text-xs text-red-600">Críticos (≥20)</div></div>
            </div>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-orange-100 p-1.5"><TrendingUp className="h-4 w-4 text-orange-600" /></div>
              <div><div className="text-xl font-bold text-orange-700">{stats.high}</div><div className="text-xs text-orange-600">Altos (12-19)</div></div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-100 p-1.5"><Activity className="h-4 w-4 text-amber-600" /></div>
              <div><div className="text-xl font-bold text-amber-700">{stats.medium || 0}</div><div className="text-xs text-amber-600">Medios (5-11)</div></div>
            </div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-green-100 p-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
              <div><div className="text-xl font-bold text-green-700">{stats.low}</div><div className="text-xs text-green-600">Bajos (1-4)</div></div>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center bg-white rounded-lg border border-neutral-200 p-1">
          <button onClick={() => setViewMode('matrix')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'matrix' ? 'bg-brand-100 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'}`}>
            <LayoutGrid className="h-4 w-4" /> Matriz 5×5
          </button>
          <button onClick={() => setViewMode('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-brand-100 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'}`}>
            <Table2 className="h-4 w-4" /> Matriz de Riesgos
          </button>
          <button onClick={() => setViewMode('process')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'process' ? 'bg-brand-100 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'}`}>
            <PieChart className="h-4 w-4" /> Por Proceso
          </button>
          <button onClick={() => setViewMode('trends')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'trends' ? 'bg-brand-100 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'}`}>
            <BarChart3 className="h-4 w-4" /> Tendencias
          </button>
        </div>
        
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${showFilters ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
          <Filter className="h-4 w-4" /> Filtros
        </button>
        
        {(filterCategory || filterLevel || filterStatus || filterDateFrom || filterDateTo) && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-neutral-200 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Categoría</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="">Todas</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Nivel</label>
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="">Todos</option>
                {RISK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="">Todos</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Desde</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Hasta</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo de Aspecto (ISO)</label>
              <select value={filterAspectType} onChange={e => setFilterAspectType(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="AMBIENTAL">Ambiental</option>
                <option value="CALIDAD">Calidad</option>
                <option value="SEGURIDAD">Seguridad</option>
                <option value="LEGAL">Legal</option>
                <option value="IATF">IATF</option>
                <option value="TECNOLOGICO">Tecnológico</option>
                <option value="FINANCIERO">Financiero</option>
                <option value="REPUTACIONAL">Reputacional</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Estrategia (ISO)</label>
              <select value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="">Todas</option>
                <option value="EVITAR">Evitar</option>
                <option value="MITIGAR">Mitigar</option>
                <option value="TRANSFERIR">Transferir</option>
                <option value="ACEPTAR">Aceptar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Requisito Legal</label>
              <select value={filterLegalRequirement} onChange={e => setFilterLegalRequirement(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Importar Riesgos desde Excel</h2>
            <button onClick={() => setShowImport(false)} className="p-1 hover:bg-neutral-100 rounded"><X className="h-4 w-4" /></button>
          </div>
          <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-neutral-400 mb-3" />
            <p className="text-sm text-neutral-600 mb-2">Seleccioná un archivo Excel</p>
            <p className="text-xs text-neutral-400 mb-4">Formato: Código, Título, Descripción, Categoría, Probabilidad, Impacto</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-brand-700 transition-colors">
              <Upload className="h-4 w-4" />
              Seleccionar archivo
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            </label>
          </div>
          {importing && <p className="text-sm text-neutral-500 text-center">Importando...</p>}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-brand-200 p-5 space-y-4">
          <h2 className="text-base font-semibold">Nuevo Riesgo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Título *</label>
              <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Departamento/Proceso</label>
              <select className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" value={form.process} onChange={e => setForm({ ...form, process: e.target.value })}>
                <option value="">(Opcional)</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción *</label>
              <textarea className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 outline-none" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Categoría</label>
              <select className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Norma</label>
              <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="ISO 39001" value={form.standard} onChange={e => setForm({...form, standard: e.target.value})} />
            </div>
            <div className="md:col-span-3 border-t border-neutral-200 pt-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Campos ISO 14001/9001/45001/IATF 16949
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo de Aspecto</label>
                  <select className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" value={form.aspectType || ''} onChange={e => setForm({...form, aspectType: e.target.value || (undefined as any)})}>
                    <option value="">Seleccionar...</option>
                    <option value="AMBIENTAL">Ambiental (ISO 14001)</option>
                    <option value="CALIDAD">Calidad (ISO 9001)</option>
                    <option value="SEGURIDAD">Seguridad (ISO 45001)</option>
                    <option value="LEGAL">Legal</option>
                    <option value="IATF">IATF 16949</option>
                    <option value="TECNOLOGICO">Tecnológico</option>
                    <option value="FINANCIERO">Financiero</option>
                    <option value="REPUTACIONAL">Reputacional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Estrategia de Tratamiento</label>
                  <select className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" value={form.strategy || ''} onChange={e => setForm({...form, strategy: e.target.value || (undefined as any)})}>
                    <option value="">Seleccionar...</option>
                    <option value="EVITAR">Evitar</option>
                    <option value="MITIGAR">Mitigar</option>
                    <option value="TRANSFERIR">Transferir</option>
                    <option value="ACEPTAR">Aceptar</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="legalRequirement" className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500" checked={form.legalRequirement || false} onChange={e => setForm({...form, legalRequirement: e.target.checked})} />
                  <label htmlFor="legalRequirement" className="text-sm font-medium text-neutral-700">Requisito Legal</label>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Requisito Normativo</label>
                  <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="Ej: ISO 14001:2015 - Cláusula 6.1.2" value={form.requirement || ''} onChange={e => setForm({...form, requirement: e.target.value})} />
                </div>
                <div className="md:col-span-2 lg:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Referencia Legal</label>
                  <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="Ej: Ley 24.051 - Resolución 501/95" value={form.legalReference || ''} onChange={e => setForm({...form, legalReference: e.target.value})} disabled={!form.legalRequirement} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Origen del Riesgo</label>
                  <select className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" value={form.riskSource || ''} onChange={e => setForm({...form, riskSource: e.target.value || (undefined as any)})}>
                    <option value="">Seleccionar...</option>
                    <option value="INTERNO">Interno</option>
                    <option value="EXTERNO">Externo</option>
                  </select>
                </div>
                {(form.aspectType === 'AMBIENTAL' || form.aspectType === 'SEGURIDAD') && (
                  <>
                    <div className="md:col-span-2 lg:col-span-2">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        {form.aspectType === 'AMBIENTAL' ? 'Aspecto Ambiental (ISO 14001)' : 'Peligro/Riesgo Laboral (ISO 45001)'}
                      </label>
                      <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" 
                        placeholder={form.aspectType === 'AMBIENTAL' ? 'Ej: Emisión de gases, Generación de residuos' : 'Ej: Caída desde altura, Exposición a químicos'} 
                        value={form.aspectType === 'AMBIENTAL' ? (form.environmentalAspect || '') : (form.hazard || '')} 
                        onChange={e => setForm({...form, [form.aspectType === 'AMBIENTAL' ? 'environmentalAspect' : 'hazard']: e.target.value})} />
                    </div>
                  </>
                )}
                <div className="md:col-span-2 lg:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Responsable</label>
                  <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="Nombre del responsable" value={form.responsible || ''} onChange={e => setForm({...form, responsible: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Eficacia de Controles (%)</label>
                  <input type="number" min="0" max="100" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="0-100" value={form.effectiveness || ''} onChange={e => setForm({...form, effectiveness: e.target.value ? Number(e.target.value) : (undefined as any)})} />
                </div>
              </div>
            </div>
            <div className="md:col-span-3 border-t border-neutral-200 pt-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" /> Riesgo Inherente (antes de controles)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Probabilidad ({PROB_LABELS[form.inherentProbability]})</label>
                  <input type="range" min={1} max={5} value={form.inherentProbability} onChange={e => setForm({...form, inherentProbability: Number(e.target.value)})} className="w-full accent-brand-600" />
                  <div className="flex justify-between text-xs text-neutral-400"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Impacto ({IMPACT_LABELS[form.inherentImpact]})</label>
                  <input type="range" min={1} max={5} value={form.inherentImpact} onChange={e => setForm({...form, inherentImpact: Number(e.target.value)})} className="w-full accent-brand-600" />
                  <div className="flex justify-between text-xs text-neutral-400"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm font-medium">Nivel inherente:</span>
                <span className={`rounded-lg px-3 py-1 text-sm font-bold ${getRiskColor(form.inherentProbability * form.inherentImpact)}`}>
                  {form.inherentProbability * form.inherentImpact} — {getRiskLabel(form.inherentProbability * form.inherentImpact)}
                </span>
              </div>
            </div>
            <div className="md:col-span-3 border-t border-neutral-200 pt-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" /> Riesgo Residual (después de controles)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Probabilidad ({PROB_LABELS[form.probability]})</label>
                  <input type="range" min={1} max={5} value={form.probability} onChange={e => setForm({...form, probability: Number(e.target.value)})} className="w-full accent-brand-600" />
                  <div className="flex justify-between text-xs text-neutral-400"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Impacto ({IMPACT_LABELS[form.impact]})</label>
                  <input type="range" min={1} max={5} value={form.impact} onChange={e => setForm({...form, impact: Number(e.target.value)})} className="w-full accent-brand-600" />
                  <div className="flex justify-between text-xs text-neutral-400"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm font-medium">Nivel residual:</span>
                <span className={`rounded-lg px-3 py-1 text-sm font-bold ${getRiskColor(form.probability * form.impact)}`}>
                  {form.probability * form.impact} — {getRiskLabel(form.probability * form.impact)}
                </span>
                {form.inherentProbability * form.inherentImpact > form.probability * form.impact && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <ArrowDown className="h-3 w-3" />
                    ↓{form.inherentProbability * form.inherentImpact - form.probability * form.impact} puntos
                  </span>
                )}
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Plan de tratamiento / Controles</label>
              <textarea className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" rows={3} value={form.treatmentPlan} onChange={e => setForm({...form, treatmentPlan: e.target.value})} placeholder="Describe las acciones de mitigación..." />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={creating} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 transition-colors">
              <Plus className="h-4 w-4" /> {creating ? 'Creando...' : 'Crear riesgo'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800">Cancelar</button>
          </div>
        </form>
      )}

      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4" /> {error}</div>}
      {success && <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 className="h-4 w-4" /> {success}</div>}

      {/* MATRIX 5x5 VIEW */}
      {viewMode === 'matrix' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-semibold text-neutral-900 mb-3">Matriz de Riesgos 5×5</h2>
          <div className="flex gap-3">
            <div className="flex flex-col justify-center items-center mr-1">
              <span className="text-xs font-medium text-neutral-500 -rotate-90 whitespace-nowrap">PROBABILIDAD →</span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-6 gap-0.5">
                <div className="h-8" />
                {[1,2,3,4,5].map(i => (
                  <div key={`h-${i}`} className="text-center text-[10px] font-medium text-neutral-500 pb-0.5 leading-tight">{IMPACT_LABELS[i]}</div>
                ))}
                {[5,4,3,2,1].map(prob => (
                  <React.Fragment key={`row-${prob}`}>
                    <div className="text-right text-[10px] font-medium text-neutral-500 pr-1.5 flex items-center justify-end leading-tight">{PROB_LABELS[prob]}</div>
                    {[1,2,3,4,5].map(imp => {
                      const level = prob * imp;
                      const count = matrixCounts[`${prob}-${imp}`] || 0;
                      const cellRisks = matrixRisks[`${prob}-${imp}`] || [];
                      return (
                        <div 
                          key={`${prob}-${imp}`} 
                          className={`h-10 w-full rounded flex flex-col items-center justify-center text-[10px] font-bold ${getRiskColor(level)} ${count > 0 ? 'ring-1 ring-offset-0.5 ring-neutral-900 cursor-pointer hover:opacity-90' : 'opacity-80'}`}
                          title={cellRisks.map(r => `${r.code}: ${r.title}`).join('\n')}
                          onClick={() => count > 0 && router.push(`/riesgos/${cellRisks[0].id}`)}
                        >
                          <span>{level}</span>
                          {count > 0 && <span className="text-[8px] font-normal opacity-90">({count})</span>}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
                <div className="h-6" />
                <div className="col-span-5 text-center text-[10px] font-medium text-neutral-500 pt-0.5">IMPACTO →</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px]">
            <span className="font-medium text-neutral-600">Nivel:</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> Bajo (1-4)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400"></span> Medio (5-11)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500"></span> Alto (12-19)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600"></span> Crítico (≥20)</span>
          </div>
        </div>
      )}

      {/* TABLE VIEW - Matriz de Riesgos Completa ISO 31000 */}
      {viewMode === 'table' && (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Matriz de Riesgos</h2>
              <p className="text-xs text-neutral-500">ISO 31000 / ISO 9001 / ISO 14001 / ISO 45001 / IATF 16949</p>
            </div>
            <span className="text-xs text-neutral-400">{filtered.length} riesgos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  {/* Identificación */}
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-20">Código</th>
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-28">Fecha Ident.</th>
                  
                  {/* Descripción del Riesgo */}
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 min-w-[180px]">Riesgo / Proceso</th>
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-20">Categoría</th>
                  
                  {/* Campos ISO */}
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-20 bg-blue-50/50">Tipo</th>
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-16 bg-blue-50/50">Legal</th>
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-24 bg-blue-50/50">Requisito ISO</th>
                  
                  {/* Análisis Inherente */}
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-14 bg-amber-50/50">Prob.</th>
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-14 bg-amber-50/50">Imp.</th>
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-16 bg-amber-50/50">Nivel</th>
                  
                  {/* Estrategia y Tratamiento */}
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-20">Estrategia</th>
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-24">Plan / Controles</th>
                  
                  {/* Análisis Residual */}
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-14 bg-green-50/50">Prob.</th>
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-14 bg-green-50/50">Imp.</th>
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-16 bg-green-50/50">Nivel</th>
                  
                  {/* Gestión */}
                  <th className="px-2 py-2 text-center font-medium text-neutral-700 w-12">%</th>
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-20">Estado</th>
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-20">Responsable</th>
                  
                  {/* Fechas */}
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-24">Revisión</th>
                  <th className="px-2 py-2 text-left font-medium text-neutral-700 w-24">Cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((risk) => {
                  const inherentLevel = (risk.inherentProbability || risk.probability) * (risk.inherentImpact || risk.impact);
                  const st = STATUS_CONFIG[risk.status] ?? STATUS_CONFIG.IDENTIFIED;
                  const hasActions = risk.treatmentPlan || risk.controls;
                  const progress = risk.status === 'CLOSED' ? 100 : risk.status === 'MONITORED' ? 80 : risk.status === 'MITIGATING' ? 50 : risk.status === 'ASSESSED' ? 25 : 0;
                  
                  // Colores para tipo de aspecto
                  const aspectColors: Record<string, string> = {
                    'AMBIENTAL': 'bg-green-100 text-green-700',
                    'CALIDAD': 'bg-blue-100 text-blue-700',
                    'SEGURIDAD': 'bg-orange-100 text-orange-700',
                    'LEGAL': 'bg-purple-100 text-purple-700',
                    'IATF': 'bg-red-100 text-red-700',
                    'TECNOLOGICO': 'bg-cyan-100 text-cyan-700',
                    'FINANCIERO': 'bg-amber-100 text-amber-700',
                    'REPUTACIONAL': 'bg-pink-100 text-pink-700',
                  };
                  
                  // Labels para estrategia
                  const strategyLabels: Record<string, string> = {
                    'EVITAR': 'Evitar',
                    'MITIGAR': 'Mitigar',
                    'TRANSFERIR': 'Transferir',
                    'ACEPTAR': 'Aceptar',
                  };
                  
                  return (
                    <tr key={risk.id} className="hover:bg-neutral-50 cursor-pointer transition-colors" onClick={() => router.push(`/riesgos/${risk.id}`)}>
                      {/* Código */}
                      <td className="px-2 py-2 font-mono text-neutral-600 whitespace-nowrap">{risk.code}</td>
                      
                      {/* Fecha Identificación */}
                      <td className="px-2 py-2 text-neutral-600 whitespace-nowrap">
                        {new Date(risk.identificationDate || risk.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      
                      {/* Riesgo / Proceso */}
                      <td className="px-2 py-2">
                        <div className="font-medium text-neutral-900 truncate" title={risk.title}>{risk.title}</div>
                        <div className="text-neutral-500 truncate text-[10px]">{risk.process || 'Sin proceso'}</div>
                      </td>
                      
                      {/* Categoría */}
                      <td className="px-2 py-2">
                        <span className="text-neutral-600">{risk.category}</span>
                      </td>
                      
                      {/* Tipo de Aspecto (ISO) */}
                      <td className="px-2 py-2 text-center bg-blue-50/30">
                        {risk.aspectType ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${aspectColors[risk.aspectType] || 'bg-neutral-100 text-neutral-600'}`}>
                            {risk.aspectType}
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      
                      {/* Requisito Legal */}
                      <td className="px-2 py-2 text-center bg-blue-50/30">
                        {risk.legalRequirement ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold" title={risk.legalReference || 'Requisito legal'}>
                            ⚖
                          </span>
                        ) : (
                          <span className="text-neutral-300">-</span>
                        )}
                      </td>
                      
                      {/* Requisito ISO */}
                      <td className="px-2 py-2 bg-blue-50/30">
                        <div className="text-[10px] text-neutral-600 truncate" title={risk.requirement || ''}>
                          {risk.requirement || '-'}
                        </div>
                      </td>
                      
                      {/* Inherente - Probabilidad */}
                      <td className="px-2 py-2 text-center bg-amber-50/30">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                          {risk.inherentProbability || risk.probability}
                        </span>
                      </td>
                      
                      {/* Inherente - Impacto */}
                      <td className="px-2 py-2 text-center bg-amber-50/30">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                          {risk.inherentImpact || risk.impact}
                        </span>
                      </td>
                      
                      {/* Inherente - Nivel */}
                      <td className="px-2 py-2 text-center bg-amber-50/30">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getRiskColor(inherentLevel)}`}>
                          {inherentLevel}
                        </span>
                      </td>
                      
                      {/* Estrategia */}
                      <td className="px-2 py-2 text-center">
                        {risk.strategy ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[9px] font-medium">
                            {strategyLabels[risk.strategy] || risk.strategy}
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      
                      {/* Plan de Acción */}
                      <td className="px-2 py-2">
                        {hasActions ? (
                          <div className="max-w-[100px]">
                            <div className="text-neutral-600 truncate text-[10px]" title={risk.treatmentPlan || ''}>{risk.treatmentPlan || ''}</div>
                          </div>
                        ) : (
                          <span className="text-amber-600 text-[10px]">Sin plan</span>
                        )}
                      </td>
                      
                      {/* Residual - Probabilidad */}
                      <td className="px-2 py-2 text-center bg-green-50/30">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                          {risk.probability}
                        </span>
                      </td>
                      
                      {/* Residual - Impacto */}
                      <td className="px-2 py-2 text-center bg-green-50/30">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                          {risk.impact}
                        </span>
                      </td>
                      
                      {/* Residual - Nivel */}
                      <td className="px-2 py-2 text-center bg-green-50/30">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getRiskColor(risk.riskLevel)}`}>
                          {risk.riskLevel}
                        </span>
                        {inherentLevel > risk.riskLevel && (
                          <span className="text-green-600 text-[8px] ml-0.5">↓</span>
                        )}
                      </td>
                      
                      {/* Progreso */}
                      <td className="px-2 py-2 text-center">
                        <div className="w-full max-w-[40px] mx-auto">
                          <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${progress === 100 ? 'bg-green-500' : progress >= 50 ? 'bg-amber-500' : 'bg-neutral-400'}`} style={{width: `${progress}%`}} />
                          </div>
                        </div>
                      </td>
                      
                      {/* Estado */}
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${st.bg} ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      
                      {/* Responsable */}
                      <td className="px-2 py-2">
                        <div className="text-[10px] text-neutral-600 truncate" title={risk.responsible || ''}>
                          {risk.responsible || (risk.owner?.email || '-')}
                        </div>
                      </td>
                      
                      {/* Fecha Revisión */}
                      <td className="px-2 py-2 text-neutral-600 whitespace-nowrap text-[10px]">
                        {risk.reviewDate ? (
                          new Date(risk.reviewDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      
                      {/* Fecha Cierre */}
                      <td className="px-2 py-2 text-neutral-600 whitespace-nowrap text-[10px]">
                        {risk.closureDate ? (
                          <span className="text-green-600 font-medium">
                            {new Date(risk.closureDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={22} className="px-3 py-8 text-center text-neutral-500">
                      <Shield className="mx-auto h-8 w-8 text-neutral-300 mb-2" />
                      <p>No hay riesgos que coincidan con los filtros</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROCESS VIEW */}
      {viewMode === 'process' && (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-base font-semibold text-neutral-900">Riesgos por Proceso</h2>
            <p className="text-xs text-neutral-500">Distribución por procesos organizacionales</p>
          </div>
          <div className="divide-y divide-neutral-200">
            {Object.entries(processData).map(([process, data]) => (
              <div key={process} className="p-4 hover:bg-neutral-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-neutral-900">{process}</h3>
                    <span className="text-xs text-neutral-500">{data.risks.length} riesgos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.criticalCount > 0 && (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">{data.criticalCount} críticos</span>
                    )}
                    {data.highCount > 0 && (
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">{data.highCount} altos</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[5,4,3,2,1].map(prob => (
                    <React.Fragment key={prob}>
                      {[1,2,3,4,5].map(imp => {
                        const level = prob * imp;
                        const count = data.risks.filter(r => r.probability === prob && r.impact === imp).length;
                        return (
                          <div 
                            key={`${prob}-${imp}`} 
                            className={`h-6 rounded flex items-center justify-center text-[10px] ${getRiskColor(level)} ${count > 0 ? 'font-bold ring-1 ring-neutral-400' : 'opacity-30'}`}
                          >
                            {count > 0 ? count : ''}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(processData).length === 0 && (
              <div className="p-8 text-center text-neutral-500">
                <PieChart className="mx-auto h-8 w-8 text-neutral-300 mb-2" />
                <p>No hay procesos con riesgos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRENDS VIEW */}
      {viewMode === 'trends' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-semibold text-neutral-900 mb-4">Tendencias de Riesgos</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-3">Evolución Mensual</h3>
              <div className="h-48 flex items-end gap-2">
                {(stats?.trends ?? []).map((trend: any) => (
                  <div key={trend.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 h-32 items-end">
                      <div className="flex-1 bg-brand-200 rounded-t" style={{height: `${(trend.identified / 8) * 100}%`}} title={`Identificados: ${trend.identified}`} />
                      <div className="flex-1 bg-green-300 rounded-t" style={{height: `${(trend.closed / 8) * 100}%`}} title={`Cerrados: ${trend.closed}`} />
                      <div className="flex-1 bg-red-300 rounded-t" style={{height: `${(trend.critical / 8) * 100}%`}} title={`Críticos: ${trend.critical}`} />
                    </div>
                    <span className="text-[10px] text-neutral-500">{trend.month}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-200 rounded"></span> Identificados</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-300 rounded"></span> Cerrados</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-300 rounded"></span> Críticos</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-neutral-200">
              <div className="bg-neutral-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-neutral-700">Tasa de cierre</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900 mt-1">67%</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-neutral-700">Tiempo promedio</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900 mt-1">45 días</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-neutral-700">Efectividad</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900 mt-1">85%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and List */}
      {viewMode !== 'trends' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Buscar riesgos..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 outline-none" 
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-3 border-brand-200 border-t-brand-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-white p-8 text-center">
              <Shield className="mx-auto h-10 w-10 text-neutral-300" />
              <h3 className="mt-3 text-base font-medium text-neutral-900">{risks.length === 0 ? 'Sin riesgos' : 'Sin resultados'}</h3>
              <p className="mt-1 text-sm text-neutral-500">{risks.length === 0 ? 'Creá el primer riesgo.' : 'Probá otros filtros.'}</p>
              {risks.length === 0 && <button onClick={() => setShowCreate(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"><Plus className="h-4 w-4" /> Nuevo riesgo</button>}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.slice(0, 10).map(risk => {
                const st = STATUS_CONFIG[risk.status] ?? STATUS_CONFIG.IDENTIFIED;
                const inherentLevel = (risk.inherentProbability || risk.probability) * (risk.inherentImpact || risk.impact);
                return (
                  <div key={risk.id} onClick={() => router.push(`/riesgos/${risk.id}`)} className="rounded-lg border border-neutral-200 bg-white p-3 hover:border-neutral-300 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 rounded-md p-1.5 ${getRiskColor(risk.riskLevel)}`}>
                        <span className="text-[10px] font-bold">{risk.riskLevel}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded">{risk.code}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${getRiskColor(risk.riskLevel)}`}>{getRiskLabel(risk.riskLevel)}</span>
                          <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                          <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded">{risk.category}</span>
                          {risk.process && <span className="text-[10px] text-brand-600 bg-brand-50 px-1 py-0.5 rounded">{risk.process}</span>}
                        </div>
                        <h3 className="mt-0.5 font-medium text-sm text-neutral-900 truncate">{risk.title}</h3>
                        <p className="text-xs text-neutral-500 line-clamp-1">{risk.description}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-400">
                          <span className="flex items-center gap-1">
                            Inh: {inherentLevel} 
                            {inherentLevel > risk.riskLevel ? <ArrowDown className="h-3 w-3 text-green-500" /> : <Minus className="h-3 w-3" />}
                            Res: {risk.riskLevel}
                          </span>
                          {risk.treatmentPlan && <span className="text-green-600">Con plan</span>}
                          {risk.standard && <span>{risk.standard}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length > 10 && (
                <p className="text-center text-xs text-neutral-400 py-2">
                  Mostrando 10 de {filtered.length} riesgos. Usá los filtros.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
