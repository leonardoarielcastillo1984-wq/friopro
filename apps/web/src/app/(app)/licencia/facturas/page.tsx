'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Download, 
  Calendar,
  Search,
  Filter,
  Eye,
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: string;
  createdAt: string;
  pdfUrl?: string;
  payment?: {
    id: string;
    amount: number;
    planTier: string;
    period: string;
  };
  tenant?: {
    name: string;
  };
}

export default function FacturasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await apiFetch('/license/invoices');
      setInvoices(response || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'ISSUED': return 'bg-blue-100 text-blue-800';
      case 'SENT': return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return <CheckCircle className="h-4 w-4" />;
      case 'ISSUED': return <FileText className="h-4 w-4" />;
      case 'SENT': return <Mail className="h-4 w-4" />;
      case 'OVERDUE': return <AlertCircle className="h-4 w-4" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PAID': return 'Pagada';
      case 'ISSUED': return 'Emitida';
      case 'SENT': return 'Enviada';
      case 'OVERDUE': return 'Vencida';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  };

  const handleDownloadPDF = async (invoiceId: string, pdfUrl: string) => {
    setDownloading(invoiceId);
    try {
      // Create download link
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `factura-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar el PDF. Por favor intenta nuevamente.');
    } finally {
      setDownloading(null);
    }
  };

  const handleViewPDF = (pdfUrl: string) => {
    window.open(pdfUrl, '_blank');
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.payment?.planTier.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const paidInvoices = invoices.filter(i => i.status === 'PAID').length;
  const pendingInvoices = invoices.filter(i => i.status === 'ISSUED' || i.status === 'SENT').length;

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
          <h1 className="text-3xl font-bold">Facturas</h1>
          <p className="text-gray-600 mt-2">
            Gestiona y descarga todas tus facturas y comprobantes
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Enviar por Email
          </Button>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Nueva Factura
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Facturado</p>
                <p className="text-2xl font-bold">${totalInvoiced.toFixed(2)} USD</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Facturas Pagadas</p>
                <p className="text-2xl font-bold">{paidInvoices}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold">{pendingInvoices}</p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Facturas</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-full">
                <FileText className="h-6 w-6 text-purple-600" />
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
                  placeholder="Buscar por número de factura o plan..."
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
                Todas
              </Button>
              <Button
                variant={statusFilter === 'PAID' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('PAID')}
              >
                Pagadas
              </Button>
              <Button
                variant={statusFilter === 'ISSUED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('ISSUED')}
              >
                Emitidas
              </Button>
              <Button
                variant={statusFilter === 'OVERDUE' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('OVERDUE')}
              >
                Vencidas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Facturas</span>
          </CardTitle>
          <CardDescription>
            {filteredInvoices.length} {filteredInvoices.length === 1 ? 'factura encontrada' : 'facturas encontradas'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length > 0 ? (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${
                        invoice.status === 'PAID' ? 'bg-green-100' :
                        invoice.status === 'ISSUED' ? 'bg-blue-100' :
                        invoice.status === 'SENT' ? 'bg-yellow-100' :
                        invoice.status === 'OVERDUE' ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                        {getStatusIcon(invoice.status)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                          <Badge className={getStatusColor(invoice.status)}>
                            {getStatusText(invoice.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(invoice.createdAt).toLocaleDateString()}
                          </span>
                          {invoice.payment && (
                            <>
                              <span>Plan {invoice.payment.planTier}</span>
                              <span>{invoice.payment.period === 'monthly' ? 'Mensual' : 'Anual'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">${invoice.total.toFixed(2)} USD</p>
                      <div className="flex items-center space-x-2 mt-2">
                        {invoice.pdfUrl && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewPDF(invoice.pdfUrl!)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDownloadPDF(invoice.id, invoice.pdfUrl!)}
                              disabled={downloading === invoice.id}
                            >
                              {downloading === invoice.id ? (
                                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              Descargar
                            </Button>
                          </>
                        )}
                        {invoice.status === 'ISSUED' && (
                          <Button size="sm">
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pagar
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
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No se encontraron facturas' : 'No tienes facturas emitidas'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Las facturas se generarán automáticamente cuando realices pagos'
                }
              </p>
              {(!searchTerm && statusFilter === 'all') && (
                <Link href="/licencia/planes">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Realizar Pago
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
