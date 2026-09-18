import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { getStorage } from '../services/storage.js';

/**
 * Backup documental — descarga todos los archivos cargados por la empresa
 * en un único ZIP, organizado en carpetas por módulo.
 *
 *   GET /company/document-backup  →  backup-documental-{empresa}-{fecha}.zip
 *
 * Implementa un ZIP "STORE" (sin compresión) escrito a mano: los documentos
 * ya son PDF/imágenes comprimidas, así que la compresión no aporta y evita
 * agregar una dependencia. El formato es 100% compatible con cualquier unzip.
 */

// ── CRC32 (tabla estándar) ────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

type ZipEntry = { name: string; data: Buffer; offset: number };

function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const now = dosDateTime(new Date());

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // flag: UTF-8 names
    local.writeUInt16LE(0, 8);           // method: STORE
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);          // extra len
    chunks.push(local, nameBuf, f.data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);             // version made by
    cd.writeUInt16LE(20, 6);             // version needed
    cd.writeUInt16LE(0x0800, 8);         // flag UTF-8
    cd.writeUInt16LE(0, 10);             // method STORE
    cd.writeUInt16LE(now.time, 12);
    cd.writeUInt16LE(now.date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(f.data.length, 20);
    cd.writeUInt32LE(f.data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);             // extra
    cd.writeUInt16LE(0, 32);             // comment
    cd.writeUInt16LE(0, 34);             // disk start
    cd.writeUInt16LE(0, 36);             // internal attrs
    cd.writeUInt32LE(0, 38);             // external attrs
    cd.writeUInt32LE(offset, 42);        // local header offset
    central.push(Buffer.concat([cd, nameBuf]));

    offset += 30 + nameBuf.length + f.data.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, cdBuf, eocd]);
}

// ── Resolución de referencia de archivo → storage key ─────────────────────────
// Los archivos se guardan como:
//   - filePath: storage key directa (getStorage().download(key))
//   - fileUrl:  URL pública ".../uploads/{key}" o path "/uploads/{key}"
// En ambos casos la key es lo que sigue a /uploads/ (o el valor tal cual si es key).
function keyFromRef(ref: string | null | undefined): string | null {
  if (!ref || typeof ref !== 'string') return null;
  const idx = ref.indexOf('/uploads/');
  if (idx >= 0) return ref.slice(idx + '/uploads/'.length).split('?')[0] || null;
  if (!ref.includes('://') && !ref.startsWith('/')) return ref; // storage key directa
  return null; // URL externa o patrón desconocido
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'archivo';
}

function fileNameFromKey(key: string, fallback: string): string {
  const base = key.split('/').pop() || fallback;
  return safeName(base);
}

// Extrae URLs de un campo Json que puede ser [{url}], ["url"], o [{name,url}]
function urlsFromJson(json: any): string[] {
  if (!json) return [];
  const arr = Array.isArray(json) ? json : [];
  return arr.map((x: any) => (typeof x === 'string' ? x : x?.url)).filter(Boolean);
}

// ── Fuentes de documentos por módulo ──────────────────────────────────────────
// Cada fuente devuelve [{ ref, name }] donde ref es fileUrl/filePath y name el
// nombre sugerido dentro del zip.
type Source = { folder: string; fetch: (prisma: any, tenantId: string) => Promise<{ ref: string; name?: string }[]> };

const SOURCES: Source[] = [
  // ── SGI / Gestión documental ──
  {
    folder: 'SGI/Documentos',
    fetch: async (p, t) => {
      const docs = await p.document.findMany({ where: { tenantId: t, filePath: { not: null } }, select: { title: true, filePath: true } });
      const versions = await p.documentVersion.findMany({ where: { document: { tenantId: t } }, select: { filePath: true, originalName: true, version: true, document: { select: { title: true } } } });
      return [
        ...docs.map((d: any) => ({ ref: d.filePath, name: d.title })),
        ...versions.map((v: any) => ({ ref: v.filePath, name: v.originalName || `${v.document?.title || 'doc'}_v${v.version}` })),
      ];
    },
  },
  // ── Flota 360 ──
  {
    folder: 'Flota360/Documentos chofer',
    fetch: async (p, t) => (await p.flotaDocumento.findMany({ where: { tenantId: t }, select: { titulo: true, fileUrl: true, fileName: true } }))
      .map((d: any) => ({ ref: d.fileUrl, name: d.fileName || d.titulo })),
  },
  {
    folder: 'Flota360/Facturas',
    fetch: async (p, t) => (await p.flotaFactura.findMany({ where: { tenantId: t, fileUrl: { not: null } }, select: { fileUrl: true, fileName: true, numero: true, proveedor: true } }))
      .map((d: any) => ({ ref: d.fileUrl, name: d.fileName || `factura_${d.numero || d.proveedor || ''}` })),
  },
  {
    folder: 'Flota360/Multas',
    fetch: async (p, t) => (await p.flotaMulta.findMany({ where: { tenantId: t, fileUrl: { not: null } }, select: { fileUrl: true, fileName: true, actaNumero: true } }))
      .map((d: any) => ({ ref: d.fileUrl, name: d.fileName || `multa_${d.actaNumero || ''}` })),
  },
  {
    folder: 'Flota360/Incidentes',
    fetch: async (p, t) => (await p.flotaIncidente.findMany({ where: { tenantId: t, fotos: { not: null } }, select: { fotos: true, tipo: true } }))
      .flatMap((d: any) => urlsFromJson(d.fotos).map((u: string) => ({ ref: u, name: `incidente_${d.tipo}` }))),
  },
  {
    folder: 'Flota360/Bitacora',
    fetch: async (p, t) => (await p.servicioRegistro.findMany({ where: { tenantId: t, fotos: { not: null } }, select: { fotos: true, tipo: true } }))
      .flatMap((d: any) => urlsFromJson(d.fotos).map((u: string) => ({ ref: u, name: `registro_${d.tipo}` }))),
  },
  {
    folder: 'Flota360/Conductores',
    fetch: async (p, t) => (await p.conductor.findMany({ where: { tenantId: t }, select: { nombre: true, licenciaFileUrl: true, psicofisicoFileUrl: true } }))
      .flatMap((c: any) => [
        c.licenciaFileUrl ? { ref: c.licenciaFileUrl, name: `licencia_${c.nombre}` } : null,
        c.psicofisicoFileUrl ? { ref: c.psicofisicoFileUrl, name: `psicofisico_${c.nombre}` } : null,
      ].filter(Boolean)),
  },
  // ── Calidad ──
  {
    folder: 'Calidad/NC adjuntos',
    fetch: async (p, t) => (await p.nonConformityAttachment.findMany({ where: { ncr: { tenantId: t } }, select: { url: true, filename: true } }))
      .map((a: any) => ({ ref: a.url, name: a.filename })),
  },
  {
    folder: 'Calidad/CAPA adjuntos',
    fetch: async (p, t) => (await p.actionPlanAttachment.findMany({ where: { actionPlan: { tenantId: t } }, select: { url: true, filename: true } }))
      .map((a: any) => ({ ref: a.url, name: a.filename })),
  },
  {
    folder: 'Calidad/Gestion de cambio',
    fetch: async (p, t) => (await p.gestionCambioEvidencia.findMany({ where: { tenantId: t, fileUrl: { not: null } }, select: { fileUrl: true, fileName: true } }))
      .map((e: any) => ({ ref: e.fileUrl, name: e.fileName })),
  },
  // ── Mantenimiento ──
  {
    folder: 'Mantenimiento/OT adjuntos',
    fetch: async (p, t) => (await p.workOrderFile.findMany({ where: { workOrder: { tenantId: t } }, select: { fileUrl: true, category: true } }))
      .map((f: any) => ({ ref: f.fileUrl, name: f.category || 'adjunto_ot' })),
  },
  {
    folder: 'Mantenimiento/Reportes OT',
    fetch: async (p, t) => (await p.pdfReport.findMany({ where: { workOrder: { tenantId: t } }, select: { fileUrl: true, workOrderId: true } }))
      .map((f: any) => ({ ref: f.fileUrl, name: `reporte_ot_${f.workOrderId.slice(0, 8)}` })),
  },
  {
    folder: 'Mantenimiento/Firmas',
    fetch: async (p, t) => (await p.signature.findMany({ where: { workOrder: { tenantId: t } }, select: { signatureFileUrl: true, signerName: true } }))
      .map((f: any) => ({ ref: f.signatureFileUrl, name: `firma_${f.signerName}` })),
  },
  // ── Minutas ──
  {
    folder: 'Minutas',
    fetch: async (p, t) => (await p.minuta.findMany({ where: { tenantId: t }, select: { title: true, attachments: true } }))
      .flatMap((m: any) => (m.attachments || []).map((u: string) => ({ ref: u, name: `minuta_${m.title}` }))),
  },
  // ── Proyectos ──
  {
    folder: 'Proyectos',
    fetch: async (p, t) => (await p.project360Attachment.findMany({ where: { tenantId: t }, select: { url: true, name: true } }))
      .map((a: any) => ({ ref: a.url, name: a.name })),
  },
  // ── Clima y cultura ──
  {
    folder: 'Clima/Comunicados',
    fetch: async (p, t) => (await p.climaComm.findMany({ where: { tenantId: t }, select: { title: true, attachments: true } }))
      .flatMap((c: any) => urlsFromJson(c.attachments).map((u: string) => ({ ref: u, name: `comunicado_${c.title}` }))),
  },
  {
    folder: 'Clima/Buzon',
    fetch: async (p, t) => (await p.climaSuggestion.findMany({ where: { tenantId: t, attachmentUrl: { not: null } }, select: { attachmentUrl: true } }))
      .map((s: any) => ({ ref: s.attachmentUrl, name: 'adjunto_buzon' })),
  },
  // ── Clientes ──
  {
    folder: 'Clientes',
    fetch: async (p, t) => (await p.clientDocument.findMany({ where: { tenantId: t }, select: { title: true, fileUrl: true, filePath: true } }))
      .map((d: any) => ({ ref: d.fileUrl || d.filePath, name: d.title })),
  },
  // ── RRHH ──
  {
    folder: 'RRHH/Ausencias',
    fetch: async (p, t) => (await p.absenceAttachment.findMany({ where: { tenantId: t, deletedAt: null }, select: { fileUrl: true, fileName: true } }))
      .map((a: any) => ({ ref: a.fileUrl, name: a.fileName })),
  },
  // ── Importaciones PDF ──
  {
    folder: 'Importaciones',
    fetch: async (p, t) => (await p.pdfImport.findMany({ where: { tenantId: t }, select: { filePath: true, originalFileName: true } }))
      .map((d: any) => ({ ref: d.filePath, name: d.originalFileName })),
  },
];

// ── Ruta ──────────────────────────────────────────────────────────────────────
export async function documentBackupRoutes(app: FastifyInstance) {
  app.get('/company/document-backup', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const prisma = app.prisma as any;
    const storage = getStorage();
    const files: { name: string; data: Buffer }[] = [];
    const seen = new Set<string>();
    let omitidos = 0;

    for (const src of SOURCES) {
      let items: { ref: string; name?: string }[] = [];
      try {
        items = await src.fetch(prisma, tenantId);
      } catch (e: any) {
        app.log.warn({ err: e?.message, folder: src.folder }, '[backup] fuente falló, se omite');
        continue;
      }
      let n = 0;
      for (const it of items) {
        const key = keyFromRef(it.ref);
        if (!key || seen.has(key)) { if (!key) omitidos++; continue; }
        seen.add(key);
        try {
          const data = await storage.download(key);
          const base = it.name ? safeName(it.name) : fileNameFromKey(key, 'archivo');
          // Conservar extensión real del archivo si el nombre no la tiene
          const ext = (key.split('/').pop() || '').match(/\.[a-z0-9]{2,5}$/i)?.[0] || '';
          const finalName = ext && !base.toLowerCase().endsWith(ext.toLowerCase()) ? `${base}${ext}` : base;
          files.push({ name: `${src.folder}/${String(++n).padStart(2, '0')}_${finalName}`, data });
        } catch {
          omitidos++; // archivo referenciado pero no presente en storage
        }
      }
    }

    if (!files.length) {
      return reply.code(404).send({ error: 'No hay documentos cargados para descargar' });
    }

    const empresa = await prisma.companySettings.findUnique({ where: { tenantId }, select: { companyName: true } }).catch(() => null);
    const slug = safeName((empresa?.companyName || 'empresa').toLowerCase().replace(/\s+/g, '-'));
    const fecha = new Date().toISOString().slice(0, 10);
    const zip = buildZip(files);

    app.log.info({ tenantId, archivos: files.length, omitidos, bytes: zip.length }, '[backup] zip generado');
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="backup-documental-${slug}-${fecha}.zip"`)
      .header('X-Archivos-Incluidos', String(files.length))
      .header('X-Archivos-Omitidos', String(omitidos))
      .send(zip);
  });
}
