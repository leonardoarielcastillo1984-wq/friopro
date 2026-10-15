import { BUSINESS, LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata = {
  title: 'Política de Privacidad — Logismart',
  description: 'Cómo Logismart recolecta, usa y protege tus datos personales conforme a la Ley 25.326.',
};

export default function PrivacidadPage() {
  return (
    <article className="prose-sm">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Política de Privacidad</h1>
      <p className="text-xs text-slate-500 mb-8">Última actualización: {LEGAL_LAST_UPDATED}</p>

      <div className="space-y-8 text-sm leading-relaxed text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Responsable del tratamiento</h2>
          <p>
            {BUSINESS.name} ({BUSINESS.location}) es responsable del tratamiento de los datos
            personales recolectados a través de este sitio web y de la plataforma. Podés contactarnos
            en <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.privacyEmail}`}>{BUSINESS.privacyEmail}</a> o{' '}
            <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Datos que recolectamos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>De registro:</strong> nombre, email, nombre de la organización, contraseña (almacenada cifrada).</li>
            <li><strong>De facturación:</strong> datos de pago procesados por Mercado Pago; nunca almacenamos números de tarjeta.</li>
            <li><strong>De uso:</strong> logs de acceso, dirección IP, navegador, funcionalidades utilizadas.</li>
            <li><strong>Contenido:</strong> documentos y datos que la organización carga en la plataforma, de los cuales el cliente es titular.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Finalidad</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Prestar, mantener y mejorar el servicio contratado.</li>
            <li>Gestionar la cuenta, suscripción y facturación.</li>
            <li>Comunicar actualizaciones, alertas de seguridad y novedades del servicio.</li>
            <li>Medición de tráfico publicitario (Google Ads) <strong>solo con tu consentimiento</strong> — ver <a className="text-orange-600 hover:underline" href="/legal/cookies">Política de Cookies</a>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Base legal y marco normativo</h2>
          <p>
            El tratamiento se realiza conforme a la <strong>Ley N° 25.326 de Protección de los Datos
            Personales</strong> (Argentina) y las disposiciones de la <strong>Agencia de Acceso a la
            Información Pública (AAIP)</strong>. La AAIP es el órgano de control facultado para atender
            denuncias y reclamos por incumplimiento de la normativa de protección de datos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Conservación y seguridad</h2>
          <p>
            Conservamos los datos mientras la cuenta esté activa y por los plazos legales aplicables.
            Aplicamos cifrado en tránsito (TLS), aislamiento por tenant, backups automáticos y control
            de acceso por roles. Ningún sistema es 100% seguro; ante un incidente que afecte tus datos
            lo notificaremos conforme a la normativa vigente.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Terceros y transferencias</h2>
          <p>
            No vendemos ni cedemos datos personales. Compartimos datos únicamente con proveedores
            necesarios para operar el servicio (hosting en la nube, procesamiento de pagos con Mercado
            Pago, envío de emails), bajo obligaciones de confidencialidad. Algunos proveedores pueden
            procesar datos fuera de Argentina con garantías adecuadas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Tus derechos</h2>
          <p>
            Podés ejercer los derechos de <strong>acceso, rectificación, actualización y supresión</strong>{' '}
            (art. 14, Ley 25.326) escribiendo a{' '}
            <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.privacyEmail}`}>{BUSINESS.privacyEmail}</a>.
            Responderemos dentro de los plazos legales. La supresión de la cuenta elimina los datos
            personales asociados, salvo obligaciones legales de retención.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Menores</h2>
          <p>
            El servicio está destinado a organizaciones y personas mayores de 18 años. No recolectamos
            intencionalmente datos de menores.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">9. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta política; los cambios sustanciales se notificarán por email o
            aviso en la plataforma con al menos 15 días de anticipación. La versión vigente siempre
            estará publicada en esta página.
          </p>
        </section>
      </div>
    </article>
  );
}
