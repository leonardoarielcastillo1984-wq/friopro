'use client';

import { Scale, ShieldAlert, FileWarning, Database, Globe, AlertTriangle, Mail, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const LAST_UPDATED = '21 de abril de 2026';

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ icon, title, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 bg-white/5 hover:bg-white/10 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-brand-400">{icon}</span>
          <h2 className="text-white font-semibold text-base">{title}</h2>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-6 py-5 text-slate-300 text-sm leading-relaxed space-y-3 bg-white/[0.02]">
          {children}
        </div>
      )}
    </div>
  );
}

export default function LegalesPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-brand-600/20 border border-brand-600/30">
          <Scale className="h-7 w-7 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Términos Legales y Aviso Legal</h1>
          <p className="text-slate-400 mt-1">
            Condiciones de uso, limitaciones de responsabilidad y política de datos de SGI 360
          </p>
          <p className="text-xs text-slate-500 mt-2">Última actualización: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Alerta destacada */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-200">
          Al utilizar SGI 360 usted acepta todos los términos y condiciones descritos en este documento. Le recomendamos leerlos detenidamente.
        </p>
      </div>

      <div className="space-y-3">

        {/* 1. Descripción del servicio */}
        <Section icon={<Globe className="h-5 w-5" />} title="1. Descripción del Servicio" defaultOpen>
          <p>
            <strong className="text-white">SGI 360</strong> es una plataforma de software como servicio (SaaS) desarrollada y operada en la República Argentina, destinada a la gestión de Sistemas de Gestión Integrados (SGI) conforme a normas ISO (9001, 14001, 45001, 27001, 39001, 50001, IATF 16949, entre otras).
          </p>
          <p>
            El sistema provee herramientas digitales para la gestión de documentos, no conformidades, auditorías, indicadores, riesgos, proveedores, capacitaciones, incidentes, aspectos ambientales, peligros ocupacionales, calibraciones, mantenimiento y reportes para la dirección.
          </p>
          <p>
            SGI 360 actúa exclusivamente como <strong className="text-white">proveedor de una plataforma tecnológica</strong>. No es un organismo de certificación, no emite certificados ISO, no reemplaza la consultoría especializada ni garantiza resultados en procesos de auditoría o certificación externa.
          </p>
        </Section>

        {/* 2. Responsabilidad por la documentación */}
        <Section icon={<FileWarning className="h-5 w-5" />} title="2. Responsabilidad sobre la Documentación Cargada">
          <p>
            Todo el contenido —documentos, archivos, textos, imágenes, registros y cualquier otro material— que los usuarios carguen, almacenen o generen en SGI 360 es de <strong className="text-white">exclusiva responsabilidad del usuario o de la organización titular de la cuenta</strong>.
          </p>
          <p>
            SGI 360 <strong className="text-white">no revisa, no valida, no certifica ni garantiza</strong> la veracidad, exactitud, completitud, vigencia ni adecuación normativa de la documentación cargada por los clientes.
          </p>
          <p>
            El usuario declara y garantiza que:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Cuenta con todos los derechos necesarios para cargar y utilizar el contenido que sube a la plataforma.</li>
            <li>El contenido no infringe derechos de terceros, leyes vigentes ni disposiciones reglamentarias.</li>
            <li>Asume plena responsabilidad civil y penal por el contenido que carga y gestiona.</li>
          </ul>
          <p>
            Lo anterior se enmarca en la <strong className="text-white">Ley N° 25.326 de Protección de Datos Personales</strong> y sus decretos reglamentarios, así como en la Ley N° 11.723 de Propiedad Intelectual de la República Argentina.
          </p>
        </Section>

        {/* 3. Propiedad intelectual */}
        <Section icon={<ShieldAlert className="h-5 w-5" />} title="3. Propiedad Intelectual y Derechos de Autor">
          <p>
            Conforme a la <strong className="text-white">Ley N° 11.723 de Propiedad Intelectual</strong> de la República Argentina, todos los derechos sobre el software SGI 360, su código fuente, diseño, marca, logotipos, interfaces y documentación propia pertenecen a sus desarrolladores y titulares.
          </p>
          <p>
            <strong className="text-white">Queda expresamente prohibido</strong>:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Reproducir, copiar, distribuir, vender o ceder el software o cualquiera de sus componentes sin autorización expresa.</li>
            <li>Realizar ingeniería inversa o intentar extraer el código fuente.</li>
            <li>Utilizar la marca "SGI 360" sin autorización escrita.</li>
          </ul>
          <p>
            Respecto al contenido cargado por los usuarios: SGI 360 <strong className="text-white">no reclama ningún derecho de propiedad intelectual</strong> sobre los documentos, textos o archivos cargados por los clientes. El usuario conserva todos los derechos que le corresponden sobre su propio contenido.
          </p>
          <p>
            Sin embargo, el usuario otorga a SGI 360 una licencia limitada, no exclusiva y revocable para almacenar, procesar y mostrar dicho contenido únicamente con el fin de prestar el servicio contratado.
          </p>
        </Section>

        {/* 4. Limitación de responsabilidad */}
        <Section icon={<ShieldAlert className="h-5 w-5" />} title="4. Limitación de Responsabilidad">
          <p>
            En la máxima medida permitida por la legislación argentina vigente, SGI 360 <strong className="text-white">no será responsable</strong> por:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-white">Pérdida o corrupción de datos</strong> derivada de fallas técnicas, interrupciones del servicio, ataques informáticos, errores humanos o causas de fuerza mayor.</li>
            <li><strong className="text-white">Daños directos, indirectos, incidentales, especiales o consecuentes</strong> que surjan del uso o la imposibilidad de uso de la plataforma.</li>
            <li><strong className="text-white">Resultados de procesos de auditoría o certificación externa</strong> basados en documentación gestionada a través de la plataforma.</li>
            <li><strong className="text-white">Decisiones empresariales, operativas o legales</strong> tomadas con base en información generada o almacenada en SGI 360.</li>
            <li>Interrupciones o demoras causadas por terceros proveedores de infraestructura (servidores, conectividad, servicios en la nube).</li>
            <li>El contenido generado por las funciones de <strong className="text-white">Inteligencia Artificial</strong> incluidas en la plataforma, las cuales son herramientas de asistencia y no reemplazan el criterio profesional humano.</li>
          </ul>
          <p>
            Lo anterior es conforme al <strong className="text-white">Código Civil y Comercial de la Nación (Ley 26.994)</strong>, en particular sus disposiciones sobre responsabilidad contractual y limitación de daños.
          </p>
        </Section>

        {/* 5. Datos personales */}
        <Section icon={<Database className="h-5 w-5" />} title="5. Protección de Datos Personales">
          <p>
            SGI 360 trata los datos personales de sus usuarios conforme a la <strong className="text-white">Ley N° 25.326 de Protección de los Datos Personales</strong> (LPDP) y las disposiciones de la <strong className="text-white">Agencia de Acceso a la Información Pública (AAIP)</strong>.
          </p>
          <p>
            Los datos recopilados (nombre, correo electrónico, información de uso, datos de la organización) son utilizados exclusivamente para:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Prestar y mejorar el servicio contratado.</li>
            <li>Gestionar la cuenta, suscripción y facturación.</li>
            <li>Comunicar actualizaciones, alertas y novedades del servicio.</li>
          </ul>
          <p>
            SGI 360 <strong className="text-white">no vende, no cede ni comercializa</strong> datos personales a terceros. Los datos pueden ser transferidos únicamente a proveedores de infraestructura técnica (hosting, procesamiento de pagos) sujetos a acuerdos de confidencialidad.
          </p>
          <p>
            El titular de los datos podrá ejercer los derechos de <strong className="text-white">acceso, rectificación, actualización y supresión</strong> según lo establecido en la LPDP, comunicándose por los canales indicados en la sección de contacto.
          </p>
          <p className="text-xs text-slate-400">
            La AAIP, Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes.
          </p>
        </Section>

        {/* 6. Disponibilidad y respaldo */}
        <Section icon={<Database className="h-5 w-5" />} title="6. Disponibilidad del Servicio y Respaldo de Datos">
          <p>
            SGI 360 realiza esfuerzos razonables para mantener el servicio disponible de forma continua, pero <strong className="text-white">no garantiza una disponibilidad del 100%</strong>. El servicio puede sufrir interrupciones por mantenimiento programado, fallas técnicas o circunstancias fuera del control del proveedor.
          </p>
          <p>
            Si bien SGI 360 implementa procedimientos de respaldo (backup) de datos, <strong className="text-white">no garantiza la recuperación total de información</strong> en caso de pérdida. Se recomienda enfáticamente que los usuarios mantengan copias de seguridad propias e independientes de toda la documentación crítica que gestionen a través de la plataforma.
          </p>
          <p>
            SGI 360 no asume responsabilidad alguna por la pérdida de datos causada por:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Acciones u omisiones del propio usuario.</li>
            <li>Ataques informáticos de terceros (ciberataques, ransomware, etc.).</li>
            <li>Fallas de infraestructura de terceros proveedores.</li>
            <li>Casos fortuitos o de fuerza mayor según el art. 1730 del Código Civil y Comercial.</li>
          </ul>
        </Section>

        {/* 7. Uso aceptable */}
        <Section icon={<ShieldAlert className="h-5 w-5" />} title="7. Política de Uso Aceptable">
          <p>
            El usuario se compromete a utilizar SGI 360 exclusivamente para fines lícitos y conforme a estos términos. Queda <strong className="text-white">expresamente prohibido</strong>:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Cargar contenido ilegal, difamatorio, obsceno o que viole derechos de terceros.</li>
            <li>Intentar acceder a cuentas o datos de otros usuarios sin autorización.</li>
            <li>Realizar acciones que puedan comprometer la seguridad o estabilidad de la plataforma.</li>
            <li>Utilizar el sistema para actividades fraudulentas o engañosas.</li>
            <li>Compartir credenciales de acceso con personas no autorizadas.</li>
          </ul>
          <p>
            El incumplimiento de estas condiciones podrá resultar en la <strong className="text-white">suspensión o cancelación inmediata</strong> de la cuenta, sin perjuicio de las acciones legales que correspondan conforme a la legislación argentina.
          </p>
        </Section>

        {/* 8. IA */}
        <Section icon={<ShieldAlert className="h-5 w-5" />} title="8. Funciones de Inteligencia Artificial">
          <p>
            SGI 360 incorpora funcionalidades de Inteligencia Artificial (IA) como herramientas de asistencia para la redacción, análisis y generación de contenido. Estas funciones:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Son de carácter <strong className="text-white">orientativo y no vinculante</strong>.</li>
            <li>Pueden contener errores, imprecisiones o información desactualizada.</li>
            <li><strong className="text-white">No reemplazan el criterio de profesionales</strong> especializados en sistemas de gestión, seguridad, medio ambiente, calidad ni en ninguna otra disciplina.</li>
            <li>El usuario es el único responsable de revisar, validar y aprobar todo contenido generado mediante IA antes de su uso oficial.</li>
          </ul>
          <p>
            SGI 360 no garantiza que el contenido generado por IA cumpla con ninguna norma ISO ni con ningún requisito legal o regulatorio específico.
          </p>
        </Section>

        {/* 9. Modificaciones */}
        <Section icon={<FileWarning className="h-5 w-5" />} title="9. Modificaciones a los Términos">
          <p>
            SGI 360 se reserva el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a los usuarios mediante el correo electrónico registrado y/o mediante un aviso visible en la plataforma, con al menos <strong className="text-white">15 (quince) días de anticipación</strong> en caso de cambios sustanciales.
          </p>
          <p>
            El uso continuado del servicio tras la notificación de cambios implica la aceptación de los nuevos términos.
          </p>
        </Section>

        {/* 10. Ley aplicable */}
        <Section icon={<Scale className="h-5 w-5" />} title="10. Ley Aplicable y Jurisdicción">
          <p>
            Estos términos se rigen e interpretan de acuerdo con las leyes de la <strong className="text-white">República Argentina</strong>, en particular:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-white">Ley N° 25.326</strong> — Protección de los Datos Personales.</li>
            <li><strong className="text-white">Ley N° 11.723</strong> — Propiedad Intelectual.</li>
            <li><strong className="text-white">Ley N° 26.994</strong> — Código Civil y Comercial de la Nación.</li>
            <li><strong className="text-white">Ley N° 24.240</strong> — Defensa del Consumidor.</li>
            <li><strong className="text-white">Ley N° 25.506</strong> — Firma Digital.</li>
          </ul>
          <p>
            Para cualquier controversia derivada del uso de la plataforma, las partes se someten a la jurisdicción de los <strong className="text-white">Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires</strong>, con renuncia a cualquier otro fuero que pudiera corresponder.
          </p>
        </Section>

        {/* Contacto */}
        <div className="flex items-start gap-4 p-5 rounded-xl bg-white/5 border border-white/10">
          <div className="p-2.5 rounded-lg bg-brand-600/20 border border-brand-600/30">
            <Mail className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1">Contacto Legal</h3>
            <p className="text-slate-400 text-sm">
              Para consultas legales, ejercicio de derechos sobre datos personales o notificaciones formales, podés comunicarte a través del módulo de soporte de la plataforma o por correo electrónico al administrador de tu organización.
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              <span>SGI 360 — República Argentina</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
