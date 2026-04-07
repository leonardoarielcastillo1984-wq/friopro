'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  CreditCard, 
  Calendar, 
  Download,
  Search,
  Filter,
  Receipt,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string;
  planTier: string;
  period: string;
  provider: string;
  providerRef?: string;
  subscription?: {
    id: string;
    plan: {
      tier: string;
      name: string;
    };
  };
}

export default function PagosPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const response = await apiFetch('/license/payments');
      setPayments(response || []);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'REFUNDED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'FAILED': return <XCircle className="h-4 w-4" />;
      case 'REFUNDED': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.planTier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.providerRef?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalPaid = payments
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingPayments = payments.filter(p => p.status === 'PENDING').length;

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
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
          <h1 className="text-3xl font-bold">Historial de Pagos</h1>
          <p className="text-gray-600 mt-2">
            Revisa todas tus transacciones y pagos realizados
          </p>
        </div>
        <Link href="/licencia/planes">
          <Button>
            <CreditCard className="h-4 w-4 mr-2" />
            Nuevo Pago
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pagado</p>
                <p className="text-2xl font-bold">${totalPaid.toFixed(2)} USD</p>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pagos Completados</p>
                <p className="text-2xl font-bold">
                  {payments.filter(p => p.status === 'COMPLETED').length}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pagos Pendientes</p>
                <p className="text-2xl font-bold">{pendingPayments}</p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por plan, proveedor o referencia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === 'COMPLETED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('COMPLETED')}
              >
                Completados
              </Button>
              <Button
                variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('PENDING')}
              >
                Pendientes
              </Button>
              <Button
                variant={statusFilter === 'FAILED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('FAILED')}
              >
                Fallidos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="h-5 w-5" />
            <span>Transacciones</span>
          </CardTitle>
          <CardDescription>
            {filteredPayments.length} {filteredPayments.length === 1 ? 'pago encontrado' : 'pagos encontrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length > 0 ? (
            <div className="space-y-4">
              {filteredPayments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${
                        payment.status === 'COMPLETED' ? 'bg-green-100' :
                        payment.status === 'PENDING' ? 'bg-yellow-100' :
                        payment.status === 'FAILED' ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                        {getStatusIcon(payment.status)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">
                            Plan {payment.planTier} - {payment.period === 'monthly' ? 'Mensual' : 'Anual'}
                          </h3>
                          <Badge className={getStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(payment.paidAt).toLocaleDateString()}
                          </span>
                          <span>Proveedor: {payment.provider}</span>
                          {payment.providerRef && (
                            <span>Ref: {payment.providerRef}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">${payment.amount.toFixed(2)} USD</p>
                      <div className="flex items-center space-x-2 mt-2">
                        {payment.status === 'COMPLETED' && (
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Comprobante
                          </Button>
                        )}
                        {payment.status === 'PENDING' && (
                          <Button size="sm">
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pagar Ahora
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No se encontraron pagos' : 'No tienes pagos registrados'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Realiza tu primer pago para comenzar a usar el sistema'
                }
              </p>
              {(!searchTerm && statusFilter === 'all') && (
                <Link href="/licencia/planes">
                  <Button>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Realizar Primer Pago
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
