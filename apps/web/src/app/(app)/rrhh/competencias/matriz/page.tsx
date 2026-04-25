'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Download, Edit3, Save, X,
  AlertTriangle, BookOpen, GraduationCap, Plus, Target, Zap,
  ArrowRight, Clock, CalendarDays, Users
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ─── Types ───
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  positionId?: string;
  departmentId?: string;
  department?: { name: string } | null;
  position?: { name: string } | null;
}

interface Competency {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

interface PositionCompetency {
  id: string;
  positionId: string;
  competencyId: string;
  requiredLevel: number;
}

interface EmployeeCompetency {
  id: string;
  employeeId: string;
  competencyId: string;
  currentLevel: number;
}

interface MatrixData {
  employees: Employee[];
  competencies: Competency[];
  positionCompetencies: PositionCompetency[];
  employeeCompetencies: EmployeeCompetency[];
}

interface Gap {
  employeeId: string;
  employeeName: string;
  positionName: string;
  competencyId: string;
  competencyName: string;
  requiredLevel: number;
  actualLevel: number;
  gapLevels: number;
}

// ─── Color helpers ───
const getLevelColor = (level: number): string => {
  switch (level) {
    case 1: return 'bg-red-50 border-red-200 text-red-700';
    case 2: return 'bg-orange-50 border-orange-200 text-orange-700';
    case 3: return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    case 4: return 'bg-green-50 border-green-200 text-green-700';
    default: return 'bg-gray-50 border-gray-200 text-gray-700';
  }
};

const getLevelLabel = (level: number): string => {
  switch (level) {
    case 1: return 'Inicial';
    case 2: return 'Básico';
    case 3: return 'Competente';
    case 4: return 'Experto';
    default: return '-';
  }
};

const getProgressColor = (pct: number): string => {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 70) return 'text-yellow-600';
  if (pct >= 50) return 'text-orange-600';
  return 'text-red-600';
};

const getProgressRingColor = (pct: number): string => {
  if (pct >= 90) return 'stroke-green-500';
  if (pct >= 70) return 'stroke-yellow-500';
  if (pct >= 50) return 'stroke-orange-500';
  return 'stroke-red-500';
};

const getPriorityLabel = (pct: number): string => {
  if (pct >= 90) return 'Muy Alto';
  if (pct >= 70) return 'Alto';
  if (pct >= 50) return 'Medio';
  return 'Bajo';
};

// ─── Circular progress SVG ───
function CircularProgress({ value, size = 44, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className={getProgressRingColor(pct)}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`absolute text-xs font-bold ${getProgressColor(pct)}`}>{Math.round(pct)}%</span>
    </div>
  );
}

// ─── Page ───
export default function MatrizPolivalenciaPage() {
  const router = useRouter();
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);

  // Filters
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [posFilter, setPosFilter] = useState<string>('all');
  const [compFilter, setCompFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'competencias'>('competencias');

  // Gap intelligence state
  const [showGapModal, setShowGapModal] = useState(false);
  const [selectedGap, setSelectedGap] = useState<Gap | null>(null);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [creatingTraining, setCreatingTraining] = useState(false);
  const [trainingForm, setTrainingForm] = useState({
    title: '',
    description: '',
    category: 'Competencias',
    modality: 'PRESENCIAL',
    durationHours: '4',
    scheduledDate: '',
    instructor: '',
    location: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = (await apiFetch('/hr/competencies/matrix')) as MatrixData;
      setData(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar la matriz');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived: filtered employees
  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    return data.employees.filter((emp) => {
      if (deptFilter !== 'all' && emp.departmentId !== deptFilter) return false;
      if (posFilter !== 'all' && emp.positionId !== posFilter) return false;
      return true;
    });
  }, [data, deptFilter, posFilter]);

  // Derived: filtered competencies
  const filteredCompetencies = useMemo(() => {
    if (!data) return [];
    if (compFilter === 'all') return data.competencies;
    return data.competencies.filter((c) => c.id === compFilter);
  }, [data, compFilter]);

  // Unique departments and positions for filters
  const departments = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    data.employees.forEach((e) => {
      if (e.departmentId && e.department?.name) map.set(e.departmentId, e.department.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const positions = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    data.employees.forEach((e) => {
      if (e.positionId && e.position?.name) map.set(e.positionId, e.position.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  // Cell value getters
  const getRequired = (emp: Employee, compId: string): number => {
    if (!data || !emp.positionId) return 0;
    const pc = data.positionCompetencies.find(
      (p) => p.positionId === emp.positionId && p.competencyId === compId
    );
    return pc?.requiredLevel || 0;
  };

  const getActual = (emp: Employee, compId: string): number => {
    if (!data) return 0;
    const ec = data.employeeCompetencies.find(
      (e) => e.employeeId === emp.id && e.competencyId === compId
    );
    return ec?.currentLevel || 0;
  };

  // Compute all gaps (ES < DEBE) for operational intelligence
  const allGaps = useMemo<Gap[]>(() => {
    if (!data) return [];
    const gaps: Gap[] = [];
    filteredEmployees.forEach((emp) => {
      filteredCompetencies.forEach((comp) => {
        const req = getRequired(emp, comp.id);
        const act = getActual(emp, comp.id);
        if (req > 0 && act < req) {
          gaps.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            positionName: emp.position?.name || '',
            competencyId: comp.id,
            competencyName: comp.name,
            requiredLevel: req,
            actualLevel: act,
            gapLevels: req - act,
          });
        }
      });
    });
    // Sort by biggest gap first
    return gaps.sort((a, b) => b.gapLevels - a.gapLevels);
  }, [data, filteredEmployees, filteredCompetencies]);

  const openGapModal = (gap: Gap) => {
    setSelectedGap(gap);
    setTrainingForm({
      title: `Capacitación: ${gap.competencyName}`,
      description: `Brecha detectada en ${gap.competencyName}. Nivel requerido: ${gap.requiredLevel} (${getLevelLabel(gap.requiredLevel)}), Nivel actual: ${gap.actualLevel} (${getLevelLabel(gap.actualLevel)}).`,
      category: 'Competencias',
      modality: 'PRESENCIAL',
      durationHours: String(gap.gapLevels * 4),
      scheduledDate: '',
      instructor: '',
      location: '',
    });
    setShowGapModal(true);
  };

  const handleCreateTraining = async () => {
    if (!selectedGap || !trainingForm.title) return;
    setCreatingTraining(true);
    try {
      const res = await apiFetch('/trainings', {
        method: 'POST',
        json: {
          title: trainingForm.title,
          description: trainingForm.description || undefined,
          category: trainingForm.category,
          modality: trainingForm.modality,
          durationHours: parseFloat(trainingForm.durationHours) || 4,
          scheduledDate: trainingForm.scheduledDate ? new Date(trainingForm.scheduledDate).toISOString() : undefined,
          instructor: trainingForm.instructor || undefined,
          location: trainingForm.location || undefined,
          expectedParticipants: 1,
        },
      });
      // Add attendee
      const trainingRes = res as any;
      if (trainingRes?.training?.id) {
        await apiFetch(`/trainings/${trainingRes.training.id}/attendees`, {
          method: 'POST',
          json: { employeeIds: [selectedGap.employeeId] },
        });
      }
      setShowTrainingModal(false);
      setShowGapModal(false);
      setSelectedGap(null);
      alert('Solicitud de capacitación creada y empleado vinculado exitosamente');
    } catch (e: any) {
      alert(e?.message || 'Error al crear capacitación');
    } finally {
      setCreatingTraining(false);
    }
  };

  // Update actual level
  const updateActual = async (employeeId: string, competencyId: string, newLevel: number) => {
    const key = `${employeeId}-${competencyId}`;
    try {
      setSaving((prev) => ({ ...prev, [key]: true }));
      await apiFetch('/hr/employee-competencies', {
        method: 'POST',
        json: { employeeId, competencyId, currentLevel: newLevel },
      });
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.employeeCompetencies.find(
          (e) => e.employeeId === employeeId && e.competencyId === competencyId
        );
        let next = [...prev.employeeCompetencies];
        if (exists) {
          next = next.map((e) =>
            e.employeeId === employeeId && e.competencyId === competencyId
              ? { ...e, currentLevel: newLevel }
              : e
          );
        } else {
          next.push({ id: 'temp', employeeId, competencyId, currentLevel: newLevel });
        }
        return { ...prev, employeeCompetencies: next };
      });
    } catch (e: any) {
      alert(e?.message || 'Error al guardar');
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Update required level (position-competency)
  const updateRequired = async (positionId: string, competencyId: string, newLevel: number) => {
    const key = `req-${positionId}-${competencyId}`;
    try {
      setSaving((prev) => ({ ...prev, [key]: true }));
      await apiFetch('/hr/position-competencies', {
        method: 'POST',
        json: { positionId, competencyId, requiredLevel: newLevel },
      });
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.positionCompetencies.find(
          (p) => p.positionId === positionId && p.competencyId === competencyId
        );
        let next = [...prev.positionCompetencies];
        if (exists) {
          next = next.map((p) =>
            p.positionId === positionId && p.competencyId === competencyId
              ? { ...p, requiredLevel: newLevel }
              : p
          );
        } else {
          next.push({ id: 'temp', positionId, competencyId, requiredLevel: newLevel });
        }
        return { ...prev, positionCompetencies: next };
      });
    } catch (e: any) {
      alert(e?.message || 'Error al guardar');
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Export to CSV (Excel-compatible)
  const exportCSV = () => {
    if (!data) return;
    const comps = filteredCompetencies;
    const emps = filteredEmployees;
    let csv = 'Persona,Posición,Tipo,' + comps.map((c) => c.name).join(',') + ',Cumplimiento\n';
    emps.forEach((emp) => {
      const fullName = `${emp.firstName} ${emp.lastName}`;
      const posName = emp.position?.name || '';
      const debeVals = comps.map((c) => getRequired(emp, c.id)).join(',');
      const esVals = comps.map((c) => getActual(emp, c.id)).join(',');
      const total = comps.reduce((sum, c) => {
        const req = getRequired(emp, c.id);
        const act = getActual(emp, c.id);
        return sum + (req > 0 ? (act / req) * 100 : 0);
      }, 0);
      const avg = comps.length ? total / comps.length : 0;
      csv += `"${fullName}","${posName}",DEBE,${debeVals},\n`;
      csv += `"","",ES,${esVals},${Math.round(avg)}%\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matriz-polivalencia.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-md">{error}</div>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-primary text-white rounded-md">Reintentar</button>
      </div>
    );
  }

  if (!data || !data.employees.length || !data.competencies.length) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 text-amber-700 p-4 rounded-md">No hay datos suficientes para mostrar la matriz. Cargue empleados y competencias primero.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/rrhh/competencias')} className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a RRHH
          </button>
          <h1 className="text-2xl font-bold">Matriz de Polivalencia por Departamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Comparación entre el nivel de competencia requerido (Debe) y el nivel actual (Es)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium ${
              editMode ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {editMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {editMode ? 'Guardar cambios' : 'Editar Evaluaciones'}
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Departamento</label>
          <select
            className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Puesto</label>
          <select
            className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Vista</label>
          <select
            className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
          >
            <option value="competencias">Competencias</option>
            <option value="all">Todas</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Nivel requerido</label>
          <select className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm" disabled>
            <option>Todos</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Nivel actual</label>
          <select className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm" disabled>
            <option>Todos</option>
          </select>
        </div>
      </div>

      {/* Gap Intelligence Panel */}
      {allGaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-amber-800">
                Inteligencia Operativa — Brechas Detectadas
              </h3>
              <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {allGaps.length} brecha{allGaps.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {allGaps.slice(0, 5).map((gap, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                onClick={() => openGapModal(gap)}
              >
                <div className="flex items-center gap-3">
                  <Target className="w-4 h-4 text-amber-500" />
                  <div>
                    <span className="font-medium text-sm text-gray-800">{gap.employeeName}</span>
                    <span className="text-xs text-gray-500 ml-2">({gap.positionName})</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold text-red-600">{gap.competencyName}</span>
                    <span className="mx-1">—</span>
                    DEBE {gap.requiredLevel} vs ES {gap.actualLevel}
                  </span>
                </div>
                <button className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-md font-medium hover:bg-amber-200 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Acción sugerida
                </button>
              </div>
            ))}
            {allGaps.length > 5 && (
              <div className="text-center text-xs text-amber-600 py-1">
                + {allGaps.length - 5} brechas más…
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500 font-medium">Niveles:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400" /> 1 Inicial</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400" /> 2 Básico</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400" /> 3 Competente</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> 4 Experto</span>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[200px]">Persona</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[80px]">Tipo</th>
              {filteredCompetencies.map((c) => (
                <th key={c.id} className="text-center px-3 py-3 font-semibold text-gray-700 min-w-[120px]">
                  <div className="text-xs">{c.name}</div>
                  <div className="text-[10px] text-gray-400 font-normal">(Debe)</div>
                </th>
              ))}
              <th className="text-center px-4 py-3 font-semibold text-gray-700 sticky right-0 bg-gray-50 z-10 min-w-[120px]">Promedio Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => {
              const deptName = emp.department?.name || '';
              const posName = emp.position?.name || '';
              const fullName = `${emp.firstName} ${emp.lastName}`;

              // Calculate averages per employee
              const rowValues = filteredCompetencies.map((c) => {
                const req = getRequired(emp, c.id);
                const act = getActual(emp, c.id);
                return { req, act, compId: c.id };
              });
              const totalPct = rowValues.reduce((sum, v) => sum + (v.req > 0 ? (v.act / v.req) * 100 : 0), 0);
              const avgPct = rowValues.length ? totalPct / rowValues.length : 0;

              return (
                <React.Fragment key={emp.id}>
                  {/* DEBE row */}
                  <tr className="border-b border-gray-100 bg-white">
                    <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-100" rowSpan={2}>
                      <div className="font-medium text-gray-900">{fullName}</div>
                      <div className="text-xs text-gray-500">{posName}</div>
                      <div className="text-xs text-gray-400">{deptName}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-blue-700 bg-blue-50/50">DEBE</td>
                    {rowValues.map(({ req, compId }) => (
                      <td key={`debe-${compId}`} className="px-2 py-2 text-center">
                        {editMode ? (
                          <select
                            className="h-8 w-16 text-center rounded border border-gray-300 text-sm"
                            value={req || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!emp.positionId) {
                                alert('El empleado no tiene un puesto asignado. Asigne un puesto primero en RRHH > Empleados.');
                                return;
                              }
                              updateRequired(emp.positionId, compId, val);
                            }}
                          >
                            <option value="">-</option>
                            {[1, 2, 3, 4].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm font-semibold ${getLevelColor(req)}`}>
                            {req || '-'}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center sticky right-0 bg-white z-10 border-l border-gray-100" rowSpan={2}>
                      <div className="flex flex-col items-center gap-1">
                        <CircularProgress value={avgPct} />
                        <span className={`text-xs font-medium ${getProgressColor(avgPct)}`}>{getPriorityLabel(avgPct)}</span>
                      </div>
                    </td>
                  </tr>
                  {/* ES row */}
                  <tr className="border-b border-gray-200 bg-gray-50/30">
                    <td className="px-4 py-3 font-medium text-green-700 bg-green-50/50">ES</td>
                    {rowValues.map(({ req, act, compId }) => {
                      const gap = req > 0 && act < req;
                      return (
                        <td key={`es-${compId}`} className={`px-2 py-2 text-center ${gap ? 'bg-red-50/60' : ''}`}>
                          {editMode ? (
                            <select
                              className="h-8 w-16 text-center rounded border border-gray-300 text-sm"
                              value={act || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                updateActual(emp.id, compId, val);
                              }}
                            >
                              <option value="">-</option>
                              {[1, 2, 3, 4].map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => {
                                if (gap) {
                                  const comp = data?.competencies.find((c) => c.id === compId);
                                  if (comp) {
                                    openGapModal({
                                      employeeId: emp.id,
                                      employeeName: `${emp.firstName} ${emp.lastName}`,
                                      positionName: emp.position?.name || '',
                                      competencyId: compId,
                                      competencyName: comp.name,
                                      requiredLevel: req,
                                      actualLevel: act,
                                      gapLevels: req - act,
                                    });
                                  }
                                }
                              }}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm font-semibold ${getLevelColor(act)} ${gap ? 'ring-2 ring-red-400 ring-offset-1 cursor-pointer hover:scale-110 transition-transform' : ''}`}
                              title={gap ? 'Click para ver brecha y acción sugerida' : getLevelLabel(act)}
                            >
                              {act || '-'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
          {/* Department averages footer */}
          <tfoot>
            <tr className="bg-gray-100 border-t border-gray-300">
              <td className="px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-100 z-10" colSpan={2}>
                Promedio del Departamento<br />
                <span className="text-xs font-normal text-gray-500">(Cumplimiento)</span>
              </td>
              {filteredCompetencies.map((c) => {
                const vals = filteredEmployees.map((e) => {
                  const req = getRequired(e, c.id);
                  const act = getActual(e, c.id);
                  return req > 0 ? (act / req) * 100 : 0;
                }).filter((v) => v > 0);
                const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                return (
                  <td key={`foot-${c.id}`} className="px-2 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <CircularProgress value={avg} size={36} stroke={3} />
                      <span className={`text-xs font-medium ${getProgressColor(avg)}`}>{getPriorityLabel(avg)}</span>
                    </div>
                  </td>
                );
              })}
              <td className="px-4 py-3 sticky right-0 bg-gray-100 z-10 border-l border-gray-300" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bottom info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-blue-50 p-3 rounded-md">
          <div className="font-medium text-blue-800 mb-1">Escala de evaluación</div>
          <div className="flex gap-3 text-xs text-blue-700">
            <span>1: Inicial</span>
            <span>2: Básico</span>
            <span>3: Competente</span>
            <span>4: Experto</span>
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-md">
          <div className="font-medium text-gray-800 mb-1">Cálculo de cumplimiento</div>
          <div className="text-xs text-gray-600">(Nivel ES / Nivel DEBE) x 100</div>
        </div>
        <div className="bg-amber-50 p-3 rounded-md">
          <div className="font-medium text-amber-800 mb-1">Consejo</div>
          <div className="text-xs text-amber-700">Haz clic en los valores marcados con brecha para ver la acción sugerida y crear capacitaciones.</div>
        </div>
      </div>

      {/* ─── Gap Detail Modal ─── */}
      {showGapModal && selectedGap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                  <h2 className="text-xl font-bold text-gray-900">Brecha Detectada</h2>
                </div>
                <button
                  onClick={() => { setShowGapModal(false); setSelectedGap(null); }}
                  className="p-1 hover:bg-gray-100 rounded-md"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">{selectedGap.employeeName}</span>
                    <span className="text-sm text-gray-500">({selectedGap.positionName})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Competencia:</span>
                    <span className="font-medium text-gray-900">{selectedGap.competencyName}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">DEBE</span>
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-bold ${getLevelColor(selectedGap.requiredLevel)}`}>
                        {selectedGap.requiredLevel}
                      </span>
                      <span className="text-xs text-gray-500">({getLevelLabel(selectedGap.requiredLevel)})</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">ES</span>
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-bold ${getLevelColor(selectedGap.actualLevel)}`}>
                        {selectedGap.actualLevel}
                      </span>
                      <span className="text-xs text-gray-500">({getLevelLabel(selectedGap.actualLevel)})</span>
                    </div>
                    <div className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md">
                      Brecha: {selectedGap.gapLevels} nivel{selectedGap.gapLevels > 1 ? 'es' : ''}
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-800">Acción sugerida</h3>
                  </div>
                  <p className="text-sm text-amber-700">
                    Programar capacitación en <strong>{selectedGap.competencyName}</strong> para elevar el nivel desde {getLevelLabel(selectedGap.actualLevel)} ({selectedGap.actualLevel}) hasta {getLevelLabel(selectedGap.requiredLevel)} ({selectedGap.requiredLevel}).
                  </p>
                  <p className="text-sm text-amber-600 mt-1">
                    Duración estimada: <strong>{selectedGap.gapLevels * 4} horas</strong>
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowTrainingModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <GraduationCap className="w-4 h-4" />
                    Crear Solicitud de Capacitación
                  </button>
                  <button
                    onClick={() => { setShowGapModal(false); setSelectedGap(null); }}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Training Creation Modal ─── */}
      {showTrainingModal && selectedGap && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-gray-900">Nueva Solicitud de Capacitación</h2>
                </div>
                <button
                  onClick={() => setShowTrainingModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-md"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={trainingForm.title}
                    onChange={(e) => setTrainingForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm h-20"
                    value={trainingForm.description}
                    onChange={(e) => setTrainingForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={trainingForm.modality}
                      onChange={(e) => setTrainingForm((f) => ({ ...f, modality: e.target.value }))}
                    >
                      <option value="PRESENCIAL">Presencial</option>
                      <option value="VIRTUAL">Virtual</option>
                      <option value="MIXTA">Mixta</option>
                      <option value="E_LEARNING">E-Learning</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (hs)</label>
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={trainingForm.durationHours}
                      onChange={(e) => setTrainingForm((f) => ({ ...f, durationHours: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Nombre del instructor"
                    value={trainingForm.instructor}
                    onChange={(e) => setTrainingForm((f) => ({ ...f, instructor: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Sala, sede o link virtual"
                    value={trainingForm.location}
                    onChange={(e) => setTrainingForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha programada</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={trainingForm.scheduledDate}
                    onChange={(e) => setTrainingForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                  />
                </div>

                <div className="bg-gray-50 rounded-md p-3 text-sm">
                  <div className="font-medium text-gray-700 mb-1">Participante vinculado</div>
                  <div className="text-gray-600">{selectedGap.employeeName} — {selectedGap.positionName}</div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCreateTraining}
                    disabled={creatingTraining}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                  >
                    {creatingTraining ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {creatingTraining ? 'Creando...' : 'Crear Solicitud'}
                  </button>
                  <button
                    onClick={() => setShowTrainingModal(false)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
