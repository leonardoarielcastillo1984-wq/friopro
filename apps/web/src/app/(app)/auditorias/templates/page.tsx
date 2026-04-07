'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { ChevronLeft, Plus, FileText, CheckCircle, Copy } from 'lucide-react';

type Template = {
  id: string;
  name: string;
  description: string | null;
  normativeStandard: string;
  version: number;
  isActive: boolean;
};

type TemplateItem = {
  id: string;
  clause: string;
  requirement: string;
  whatToCheck: string;
  guidance: string | null;
  order: number;
};

const ISO_OPTIONS = [
  { value: 'ISO_9001', label: 'ISO 9001 - Calidad' },
  { value: 'ISO_14001', label: 'ISO 14001 - Medio Ambiente' },
  { value: 'ISO_45001', label: 'ISO 45001 - Seguridad y Salud' },
  { value: 'ISO_39001', label: 'ISO 39001 - Seguridad Vial' },
  { value: 'IATF_16949', label: 'IATF 16949 - Automotriz' },
  { value: 'ISO_27001', label: 'ISO 27001 - Seguridad Información' },
  { value: 'ISO_50001', label: 'ISO 50001 - Energía' },
  { value: 'CUSTOM', label: 'Otra Norma' },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    normativeStandard: 'ISO_9001',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoading(true);
      const res = await apiFetch('/audit/templates') as { templates: Template[] };
      if (res.templates) {
        setTemplates(res.templates);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplateItems(templateId: string) {
    try {
      const res = await apiFetch(`/audit/templates/${templateId}/items`) as { items: TemplateItem[] };
      if (res.items) {
        setItems(res.items);
      }
    } catch (err) {
      console.error('Error loading items:', err);
    }
  }

  function handleSelectTemplate(template: Template) {
    setSelectedTemplate(template);
    loadTemplateItems(template.id);
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch('/audit/templates', {
        method: 'POST',
        body: JSON.stringify(newTemplate),
      }) as { template: Template };

      if (res.template) {
        setTemplates([...templates, res.template]);
        setShowCreateModal(false);
        setNewTemplate({ name: '', description: '', normativeStandard: 'ISO_9001' });
      }
    } catch (err) {
      console.error('Error creating template:', err);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/auditorias"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Templates de Checklist ISO</h1>
            <p className="text-gray-500">Gestión de plantillas por norma</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Templates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Templates ({templates.length})</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedTemplate?.id === template.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{template.name}</span>
                </div>
                <p className="text-sm text-gray-500">{template.normativeStandard.replace('_', ' ')}</p>
                <p className="text-xs text-gray-400 mt-1">Versión {template.version}</p>
              </button>
            ))}

            {templates.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay templates creados</p>
              </div>
            )}
          </div>
        </div>

        {/* Detalle del Template */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedTemplate.name}</h2>
                    <p className="text-gray-500 mt-1">
                      {selectedTemplate.normativeStandard.replace('_', ' ')} • Versión {selectedTemplate.version}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                      <Copy className="w-4 h-4 inline mr-1" />
                      Duplicar
                    </button>
                  </div>
                </div>
                {selectedTemplate.description && (
                  <p className="text-gray-600 mt-2">{selectedTemplate.description}</p>
                )}
              </div>

              {/* Items del Template */}
              <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <div key={item.id} className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {item.clause}
                            </span>
                          </div>
                          <p className="text-gray-900">{item.requirement}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Verificar:</span> {item.whatToCheck}
                          </p>
                          {item.guidance && (
                            <p className="text-sm text-gray-400 mt-1">
                              <span className="font-medium">Guía:</span> {item.guidance}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay items en este template</p>
                    <button className="text-blue-600 hover:text-blue-800 text-sm mt-2">
                      + Agregar item
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Selecciona un template para ver sus items</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Template */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Template</h3>
            </div>
            <form onSubmit={createTemplate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Checklist ISO 9001 - Producción"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Norma ISO</label>
                <select
                  value={newTemplate.normativeStandard}
                  onChange={(e) => setNewTemplate({ ...newTemplate, normativeStandard: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ISO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descripción del propósito del template..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Crear Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
