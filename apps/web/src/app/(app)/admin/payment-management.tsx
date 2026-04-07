'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { 
  DollarSign, FileText, Upload, Download, CheckCircle2, 
  AlertCircle, Loader2, Search, Filter 
} from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt?: string;
  planTier: string;
  period: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  subscription?: {
    id: string;
    status: string;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    pdfUrl?: string;
  };
}

export default function PaymentManagement() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    try {
      const data = await apiFetch('/super-admin/payments') as any[];
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvoice(paymentId: string) {
    try {
      const data = await apiFetch(`/super-admin/payments/${paymentId}/invoice`, {
        method: 'POST',
      }) as { success: boolean; invoice?: any };
      
      if (data.success) {
        loadPayments(); // Recargar para mostrar la factura creada
        alert('Factura creada exitosamente');
      }
    } catch (error: any) {
      alert('Error al crear factura: ' + (error.message || 'Error desconocido'));
    }
  }

  async function handleUploadPdf(paymentId: string, invoiceId: string, file: File) {
    if (!file || file.type !== 'application/pdf') {
      alert('Por favor selecciona un archivo PDF');
      return;
    }

    setUploading(paymentId);
    
    try {
      // Crear FormData para el archivo
      const formData = new FormData();
      formData.append('file', file);

      // Subir el PDF (simulado - aquí usarías multipart)
      const data = await apiFetch(`/super-admin/invoices/${invoiceId}/pdf`, {
        method: 'PUT',
        body: formData,
      }) as { success: boolean; invoice?: any };

      if (data.success) {
        loadPayments();
        alert('Factura PDF subida exitosamente');
      }
    } catch (error: any) {
      alert('Error al subir PDF: ' + (error.message || 'Error desconocido'));
    } finally {
      setUploading(null);
    }
  }

  // Filtrar pagos
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.tenant.name.toLowerCase().includes(search.toLowerCase()) ||
                         payment.planTier.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = filter === 'all' ||
                         (filter === 'pending' && !payment.invoice) ||
                         (filter === 'completed' && payment.invoice);
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-neutral-600" />
          <h2 className="font-semibold text-neutral-900">Gestión de Pagos y Facturas</h2>
          <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
            {payments.length} pagos
          </span>
        </div>
        <button
          onClick={loadPayments}
          className="text-neutral-400 hover:text-neutral-600 transition-colors"
          title="Recargar"
        >
          <Loader2 className="h-4 w-4" />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por empresa o plan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          className="px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos</option>
          <option value="pending">Sin Factura</option>
          <option value="completed">Con Factura</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="py-12 text-center">
          <DollarSign className="mx-auto h-10 w-10 text-neutral-200" />
          <p className="mt-3 text-sm text-neutral-400">
            {search || filter !== 'all' ? 'No hay pagos que coincidan con los filtros' : 'No hay pagos registrados'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPayments.map((payment) => (
            <div
              key={payment.id}
              className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-neutral-900">{payment.tenant.name}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {payment.planTier}
                    </span>
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                      {payment.period}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      payment.status === 'COMPLETED' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {payment.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-neutral-600">
                    <span className="font-semibold text-neutral-900">
                      ${payment.amount} {payment.currency}
                    </span>
                    <span>
                      {new Date(payment.createdAt).toLocaleDateString('es-AR')}
                    </span>
                    {payment.paidAt && (
                      <span>
                        Pagado: {new Date(payment.paidAt).toLocaleDateString('es-AR')}
                      </span>
                    )}
                  </div>

                  {/* Estado de factura */}
                  {payment.invoice ? (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Factura {payment.invoice.invoiceNumber}</span>
                      </div>
                      {payment.invoice.pdfUrl ? (
                        <a
                          href={payment.invoice.pdfUrl}
                          download
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          <Download className="h-3 w-3" />
                          Descargar PDF
                        </a>
                      ) : (
                        <span className="text-xs text-orange-600">PDF pendiente</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <button
                        onClick={() => handleCreateInvoice(payment.id)}
                        className="inline-flex items-center gap-2 text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        Crear Factura
                      </button>
                    </div>
                  )}
                </div>

                {/* Subir PDF si hay factura */}
                {payment.invoice && !payment.invoice.pdfUrl && (
                  <div className="ml-4">
                    <label className="cursor-pointer inline-flex items-center gap-2 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors">
                      {uploading === payment.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Subir PDF
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && payment.invoice) handleUploadPdf(payment.id, payment.invoice.id, file);
                        }}
                        className="hidden"
                        disabled={uploading === payment.id}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
