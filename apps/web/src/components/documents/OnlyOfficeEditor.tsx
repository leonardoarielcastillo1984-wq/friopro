'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface OnlyOfficeEditorProps {
  documentId: string;
  apiUrl: string;
  documentTitle?: string;
}

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

export default function OnlyOfficeEditor({ documentId, apiUrl, documentTitle }: OnlyOfficeEditorProps) {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const containerId = `oo-editor-${documentId}`;

    const initEditor = () => {
      if (!window.DocsAPI) {
        setError('No se pudo conectar con el servidor de documentos (OnlyOffice).');
        setLoading(false);
        return;
      }

      // URL base del sitio (funciona tanto en HTTP como HTTPS)
      const origin = window.location.origin;
      const fileUrl = `${origin}/api/documents/${documentId}/file`;
      const callbackUrl = `${origin}/api/documents/${documentId}/onlyoffice-callback`;

      // Detectar extensión desde el título
      const ext = (documentTitle || '').split('.').pop()?.toLowerCase() || 'docx';
      const docType = ['xlsx', 'xls', 'csv', 'ods'].includes(ext) ? 'cell'
        : ['pptx', 'ppt', 'odp'].includes(ext) ? 'slide'
        : 'word';

      editorRef.current = new window.DocsAPI.DocEditor(containerId, {
        document: {
          fileType: ext,
          key: `${documentId}-${Date.now()}`,
          title: documentTitle || 'Documento',
          url: fileUrl,
          permissions: {
            comment: true,
            download: true,
            edit: true,
            fillForms: true,
            modifyContentControl: true,
            modifyFilter: true,
            print: true,
            review: true,
          },
        },
        documentType: docType,
        editorConfig: {
          callbackUrl,
          lang: 'es',
          user: {
            id: 'sgi-user',
            name: 'Usuario SGI',
          },
          customization: {
            autosave: true,
            forcesave: false,
            logo: { visible: false },
            toolbar: true,
            statusBar: true,
            chat: false,
            comments: true,
            compactHeader: true,
            toolbarNoTabs: false,
            uiTheme: 'theme-light',
          },
        },
        events: {
          onReady: () => setLoading(false),
          onError: (err: any) => {
            console.error('OnlyOffice error:', err);
            setError('Error al cargar el editor. Verificá que el documento sea válido.');
            setLoading(false);
          },
        },
        width: '100%',
        height: '100%',
      });
    };

    // Cargar el script de OnlyOffice desde el proxy /onlyoffice/ (HTTPS seguro)
    if (window.DocsAPI) {
      initEditor();
    } else {
      const script = document.createElement('script');
      const scriptSrc = `${window.location.origin}/onlyoffice/web-apps/apps/api/documents/api.js`;
      script.src = scriptSrc;
      script.async = true;
      script.onload = () => initEditor();
      script.onerror = () => {
        setError('No se pudo cargar el editor de documentos. Contactá al administrador.');
        setLoading(false);
      };
      document.head.appendChild(script);
    }

    return () => {
      if (editorRef.current?.destroyEditor) {
        editorRef.current.destroyEditor();
      }
    };
  }, [documentId]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-gray-400">Cargando editor de documentos...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 gap-3 p-8 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      <div id={`oo-editor-${documentId}`} ref={containerRef} className="w-full h-full" />
    </div>
  );
}
