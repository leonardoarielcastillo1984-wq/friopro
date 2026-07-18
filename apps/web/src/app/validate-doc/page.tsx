'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck, ShieldX, FileText, AlertTriangle, Loader2,
  CheckCircle, XCircle, Clock, Hash, Calendar, Building2,
} from 'lucide-react';

interface ValidationResult {
  valid: boolean;
  status: string;
  documentCode?: string;
  revision?: number;
  documentTitle?: string;
  module?: string;
  screenName?: string;
  message: string;
}

export default function ValidateDocPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`/api/doc-export/validate/${token}`)
      .then(r => r.json())
      .then(data => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        setResult({
          valid: false,
          status: 'ERROR',
          message: 'Error al validar el documento.',
        });
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-neutral-500">Validando documento...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md w-full rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-neutral-800 mb-2">Token no proporcionado</h1>
          <p className="text-sm text-neutral-500">
            Se requiere un token de validación. Escaneá el código QR del documento para validar su autenticidad.
          </p>
        </div>
      </div>
    );
  }

  const isValid = result?.valid;
  const isObsolete = result?.status === 'OBSOLETE';

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="max-w-lg w-full rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className={`p-6 text-center ${isValid ? 'bg-green-50' : isObsolete ? 'bg-amber-50' : 'bg-red-50'}`}>
          {isValid ? (
            <ShieldCheck className="h-20 w-20 text-green-500 mx-auto mb-3" />
          ) : isObsolete ? (
            <AlertTriangle className="h-20 w-20 text-amber-500 mx-auto mb-3" />
          ) : (
            <ShieldX className="h-20 w-20 text-red-500 mx-auto mb-3" />
          )}
          <h1 className={`text-2xl font-bold ${isValid ? 'text-green-700' : isObsolete ? 'text-amber-700' : 'text-red-700'}`}>
            {isValid ? 'Documento Válido' : isObsolete ? 'Documento Obsoleto' : 'Documento No Válido'}
          </h1>
          <p className={`text-sm mt-1 ${isValid ? 'text-green-600' : isObsolete ? 'text-amber-600' : 'text-red-600'}`}>
            {result?.message}
          </p>
        </div>

        {/* Datos */}
        {result && (result.documentCode || result.documentTitle) && (
          <div className="p-6 space-y-3">
            {result.documentCode && (
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-neutral-400" />
                <div>
                  <div className="text-xs text-neutral-400">Código Documental</div>
                  <code className="font-mono font-bold text-blue-700">{result.documentCode}</code>
                </div>
              </div>
            )}
            {result.revision !== undefined && result.revision > 0 && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-neutral-400" />
                <div>
                  <div className="text-xs text-neutral-400">Revisión</div>
                  <span className="font-medium text-neutral-800">R{String(result.revision).padStart(2, '0')}</span>
                </div>
              </div>
            )}
            {result.documentTitle && (
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-neutral-400" />
                <div>
                  <div className="text-xs text-neutral-400">Título</div>
                  <span className="font-medium text-neutral-800">{result.documentTitle}</span>
                </div>
              </div>
            )}
            {result.module && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-neutral-400" />
                <div>
                  <div className="text-xs text-neutral-400">Módulo del Sistema</div>
                  <span className="font-medium text-neutral-800 capitalize">{result.module}</span>
                </div>
              </div>
            )}
            {result.screenName && (
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-neutral-400" />
                <div>
                  <div className="text-xs text-neutral-400">Salida</div>
                  <span className="font-medium text-neutral-800">{result.screenName}</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              {isValid ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
              <div>
                <div className="text-xs text-neutral-400">Estado</div>
                <span className={`font-medium ${isValid ? 'text-green-700' : 'text-red-700'}`}>
                  {result.status === 'EFFECTIVE' ? 'Vigente' :
                   result.status === 'OBSOLETE' ? 'Obsoleto' :
                   result.status === 'DRAFT' ? 'Borrador' :
                   result.status === 'EXPIRED' ? 'Token Expirado' :
                   result.status === 'NOT_FOUND' ? 'No Encontrado' :
                   result.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-neutral-100 p-4 text-center">
          <p className="text-xs text-neutral-400">
            Sistema de Gestión Integrado · Validación de Documentos Controlados
          </p>
          <p className="text-xs text-neutral-300 mt-1">
            Este documento ha sido verificado electrónicamente mediante código QR
          </p>
        </div>
      </div>
    </div>
  );
}
