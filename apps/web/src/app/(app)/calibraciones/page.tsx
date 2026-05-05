'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Ruler, Plus, Edit2, Trash2, X, Calendar, FileText, Upload, ChevronDown, ChevronUp, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type Equipment = {
  id: string;
  code: string;
  name: string;
  type?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  status: string;
  calibrationFrequency: string;
  lastCalibrationDate?: string;
  nextCalibrationDate?: string;
  acquisitionDate?: string;
  notes?: string;
  calibrations?: Calibration[];
};

type Calibration = {
  id: string;
  date: string;
  provider?: string;
  certificateNumber?: string;
  certificateUrl?: string;
  result: string;
  notes?: string;
  nextCalibrationDate?: string;
  cost?: number;
};

export default function CalibracionesPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);

  const [equipmentForm, setEquipmentForm] = useState<Partial<Equipment>>({
    status: 'ACTIVE',
    calibrationFrequency: 'YEARLY',
  });

  const [calibrationForm, setCalibrationForm] = useState({
    date: new Date().toISOString().split('T')[0],
    provider: '',
    certificateNumber: '',
    result: 'CONFORMING',
    notes: '',
    nextCalibrationDate: '',
    cost: '',
  });

  const [calibrationFile, setCalibrationFile] = useState<File | null>(null);

  useEffect(() => {
    loadEquipment();
  }, []);

  async function loadEquipment() {
    try {
      setLoading(true);
      const res = await apiFetch<{ items: Equipment[] }>('/equipment');
      setEquipment(res?.items || []);
    } catch (err) {
      console.error('Error loading equipment:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCalibrations(equipmentId: string) {
    try {
      const res = await apiFetch<{ calibrations: Calibration[] }>(`/calibrations/${equipmentId}`);
      return res?.calibrations || [];
    } catch (err) {
      console.error('Error loading calibrations:', err);
      return [];
    }
  }

  async function toggleExpand(equip: Equipment) {
    if (expandedEquipment === equip.id) {
      setExpandedEquipment(null);
    } else {
      setExpandedEquipment(equip.id);
      const calibrations = await loadCalibrations(equip.id);
      setEquipment(equipment.map(e => e.id === equip.id ? { ...e, calibrations } : e));
    }
  }

  async function saveEquipment(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const body = { ...equipmentForm };
      if (editingEquipment) {
        await apiFetch(`/equipment/${editingEquipment.id}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch('/equipment', { method: 'POST', json: body });
      }
      setShowEquipmentModal(false);
      setEditingEquipment(null);
      setEquipmentForm({ status: 'ACTIVE', calibrationFrequency: 'YEARLY' });
      await loadEquipment();
    } catch (err) {
      console.error('Error saving equipment:', err);
      alert('Error al guardar equipo');
    } finally {
      setSaving(false);
    }
  }

  async function saveCalibration(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEquipment) return;

    try {
      setSaving(true);
      let certificateUrl = calibrationForm.certificateNumber || null;

      if (calibrationFile) {
        if (calibrationFile.size > 10 * 1024 * 1024) {
          alert('El archivo es demasiado grande. Máximo 10MB.');
          return;
        }
        setUploadingFile(true);
        const formData = new FormData();
        formData.append('file', calibrationFile);
        const { filePath } = await apiFetch<{ filePath: string }>('/calibrations/upload', {
          method: 'POST',
          body: formData,
        });
        certificateUrl = filePath;
        setUploadingFile(false);
      }

      const body = {
        equipmentId: selectedEquipment.id,
        date: calibrationForm.date,
        provider: calibrationForm.provider || null,
        certificateNumber: calibrationForm.certificateNumber || null,
        certificateUrl,
        result: calibrationForm.result,
        notes: calibrationForm.notes || null,
        nextCalibrationDate: calibrationForm.nextCalibrationDate || null,
        cost: calibrationForm.cost ? Number(calibrationForm.cost) : null,
      };

      await apiFetch('/calibrations', { method: 'POST', json: body });
      setShowCalibrationModal(false);
      setCalibrationFile(null);
      setCalibrationForm({
        date: new Date().toISOString().split('T')[0],
        provider: '',
        certificateNumber: '',
        result: 'CONFORMING',
        notes: '',
        nextCalibrationDate: '',
        cost: '',
      });
      await loadEquipment();
      if (expandedEquipment === selectedEquipment.id) {
        const calibrations = await loadCalibrations(selectedEquipment.id);
        setEquipment(equipment.map(e => e.id === selectedEquipment.id ? { ...e, calibrations } : e));
      }
    } catch (err) {
      console.error('Error saving calibration:', err);
      alert('Error al guardar calibración');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCalibration(calibrationId: string) {
    if (!confirm('¿Estás seguro de eliminar esta calibración?')) return;
    try {
      await apiFetch(`/calibrations/${calibrationId}`, { method: 'DELETE' });
      // Recargar calibraciones del equipo expandido
      if (expandedEquipment) {
        const calibrations = await loadCalibrations(expandedEquipment);
        setEquipment(equipment.map(e => e.id === expandedEquipment ? { ...e, calibrations } : e));
      }
    } catch (err) {
      console.error('Error deleting calibration:', err);
      alert('Error al eliminar calibración');
    }
  }

  async function deleteEquipment(id: string) {
    if (!confirm('¿Eliminar este equipo?')) return;
    try {
      await apiFetch(`/equipment/${id}`, { method: 'DELETE' });
      await loadEquipment();
    } catch (err) {
      console.error('Error deleting equipment:', err);
    }
  }

  function openEdit(equip: Equipment) {
    setEditingEquipment(equip);
    setEquipmentForm(equip);
    setShowEquipmentModal(true);
  }

  function openAddCalibration(equip: Equipment) {
    setSelectedEquipment(equip);
    setShowCalibrationModal(true);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'OUT_OF_SERVICE': return 'bg-yellow-100 text-yellow-800';
      case 'RETIRED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getResultColor(result: string) {
    switch (result) {
      case 'CONFORMING': return 'bg-green-100 text-green-800';
      case 'CONFORMING_WITH_ADJUSTMENT': return 'bg-yellow-100 text-yellow-800';
      case 'NON_CONFORMING': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getResultLabel(result: string) {
    switch (result) {
      case 'CONFORMING': return 'Conforme';
      case 'CONFORMING_WITH_ADJUSTMENT': return 'Conforme con ajuste';
      case 'NON_CONFORMING': return 'No conforme';
      default: return result;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/infraestructura" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Volver a Infraestructura
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Ruler className="w-6 h-6 text-blue-600" />
            Equipos de Medición / Calibraciones
          </h1>
          <p className="text-gray-600 mt-1">Inventario y cronograma de calibraciones (ISO 9001 §7.1.5)</p>
        </div>
        <button
          onClick={() => {
            setEditingEquipment(null);
            setEquipmentForm({ status: 'ACTIVE', calibrationFrequency: 'YEARLY' });
            setShowEquipmentModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Equipo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {equipment.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Ruler className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay equipos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {equipment.map((equip) => (
              <div key={equip.id} className="border-b border-gray-200 last:border-b-0">
                <div className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => toggleExpand(equip)}>
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Ruler className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{equip.code} - {equip.name}</p>
                        <p className="text-sm text-gray-500">{equip.type} • {equip.brand} {equip.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(equip.status)}`}>
                        {equip.status === 'ACTIVE' ? 'Activo' : equip.status === 'OUT_OF_SERVICE' ? 'Fuera de servicio' : 'Dado de baja'}
                      </span>
                      <span className="text-sm text-gray-500">
                        Próx. calibración: {equip.nextCalibrationDate ? new Date(equip.nextCalibrationDate).toLocaleDateString('es-AR') : '—'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openAddCalibration(equip); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Calibrar
                      </button>
                      <button onClick={() => toggleExpand(equip)} className="p-2 text-gray-400 hover:text-gray-600">
                        {expandedEquipment === equip.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {expandedEquipment === equip.id && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Historial de Calibraciones</h3>
                      <button
                        onClick={(e) => { e.stopPropagation(); openAddCalibration(equip); }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Agregar Calibración
                      </button>
                    </div>

                    {equip.calibrations && equip.calibrations.length > 0 ? (
                      <div className="space-y-3">
                        {equip.calibrations.map((cal) => (
                          <div key={cal.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(cal.date).toLocaleDateString('es-AR')}
                                </span>
                                {cal.provider && <span className="text-sm text-gray-500">• {cal.provider}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${getResultColor(cal.result)}`}>
                                  {getResultLabel(cal.result)}
                                </span>
                                <button
                                  onClick={() => deleteCalibration(cal.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar calibración"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {cal.certificateNumber && (
                              <p className="text-sm text-gray-600 mb-1">Certificado: {cal.certificateNumber}</p>
                            )}
                            {cal.certificateUrl && (
                              <a
                                href={cal.certificateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                              >
                                <Download className="w-3 h-3" />
                                Ver informe
                              </a>
                            )}
                            {cal.notes && <p className="text-sm text-gray-500 mt-2">{cal.notes}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No hay calibraciones registradas
                      </div>
                    )}
                  </div>
                )}

                <div className="px-6 py-2 flex justify-end gap-2 border-t border-gray-200">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(equip); }}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteEquipment(equip.id); }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Equipo */}
      {showEquipmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingEquipment ? 'Editar' : 'Nuevo'} Equipo
              </h2>
              <button onClick={() => setShowEquipmentModal(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveEquipment} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={equipmentForm.name || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <input
                  type="text"
                  value={equipmentForm.type || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Balanza, calibre..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                <input
                  type="text"
                  value={equipmentForm.brand || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, brand: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                <input
                  type="text"
                  value={equipmentForm.model || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nº de serie</label>
                <input
                  type="text"
                  value={equipmentForm.serialNumber || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input
                  type="text"
                  value={equipmentForm.location || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={equipmentForm.status || 'ACTIVE'}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="OUT_OF_SERVICE">Fuera de servicio</option>
                  <option value="RETIRED">Dado de baja</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia calibración</label>
                <select
                  value={equipmentForm.calibrationFrequency || 'YEARLY'}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, calibrationFrequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="QUARTERLY">Trimestral</option>
                  <option value="BIANNUAL">Semestral</option>
                  <option value="YEARLY">Anual</option>
                  <option value="OTHER">Otra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Última calibración</label>
                <input
                  type="date"
                  value={equipmentForm.lastCalibrationDate?.split('T')[0] || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, lastCalibrationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Próxima calibración</label>
                <input
                  type="date"
                  value={equipmentForm.nextCalibrationDate?.split('T')[0] || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, nextCalibrationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={equipmentForm.notes || ''}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEquipmentModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Calibración */}
      {showCalibrationModal && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Nueva Calibración: {selectedEquipment.name}
              </h2>
              <button onClick={() => setShowCalibrationModal(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveCalibration} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={calibrationForm.date}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                <input
                  type="text"
                  value={calibrationForm.provider}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, provider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nº de certificado</label>
                <input
                  type="text"
                  value={calibrationForm.certificateNumber}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, certificateNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Informe de calibración (PDF, JPG, PNG)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setCalibrationFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="calibration-upload"
                  />
                  <label htmlFor="calibration-upload" className="cursor-pointer flex flex-col items-center">
                    <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mb-2">
                      {uploadingFile ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
                      ) : (
                        <Upload className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <span className="text-sm text-gray-600 text-center">
                      {calibrationFile ? calibrationFile.name : 'Click para subir informe'}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">Máx. 10MB</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resultado *</label>
                <select
                  value={calibrationForm.result}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, result: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="CONFORMING">Conforme</option>
                  <option value="CONFORMING_WITH_ADJUSTMENT">Conforme con ajuste</option>
                  <option value="NON_CONFORMING">No conforme</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Próxima calibración</label>
                <input
                  type="date"
                  value={calibrationForm.nextCalibrationDate}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, nextCalibrationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo</label>
                <input
                  type="number"
                  value={calibrationForm.cost}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, cost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={calibrationForm.notes}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCalibrationModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingFile}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar Calibración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
