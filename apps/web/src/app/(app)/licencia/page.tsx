'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard,
  FileText,
  History,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  BarChart3,
  Zap,
  Database,
  Smartphone,
  Lock,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Subscription {
  id: string;
  planTier: string;
  status: string;
  startedAt: string;
  endsAt: string;
  daysRemaining: number;
  isInGracePeriod: boolean;
  graceDaysRemaining: number;
  isExpired: boolean;
  provider: string;
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: string;
  createdAt: string;
  pdfUrl?: string;
}

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  percentage: number;
}

interface UsageHistory {
  date: string;
  usage: number;
  action: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

export default function LicenciaPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetric[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subResponse, paymentsResponse, invoicesResponse, usageResponse, historyResponse, methodsResponse] = await Promise.all([
        apiFetch('/license/subscription'),
        apiFetch('/license/payments'),
        apiFetch('/license/invoices'),
        apiFetch('/license/usage').catch(() => null),
        apiFetch('/license/usage-history').catch(() => null),
        apiFetch('/license/payment-methods').catch(() => null)
      ]);

      setSubscription(subResponse);
      setPayments(Array.isArray(paymentsResponse) ? paymentsResponse : []);
      setInvoices(Array.isArray(invoicesResponse) ? invoicesResponse : []);

      // Mock usage data - será reemplazado por API real
      if (!usageResponse) {
        setUsageMetrics([
          { name: 'Documentos', current: 245, limit: 500, percentage: 49 },
          { name: 'Usuarios', current: 12, limit: 50, percentage: 24 },
          { name: 'Almacenamiento', current: 8.5, limit: 100, percentage: 9 },
          { name: 'Integraciones', current: 5, limit: 10, percentage: 50 }
        ]);

        setUsageHistory([
          { date: '2026-04-05', usage: 245, action: 'Documento cargado' },
          { date: '2026-04-04', usage: 240, action: 'Documentos procesados' },
          { date: '2026-04-03', usage: 235, action: 'Búsqueda de documentos' },
          { date: '2026-04-02', usage: 230, action: 'Documento descargado' },
          { date: '2026-04-01', usage: 225, action: 'Documento compartido' }
        ]);
      } else {
        setUsageMetrics(usageResponse.metrics || []);
        setUsageHistory(usageResponse.history || []);
      }

      if (!methodsResponse) {
        setPaymentMethods([
          { id: '1', type: 'MercadoPago', last4: '4242', expiry: '12/25', isDefault: true },
          { id: '2', type: 'Transferencia Bancaria', last4: 'XXXX', expiry: 'N/A', isDefault: false }
        ]);
      } else {
        setPaymentMethods(methodsResponse || []);
      }
    } catch (error) {
      console.error('Error loading license data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'TRIAL': return 'bg-blue-100 text-blue-800';
      case 'PAST_DUE': return 'bg-yellow-100 text-yellow-800';
      case 'CANCELED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="h-4 w-4" />;
      case 'TRIAL': return <Clock className="h-4 w-4" />;
      case 'PAST_DUE': return <AlertCircle className="h-4 w-4" />;
      case 'CANCELED': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid gap-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Licencia</h1>
          <p className="text-gray-600 mt-2">
            Administra tu suscripción, pagos y facturas
          </p>
        </div>
        <Link href="/licencia/planes">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <CreditCard className="h-4 w-4 mr-2" />
            Cambiar Plan
          </Button>
        </Link>
      </div>

      {/* Alertas */}
      {subscription?.isExpired && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-800">
                  Tu suscripción ha vencido
                </p>
                <p className="text-red-600 text-sm">
                  Renueva tu plan para continuar usando todos los módulos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {subscription?.isInGracePeriod && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-800">
                  Período de gracia activo
                </p>
                <p className="text-yellow-600 text-sm">
                  Te quedan {subscription.graceDaysRemaining} días para renovar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="usage">Uso y Límites</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        {/* Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Suscripción Actual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Suscripción Actual</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscription ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Plan</span>
                      <Badge variant="outline" className="font-semibold">
                        {subscription.planTier}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Estado</span>
                      <Badge className={getStatusColor(subscription.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(subscription.status)}
                          <span>{subscription.status}</span>
                        </div>
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Inicio</span>
                      <span className="text-sm">
                        {new Date(subscription.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Vencimiento</span>
                      <span className="text-sm">
                        {subscription.endsAt 
                          ? new Date(subscription.endsAt).toLocaleDateString()
                          : 'Sin límite'
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Días restantes</span>
                      <span className={`text-sm font-semibold ${
                        subscription.daysRemaining > 30 
                          ? 'text-green-600'
                          : subscription.daysRemaining > 7
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {subscription.daysRemaining > 0 
                          ? `${subscription.daysRemaining} días`
                          : 'Vencido'
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Proveedor</span>
                      <span className="text-sm">{subscription.provider}</span>
                    </div>
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <h4 className="font-semibold text-sm">Información de Renovación</h4>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Próxima renovación</span>
                        <span className="text-sm font-semibold text-blue-600">
                          {subscription.endsAt
                            ? new Date(subscription.endsAt).toLocaleDateString()
                            : 'Sin límite'
                          }
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 mb-4">No tienes una suscripción activa</p>
                    <Link href="/licencia/planes">
                      <Button>Seleccionar Plan</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Estadísticas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Estadísticas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total pagado</span>
                  <span className="text-sm font-semibold">
                    ${Array.isArray(payments) ? payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2) : '0.00'} USD
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pagos realizados</span>
                  <span className="text-sm font-semibold">{Array.isArray(payments) ? payments.length : 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Facturas emitidas</span>
                  <span className="text-sm font-semibold">{Array.isArray(invoices) ? invoices.length : 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Último pago</span>
                  <span className="text-sm">
                    {Array.isArray(payments) && payments.length > 0
                      ? new Date(payments[0].paidAt).toLocaleDateString()
                      : 'Ninguno'
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Uso y Límites */}
        <TabsContent value="usage" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Métricas de Uso */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Uso por Servicio</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {Array.isArray(usageMetrics) ? usageMetrics.map((metric, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{metric.name}</span>
                      <span className="text-sm text-gray-600">
                        {metric.current} / {metric.limit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          metric.percentage > 80
                            ? 'bg-red-500'
                            : metric.percentage > 60
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(metric.percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 mt-1">
                      {metric.percentage}% utilizado
                    </span>
                  </div>
                )) : null}
              </CardContent>
            </Card>

            {/* Información de Límites */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Límites del Plan</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Almacenamiento Total</p>
                      <p className="text-sm text-gray-600">100 GB disponible</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start space-x-3">
                    <Users className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Usuarios Concurrentes</p>
                      <p className="text-sm text-gray-600">Hasta 50 usuarios simultáneos</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start space-x-3">
                    <Smartphone className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Dispositivos</p>
                      <p className="text-sm text-gray-600">Acceso desde 5 dispositivos</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Historial de Uso */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <History className="h-5 w-5" />
                <span>Historial de Uso</span>
              </CardTitle>
              <CardDescription>
                Últimas actividades y cambios de uso
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(usageHistory) && usageHistory.length > 0 ? (
                <div className="space-y-3">
                  {usageHistory.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 rounded-full">
                          <TrendingUp className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{entry.action}</p>
                          <p className="text-xs text-gray-600">
                            {new Date(entry.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{entry.usage}</p>
                        <p className="text-xs text-gray-600">documentos</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay historial de uso disponible</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pagos */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <History className="h-5 w-5" />
                <span>Historial de Pagos</span>
              </CardTitle>
              <CardDescription>
                Todos tus pagos y transacciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(payments) && payments.length > 0 ? (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-green-100 rounded-full">
                          <CreditCard className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold">
                            Plan {payment.planTier} - {payment.period}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(payment.paidAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${payment.amount.toFixed(2)} USD</p>
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No tienes pagos registrados</p>
                  <Link href="/licencia/planes">
                    <Button className="mt-4">Realizar primer pago</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Facturas */}
        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Facturas</span>
              </CardTitle>
              <CardDescription>
                Facturas y comprobantes de pago
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(invoices) && invoices.length > 0 ? (
                <div className="space-y-4">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 rounded-full">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(invoice.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-semibold">${invoice.total.toFixed(2)} USD</p>
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </div>
                        {invoice.pdfUrl && (
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No tienes facturas emitidas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración */}
        <TabsContent value="settings" className="space-y-6">
          {/* Métodos de Pago */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Métodos de Pago</span>
              </CardTitle>
              <CardDescription>
                Gestiona tus métodos de pago disponibles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.isArray(paymentMethods) && paymentMethods.length > 0 ? (
                <>
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <CreditCard className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold">{method.type}</p>
                            <p className="text-sm text-gray-600">
                              Termina en {method.last4}
                              {method.expiry !== 'N/A' && ` • Expira ${method.expiry}`}
                            </p>
                          </div>
                        </div>
                        {method.isDefault && (
                          <Badge className="bg-green-100 text-green-800">Predeterminado</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!method.isDefault && (
                          <Button variant="outline" size="sm">
                            Establecer como predeterminado
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="text-red-600">
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-6">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay métodos de pago agregados</p>
                </div>
              )}

              <Button className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                Agregar nuevo método de pago
              </Button>
            </CardContent>
          </Card>

          {/* Información de Facturación */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Información de Facturación</span>
              </CardTitle>
              <CardDescription>
                Datos para la emisión de facturas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium">Empresa</label>
                  <p className="text-sm text-gray-600 mt-1">Tu empresa</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Email de facturación</label>
                  <p className="text-sm text-gray-600 mt-1">ejemplo@empresa.com</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Dirección fiscal</label>
                  <p className="text-sm text-gray-600 mt-1">Calle Principal 123, Santiago, Chile</p>
                </div>
                <div>
                  <label className="text-sm font-medium">RFC/RUT</label>
                  <p className="text-sm text-gray-600 mt-1">12.345.678-9</p>
                </div>
              </div>
              <Button variant="outline" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Editar información de facturación
              </Button>
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5" />
                <span>Seguridad de Pago</span>
              </CardTitle>
              <CardDescription>
                Configuración de seguridad para tus pagos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-semibold text-sm">Cifrado SSL/TLS activo</p>
                </div>
                <p className="text-sm text-gray-600">Tus datos de pago están protegidos con cifrado de nivel bancario</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <p className="font-semibold text-sm">PCI DSS Cumplido</p>
                </div>
                <p className="text-sm text-gray-600">Cumplimos con los estándares de seguridad de datos de tarjetas de crédito</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
