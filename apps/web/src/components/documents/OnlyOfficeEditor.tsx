'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

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

export default function OnlyOfficeEditor({ documentId, documentTitle }: OnlyOfficeEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const ooContainerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Crear el div del editor FUERA del árbol React (appendChild directo al DOM)
    // para evitar que React y OnlyOffice compitan en el mismo nodo
    const containerId = `oo-container-${documentId}`;
    const ooDiv = document.createElement('div');
    ooDiv.id = containerId;
    ooDiv.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;';
    wrapper.appendChild(ooDiv);
    ooContainerRef.current = ooDiv;

    const initEditor = () => {
      if (!window.DocsAPI) {
        setError('No se pudo conectar con el servidor de documentos.');
        setLoading(false);
        return;
      }

      const origin = window.location.origin;
      const fileUrl = `${origin}/api/documents/${documentId}/file`;
      const callbackUrl = `${origin}/api/documents/${documentId}/onlyoffice-callback`;

      const ext = (documentTitle || '').split('.').pop()?.toLowerCase() || 'docx';
      const docType = ['xlsx', 'xls', 'csv', 'ods'].includes(ext) ? 'cell'
        : ['pptx', 'ppt', 'odp'].includes(ext) ? 'slide'
        : 'word';

      try {
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
            user: { id: 'sgi-user', name: 'Usuario SGI' },
            customization: {
              autosave: true,
              forcesave: false,
              logo: { visible: false },
              chat: false,
              comments: true,
              compactHeader: true,
              uiTheme: 'theme-light',
            },
          },
          events: {
            onReady: () => setLoading(false),
            onError: (err: any) => {
              console.error('OnlyOffice error:', err);
              setError('Error al abrir el documento. Verificá que el formato sea compatible.');
              setLoading(false);
            },
          },
          width: '100%',
          height: '100%',
        });
      } catch (e) {
        console.error('OnlyOffice init error:', e);
        setError('Error al inicializar el editor.');
        setLoading(false);
      }
    };

    if (window.DocsAPI) {
      initEditor();
    } else {
      const script = document.createElement('script');
      const ooHost = (window.location.hostname === 'logismart.ar' || window.location.hostname === 'www.logismart.ar')
        ? 'https://docs.logismart.ar'
        : `http://${window.location.hostname}:8080`;
      const scriptSrc = `${ooHost}/web-apps/apps/api/documents/api.js`;
      script.src = scriptSrc;
      script.async = true;
      script.setAttribute('data-oo-api', '1');
      script.onload = () => initEditor();
      script.onerror = () => {
        setError('No se pudo cargar el editor. Verificá la conexión con el servidor.');
        setLoading(false);
      };
      document.head.appendChild(script);
    }

    return () => {
      try { editorRef.current?.destroyEditor?.(); } catch { /* ok */ }
      try { ooContainerRef.current?.remove(); } catch { /* ok */ }
      ooContainerRef.current = null;
      // Limpiar DocsAPI para que la próxima apertura cargue una sesión nueva
      try { delete (window as any).DocsAPI; } catch { /* ok */ }
      // Remover el script tag para permitir recarga limpia
      const oldScript = document.querySelector('script[data-oo-api]');
      try { oldScript?.remove(); } catch { /* ok */ }
    };
  }, [documentId]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full bg-gray-100">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-20 gap-3 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-gray-400">Cargando editor de documentos...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-20 gap-3 p-8 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-blue-400 underline"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
