import { BUSINESS, LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata = {
  title: 'Aviso Legal — Logismart',
  description: 'Aviso legal e identificación del titular del sitio web Logismart.',
};

export default function AvisoLegalPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Aviso Legal</h1>
      <p className="text-xs text-slate-500 mb-8">Última actualización: {LEGAL_LAST_UPDATED}</p>

      <div className="space-y-8 text-sm leading-relaxed text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Titular del sitio</h2>
          <p>
            En cumplimiento del deber de información, se informa que el presente sitio web y la
            plataforma asociada son titularidad de:
          </p>
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-1">
            <p><strong>Denominación:</strong> {BUSINESS.name}</p>
            <p><strong>Domicilio:</strong> {BUSINESS.location}</p>
            <p><strong>Email:</strong> {BUSINESS.email}</p>
            <p><strong>Email protección de datos:</strong> {BUSINESS.privacyEmail}</p>
            <p><strong>WhatsApp:</strong> {BUSINESS.whatsapp}</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Objeto y ámbito</h2>
          <p>
            Este sitio tiene por objeto informar sobre los productos de software de {BUSINESS.name}
            (SGI360, SEH360, AUDIT360, FLOTA360, SINIESTROS360, PROYECT360) y dar acceso a la
            plataforma SaaS contratada por organizaciones. El acceso y navegación implican la
            aceptación de este aviso y de los{' '}
            <a className="text-orange-600 hover:underline" href="/legal/terminos">Términos y Condiciones</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Datos personales</h2>
          <p>
            El tratamiento de datos personales se rige por la{' '}
            <a className="text-orange-600 hover:underline" href="/legal/privacidad">Política de Privacidad</a>,
            conforme a la <strong>Ley N° 25.326 de Protección de los Datos Personales</strong> de la
            República Argentina y a las disposiciones de la <strong>Agencia de Acceso a la
            Información Pública (AAIP)</strong>, órgano de control competente para atender denuncias
            por incumplimiento.
          </p>
          <p className="mt-2">
            El titular podrá ejercer los derechos de acceso, rectificación, actualización y supresión
            escribiendo a <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.privacyEmail}`}>{BUSINESS.privacyEmail}</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Propiedad intelectual</h2>
          <p>
            Todos los contenidos del sitio (textos, diseño, código, marca, logotipos, iconografía) son
            titularidad de {BUSINESS.name} o de terceros licenciantes (iconos Lucide bajo licencia
            ISC). Queda prohibida su reproducción total o parcial sin autorización escrita, conforme
            a la <strong>Ley N° 11.723 de Propiedad Intelectual</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Exactitud de la información</h2>
          <p>
            {BUSINESS.name} procura que la información publicada sea exacta y esté actualizada, pero
            no garantiza la ausencia de errores. Las funcionalidades descritas pueden variar según el
            módulo y plan contratado. El contenido del sitio tiene carácter informativo y no constituye
            oferta vinculante ni asesoramiento profesional, técnico ni legal.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Enlaces a terceros</h2>
          <p>
            El sitio puede contener enlaces a sitios de terceros (por ejemplo WhatsApp). {BUSINESS.name}{' '}
            no controla ni responde por el contenido, políticas o prácticas de dichos sitios.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Legislación aplicable</h2>
          <p>
            Este aviso se rige por las leyes de la República Argentina: Ley N° 25.326 (datos
            personales), Ley N° 11.723 (propiedad intelectual), Código Civil y Comercial (Ley N°
            26.994) y Ley N° 24.240 (defensa del consumidor). Para controversias, jurisdicción de los{' '}
            {BUSINESS.jurisdiction}.
          </p>
        </section>
      </div>
    </article>
  );
}
