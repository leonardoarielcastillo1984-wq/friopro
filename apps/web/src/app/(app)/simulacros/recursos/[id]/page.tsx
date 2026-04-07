'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle, Clock, Edit,
  MapPin, Phone, Save, Target, Trash2, User, X
} from 'lucide-react';

interface EmergencyResource {
  id: string;
  name: string;
  description: string;
  type: 'EQUIPMENT' | 'SUPPLY' | 'PERSONNEL' | 'FACILITY' | 'EXTERNAL';
  category: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'UNAVAILABLE';
  quantity: number;
  location: string;
  specifications: Record<string, any>;
  maintenanceSchedule: {
    lastMaintenance: string | null;
    nextMaintenance: string | null;
    frequency: string;
  };
  contactInfo: {
    responsible: string;
    phone: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const resourceId = params.id as string;

  const [resource, setResource] = useState<EmergencyResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResource, setEditedResource] = useState<Partial<EmergencyResource>>({});

  useEffect(() => {
    loadResource();
  }, [resourceId]);

  const loadResource = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/emergency/resources/${resourceId}`) as any;
      if (response.resource) {
        setResource(response.resource);
        setEditedResource(response.resource);
      } else {
        setError('Recurso no encontrado');
      }
    } catch (err) {
      setError('Error al cargar el recurso');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/emergency/resources/${resourceId}`, {
        method: 'PUT',
        json: editedResource
      }) as any;

      if (response.success) {
        setResource(response.resource);
        setIsEditing(false);
      }
    } catch (err) {
      alert('Error al guardar el recurso');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Está seguro de que desea eliminar este recurso?')) return;

    try {
      await apiFetch(`/emergency/resources/${resourceId}`, {
        method: 'DELETE'
      });
      router.push('/simulacros?tab=resources');
    } catch (err) {
      alert('Error al eliminar el recurso');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'text-green-600 bg-green-50';
      case 'IN_USE': return 'text-blue-600 bg-blue-50';
      case 'MAINTENANCE': return 'text-yellow-600 bg-yellow-50';
      case 'UNAVAILABLE': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'Disponible';
      case 'IN_USE': return 'En Uso';
      case 'MAINTENANCE': return 'Mantenimiento';
      case 'UNAVAILABLE': return 'No Disponible';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'EQUIPMENT': return 'Equipo';
      case 'SUPPLY': return 'Suministro';
      case 'PERSONNEL': return 'Personal';
      case 'FACILITY': return 'Instalación';
      case 'EXTERNAL': return 'Contacto Externo';
      default: return type;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'FIRE_SAFETY': return 'Seguridad contra Incendios';
      case 'MEDICAL': return 'Médico';
      case 'EVACUATION': return 'Evacuación';
      case 'COMMUNICATION': return 'Comunicación';
      case 'POWER': return 'Energía';
      case 'INFRASTRUCTURE': return 'Infraestructura';
      default: return category;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Recurso no encontrado'}</h1>
        <Link href="/simulacros?tab=resources" className="text-blue-600 hover:text-blue-700">
          Volver a Recursos de Emergencia
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
            href="/simulacros?tab=resources"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editedResource.name || ''}
                  onChange={(e) => setEditedResource({ ...editedResource, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-2xl font-bold"
                  placeholder="Nombre del recurso"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={editedResource.type || resource.type}
                    onChange={(e) => setEditedResource({ ...editedResource, type: e.target.value as any })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-100 text-blue-700"
                  >
                    <option value="EQUIPMENT">Equipo</option>
                    <option value="SUPPLY">Suministro</option>
                    <option value="PERSONNEL">Personal</option>
                    <option value="FACILITY">Instalación</option>
                    <option value="EXTERNAL">Contacto Externo</option>
                  </select>
                  <select
                    value={editedResource.status || resource.status}
                    onChange={(e) => setEditedResource({ ...editedResource, status: e.target.value as any })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AVAILABLE">Disponible</option>
                    <option value="IN_USE">En Uso</option>
                    <option value="MAINTENANCE">Mantenimiento</option>
                    <option value="UNAVAILABLE">No Disponible</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{resource.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(resource.status)}`}>
                    {getStatusLabel(resource.status)}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {getTypeLabel(resource.type)}
                  </span>
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
                value={editedResource.description || ''}
                onChange={(e) => setEditedResource({ ...editedResource, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            ) : (
              <p className="text-gray-700">{resource.description || 'Sin descripción'}</p>
            )}
          </div>

          {/* Location & Quantity */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Ubicación y Cantidad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={editedResource.location || ''}
                      onChange={(e) => setEditedResource({ ...editedResource, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Planta baja, pasillo principal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                    <input
                      type="number"
                      value={editedResource.quantity || 1}
                      onChange={(e) => setEditedResource({ ...editedResource, quantity: parseInt(e.target.value) || 1 })}
                      min={1}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">Ubicación</div>
                    <div className="text-lg font-semibold text-gray-900">{resource.location || 'No especificada'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">Cantidad</div>
                    <div className="text-lg font-semibold text-gray-900">{resource.quantity}</div>
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
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Categoría</span>
                {isEditing ? (
                  <select
                    value={editedResource.category || resource.category}
                    onChange={(e) => setEditedResource({ ...editedResource, category: e.target.value })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FIRE_SAFETY">Seguridad contra Incendios</option>
                    <option value="MEDICAL">Médico</option>
                    <option value="EVACUATION">Evacuación</option>
                    <option value="COMMUNICATION">Comunicación</option>
                    <option value="POWER">Energía</option>
                    <option value="INFRASTRUCTURE">Infraestructura</option>
                  </select>
                ) : (
                  <span className="font-medium text-gray-900">{getCategoryLabel(resource.category)}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Creado</span>
                <span className="font-medium text-gray-900">{new Date(resource.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Actualizado</span>
                <span className="font-medium text-gray-900">{new Date(resource.updatedAt).toLocaleDateString('es-AR')}</span>
              </div>
            </div>
          </div>

          {/* Maintenance */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Mantenimiento
            </h2>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                  <select
                    value={editedResource.maintenanceSchedule?.frequency || 'Anual'}
                    onChange={(e) => setEditedResource({
                      ...editedResource,
                      maintenanceSchedule: { ...editedResource.maintenanceSchedule, frequency: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Frecuencia</span>
                  <span className="font-medium text-gray-900">{resource.maintenanceSchedule?.frequency || 'No definida'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
