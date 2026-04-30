'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { CreditCard, CheckCircle2, AlertTriangle, FileText, Download, Loader2, Calendar, DollarSign } from 'lucide-react';

interface Subscription {
  hasSubscription: boolean;
  status: string;
  planTier: string;
  daysRemaining: number;
  endsAt?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: string;
  invoiceDate: string;
  pdfUrl?: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string;
  planTier: string;
  period: string;
}

const PLAN_PRICES = {
  monthly: { PREMIUM: 99 },
  annual: { PREMIUM: 1128 }
};

export default function LicensesPanel() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      // Cargar suscripción
      const subData = await apiFetch('/license/subscription') as Subscription;
      setSubscription(subData);
      
      // Cargar facturas
      const invData = await apiFetch('/license/invoices') as { invoices: Invoice[] };
      setInvoices(invData.invoices || []);
      
      // Cargar pagos
      const payData = await apiFetch('/license/payments') as { payments: Payment[] };
      setPayments(payData.payments || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment() {
    try {
      setProcessingPayment(true);
      
      const response = await apiFetch('/license/checkout', {
        method: 'POST',
        json: {
          planTier: 'PREMIUM',
          period: selectedPeriod
        }
      }) as { initPoint?: string };

      if (response.initPoint) {
        // Redirigir a MercadoPago
        window.open(response.initPoint, '_blank');
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      alert('Error al crear el pago. Intenta nuevamente.');
    } finally {
      setProcessingPayment(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const isExpired = subscription?.daysRemaining === 0;
  const isExpiringSoon = subscription?.daysRemaining && subscription.daysRemaining <= 7;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Licencias y Facturación</h1>
        <p className="text-gray-600">Gestiona tu suscripción, pagos y facturas</p>
      </div>

      {/* Estado de Suscripción */}
      <div className={`p-6 rounded-xl border ${
        isExpired ? 'bg-red-50 border-red-200' :
        isExpiringSoon ? 'bg-amber-50 border-amber-200' :
        'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${
            isExpired ? 'bg-red-100' :
            isExpiringSoon ? 'bg-amber-100' :
            'bg-green-100'
          }`}>
            {isExpired ? (
              <AlertTriangle className="h-6 w-6 text-red-600" />
            ) : isExpiringSoon ? (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {isExpired ? 'Suscripción Vencida' :
               isExpiringSoon ? 'Renovación Próxima' :
               'Suscripción Activa'}
            </h3>
            <p className="text-gray-600 mt-1">
              {isExpired ? 'Tu suscripción ha vencido. Renueva para continuar usando el sistema.' :
               isExpiringSoon ? `Tu suscripción vence en ${subscription?.daysRemaining} días. Renueva pronto.` :
               `Tu suscripción ${subscription?.planTier} está activa. ${subscription?.daysRemaining} días restantes.`}
            </p>
            {subscription?.endsAt && (
              <div className="flex items-center gap-2 mt-2 text-gray-600">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Vence: {new Date(subscription.endsAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selector de Plan para Pago */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Renovar o Cambiar Plan
        </h2>

        {/* Plan PREMIUM */}
        <div className="mb-6">
          <div className="p-5 rounded-xl border-2 border-blue-400 bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-900/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">PREMIUM</div>
                <div className="text-sm text-blue-100 mt-1">
                  ${PLAN_PRICES[selectedPeriod].PREMIUM} {selectedPeriod === 'monthly' ? 'USD / mes' : 'USD / año'}
                </div>
              </div>
              <div className="bg-white text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow">
                Único Plan Disponible
              </div>
            </div>
            <ul className="mt-4 text-sm text-blue-50 space-y-1 list-disc list-inside">
              <li>Módulos ilimitados</li>
              <li>Consultas IA incluidas</li>
              <li>Soporte prioritario</li>
              <li>Backups diarios</li>
            </ul>
          </div>
        </div>

        {/* Selector de Período */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSelectedPeriod('monthly')}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedPeriod === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setSelectedPeriod('annual')}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedPeriod === 'annual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Anual (Ahorra 5%)
          </button>
        </div>

        {/* Botón de Pago */}
        <button
          onClick={handlePayment}
          disabled={processingPayment}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processingPayment ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CreditCard className="h-5 w-5" />
          )}
          {processingPayment ? 'Procesando...' : `Pagar $${PLAN_PRICES[selectedPeriod].PREMIUM} USD`}
        </button>
        <p className="text-sm text-gray-500 mt-2 text-center">
          Serás redirigido a MercadoPago para completar el pago de forma segura.
        </p>
      </div>

      {/* Facturas */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Facturas
        </h2>

        {invoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay facturas disponibles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(invoice.invoiceDate).toLocaleDateString()} · ${invoice.total} {invoice.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    invoice.status === 'PAID' ? 'bg-green-100 text-green-700' :
                    invoice.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {invoice.status === 'PAID' ? 'Pagada' :
                     invoice.status === 'SENT' ? 'Enviada' : 'Pendiente'}
                  </span>
                  {invoice.pdfUrl && (
                    <a
                      href={invoice.pdfUrl}
                      download
                      className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-all"
                      title="Descargar PDF"
                    >
                      <Download className="h-5 w-5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de Pagos */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Historial de Pagos
        </h2>

        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay pagos registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{payment.planTier} · {payment.period}</p>
                    <p className="text-sm text-gray-600">
                      {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'Pendiente'}
                    </p>
                  </div>
                </div>
                <div className="font-semibold text-gray-900">
                  ${payment.amount} {payment.currency}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
