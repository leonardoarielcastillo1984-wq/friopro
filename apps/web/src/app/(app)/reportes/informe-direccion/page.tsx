'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ChevronLeft, 
  Plus, 
  FileText, 
  Download, 
  Calendar,
  CheckCircle,
  AlertCircle,
  Edit3,
  Trash2,
  Eye,
  Settings,
  FileBarChart,
  FileDown
} from 'lucide-react';
import { useCompany } from '@/lib/company-context';

type ManagementReview = {
  id: string;
  title: string;
  summary: string | null;
  periodStart: string;
  periodEnd: string;
  standards: string[];
  status: 'DRAFT' | 'FINAL';
  generatedAt: string;
  createdAt: string;
  sections: Array<{
    key: string;
    title: string;
  }>;
};

const ISO_STANDARD_LABELS: Record<string, string> = {
  'ISO_9001': 'ISO 9001',
  'ISO_14001': 'ISO 14001',
  'ISO_45001': 'ISO 45001',
  'ISO_27001': 'ISO 27001',
  'ISO_39001': 'ISO 39001',
  'IATF_16949': 'IATF 16949',
  'ISO_50001': 'ISO 50001',
  'CUSTOM': 'Personalizado',
};

const STATUS_LABELS: Record<string, string> = {
  'DRAFT': 'Borrador',
  'FINAL': 'Final',
};

function displayTitle(title: string) {
  return title.replace(/__\d{6,}$/, '');
}

const STATUS_COLORS: Record<string, string> = {
  'DRAFT': 'bg-yellow-100 text-yellow-800',
  'FINAL': 'bg-green-100 text-green-800',
};

export default function InformeDireccionPage() {
  const { settings: companySettings } = useCompany();
  const [reviews, setReviews] = useState<ManagementReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/management-reviews') as { reviews: ManagementReview[] };
      if (res.reviews) setReviews(res.reviews);
    } catch (err) {
      console.error('Error loading management reviews:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar informes');
    } finally {
      setLoading(false);
    }
  }

  async function createReview(data: {
    title: string;
    summary: string;
    periodStart: string;
    periodEnd: string;
    standards: string[];
  }) {
    try {
      setCreating(true);
      setModalError(null);
      const res = await apiFetch('/management-reviews', {
        method: 'POST',
        json: data,
      }) as { review: ManagementReview };
      
      if (res.review) {
        setReviews(prev => [res.review, ...prev]);
        setShowCreateModal(false);
        setModalError(null);
      }
    } catch (err) {
      console.error('Error creating review:', err);
      setModalError(err instanceof Error ? err.message : 'Error al crear informe');
    } finally {
      setCreating(false);
    }
  }

  async function generateDraft(reviewId: string) {
    try {
      setError(null);
      const res = await apiFetch(`/management-reviews/${reviewId}/generate-draft`, {
        method: 'POST',
      }) as { review: ManagementReview };
      
      if (res.review) {
        setReviews(prev => prev.map(r => r.id === reviewId ? res.review : r));
      }
    } catch (err) {
      console.error('Error generating draft:', err);
      setError(err instanceof Error ? err.message : 'Error al generar borrador');
    }
  }

  async function deleteReview(reviewId: string) {
    if (!confirm('¿Está seguro de eliminar este informe?')) return;
    
    try {
      setError(null);
      await apiFetch(`/management-reviews/${reviewId}`, {
        method: 'DELETE',
      });
      
      setReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (err) {
      console.error('Error deleting review:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar informe');
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
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Informe para la Dirección</h1>
          <p className="text-gray-600 mt-1">
            Gestiona los informes de revisión por la dirección según normas ISO
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Informe
        </button>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {reviews.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay informes</h3>
            <p className="text-gray-600 mb-4">
              Crea tu primer informe para la dirección
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear Informe
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Informe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Período
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Normas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {displayTitle(review.title)}
                        </div>
                        {review.summary && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {review.summary}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(review.periodStart).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          hasta {new Date(review.periodEnd).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {review.standards.map((standard) => (
                          <span
                            key={standard}
                            className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700"
                          >
                            {ISO_STANDARD_LABELS[standard] || standard}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[review.status]}`}>
                        {STATUS_LABELS[review.status] || review.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/reportes/informe-direccion/${review.id}`}
                          className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => generateDraft(review.id)}
                          className="p-1 text-gray-600 hover:text-green-600 transition-colors"
                          title="Generar borrador"
                          disabled={review.status === 'FINAL'}
                        >
                          <FileBarChart className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteReview(review.id)}
                          className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                          title="Eliminar"
                          disabled={review.status === 'FINAL'}
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

      {/* Create Modal */}
      {showCreateModal && (
        <CreateReviewModal
          onClose={() => { setShowCreateModal(false); setModalError(null); }}
          onSubmit={createReview}
          loading={creating}
          error={modalError}
        />
      )}
    </div>
  );
}

// Create Review Modal Component
function CreateReviewModal({ 
  onClose, 
  onSubmit, 
  loading,
  error,
}: { 
  onClose: () => void; 
  onSubmit: (data: any) => void; 
  loading: boolean;
  error: string | null;
}) {
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    periodStart: '',
    periodEnd: '',
    standards: [] as string[],
  });

  const availableStandards = Object.keys(ISO_STANDARD_LABELS);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title || !formData.periodStart || !formData.periodEnd || formData.standards.length === 0) {
      return;
    }
    onSubmit(formData);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Nuevo Informe para la Dirección</h2>
          <p className="text-gray-600 mt-1">
            Configura el período y las normas para el informe
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título del Informe *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Revisión por la Dirección - Q1 2026"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resumen
            </label>
            <textarea
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Breve descripción del alcance y objetivos del informe"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Inicio *
              </label>
              <input
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Fin *
              </label>
              <input
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                min={formData.periodStart}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Normas Aplicables *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableStandards.map((standard) => (
                <label key={standard} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.standards.includes(standard)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ 
                          ...formData, 
                          standards: [...formData.standards, standard] 
                        });
                      } else {
                        setFormData({ 
                          ...formData, 
                          standards: formData.standards.filter(s => s !== standard) 
                        });
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {ISO_STANDARD_LABELS[standard]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title || !formData.periodStart || !formData.periodEnd || formData.standards.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Informe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
