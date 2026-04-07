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
  monthly: { BASIC: 35, PROFESSIONAL: 69, PREMIUM: 99 },
  annual: { BASIC: 399, PROFESSIONAL: 786, PREMIUM: 1128 }
};

export default function LicensesPanel() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'BASIC' | 'PROFESSIONAL' | 'PREMIUM'>('BASIC');
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
          planTier: selectedPlan,
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
        <h1 className="text-2xl font-bold text-white mb-2">Licencias y Facturación</h1>
        <p className="text-slate-400">Gestiona tu suscripción, pagos y facturas</p>
      </div>

      {/* Estado de Suscripción */}
      <div className={`p-6 rounded-xl border ${
        isExpired ? 'bg-red-500/10 border-red-500/30' :
        isExpiringSoon ? 'bg-yellow-500/10 border-yellow-500/30' :
        'bg-green-500/10 border-green-500/30'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${
            isExpired ? 'bg-red-500/20' :
            isExpiringSoon ? 'bg-yellow-500/20' :
            'bg-green-500/20'
          }`}>
            {isExpired ? (
              <AlertTriangle className="h-6 w-6 text-red-400" />
            ) : isExpiringSoon ? (
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {isExpired ? 'Suscripción Vencida' :
               isExpiringSoon ? 'Renovación Próxima' :
               'Suscripción Activa'}
            </h3>
            <p className="text-slate-400 mt-1">
              {isExpired ? 'Tu suscripción ha vencido. Renueva para continuar usando el sistema.' :
               isExpiringSoon ? `Tu suscripción vence en ${subscription?.daysRemaining} días. Renueva pronto.` :
               `Tu suscripción ${subscription?.planTier} está activa. ${subscription?.daysRemaining} días restantes.`}
            </p>
            {subscription?.endsAt && (
              <div className="flex items-center gap-2 mt-2 text-slate-400">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Vence: {new Date(subscription.endsAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selector de Plan para Pago */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Renovar o Cambiar Plan
        </h2>

        {/* Selector de Plan */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(['BASIC', 'PROFESSIONAL', 'PREMIUM'] as const).map((plan) => (
            <button
              key={plan}
              onClick={() => setSelectedPlan(plan)}
              className={`p-4 rounded-lg border transition-all ${
                selectedPlan === plan
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="font-semibold">{plan}</div>
              <div className="text-sm text-slate-400 mt-1">
                ${PLAN_PRICES[selectedPeriod][plan]}/{selectedPeriod === 'monthly' ? 'mes' : 'año'}
              </div>
            </button>
          ))}
        </div>

        {/* Selector de Período */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSelectedPeriod('monthly')}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedPeriod === 'monthly'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setSelectedPeriod('annual')}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedPeriod === 'annual'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
          {processingPayment ? 'Procesando...' : `Pagar $${PLAN_PRICES[selectedPeriod][selectedPlan]} USD`}
        </button>
        <p className="text-sm text-slate-400 mt-2 text-center">
          Serás redirigido a MercadoPago para completar el pago de forma segura.
        </p>
      </div>

      {/* Facturas */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Facturas
        </h2>

        {invoices.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay facturas disponibles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-slate-400">
                      {new Date(invoice.invoiceDate).toLocaleDateString()} · ${invoice.total} {invoice.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    invoice.status === 'PAID' ? 'bg-green-500/20 text-green-400' :
                    invoice.status === 'SENT' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {invoice.status === 'PAID' ? 'Pagada' :
                     invoice.status === 'SENT' ? 'Enviada' : 'Pendiente'}
                  </span>
                  {invoice.pdfUrl && (
                    <a
                      href={invoice.pdfUrl}
                      download
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
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
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Historial de Pagos
        </h2>

        {payments.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay pagos registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{payment.planTier} · {payment.period}</p>
                    <p className="text-sm text-slate-400">
                      {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'Pendiente'}
                    </p>
                  </div>
                </div>
                <div className="font-semibold text-white">
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
