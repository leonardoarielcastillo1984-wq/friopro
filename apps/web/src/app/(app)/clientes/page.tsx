'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  Users, TrendingUp, Clock, CheckCircle2,
  AlertTriangle, BarChart3, HeadphonesIcon,
  MessageSquare, Star, ArrowUpRight, ArrowDownRight,
  Plus, Filter, Search, Download, RefreshCw,
  Eye, FileText, Settings, Building2, Mail, Phone,
  MapPin, Edit2, Trash2, MoreVertical, ClipboardList,
  Send, UserPlus, X, CheckCircle, AlertCircle
} from 'lucide-react';

interface Customer {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  type: 'CLIENT' | 'SUPPLIER' | 'PARTNER' | 'PROSPECT';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  category?: string;
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPosition?: string;
  notes?: string;
  createdAt: string;
  _count?: { surveys: number };
  avgSatisfaction?: number | null;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  lastSurveyDate?: string | null;
  lastSatisfactionScore?: number | null;
}

interface Survey {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: string;
  isActive: boolean;
  isAnonymous: boolean;
  allowMultipleResponses: boolean;
  _count?: { questions: number; responses: number };
  createdAt: string;
}

interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  totalSurveys: number;
  totalResponses: number;
  avgSatisfaction: number | null;
  highRiskCount: number;
  withoutSurvey: number;
}

const DEFAULT_STATS: CustomerStats = {
  totalCustomers: 0,
  activeCustomers: 0,
  totalSurveys: 0,
  totalResponses: 0,
  avgSatisfaction: null,
  highRiskCount: 0,
  withoutSurvey: 0,
};

export default function ClientesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<CustomerStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'customers' | 'surveys'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionCustomer, setActionCustomer] = useState<Customer | null>(null);
  const [actionType, setActionType] = useState<'NC' | 'CAPA' | 'PLAN'>('NC');
  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [actionSeverity, setActionSeverity] = useState('MAJOR');
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customersRes, surveysRes, statsRes] = await Promise.all([
        apiFetch<{ customers: Customer[] }>('/customers'),
        apiFetch<{ surveys: Survey[] }>('/surveys'),
        apiFetch<{ stats: CustomerStats }>('/customers/stats').catch(() => null),
      ]);

      const customersData = customersRes?.customers || [];
      const surveysData = surveysRes?.surveys || [];

      setCustomers(customersData);
      setSurveys(surveysData);

      if (statsRes?.stats) {
        setStats(statsRes.stats);
      } else {
        const activeCustomers = customersData.filter(c => c.status === 'ACTIVE').length;
        const totalResponses = surveysData.reduce((acc, s) => acc + (s._count?.responses || 0), 0);
        const avgSatisfaction = customersData.length > 0
          ? (customersData.reduce((acc, c) => acc + (c.avgSatisfaction || 0), 0) / customersData.filter(c => c.avgSatisfaction !== null && c.avgSatisfaction !== undefined).length || null)
          : null;
        setStats({
          totalCustomers: customersData.length,
          activeCustomers,
          totalSurveys: surveysData.length,
          totalResponses,
          avgSatisfaction: avgSatisfaction !== null && !isNaN(avgSatisfaction) ? avgSatisfaction : null,
          highRiskCount: customersData.filter(c => c.riskLevel === 'HIGH').length,
          withoutSurvey: 0,
        });
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
    try {
      await apiFetch(`/customers/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      console.error('Error deleting customer:', err);
    }
  };

  const handleDeleteSurvey = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta encuesta?')) return;
    try {
      await apiFetch(`/surveys/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      console.error('Error deleting survey:', err);
    }
  };

  const openActionModal = (customer: Customer, type: 'NC' | 'CAPA' | 'PLAN' = 'NC') => {
    setActionCustomer(customer);
    setActionType(type);
    setActionTitle(type === 'NC' ? `NC - ${customer.name}` : type === 'CAPA' ? `CAPA - ${customer.name}` : `Plan de Mejora - ${customer.name}`);
    setActionDescription('');
    setActionSeverity('MAJOR');
    setShowActionModal(true);
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionCustomer) return;
    try {
      await apiFetch(`/customers/${actionCustomer.id}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          type: actionType,
          title: actionTitle,
          description: actionDescription,
          severity: actionSeverity,
        }),
      });
      setShowActionModal(false);
      alert('Acción creada exitosamente');
    } catch (err) {
      console.error('Error creating action:', err);
      alert('Error al crear la acción');
    }
  };

  const handleAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const res = await apiFetch<{ analysis: any }>('/customers/analyze', { method: 'POST' });
      setAiAnalysis(res?.analysis || null);
      setShowAiAnalysis(true);
    } catch (err) {
      console.error('Error running AI analysis:', err);
      alert('Error al ejecutar análisis');
    } finally {
      setAiLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = !searchQuery || 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || c.type === filterType;
    const matchesStatus = !filterStatus || c.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h1>
          <p className="text-gray-600 mt-1">Clientes y encuestas de satisfacción</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'customers' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Clientes
          </button>
          <button
            onClick={() => setActiveTab('surveys')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'surveys' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ClipboardList className="w-4 h-4 inline mr-2" />
            Encuestas
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={handleAiAnalysis}
          disabled={aiLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <BarChart3 className="w-4 h-4" />
          {aiLoading ? 'Analizando...' : 'Analizar con IA'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-green-600 flex items-center">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              {stats.totalCustomers > 0 ? '+12%' : 'Nuevo'}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</div>
          <div className="text-sm text-gray-600 mt-1">Total Clientes</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.activeCustomers}</div>
          <div className="text-sm text-gray-600 mt-1">Clientes Activos</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ClipboardList className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalSurveys}</div>
          <div className="text-sm text-gray-600 mt-1">Encuestas Creadas</div>
        </div>

        <div className={`rounded-xl border p-6 ${stats.highRiskCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-lg ${stats.highRiskCount > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${stats.highRiskCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
            </div>
          </div>
          <div className={`text-2xl font-bold ${stats.highRiskCount > 0 ? 'text-red-900' : 'text-gray-900'}`}>{stats.highRiskCount}</div>
          <div className={`text-sm mt-1 ${stats.highRiskCount > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>Clientes en Riesgo</div>
        </div>
      </div>

      {stats.withoutSurvey > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span className="text-amber-800 font-medium">{stats.withoutSurvey} clientes sin encuestas en los últimos 90 días</span>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'customers' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Customers Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Lista de Clientes</h2>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar clientes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los tipos</option>
                <option value="CLIENT">Cliente</option>
                <option value="SUPPLIER">Proveedor</option>
                <option value="PARTNER">Socio</option>
                <option value="PROSPECT">Prospecto</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setShowCustomerModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Nuevo Cliente
              </button>
            </div>
          </div>

          {/* Customers Table */}
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay clientes registrados</p>
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setShowCustomerModal(true);
                }}
                className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                Agregar primer cliente
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Código</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Nombre</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Contacto</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Estado</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Satisfacción</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Riesgo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Última Encuesta</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link
                          href={`/clientes/${customer.id}`}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {customer.code}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900 font-medium">{customer.name}</div>
                        {customer.legalName && (
                          <div className="text-gray-500 text-sm">{customer.legalName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-900">{customer.contactName || '-'}</div>
                        <div className="text-sm text-gray-500">{customer.contactEmail || customer.email || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          customer.type === 'CLIENT' ? 'bg-blue-100 text-blue-700' :
                          customer.type === 'SUPPLIER' ? 'bg-purple-100 text-purple-700' :
                          customer.type === 'PARTNER' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {customer.type === 'CLIENT' ? 'Cliente' :
                           customer.type === 'SUPPLIER' ? 'Proveedor' :
                           customer.type === 'PARTNER' ? 'Socio' : 'Prospecto'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          customer.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          customer.status === 'INACTIVE' ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {customer.status === 'ACTIVE' ? 'Activo' :
                           customer.status === 'INACTIVE' ? 'Inactivo' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {customer.avgSatisfaction !== null && customer.avgSatisfaction !== undefined ? (
                          <div className="flex items-center gap-1">
                            <Star className={`w-4 h-4 ${customer.avgSatisfaction >= 4 ? 'text-amber-500 fill-amber-500' : customer.avgSatisfaction >= 3 ? 'text-amber-400' : 'text-red-500'}`} />
                            <span className="text-sm font-medium text-gray-700">{customer.avgSatisfaction.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Sin datos</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {customer.riskLevel ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            customer.riskLevel === 'LOW' ? 'bg-green-100 text-green-700' :
                            customer.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {customer.riskLevel === 'LOW' ? 'Bajo' :
                             customer.riskLevel === 'MEDIUM' ? 'Medio' : 'Alto'}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {customer.lastSurveyDate ? (
                          <span className="text-sm text-gray-600">
                            {new Date(customer.lastSurveyDate).toLocaleDateString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Sin encuestas</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/clientes/${customer.id}`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => openActionModal(customer, 'NC')}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Generar NC"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openActionModal(customer, 'PLAN')}
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Plan de Mejora"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCustomer(customer);
                              setShowCustomerModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Surveys Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Encuestas de Satisfacción</h2>
            <button
              onClick={() => {
                setEditingSurvey(null);
                setShowSurveyModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva Encuesta
            </button>
          </div>

          {/* Surveys Grid */}
          {surveys.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay encuestas creadas</p>
              <button
                onClick={() => {
                  setEditingSurvey(null);
                  setShowSurveyModal(true);
                }}
                className="inline-flex items-center gap-2 mt-4 text-purple-600 hover:text-purple-700"
              >
                <Plus className="w-4 h-4" />
                Crear primera encuesta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {surveys.map((survey) => (
                <div key={survey.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs text-gray-500">{survey.code}</span>
                      <h3 className="font-semibold text-gray-900">{survey.title}</h3>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      survey.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {survey.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{survey.description || 'Sin descripción'}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span>{survey._count?.questions || 0} preguntas</span>
                    <span>{survey._count?.responses || 0} respuestas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/clientes/encuestas/${survey.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </Link>
                    <button
                      onClick={() => {
                        setEditingSurvey(survey);
                        setShowSurveyModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSurvey(survey.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {showCustomerModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => setShowCustomerModal(false)}
          onSave={async (data) => {
            if (editingCustomer) {
              await apiFetch(`/customers/${editingCustomer.id}`, {
                method: 'PATCH',
                json: data,
              });
            } else {
              await apiFetch('/customers', {
                method: 'POST',
                json: data,
              });
            }
            setShowCustomerModal(false);
            await loadData();
          }}
        />
      )}

      {showSurveyModal && (
        <SurveyModal
          survey={editingSurvey}
          onClose={() => setShowSurveyModal(false)}
          onSave={async (data) => {
            if (editingSurvey) {
              await apiFetch(`/surveys/${editingSurvey.id}`, {
                method: 'PATCH',
                json: data,
              });
            } else {
              await apiFetch('/surveys', {
                method: 'POST',
                json: data,
              });
            }
            setShowSurveyModal(false);
            await loadData();
          }}
        />
      )}

      {showActionModal && actionCustomer && (
        <ActionModal
          customer={actionCustomer}
          type={actionType}
          title={actionTitle}
          description={actionDescription}
          severity={actionSeverity}
          onClose={() => setShowActionModal(false)}
          onSubmit={handleCreateAction}
          setTitle={setActionTitle}
          setDescription={setActionDescription}
          setType={setActionType}
          setSeverity={setActionSeverity}
        />
      )}

      {showAiAnalysis && aiAnalysis && (
        <AiAnalysisModal
          analysis={aiAnalysis}
          onClose={() => setShowAiAnalysis(false)}
        />
      )}
    </div>
  );
}

// Action Modal Component
function ActionModal({
  customer,
  type,
  title,
  description,
  severity,
  onClose,
  onSubmit,
  setTitle,
  setDescription,
  setType,
  setSeverity,
}: {
  customer: Customer;
  type: 'NC' | 'CAPA' | 'PLAN';
  title: string;
  description: string;
  severity: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setType: (v: 'NC' | 'CAPA' | 'PLAN') => void;
  setSeverity: (v: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {type === 'NC' ? 'Generar No Conformidad' : type === 'CAPA' ? 'Generar CAPA' : 'Crear Plan de Mejora'} - {customer.name}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de acción</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="NC">No Conformidad</option>
              <option value="CAPA">CAPA (Correctiva/Preventiva)</option>
              <option value="PLAN">Plan de Mejora</option>
            </select>
          </div>
          {(type === 'NC' || type === 'CAPA') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severidad</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="CRITICAL">Crítica</option>
                <option value="MAJOR">Mayor</option>
                <option value="MINOR">Menor</option>
                <option value="OBSERVATION">Observación</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// AI Analysis Modal Component
function AiAnalysisModal({
  analysis,
  onClose,
}: {
  analysis: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            <BarChart3 className="w-5 h-5 inline mr-2 text-indigo-600" />
            Análisis de Clientes con IA
          </h2>
          <button onClick={onClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-900">{analysis.overallAvg?.toFixed(1) ?? 'N/A'}</div>
              <div className="text-sm text-blue-700">Satisfacción Promedio</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-900">{analysis.highRiskCount ?? 0}</div>
              <div className="text-sm text-red-700">Clientes en Riesgo</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-900">{analysis.noSurvey90Days?.length ?? 0}</div>
              <div className="text-sm text-amber-700">Sin encuesta 90 días</div>
            </div>
          </div>

          {analysis.highRiskCustomers && analysis.highRiskCustomers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Clientes con Riesgo Crítico</h3>
              <div className="space-y-2">
                {analysis.highRiskCustomers.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                    <span className="text-sm font-medium text-gray-900">Cliente #{i + 1}</span>
                    <span className="text-sm font-bold text-red-600">{c.avgScore?.toFixed(1) ?? 'N/A'} ({c.count} respuestas)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recomendaciones</h3>
              <div className="space-y-2">
                {analysis.recommendations.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 bg-indigo-50 rounded-lg p-3">
                    <CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-indigo-900">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Customer Modal Component
function CustomerModal({
  customer,
  onClose,
  onSave,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    legalName: customer?.legalName || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    mobile: customer?.mobile || '',
    address: customer?.address || '',
    city: customer?.city || '',
    state: customer?.state || '',
    country: customer?.country || '',
    type: customer?.type || 'CLIENT',
    status: customer?.status || 'ACTIVE',
    category: customer?.category || '',
    industry: customer?.industry || '',
    contactName: customer?.contactName || '',
    contactEmail: customer?.contactEmail || '',
    contactPhone: customer?.contactPhone || '',
    contactPosition: customer?.contactPosition || '',
    notes: customer?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
              <input
                type="text"
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="CLIENT">Cliente</option>
                <option value="SUPPLIER">Proveedor</option>
                <option value="PARTNER">Socio</option>
                <option value="PROSPECT">Prospecto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado/Provincia</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Persona de Contacto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                <input
                  type="text"
                  value={form.contactPosition}
                  onChange={(e) => setForm({ ...form, contactPosition: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email de contacto</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de contacto</label>
                <input
                  type="text"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {customer ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Survey Modal Component
function SurveyModal({
  survey,
  onClose,
  onSave,
}: {
  survey: Survey | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: survey?.title || '',
    description: survey?.description || '',
    type: survey?.type || 'SATISFACTION',
    isAnonymous: survey?.isAnonymous || false,
    allowMultipleResponses: survey?.allowMultipleResponses || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {survey ? 'Editar Encuesta' : 'Nueva Encuesta'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="ej. Encuesta de Satisfacción Q1 2024"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Describe el propósito de esta encuesta..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="SATISFACTION">Satisfacción del Cliente</option>
              <option value="NPS">Net Promoter Score (NPS)</option>
              <option value="POST_SERVICE">Post-Servicio</option>
              <option value="CUSTOM">Personalizada</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={form.isAnonymous}
              onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="isAnonymous" className="text-sm text-gray-700">
              Encuesta anónima
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowMultipleResponses"
              checked={form.allowMultipleResponses}
              onChange={(e) => setForm({ ...form, allowMultipleResponses: e.target.checked })}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="allowMultipleResponses" className="text-sm text-gray-700">
              Permitir múltiples respuestas
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              {survey ? 'Guardar Cambios' : 'Crear Encuesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
