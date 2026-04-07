'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  Building2, Mail, Phone, MapPin, ArrowLeft, Edit2, Trash2,
  User, Briefcase, Globe, FileText, Star, ClipboardList,
  MessageSquare, CheckCircle2, X, Save, Send
} from 'lucide-react';

interface Customer {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  type: 'CLIENT' | 'SUPPLIER' | 'PARTNER' | 'PROSPECT';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  category?: string;
  industry?: string;
  employeesCount?: number;
  annualRevenue?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPosition?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  surveys?: Array<{
    id: string;
    survey: {
      id: string;
      code: string;
      title: string;
    };
    status: string;
    completedAt?: string;
  }>;
  ncrLinks?: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    severity: string;
  }>;
}

interface Survey {
  id: string;
  code: string;
  title: string;
  description?: string;
  isActive: boolean;
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [availableSurveys, setAvailableSurveys] = useState<Survey[]>([]);
  const [showAssignSurvey, setShowAssignSurvey] = useState(false);

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ customer: Customer }>(`/customers/${customerId}`);
      if (res?.customer) {
        setCustomer(res.customer);
        setForm(res.customer);
      }
    } catch (err) {
      console.error('Error loading customer:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('handleSave called with form:', form);
    try {
      await apiFetch(`/customers/${customerId}`, {
        method: 'PATCH',
        json: form,
      });
      setEditing(false);
      await loadCustomer();
    } catch (err) {
      console.error('Error saving customer:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
    try {
      await apiFetch(`/customers/${customerId}`, { method: 'DELETE' });
      router.push('/clientes');
    } catch (err) {
      console.error('Error deleting customer:', err);
    }
  };

  const loadAvailableSurveys = async () => {
    try {
      const res = await apiFetch<{ surveys: Survey[] }>('/surveys?isActive=true');
      setAvailableSurveys(res?.surveys || []);
    } catch (err) {
      console.error('Error loading surveys:', err);
    }
  };

  const handleAssignSurvey = async (surveyId: string) => {
    try {
      await apiFetch(`/customers/${customerId}/surveys`, {
        method: 'POST',
        json: { surveyId },
      });
      setShowAssignSurvey(false);
      await loadCustomer();
    } catch (err) {
      console.error('Error assigning survey:', err);
    }
  };

  const handleSendSurveyEmail = async (surveyId: string) => {
    try {
      const result = await apiFetch<{ success: boolean; message: string; surveyUrl: string }>(
        `/customers/${customerId}/surveys/${surveyId}/send`,
        { method: 'POST' }
      );
      if (result?.success) {
        alert('Email enviado correctamente');
        await loadCustomer();
      }
    } catch (err) {
      console.error('Error sending survey email:', err);
      alert('Error al enviar el email');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Cliente no encontrado</p>
          <Link
            href="/clientes"
            className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a clientes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/clientes"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-gray-600">{customer.code} • {customer.legalName}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  setForm(customer);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  loadAvailableSurveys();
                  setShowAssignSurvey(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                Asignar Encuesta
              </button>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.legalName || ''}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.legalName || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                {editing ? (
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.email || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.phone || ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.phone || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                {editing ? (
                  <select
                    value={form.type || 'CLIENT'}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="CLIENT">Cliente</option>
                    <option value="SUPPLIER">Proveedor</option>
                    <option value="PARTNER">Socio</option>
                    <option value="PROSPECT">Prospecto</option>
                  </select>
                ) : (
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
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                {editing ? (
                  <select
                    value={form.status || 'ACTIVE'}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                    <option value="SUSPENDED">Suspendido</option>
                  </select>
                ) : (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    customer.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    customer.status === 'INACTIVE' ? 'bg-gray-100 text-gray-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {customer.status === 'ACTIVE' ? 'Activo' :
                     customer.status === 'INACTIVE' ? 'Inactivo' : 'Suspendido'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dirección</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.address || ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.address || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.city || ''}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.city || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado/Provincia</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.state || ''}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.state || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Person */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Persona de Contacto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.contactName || ''}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.contactName || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.contactPosition || ''}
                    onChange={(e) => setForm({ ...form, contactPosition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.contactPosition || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email de contacto</label>
                {editing ? (
                  <input
                    type="email"
                    value={form.contactEmail || ''}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.contactEmail || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de contacto</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.contactPhone || ''}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{customer.contactPhone || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notas</h2>
            {editing ? (
              <textarea
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900">{customer.notes || 'Sin notas'}</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assigned Surveys */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Encuestas Asignadas</h2>
              <ClipboardList className="w-5 h-5 text-gray-400" />
            </div>
            {customer.surveys?.length === 0 ? (
              <p className="text-gray-600 text-sm">No hay encuestas asignadas</p>
            ) : (
              <div className="space-y-3">
                {customer.surveys?.map((cs) => (
                  <div key={cs.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{cs.survey.title}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        cs.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        cs.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {cs.status === 'COMPLETED' ? 'Completada' :
                         cs.status === 'SENT' ? 'Enviada' : 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{cs.survey.code}</p>
                    {cs.completedAt && (
                      <p className="text-xs text-gray-500">
                        Completada: {new Date(cs.completedAt).toLocaleDateString()}
                      </p>
                    )}
                    {cs.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleSendSurveyEmail(cs.survey.id)}
                        className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Enviar Email
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NCR Links */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">No Conformidades</h2>
              <MessageSquare className="w-5 h-5 text-gray-400" />
            </div>
            {customer.ncrLinks?.length === 0 ? (
              <p className="text-gray-600 text-sm">No hay reclamos registrados</p>
            ) : (
              <div className="space-y-3">
                {customer.ncrLinks?.map((ncr) => (
                  <Link
                    key={ncr.id}
                    href={`/no-conformidades/${ncr.id}`}
                    className="block border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-600">{ncr.code}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        ncr.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {ncr.status === 'CLOSED' ? 'Cerrada' : 'Abierta'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mt-1 truncate">{ncr.title}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Survey Modal */}
      {showAssignSurvey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Asignar Encuesta</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableSurveys.length === 0 ? (
                <p className="text-gray-600">No hay encuestas disponibles</p>
              ) : (
                availableSurveys.map((survey) => (
                  <button
                    key={survey.id}
                    onClick={() => handleAssignSurvey(survey.id)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <p className="font-medium text-gray-900">{survey.title}</p>
                    <p className="text-xs text-gray-500">{survey.code}</p>
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowAssignSurvey(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
