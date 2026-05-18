'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface OnlyOfficeEditorProps {
  documentId: string;
  apiUrl: string;
  documentTitle?: string;
}

export default function OnlyOfficeEditor({ documentId, documentTitle }: OnlyOfficeEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const ooBase = 'https://docs.logismart.ar';
  const appBase = 'https://www.logismart.ar';

  const extRaw = (documentTitle || '').split('.').pop()?.toLowerCase() || 'docx';
  const extMap: Record<string, string> = { doc:'docx', docx:'docx', xls:'xlsx', xlsx:'xlsx', ppt:'pptx', pptx:'pptx', pdf:'pdf' };
  const fileExt = extMap[extRaw] || 'docx';

  const params = new URLSearchParams({
    docId: documentId,
    title: documentTitle || 'Documento',
    ext: fileExt,
    apiBase: appBase,
    t: Date.now().toString(),
  });

  const iframeSrc = `${ooBase}/editor?${params.toString()}`;

  return (
    <div className="absolute inset-0 bg-gray-900">
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-gray-400">Cargando editor de documentos...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3 p-8 text-center">
          <p className="text-red-400 text-sm">No se pudo cargar el editor.</p>
          <button onClick={() => { setError(false); setLoading(true); }} className="text-xs text-blue-400 underline">Reintentar</button>
        </div>
      )}
      {!error && (
        <iframe
          key={documentId}
          src={iframeSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          onLoad={() => setLoading(false)}
          onError={() => { setError(true); setLoading(false); }}
          allow="fullscreen"
          title="Editor de documentos"
        />
      )}
    </div>
  );
}
