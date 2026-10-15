import { BUSINESS, LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata = {
  title: 'Términos y Condiciones — Logismart',
  description: 'Términos y condiciones de uso de la plataforma Logismart y sus módulos SGI360.',
};

export default function TerminosPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Términos y Condiciones de Uso</h1>
      <p className="text-xs text-slate-500 mb-8">Última actualización: {LEGAL_LAST_UPDATED}</p>

      <div className="space-y-8 text-sm leading-relaxed text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. El servicio</h2>
          <p>
            {BUSINESS.name} es una suite de software como servicio (SaaS) para gestión empresarial:
            sistemas de gestión ISO (SGI360), seguridad e higiene (SEH360), auditorías (AUDIT360),
            flotas (FLOTA360), siniestros (SINIESTROS360) y proyectos (PROYECT360). Al crear una
            cuenta o usar el servicio aceptás estos términos, la{' '}
            <a className="text-orange-600 hover:underline" href="/legal/privacidad">Política de Privacidad</a> y la{' '}
            <a className="text-orange-600 hover:underline" href="/legal/reembolsos">Política de Reembolsos</a>.
          </p>
          <p className="mt-2">
            La plataforma es una <strong>herramienta tecnológica</strong>: no es un organismo de
            certificación, no emite certificados ISO ni reemplaza la consultoría profesional.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Cuentas y acceso</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Debés ser mayor de 18 años y proveer información veraz.</li>
            <li>Sos responsable de la confidencialidad de tus credenciales y de toda actividad bajo tu cuenta.</li>
            <li>Notificanos de inmediato ante uso no autorizado a <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.</li>
            <li>Cada organización (tenant) tiene sus datos aislados; el acceso se rige por los permisos que defina el administrador del tenant.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Suscripciones y facturación</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>El precio vigente se publica en el sitio (actualmente USD 99/mes por módulo) y puede incluir un período de prueba gratuita.</li>
            <li>La facturación es mensual por adelantado a través de Mercado Pago.</li>
            <li>Podés cancelar en cualquier momento desde la sección Licencia; el acceso continúa hasta el fin del ciclo ya pagado. Ver <a className="text-orange-600 hover:underline" href="/legal/reembolsos">Política de Reembolsos</a>.</li>
            <li>Los precios pueden actualizarse con aviso previo de al menos 15 días.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Tu contenido</h2>
          <p>
            Sos titular de todo el contenido que tu organización carga. Nos otorgás una licencia
            limitada, no exclusiva y revocable para almacenar y procesarlo únicamente con el fin de
            prestarte el servicio. Garantizás que tenés derechos sobre el contenido que subís y que no
            infringe leyes ni derechos de terceros (Ley N° 11.723 de Propiedad Intelectual).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Uso aceptable</h2>
          <p>Queda prohibido:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Cargar contenido ilegal, difamatorio o que viole derechos de terceros.</li>
            <li>Intentar acceder a cuentas o datos de otros usuarios, vulnerar la seguridad o realizar ingeniería inversa.</li>
            <li>Usar el servicio para actividades fraudulentas o envío de spam.</li>
            <li>Compartir credenciales con personas no autorizadas.</li>
          </ul>
          <p className="mt-2">El incumplimiento puede derivar en suspensión o cancelación de la cuenta.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Funciones de IA</h2>
          <p>
            Las funcionalidades de Inteligencia Artificial son herramientas de asistencia de carácter
            orientativo: pueden contener errores y <strong>no reemplazan el criterio profesional
            humano</strong>. Sos responsable de revisar todo contenido generado por IA antes de su uso.
            Las consultas de IA pueden tener límites mensuales según el plan.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Disponibilidad y respaldo</h2>
          <p>
            Hacemos esfuerzos razonables por mantener el servicio disponible, pero no garantizamos
            disponibilidad del 100%. Realizamos backups automáticos; aun así te recomendamos mantener
            copias propias de la documentación crítica.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Limitación de responsabilidad</h2>
          <p>
            En la máxima medida permitida por la ley argentina, {BUSINESS.name} no será responsable
            por daños indirectos, lucro cesante, pérdida de datos ni por decisiones tomadas en base a
            la información de la plataforma (incluidos resultados de auditorías o certificaciones
            externas). Nada en estos términos limita derechos irrenunciables del consumidor conforme
            a la <strong>Ley N° 24.240 de Defensa del Consumidor</strong> cuando resulte aplicable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">9. Propiedad intelectual</h2>
          <p>
            El software, diseño, marca y logotipos de {BUSINESS.name} son propiedad de sus titulares
            (Ley N° 11.723). Está prohibido reproducirlos, venderlos o utilizarlos sin autorización
            escrita.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">10. Modificaciones y terminación</h2>
          <p>
            Podemos modificar estos términos; los cambios sustanciales se notifican con al menos 15
            días de anticipación. El uso continuado implica aceptación. Podés cerrar tu cuenta en
            cualquier momento; nosotros podemos suspenderla por incumplimiento.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">11. Ley aplicable y jurisdicción</h2>
          <p>
            Estos términos se rigen por las leyes de la República Argentina: Ley N° 25.326 (datos
            personales), Ley N° 11.723 (propiedad intelectual), Código Civil y Comercial (Ley N°
            26.994) y Ley N° 24.240 (defensa del consumidor). Las partes se someten a los{' '}
            {BUSINESS.jurisdiction}, con renuncia a cualquier otro fuero, sin perjuicio de los
            derechos irrenunciables del consumidor.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">12. Contacto</h2>
          <p>
            {BUSINESS.name} — {BUSINESS.location}. Email:{' '}
            <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> — WhatsApp:{' '}
            <a className="text-orange-600 hover:underline" href={`https://wa.me/${BUSINESS.whatsappIntl}`} target="_blank" rel="noopener noreferrer">{BUSINESS.whatsapp}</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
