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
  avgSatisfaction: number;
  responseRate: number;
}

const DEFAULT_STATS: CustomerStats = {
  totalCustomers: 0,
  activeCustomers: 0,
  totalSurveys: 0,
  totalResponses: 0,
  avgSatisfaction: 0,
  responseRate: 0,
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customersRes, surveysRes] = await Promise.all([
        apiFetch<{ customers: Customer[] }>('/customers'),
        apiFetch<{ surveys: Survey[] }>('/surveys'),
      ]);

      const customersData = customersRes?.customers || [];
      const surveysData = surveysRes?.surveys || [];

      setCustomers(customersData);
      setSurveys(surveysData);

      // Calculate stats
      const activeCustomers = customersData.filter(c => c.status === 'ACTIVE').length;
      const totalResponses = surveysData.reduce((acc, s) => acc + (s._count?.responses || 0), 0);
      
      setStats({
        totalCustomers: customersData.length,
        activeCustomers,
        totalSurveys: surveysData.length,
        totalResponses,
        avgSatisfaction: 4.2, // Mock data
        responseRate: 68, // Mock data
      });
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

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-green-600 flex items-center">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              5%
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.avgSatisfaction.toFixed(1)}</div>
          <div className="text-sm text-gray-600 mt-1">Satisfacción Promedio</div>
        </div>
      </div>

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
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Encuestas</th>
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
                        <span className="text-sm text-gray-600">
                          {customer._count?.surveys || 0} encuestas
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/clientes/${customer.id}`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
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
