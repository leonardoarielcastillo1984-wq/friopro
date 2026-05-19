'use client';

interface AssetDiagramProps {
  categoria: string;
  logoUrl?: string | null;
  companyName?: string | null;
  primaryColor?: string;
}

const PUNTOS: Record<string, { cx: number; cy: number; label: string }[]> = {
  CAMION: [
    { cx: 285, cy: 108, label: 'Aceite motor' },
    { cx: 230, cy: 108, label: 'Refrigerante' },
    { cx: 148, cy: 185, label: 'Frenos' },
    { cx: 148, cy: 215, label: 'Neumáticos' },
    { cx: 60,  cy: 130, label: 'Luces' },
    { cx: 195, cy: 75,  label: 'Cinturón' },
    { cx: 310, cy: 175, label: 'Extintor' },
    { cx: 260, cy: 60,  label: 'Documentación' },
  ],
  AUTOELEVADOR: [
    { cx: 125, cy: 225, label: 'Combustible/batería' },
    { cx: 72,  cy: 145, label: 'Horquillas' },
    { cx: 72,  cy: 108, label: 'Hidráulico' },
    { cx: 155, cy: 235, label: 'Neumáticos' },
    { cx: 215, cy: 130, label: 'Frenos' },
    { cx: 215, cy: 92,  label: 'Bocina/alarma' },
    { cx: 155, cy: 58,  label: 'Arco seguridad' },
    { cx: 290, cy: 165, label: 'Extintor' },
  ],
  EXTINTOR: [
    { cx: 230, cy: 118, label: 'Manómetro/presión' },
    { cx: 230, cy: 72,  label: 'Pasador/seguro' },
    { cx: 100, cy: 228, label: 'Manguera/boquilla' },
    { cx: 230, cy: 175, label: 'Etiqueta vigente' },
    { cx: 230, cy: 215, label: 'Soporte/visibilidad' },
  ],
  MAQUINARIA: [
    { cx: 95,  cy: 95,  label: 'Guardas seguridad' },
    { cx: 270, cy: 130, label: 'Panel/control' },
    { cx: 75,  cy: 175, label: 'Freno emergencia' },
    { cx: 155, cy: 155, label: 'Lubricación/eje' },
    { cx: 270, cy: 175, label: 'Sistema eléctrico' },
    { cx: 155, cy: 60,  label: 'Temperatura/presión' },
  ],
  EDIFICIO: [
    { cx: 86,  cy: 157, label: 'Señal evacuación' },
    { cx: 274, cy: 82,  label: 'Luces emergencia' },
    { cx: 86,  cy: 105, label: 'Extintores' },
    { cx: 155, cy: 180, label: 'Salida emergencia' },
    { cx: 185, cy: 248, label: 'Orden y limpieza' },
    { cx: 155, cy: 128, label: 'Botiquín' },
  ],
};

function CamionSVG() {
  return (
    <g>
      <rect x="170" y="62" width="80" height="68" rx="8" fill="#475569" />
      <rect x="175" y="67" width="70" height="36" rx="4" fill="#94a3b8" opacity="0.55" />
      <rect x="85" y="97" width="165" height="78" rx="6" fill="#334155" />
      <circle cx="130" cy="183" r="25" fill="#1e293b" />
      <circle cx="130" cy="183" r="15" fill="#475569" />
      <circle cx="130" cy="183" r="5" fill="#94a3b8" />
      <circle cx="228" cy="183" r="25" fill="#1e293b" />
      <circle cx="228" cy="183" r="15" fill="#475569" />
      <circle cx="228" cy="183" r="5" fill="#94a3b8" />
      <rect x="245" y="80" width="58" height="52" rx="8" fill="#3b4f69" />
      <rect x="248" y="84" width="24" height="18" rx="3" fill="#7dd3fc" opacity="0.65" />
      <rect x="275" y="108" width="28" height="18" rx="3" fill="#1e3a5f" />
      <rect x="168" y="50" width="8" height="22" rx="3" fill="#64748b" />
      <rect x="195" y="100" width="34" height="54" rx="4" fill="#3d5470" />
      <circle cx="224" cy="128" r="3" fill="#94a3b8" />
    </g>
  );
}

function AutoelevadorSVG() {
  return (
    <g>
      <rect x="100" y="128" width="140" height="100" rx="8" fill="#374151" />
      <rect x="210" y="148" width="42" height="68" rx="6" fill="#4b5563" />
      <rect x="72" y="58" width="12" height="162" rx="4" fill="#6b7280" />
      <rect x="90" y="58" width="12" height="162" rx="4" fill="#6b7280" />
      <rect x="52" y="173" width="66" height="10" rx="3" fill="#9ca3af" />
      <rect x="52" y="198" width="66" height="10" rx="3" fill="#9ca3af" />
      <circle cx="140" cy="236" r="22" fill="#1f2937" />
      <circle cx="140" cy="236" r="13" fill="#4b5563" />
      <circle cx="210" cy="236" r="22" fill="#1f2937" />
      <circle cx="210" cy="236" r="13" fill="#4b5563" />
      <rect x="118" y="103" width="70" height="60" rx="6" fill="#1e3a5f" />
      <rect x="122" y="107" width="62" height="34" rx="4" fill="#7dd3fc" opacity="0.45" />
      <path d="M118 103 Q118 73 188 73 Q188 73 188 103" fill="none" stroke="#6b7280" strokeWidth="6" />
    </g>
  );
}

function ExtintorSVG() {
  return (
    <g>
      <rect x="148" y="88" width="64" height="148" rx="32" fill="#dc2626" />
      <rect x="152" y="92" width="56" height="140" rx="28" fill="#ef4444" />
      <rect x="172" y="60" width="16" height="30" rx="6" fill="#6b7280" />
      <circle cx="180" cy="118" r="16" fill="#f1f5f9" />
      <circle cx="180" cy="118" r="12" fill="white" />
      <path d="M180 110 L180 118 L187 118" stroke="#16a34a" strokeWidth="2" fill="none" />
      <rect x="155" y="148" width="50" height="50" rx="4" fill="white" opacity="0.2" />
      <rect x="160" y="72" width="40" height="6" rx="3" fill="#fbbf24" />
      <path d="M148 185 Q108 185 103 222" fill="none" stroke="#374151" strokeWidth="8" strokeLinecap="round" />
      <path d="M103 222 L88 237 L112 242 Z" fill="#374151" />
      <rect x="197" y="110" width="14" height="100" rx="4" fill="#94a3b8" />
      <rect x="203" y="106" width="28" height="8" rx="3" fill="#64748b" />
    </g>
  );
}

function MaquinariaSVG() {
  return (
    <g>
      <rect x="75" y="195" width="210" height="28" rx="6" fill="#374151" />
      <rect x="95" y="98" width="170" height="102" rx="8" fill="#334155" />
      <rect x="200" y="113" width="56" height="62" rx="6" fill="#1e3a5f" />
      <circle cx="215" cy="130" r="6" fill="#22c55e" />
      <circle cx="235" cy="130" r="6" fill="#ef4444" />
      <rect x="207" y="148" width="40" height="8" rx="3" fill="#3b82f6" opacity="0.7" />
      <rect x="95" y="98" width="100" height="102" rx="8" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="8 4" />
      <circle cx="155" cy="150" r="30" fill="#475569" />
      <circle cx="155" cy="150" r="18" fill="#6b7280" />
      <circle cx="155" cy="150" r="7" fill="#94a3b8" />
      <rect x="73" y="128" width="24" height="42" rx="6" fill="#dc2626" />
      <rect x="79" y="133" width="12" height="16" rx="3" fill="#fca5a5" />
    </g>
  );
}

function EdificioSVG() {
  return (
    <g>
      <rect x="80" y="80" width="200" height="170" rx="4" fill="#334155" />
      <polygon points="70,80 185,28 300,80" fill="#475569" />
      <rect x="155" y="178" width="40" height="72" rx="4" fill="#1e3a5f" />
      <circle cx="189" cy="215" r="4" fill="#fbbf24" />
      <rect x="95" y="103" width="42" height="38" rx="4" fill="#7dd3fc" opacity="0.55" />
      <rect x="148" y="103" width="42" height="38" rx="4" fill="#7dd3fc" opacity="0.55" />
      <rect x="201" y="103" width="42" height="38" rx="4" fill="#7dd3fc" opacity="0.55" />
      <rect x="83" y="155" width="30" height="18" rx="3" fill="#16a34a" />
      <path d="M93 159 L98 172 L103 159" fill="white" />
      <rect x="244" y="80" width="30" height="16" rx="4" fill="#dc2626" />
      <circle cx="252" cy="88" r="4" fill="#fca5a5" />
      <circle cx="266" cy="88" r="4" fill="#fca5a5" />
      <rect x="75" y="248" width="210" height="10" rx="3" fill="#475569" />
    </g>
  );
}

const SVG_MAP: Record<string, () => JSX.Element> = {
  CAMION: CamionSVG,
  AUTOELEVADOR: AutoelevadorSVG,
  EXTINTOR: ExtintorSVG,
  MAQUINARIA: MaquinariaSVG,
  EDIFICIO: EdificioSVG,
};

const LABEL_MAP: Record<string, string> = {
  CAMION: 'Camión',
  AUTOELEVADOR: 'Autoelevador / Montacargas',
  EXTINTOR: 'Extintor',
  MAQUINARIA: 'Maquinaria Industrial',
  EDIFICIO: 'Edificio / Instalación',
};

export default function AssetDiagram({ categoria, logoUrl, companyName, primaryColor = '#2563eb' }: AssetDiagramProps) {
  const puntos = PUNTOS[categoria] || [];
  const AssetShape = SVG_MAP[categoria];
  if (!AssetShape) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Diagrama de puntos de control
        </p>
        {logoUrl
          ? <img src={logoUrl} alt={companyName || ''} className="h-7 w-auto object-contain opacity-90" />
          : companyName
            ? <span className="text-xs font-bold text-white/50">{companyName}</span>
            : null}
      </div>

      <svg viewBox="0 0 360 270" className="w-full" style={{ maxHeight: 240 }}>
        {/* Fondo sutil */}
        <rect x="0" y="0" width="360" height="270" fill="transparent" />

        {/* Dibujo del activo */}
        <AssetShape />

        {/* Líneas desde puntos al borde + número */}
        {puntos.map((p, i) => {
          const num = i + 1;
          const isLeft = p.cx < 180;
          const labelX = isLeft ? 18 : 342;
          const anchorX = isLeft ? 36 : 324;
          return (
            <g key={i}>
              <line
                x1={p.cx} y1={p.cy}
                x2={anchorX} y2={p.cy}
                stroke={primaryColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"
              />
              {/* Punto */}
              <circle cx={p.cx} cy={p.cy} r="9" fill={primaryColor} opacity="0.95" />
              <text x={p.cx} y={p.cy + 4} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{num}</text>
              {/* Badge lateral */}
              <circle cx={labelX} cy={p.cy} r="9" fill={primaryColor} />
              <text x={labelX} y={p.cy + 4} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{num}</text>
            </g>
          );
        })}
      </svg>

      {/* Leyenda */}
      <div className="px-4 pb-4 pt-1">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {puntos.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: primaryColor, fontSize: 9, fontWeight: 700 }}
              >
                {i + 1}
              </span>
              <span className="text-xs text-white/70 truncate">{p.label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-white/30 mt-3">
          {LABEL_MAP[categoria] || categoria} · {companyName || 'SGI 360'}
        </p>
      </div>
    </div>
  );
}
