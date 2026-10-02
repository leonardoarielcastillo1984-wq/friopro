'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Shield, AlertTriangle, Users, Calendar, Clock, CheckCircle, XCircle,
  ArrowLeft, Edit, Trash2, FileText, MapPin, Target, Activity,
  BarChart3, Save, X, ChevronDown, Building, Phone, Radio, Megaphone,
  TrendingUp, TrendingDown
} from 'lucide-react';

interface ContingencyPlan {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  status: 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'ARCHIVED';
  coverage: {
    areas: string[];
    departments: string[];
    criticalProcesses: string[];
  };
  scenarios: string[];
  procedures: string[];
  resources: {
    personnel: string[];
    equipment: string[];
    facilities: string[];
    externalResources: string[];
  };
  communication: {
    internalContacts: string[];
    externalContacts: string[];
    communicationChannels: string[];
  };
  activation: {
    triggerConditions: string[];
    activationLevels: string[];
    decisionMaker: string;
  };
  recovery: {
    rto: string;
    rpo: string;
    prioritySystems: string[];
    recoverySteps: string[];
  };
  testing: {
    lastTestDate: string | null;
    testFrequency: string;
    testResults: string | null;
    nextTestDate: string | null;
  };
  // IATF 6.1.2.3
  lastTestedAt?: string | null;
  testResult?: string | null;
  testNotes?: string | null;
  customerNotificationRequired?: boolean;
  customerNotificationContact?: string | null;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export default function ContingencyPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [plan, setPlan] = useState<ContingencyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState<Partial<ContingencyPlan>>({});
  // IATF 6.1.2.3 — prueba de eficacia
  const [showTestModal, setShowTestModal] = useState(false);
  const [testForm, setTestForm] = useState({ testResult: 'EFFECTIVE', testNotes: '', lastTestedAt: new Date().toISOString().slice(0, 10) });
  const [testSaving, setTestSaving] = useState(false);

  const handleRegisterTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestSaving(true);
    try {
      const res = await apiFetch(`/emergency/contingency-plans/${planId}/test`, {
        method: 'POST',
        json: testForm,
      }) as any;
      if (res?.plan) {
        setPlan((prev) => prev ? { ...prev, ...res.plan } : prev);
        setEditedPlan((prev) => ({ ...prev, ...res.plan }));
        setShowTestModal(false);
        setTestForm({ testResult: 'EFFECTIVE', testNotes: '', lastTestedAt: new Date().toISOString().slice(0, 10) });
      }
    } catch {
      alert('Error al registrar la prueba');
    } finally {
      setTestSaving(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, [planId]);

  const loadPlan = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/emergency/contingency-plans/${planId}`) as any;
      if (response.plan) {
        setPlan(response.plan);
        setEditedPlan(response.plan);
      } else {
        setError('Plan no encontrado');
      }
    } catch (err) {
      setError('Error al cargar el plan');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/emergency/contingency-plans/${planId}`, {
        method: 'PUT',
        json: editedPlan
      }) as any;

      if (response.success) {
        setPlan(response.plan);
        setIsEditing(false);
      }
    } catch (err) {
      alert('Error al guardar el plan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Está seguro de que desea eliminar este plan?')) return;

    try {
      await apiFetch(`/emergency/contingency-plans/${planId}`, {
        method: 'DELETE'
      });
      router.push('/simulacros?tab=plans');
    } catch (err) {
      alert('Error al eliminar el plan');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'text-gray-600 bg-gray-50';
      case 'ACTIVE': return 'text-green-600 bg-green-50';
      case 'UNDER_REVIEW': return 'text-yellow-600 bg-yellow-50';
      case 'ARCHIVED': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Borrador';
      case 'ACTIVE': return 'Activo';
      case 'UNDER_REVIEW': return 'En Revisión';
      case 'ARCHIVED': return 'Archivado';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'EMERGENCY_RESPONSE': return 'Respuesta a Emergencias';
      case 'BUSINESS_CONTINUITY': return 'Continuidad del Negocio';
      case 'DISASTER_RECOVERY': return 'Recuperación ante Desastres';
      case 'CRISIS_MANAGEMENT': return 'Gestión de Crisis';
      case 'COMMUNICATION': return 'Comunicación';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Plan no encontrado'}</h1>
        <Link href="/simulacros?tab=plans" className="text-blue-600 hover:text-blue-700">
          Volver a Planes de Contingencia
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/simulacros?tab=plans"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editedPlan.name || ''}
                  onChange={(e) => setEditedPlan({ ...editedPlan, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-2xl font-bold"
                  placeholder="Nombre del plan"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={editedPlan.type || plan.type}
                    onChange={(e) => setEditedPlan({ ...editedPlan, type: e.target.value })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-100 text-blue-700"
                  >
                    <option value="EMERGENCY_RESPONSE">Respuesta a Emergencias</option>
                    <option value="BUSINESS_CONTINUITY">Continuidad del Negocio</option>
                    <option value="DISASTER_RECOVERY">Recuperación ante Desastres</option>
                    <option value="CRISIS_MANAGEMENT">Gestión de Crisis</option>
                    <option value="COMMUNICATION">Comunicación</option>
                  </select>
                  <select
                    value={editedPlan.status || plan.status}
                    onChange={(e) => setEditedPlan({ ...editedPlan, status: e.target.value as ContingencyPlan['status'] })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DRAFT">Borrador</option>
                    <option value="ACTIVE">Activo</option>
                    <option value="UNDER_REVIEW">En Revisión</option>
                    <option value="ARCHIVED">Archivado</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(plan.status)}`}>
                    {getStatusLabel(plan.status)}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {getTypeLabel(plan.type)}
                  </span>
                  <span className="text-sm text-gray-500">Versión {plan.version}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Descripción</h2>
            {isEditing ? (
              <textarea
                value={editedPlan.description || ''}
                onChange={(e) => setEditedPlan({ ...editedPlan, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            ) : (
              <p className="text-gray-700">{plan.description || 'Sin descripción'}</p>
            )}
          </div>

          {/* Coverage */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Cobertura
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Áreas</h3>
                {isEditing ? (
                  <textarea
                    value={editedPlan.coverage?.areas?.join('\n') || ''}
                    onChange={(e) => setEditedPlan({
                      ...editedPlan,
                      coverage: { ...editedPlan.coverage, areas: e.target.value.split('\n').filter(a => a.trim()) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={3}
                    placeholder="Un área por línea"
                  />
                ) : (
                  <ul className="text-sm text-gray-600 space-y-1">
                    {plan.coverage?.areas?.map((area, i) => (
                      <li key={i}>{area}</li>
                    )) || <li>No especificado</li>}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Departamentos</h3>
                {isEditing ? (
                  <textarea
                    value={editedPlan.coverage?.departments?.join('\n') || ''}
                    onChange={(e) => setEditedPlan({
                      ...editedPlan,
                      coverage: { ...editedPlan.coverage, departments: e.target.value.split('\n').filter(d => d.trim()) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={3}
                    placeholder="Un departamento por línea"
                  />
                ) : (
                  <ul className="text-sm text-gray-600 space-y-1">
                    {plan.coverage?.departments?.map((dept, i) => (
                      <li key={i}>{dept}</li>
                    )) || <li>No especificado</li>}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Procesos Críticos</h3>
                {isEditing ? (
                  <textarea
                    value={editedPlan.coverage?.criticalProcesses?.join('\n') || ''}
                    onChange={(e) => setEditedPlan({
                      ...editedPlan,
                      coverage: { ...editedPlan.coverage, criticalProcesses: e.target.value.split('\n').filter(p => p.trim()) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={3}
                    placeholder="Un proceso por línea"
                  />
                ) : (
                  <ul className="text-sm text-gray-600 space-y-1">
                    {plan.coverage?.criticalProcesses?.map((proc, i) => (
                      <li key={i}>{proc}</li>
                    )) || <li>No especificado</li>}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Recovery */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recuperación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RTO (Tiempo de Recuperación)</label>
                    <input
                      type="text"
                      value={editedPlan.recovery?.rto || ''}
                      onChange={(e) => setEditedPlan({
                        ...editedPlan,
                        recovery: { ...editedPlan.recovery, rto: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: 4 horas"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RPO (Punto de Recuperación)</label>
                    <input
                      type="text"
                      value={editedPlan.recovery?.rpo || ''}
                      onChange={(e) => setEditedPlan({
                        ...editedPlan,
                        recovery: { ...editedPlan.recovery, rpo: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: 1 hora"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">RTO (Tiempo de Recuperación)</div>
                    <div className="text-lg font-semibold text-gray-900">{plan.recovery?.rto || 'No definido'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">RPO (Punto de Recuperación)</div>
                    <div className="text-lg font-semibold text-gray-900">{plan.recovery?.rpo || 'No definido'}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Categoría</span>
                <span className="font-medium text-gray-900">{plan.category || 'No especificado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Versión</span>
                <span className="font-medium text-gray-900">{plan.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Creado</span>
                <span className="font-medium text-gray-900">{new Date(plan.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Actualizado</span>
                <span className="font-medium text-gray-900">{new Date(plan.updatedAt).toLocaleDateString('es-AR')}</span>
              </div>
            </div>
          </div>

          {/* Testing — IATF 6.1.2.3 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Pruebas <span className="text-xs font-normal text-gray-400">IATF 6.1.2.3</span>
              </h2>
              {!isEditing && plan.status === 'ACTIVE' && (
                <button
                  onClick={() => setShowTestModal(true)}
                  className="text-xs px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium"
                >
                  Registrar prueba
                </button>
              )}
            </div>

            {/* Resultado de última prueba IATF */}
            {plan.lastTestedAt && (
              <div className={`mb-3 rounded-lg p-3 text-sm border ${
                plan.testResult === 'EFFECTIVE' ? 'bg-green-50 border-green-200' :
                plan.testResult === 'PARTIAL' ? 'bg-amber-50 border-amber-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {plan.testResult === 'EFFECTIVE' ? '✓ Eficaz' : plan.testResult === 'PARTIAL' ? 'Parcialmente eficaz' : 'Ineficaz'}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(plan.lastTestedAt).toLocaleDateString('es-AR')}</span>
                </div>
                {plan.testNotes && <p className="text-xs text-gray-600 mt-1">{plan.testNotes}</p>}
              </div>
            )}

            {/* Notificación al cliente */}
            <div className="mb-3 text-sm">
              {isEditing ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={editedPlan.customerNotificationRequired ?? false}
                      onChange={(e) => setEditedPlan({ ...editedPlan, customerNotificationRequired: e.target.checked })}
                    />
                    Requiere notificación al cliente
                  </label>
                  {(editedPlan.customerNotificationRequired) && (
                    <input
                      type="text"
                      value={editedPlan.customerNotificationContact || ''}
                      onChange={(e) => setEditedPlan({ ...editedPlan, customerNotificationContact: e.target.value })}
                      placeholder="Contacto del cliente a notificar"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  )}
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-gray-500">Notif. al cliente</span>
                  <span className="font-medium text-gray-900">
                    {plan.customerNotificationRequired ? `Sí${plan.customerNotificationContact ? ` — ${plan.customerNotificationContact}` : ''}` : 'No'}
                  </span>
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                  <select
                    value={editedPlan.testing?.testFrequency || 'Anual'}
                    onChange={(e) => setEditedPlan({
                      ...editedPlan,
                      testing: { ...editedPlan.testing, testFrequency: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                    <option value="Bianual">Bianual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Última prueba</label>
                  <input
                    type="date"
                    value={editedPlan.testing?.lastTestDate ? editedPlan.testing.lastTestDate.split('T')[0] : ''}
                    onChange={(e) => setEditedPlan({
                      ...editedPlan,
                      testing: { ...editedPlan.testing, lastTestDate: e.target.value ? new Date(e.target.value).toISOString() : null }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Próxima prueba</label>
                  <input
                    type="date"
                    value={editedPlan.testing?.nextTestDate ? editedPlan.testing.nextTestDate.split('T')[0] : ''}
                    onChange={(e) => setEditedPlan({
                      ...editedPlan,
                      testing: { ...editedPlan.testing, nextTestDate: e.target.value ? new Date(e.target.value).toISOString() : null }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Frecuencia</span>
                  <span className="font-medium text-gray-900">{plan.testing?.testFrequency || 'No definida'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Última prueba</span>
                  <span className="font-medium text-gray-900">
                    {plan.testing?.lastTestDate ? new Date(plan.testing.lastTestDate).toLocaleDateString('es-AR') : 'Nunca'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Próxima prueba</span>
                  <span className="font-medium text-gray-900">
                    {plan.testing?.nextTestDate ? new Date(plan.testing.nextTestDate).toLocaleDateString('es-AR') : 'No programada'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal registrar prueba — IATF 6.1.2.3 */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Registrar prueba de eficacia</h2>
              <button onClick={() => setShowTestModal(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegisterTest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de la prueba *</label>
                <input
                  type="date" required
                  value={testForm.lastTestedAt}
                  onChange={(e) => setTestForm({ ...testForm, lastTestedAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resultado *</label>
                <select
                  value={testForm.testResult}
                  onChange={(e) => setTestForm({ ...testForm, testResult: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="EFFECTIVE">Eficaz</option>
                  <option value="PARTIAL">Parcialmente eficaz</option>
                  <option value="INEFFECTIVE">Ineficaz</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  rows={3}
                  value={testForm.testNotes}
                  onChange={(e) => setTestForm({ ...testForm, testNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Ej: simulacro de corte de suministro eléctrico, tiempo real de respuesta 12min..."
                />
              </div>
              {testForm.testResult !== 'EFFECTIVE' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Un resultado no eficaz debe derivar en revisión del plan y acciones correctivas.
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTestModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={testSaving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {testSaving ? 'Guardando…' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
