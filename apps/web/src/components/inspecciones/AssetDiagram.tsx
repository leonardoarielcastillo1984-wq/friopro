'use client';

interface AssetDiagramProps {
  categoria: string;
  logoUrl?: string | null;
  companyName?: string | null;
  primaryColor?: string;
}

const PUNTOS: Record<string, { cx: number; cy: number; label: string }[]> = {
  CAMION: [
    { cx: 305, cy: 162, label: 'Motor / aceite' },
    { cx: 305, cy: 148, label: 'Luces delanteras' },
    { cx: 258, cy: 202, label: 'Rueda delantera' },
    { cx: 118, cy: 202, label: 'Ruedas traseras' },
    { cx: 252, cy: 90,  label: 'Escape / gases' },
    { cx: 234, cy: 138, label: 'Cabina / cinturón' },
    { cx: 130, cy: 148, label: 'Caja de carga' },
    { cx: 246, cy: 172, label: 'Frenos' },
  ],
  AUTOELEVADOR: [
    { cx: 184, cy: 220, label: 'Combustible/batería' },
    { cx: 57,  cy: 180, label: 'Horquillas' },
    { cx: 90,  cy: 120, label: 'Sistema hidráulico' },
    { cx: 148, cy: 238, label: 'Neumático delantero' },
    { cx: 220, cy: 238, label: 'Neumático trasero' },
    { cx: 167, cy: 120, label: 'Bocina / alarma' },
    { cx: 167, cy: 65,  label: 'Arco de seguridad' },
    { cx: 252, cy: 185, label: 'Contrapeso' },
  ],
  EXTINTOR: [
    { cx: 176, cy: 128, label: 'Manómetro / presión' },
    { cx: 164, cy: 62,  label: 'Pasador de seguridad' },
    { cx: 88,  cy: 235, label: 'Manguera / boquilla' },
    { cx: 237, cy: 152, label: 'Etiqueta vigente' },
    { cx: 237, cy: 200, label: 'Soporte en pared' },
  ],
  MAQUINARIA: [
    { cx: 84,  cy: 99,  label: 'Guardas de seguridad' },
    { cx: 238, cy: 120, label: 'Panel de control' },
    { cx: 63,  cy: 152, label: 'Botón emergencia' },
    { cx: 144, cy: 150, label: 'Engranaje / lubricación' },
    { cx: 238, cy: 168, label: 'Sistema eléctrico' },
    { cx: 180, cy: 60,  label: 'Temperatura / presión' },
  ],
  EDIFICIO: [
    { cx: 78,  cy: 167, label: 'Señal de evacuación' },
    { cx: 264, cy: 97,  label: 'Luces de emergencia' },
    { cx: 83,  cy: 210, label: 'Extintor en pared' },
    { cx: 174, cy: 224, label: 'Salida de emergencia' },
    { cx: 182, cy: 258, label: 'Orden y limpieza' },
    { cx: 182, cy: 128, label: 'Botiquín primeros auxilios' },
  ],
};

function CamionSVG() {
  return (
    <g>
      {/* Chasis / piso */}
      <rect x="48" y="188" width="268" height="14" rx="4" fill="#1e293b" />
      {/* Caja de carga */}
      <rect x="48" y="105" width="170" height="86" rx="4" fill="#334155" />
      <rect x="52" y="109" width="162" height="78" rx="3" fill="#3d5470" />
      {/* líneas horizontales caja */}
      <line x1="52" y1="135" x2="214" y2="135" stroke="#475569" strokeWidth="1.5"/>
      <line x1="52" y1="161" x2="214" y2="161" stroke="#475569" strokeWidth="1.5"/>
      {/* Cabina */}
      <rect x="216" y="118" width="82" height="73" rx="6" fill="#1e3a5f" />
      {/* Parabrisas */}
      <rect x="222" y="122" width="52" height="36" rx="4" fill="#7dd3fc" opacity="0.75" />
      {/* Puerta cabina */}
      <rect x="222" y="162" width="30" height="28" rx="3" fill="#2d4a6e" />
      <circle cx="247" cy="178" r="2.5" fill="#94a3b8" />
      {/* Capó */}
      <rect x="295" y="148" width="24" height="44" rx="4" fill="#253a55" />
      {/* Parrilla */}
      <rect x="298" y="162" width="18" height="22" rx="2" fill="#162030" />
      <line x1="298" y1="168" x2="316" y2="168" stroke="#334155" strokeWidth="1"/>
      <line x1="298" y1="174" x2="316" y2="174" stroke="#334155" strokeWidth="1"/>
      <line x1="298" y1="180" x2="316" y2="180" stroke="#334155" strokeWidth="1"/>
      {/* Faro delantero */}
      <rect x="297" y="150" width="18" height="10" rx="2" fill="#fde68a" opacity="0.9" />
      {/* Espejo */}
      <rect x="314" y="125" width="6" height="14" rx="2" fill="#475569" />
      {/* Escape vertical */}
      <rect x="248" y="88" width="8" height="32" rx="3" fill="#475569" />
      <ellipse cx="252" cy="88" rx="4" ry="2" fill="#64748b" />
      {/* Rueda trasera doble */}
      <circle cx="105" cy="202" r="24" fill="#0f172a" />
      <circle cx="105" cy="202" r="16" fill="#334155" />
      <circle cx="105" cy="202" r="7" fill="#64748b" />
      <circle cx="138" cy="202" r="24" fill="#0f172a" />
      <circle cx="138" cy="202" r="16" fill="#334155" />
      <circle cx="138" cy="202" r="7" fill="#64748b" />
      {/* Rueda delantera */}
      <circle cx="258" cy="202" r="24" fill="#0f172a" />
      <circle cx="258" cy="202" r="16" fill="#334155" />
      <circle cx="258" cy="202" r="7" fill="#64748b" />
      {/* Estribo */}
      <rect x="218" y="188" width="74" height="6" rx="2" fill="#475569" />
    </g>
  );
}

function AutoelevadorSVG() {
  return (
    <g>
      {/* Cuerpo principal */}
      <rect x="118" y="130" width="130" height="100" rx="8" fill="#374151" />
      {/* Contrapeso trasero */}
      <rect x="235" y="150" width="38" height="70" rx="6" fill="#4b5563" />
      <rect x="238" y="155" width="32" height="60" rx="4" fill="#3d5473" />
      {/* Cabina operador */}
      <rect x="128" y="98" width="78" height="66" rx="6" fill="#1e3a5f" />
      <rect x="133" y="103" width="68" height="38" rx="4" fill="#7dd3fc" opacity="0.55" />
      {/* Asiento */}
      <rect x="145" y="148" width="35" height="10" rx="3" fill="#2d3748" />
      <rect x="150" y="138" width="10" height="15" rx="2" fill="#2d3748" />
      {/* Arco de seguridad ROPS */}
      <path d="M128 98 Q128 65 206 65 L206 98" fill="none" stroke="#9ca3af" strokeWidth="7" strokeLinejoin="round" />
      <line x1="128" y1="98" x2="128" y2="130" stroke="#9ca3af" strokeWidth="5"/>
      <line x1="206" y1="98" x2="206" y2="130" stroke="#9ca3af" strokeWidth="5"/>
      {/* Mástil vertical */}
      <rect x="82" y="52" width="14" height="178" rx="4" fill="#6b7280" />
      <rect x="102" y="52" width="14" height="178" rx="4" fill="#6b7280" />
      {/* Carlin mástil */}
      <rect x="82" y="140" width="34" height="8" rx="2" fill="#9ca3af" />
      <rect x="82" y="100" width="34" height="8" rx="2" fill="#9ca3af" />
      {/* Horquillas */}
      <rect x="44" y="168" width="72" height="12" rx="3" fill="#d1d5db" />
      <rect x="44" y="192" width="72" height="12" rx="3" fill="#d1d5db" />
      {/* Base horquillas */}
      <rect x="80" y="162" width="20" height="48" rx="3" fill="#9ca3af" />
      {/* Ruedas */}
      <circle cx="148" cy="238" r="24" fill="#1f2937" />
      <circle cx="148" cy="238" r="15" fill="#374151" />
      <circle cx="148" cy="238" r="6" fill="#6b7280" />
      <circle cx="220" cy="238" r="24" fill="#1f2937" />
      <circle cx="220" cy="238" r="15" fill="#374151" />
      <circle cx="220" cy="238" r="6" fill="#6b7280" />
      {/* Piso */}
      <rect x="44" y="228" width="230" height="8" rx="3" fill="#1e293b" />
    </g>
  );
}

function ExtintorSVG() {
  return (
    <g>
      {/* Soporte pared */}
      <rect x="220" y="82" width="34" height="140" rx="4" fill="#374151" />
      <rect x="215" y="98" width="10" height="20" rx="3" fill="#64748b" />
      <rect x="215" y="162" width="10" height="20" rx="3" fill="#64748b" />
      {/* Cuerpo extintor */}
      <rect x="140" y="98" width="72" height="150" rx="36" fill="#dc2626" />
      <rect x="144" y="102" width="64" height="142" rx="32" fill="#ef4444" />
      {/* Reflejo */}
      <rect x="148" y="108" width="18" height="80" rx="9" fill="white" opacity="0.15" />
      {/* Cuello superior */}
      <rect x="160" y="78" width="32" height="24" rx="6" fill="#9ca3af" />
      {/* Válvula */}
      <rect x="168" y="64" width="16" height="18" rx="4" fill="#6b7280" />
      <rect x="156" y="68" width="40" height="8" rx="4" fill="#4b5563" />
      {/* Pasador seguridad */}
      <rect x="160" y="60" width="8" height="22" rx="3" fill="#fbbf24" />
      <circle cx="164" cy="60" r="4" fill="#fbbf24" />
      {/* Manómetro */}
      <circle cx="176" cy="128" r="18" fill="#e2e8f0" />
      <circle cx="176" cy="128" r="14" fill="white" />
      <path d="M176 118 L176 128 L184 128" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="176" cy="128" r="3" fill="#374151" />
      {/* Etiqueta */}
      <rect x="148" y="152" width="56" height="58" rx="5" fill="white" opacity="0.18" />
      <rect x="152" y="158" width="48" height="4" rx="2" fill="white" opacity="0.4" />
      <rect x="152" y="167" width="38" height="3" rx="1.5" fill="white" opacity="0.3" />
      <rect x="152" y="174" width="42" height="3" rx="1.5" fill="white" opacity="0.3" />
      {/* Manguera */}
      <path d="M140 188 Q100 188 92 220" fill="none" stroke="#374151" strokeWidth="10" strokeLinecap="round"/>
      <path d="M140 188 Q100 188 92 220" fill="none" stroke="#4b5563" strokeWidth="6" strokeLinecap="round"/>
      {/* Boquilla */}
      <path d="M92 220 L75 238 L105 246 Z" fill="#374151" />
      <rect x="78" y="228" width="24" height="10" rx="4" fill="#6b7280" />
      {/* Base / pie */}
      <ellipse cx="176" cy="248" rx="34" ry="8" fill="#b91c1c" />
    </g>
  );
}

function MaquinariaSVG() {
  return (
    <g>
      {/* Base / mesa */}
      <rect x="62" y="200" width="240" height="22" rx="5" fill="#1e293b" />
      <rect x="75" y="222" width="18" height="30" rx="3" fill="#374151" />
      <rect x="270" y="222" width="18" height="30" rx="3" fill="#374151" />
      {/* Cuerpo máquina */}
      <rect x="80" y="95" width="200" height="110" rx="8" fill="#334155" />
      {/* Guarda amarilla (zona peligro) */}
      <rect x="80" y="95" width="120" height="110" rx="8" fill="#3d3000" />
      <rect x="84" y="99" width="112" height="102" rx="6" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="10 5" />
      {/* Engranaje / disco giratorio */}
      <circle cx="144" cy="150" r="36" fill="#475569" />
      <circle cx="144" cy="150" r="26" fill="#374151" />
      <circle cx="144" cy="150" r="10" fill="#64748b" />
      {/* Dientes engranaje */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 144 + 36 * Math.cos(rad);
        const y1 = 150 + 36 * Math.sin(rad);
        const x2 = 144 + 44 * Math.cos(rad);
        const y2 = 150 + 44 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b7280" strokeWidth="5" strokeLinecap="round" />;
      })}
      {/* Panel de control */}
      <rect x="205" y="108" width="66" height="82" rx="6" fill="#1e3a5f" />
      <circle cx="222" cy="128" r="8" fill="#22c55e" />
      <circle cx="248" cy="128" r="8" fill="#ef4444" />
      <rect x="212" y="148" width="48" height="10" rx="4" fill="#3b82f6" opacity="0.8" />
      <rect x="212" y="163" width="38" height="6" rx="3" fill="#fbbf24" opacity="0.7" />
      <rect x="212" y="174" width="28" height="4" rx="2" fill="#94a3b8" opacity="0.5" />
      {/* Botón emergencia */}
      <circle cx="63" cy="152" r="18" fill="#dc2626" />
      <circle cx="63" cy="152" r="12" fill="#ef4444" />
      <rect x="59" y="148" width="8" height="8" rx="1" fill="white" opacity="0.8" />
      {/* Texto STOP */}
      <text x="63" y="181" textAnchor="middle" fill="#fca5a5" fontSize="7" fontWeight="bold">STOP</text>
    </g>
  );
}

function EdificioSVG() {
  return (
    <g>
      {/* Piso */}
      <rect x="55" y="248" width="254" height="10" rx="3" fill="#1e293b" />
      {/* Cuerpo edificio */}
      <rect x="72" y="88" width="220" height="162" rx="4" fill="#334155" />
      {/* Techo */}
      <polygon points="60,88 182,30 304,88" fill="#253a55" />
      <polygon points="68,88 182,38 296,88" fill="#2d4a6e" />
      {/* Ventanas piso 1 */}
      <rect x="90" y="108" width="46" height="40" rx="4" fill="#7dd3fc" opacity="0.6" />
      <line x1="113" y1="108" x2="113" y2="148" stroke="#475569" strokeWidth="1.5"/>
      <line x1="90" y1="128" x2="136" y2="128" stroke="#475569" strokeWidth="1.5"/>
      <rect x="150" y="108" width="46" height="40" rx="4" fill="#7dd3fc" opacity="0.6" />
      <line x1="173" y1="108" x2="173" y2="148" stroke="#475569" strokeWidth="1.5"/>
      <line x1="150" y1="128" x2="196" y2="128" stroke="#475569" strokeWidth="1.5"/>
      <rect x="210" y="108" width="46" height="40" rx="4" fill="#7dd3fc" opacity="0.6" />
      <line x1="233" y1="108" x2="233" y2="148" stroke="#475569" strokeWidth="1.5"/>
      <line x1="210" y1="128" x2="256" y2="128" stroke="#475569" strokeWidth="1.5"/>
      {/* Ventanas piso 2 */}
      <rect x="90" y="162" width="46" height="35" rx="4" fill="#7dd3fc" opacity="0.4" />
      <rect x="150" y="162" width="46" height="35" rx="4" fill="#7dd3fc" opacity="0.4" />
      <rect x="210" y="162" width="46" height="35" rx="4" fill="#7dd3fc" opacity="0.4" />
      {/* Puerta */}
      <rect x="152" y="198" width="44" height="52" rx="4" fill="#1e3a5f" />
      <circle cx="190" cy="226" r="3.5" fill="#fbbf24" />
      <line x1="174" y1="198" x2="174" y2="250" stroke="#374151" strokeWidth="1.5"/>
      {/* Señal evacuación */}
      <rect x="76" y="162" width="10" height="28" rx="2" fill="#16a34a" />
      <rect x="68" y="162" width="26" height="10" rx="2" fill="#16a34a" />
      <path d="M78 168 L82 178 L86 168" fill="white" />
      {/* Luz emergencia */}
      <rect x="248" y="90" width="32" height="14" rx="4" fill="#dc2626" />
      <circle cx="256" cy="97" r="4" fill="#fca5a5" />
      <circle cx="272" cy="97" r="4" fill="#fca5a5" />
      {/* Extintor en pared */}
      <rect x="78" y="200" width="10" height="38" rx="5" fill="#dc2626" />
      <rect x="76" y="196" width="14" height="6" rx="2" fill="#9ca3af" />
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
