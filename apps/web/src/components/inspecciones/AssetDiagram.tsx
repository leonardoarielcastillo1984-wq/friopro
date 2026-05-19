'use client';

interface FotoCuadrante { url: string; titulo: string; puntos: { x: number; y: number; label: string }[] }

interface AssetDiagramProps {
  categoria: string;
  logoUrl?: string | null;
  companyName?: string | null;
  primaryColor?: string;
  diagramaFotos?: FotoCuadrante[] | null;
}

interface Punto { x: number; y: number; label: string }

const CONFIG: Record<string, { img: string; puntos: Punto[] }> = {
  CAMION: {
    img: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80',
    puntos: [
      { x: 82, y: 55, label: 'Motor / aceite' },
      { x: 88, y: 72, label: 'Luces delanteras' },
      { x: 70, y: 82, label: 'Rueda delantera' },
      { x: 25, y: 82, label: 'Ruedas traseras' },
      { x: 60, y: 18, label: 'Escape / gases' },
      { x: 55, y: 50, label: 'Cabina / cinturón' },
      { x: 30, y: 45, label: 'Caja de carga' },
      { x: 72, y: 70, label: 'Frenos' },
    ],
  },
  AUTOELEVADOR: {
    img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80',
    puntos: [
      { x: 50, y: 75, label: 'Combustible/batería' },
      { x: 15, y: 62, label: 'Horquillas' },
      { x: 25, y: 42, label: 'Sistema hidráulico' },
      { x: 38, y: 88, label: 'Neumático delantero' },
      { x: 65, y: 88, label: 'Neumático trasero' },
      { x: 48, y: 40, label: 'Bocina / alarma' },
      { x: 48, y: 18, label: 'Arco de seguridad' },
      { x: 78, y: 65, label: 'Contrapeso' },
    ],
  },
  EXTINTOR: {
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    puntos: [
      { x: 50, y: 42, label: 'Manómetro / presión' },
      { x: 50, y: 18, label: 'Pasador de seguridad' },
      { x: 22, y: 82, label: 'Manguera / boquilla' },
      { x: 72, y: 55, label: 'Etiqueta vigente' },
      { x: 85, y: 40, label: 'Soporte en pared' },
    ],
  },
  MAQUINARIA: {
    img: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800&q=80',
    puntos: [
      { x: 20, y: 35, label: 'Guardas de seguridad' },
      { x: 75, y: 40, label: 'Panel de control' },
      { x: 10, y: 55, label: 'Botón emergencia' },
      { x: 45, y: 55, label: 'Engranaje / lubricación' },
      { x: 80, y: 62, label: 'Sistema eléctrico' },
      { x: 50, y: 18, label: 'Temperatura / presión' },
    ],
  },
  EDIFICIO: {
    img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
    puntos: [
      { x: 18, y: 62, label: 'Señal de evacuación' },
      { x: 78, y: 32, label: 'Luces de emergencia' },
      { x: 15, y: 78, label: 'Extintor en pared' },
      { x: 50, y: 85, label: 'Salida de emergencia' },
      { x: 50, y: 95, label: 'Orden y limpieza' },
      { x: 50, y: 48, label: 'Botiquín primeros auxilios' },
    ],
  },
};

const LABEL_MAP: Record<string, string> = {
  CAMION: 'Camión',
  AUTOELEVADOR: 'Autoelevador / Montacargas',
  EXTINTOR: 'Extintor',
  MAQUINARIA: 'Maquinaria Industrial',
  EDIFICIO: 'Edificio / Instalación',
};

function PhotoPanel({ foto, primaryColor, globalOffset }: { foto: FotoCuadrante; primaryColor: string; globalOffset: number }) {
  return (
    <div className="relative rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foto.url} alt={foto.titulo} className="w-full h-full object-cover opacity-90" />
      <div className="absolute inset-0 bg-black/15" />
      <div className="absolute top-1.5 left-2 bg-black/50 text-white text-xs font-semibold px-2 py-0.5 rounded">{foto.titulo}</div>
      {foto.puntos.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)' }}
          title={p.label}
        >
          <div className="absolute w-6 h-6 rounded-full animate-ping opacity-25" style={{ backgroundColor: primaryColor }} />
          <div
            className="relative w-5 h-5 rounded-full flex items-center justify-center text-white font-bold shadow-md border-2 border-white/70"
            style={{ backgroundColor: primaryColor, fontSize: 9 }}
          >
            {globalOffset + i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AssetDiagram({ categoria, logoUrl, companyName, primaryColor = '#2563eb', diagramaFotos }: AssetDiagramProps) {
  const hasCustom = diagramaFotos && diagramaFotos.length > 0 && diagramaFotos.some(f => f.url);

  if (hasCustom) {
    const fotos = diagramaFotos!.filter(f => f.url);
    const allPuntos = fotos.flatMap(f => f.puntos.map(p => ({ ...p, foto: f.titulo })));
    let offset = 0;
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xl">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Diagrama personalizado — {LABEL_MAP[categoria] || categoria}
          </p>
          {logoUrl
            ? <img src={logoUrl} alt={companyName || ''} className="h-6 w-auto object-contain opacity-80" />
            : companyName ? <span className="text-xs font-bold text-white/40">{companyName}</span> : null}
        </div>
        <div className={`grid gap-2 mx-3 mb-2 ${fotos.length === 1 ? 'grid-cols-1' : fotos.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {fotos.map((foto, fi) => {
            const panel = <PhotoPanel key={fi} foto={foto} primaryColor={primaryColor} globalOffset={offset} />;
            offset += foto.puntos.length;
            return panel;
          })}
        </div>
        {allPuntos.length > 0 && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {allPuntos.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 border border-white/30" style={{ backgroundColor: primaryColor, fontSize: 9, fontWeight: 700 }}>{i + 1}</span>
                  <span className="text-xs text-white/70 truncate">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback genérico (foto Unsplash)
  const cfg = CONFIG[categoria];
  if (!cfg) return null;
  const { img, puntos } = cfg;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xl">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Puntos de control — {LABEL_MAP[categoria] || categoria}
        </p>
        {logoUrl
          ? <img src={logoUrl} alt={companyName || ''} className="h-6 w-auto object-contain opacity-80" />
          : companyName
            ? <span className="text-xs font-bold text-white/40">{companyName}</span>
            : null}
      </div>
      <div className="relative mx-3 mb-2 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={LABEL_MAP[categoria] || categoria} className="w-full h-full object-cover" crossOrigin="anonymous" />
        <div className="absolute inset-0 bg-black/20" />
        {puntos.map((p, i) => (
          <div key={i} className="absolute flex items-center justify-center" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}>
            <div className="absolute w-7 h-7 rounded-full animate-ping opacity-30" style={{ backgroundColor: primaryColor }} />
            <div className="relative w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white/60" style={{ backgroundColor: primaryColor, fontSize: 11 }}>{i + 1}</div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {puntos.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 border border-white/30" style={{ backgroundColor: primaryColor, fontSize: 9, fontWeight: 700 }}>{i + 1}</span>
              <span className="text-xs text-white/70 truncate">{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
