'use client';

import { useState, useMemo } from 'react';
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
  const docType = fileExt === 'xlsx' ? 'spreadsheet' : fileExt === 'pptx' ? 'presentation' : 'word';
  const docKey = documentId.replace(/-/g, '') + '_' + Date.now();

  const srcdoc = useMemo(() => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body,#editor{width:100%;height:100%;overflow:hidden}</style>
</head>
<body>
<div id="editor"></div>
<script>
var config = {
  document: {
    fileType: "${fileExt}",
    key: "${docKey}",
    title: ${JSON.stringify(documentTitle || 'Documento')},
    url: "${appBase}/api/documents/${documentId}/file",
    permissions: { edit: true, download: true }
  },
  documentType: "${docType}",
  editorConfig: {
    callbackUrl: "${appBase}/api/documents/${documentId}/onlyoffice-callback",
    lang: "es",
    mode: "edit",
    customization: { autosave: true, forcesave: false, customer: { name: "SGI 360" } }
  },
  height: "100%",
  width: "100%"
};
var s = document.createElement("script");
s.src = "${ooBase}/web-apps/apps/api/documents/api.js";
s.onload = function() {
  if (typeof DocsAPI !== "undefined") {
    new DocsAPI.DocEditor("editor", config);
  }
};
document.head.appendChild(s);
</script>
</body>
</html>`, [documentId, documentTitle, fileExt, docType, docKey, ooBase, appBase]);

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
          srcDoc={srcdoc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          onLoad={() => setLoading(false)}
          onError={() => { setError(true); setLoading(false); }}
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          title="Editor de documentos"
        />
      )}
    </div>
  );
}
