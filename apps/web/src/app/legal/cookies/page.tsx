import { BUSINESS, LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata = {
  title: 'Política de Cookies — Logismart',
  description: 'Qué cookies usa Logismart, con qué finalidad y cómo gestionar tu consentimiento.',
};

export default function CookiesPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Política de Cookies</h1>
      <p className="text-xs text-slate-500 mb-8">Última actualización: {LEGAL_LAST_UPDATED}</p>

      <div className="space-y-8 text-sm leading-relaxed text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Qué son las cookies</h2>
          <p>
            Las cookies son pequeños archivos que el sitio guarda en tu navegador para recordar
            preferencias, mantener tu sesión y medir el uso. También usamos tecnologías similares
            (localStorage) que cumplen la misma función.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Cookies que usamos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Tipo</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Ejemplos</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Finalidad</th>
                  <th className="text-left px-4 py-2.5 font-semibold">¿Requiere consentimiento?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-900">Esenciales</td>
                  <td className="px-4 py-2.5">Token de sesión, CSRF, preferencia de consentimiento</td>
                  <td className="px-4 py-2.5">Autenticación, seguridad y funcionamiento básico. Sin ellas el sitio no funciona.</td>
                  <td className="px-4 py-2.5">No — siempre activas</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-900">Analítica / publicidad</td>
                  <td className="px-4 py-2.5">Google Ads (gtag, AW-18147230024)</td>
                  <td className="px-4 py-2.5">Medición de conversiones y rendimiento de campañas.</td>
                  <td className="px-4 py-2.5"><strong>Sí — solo si aceptás</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Consentimiento</h2>
          <p>
            Al visitar el sitio por primera vez verás un banner donde podés <strong>aceptar</strong> o{' '}
            <strong>rechazar</strong> las cookies no esenciales. Google Ads <strong>solo se carga si
            aceptás</strong>; si rechazás, ningún script de medición se ejecuta. Tu decisión se guarda
            en localStorage bajo la clave <code className="bg-slate-100 px-1 rounded">lg_cookie_consent</code>{' '}
            y podés cambiarla borrando los datos del sitio en tu navegador.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Cómo gestionar cookies en tu navegador</h2>
          <p>
            Podés bloquear o eliminar cookies desde la configuración de tu navegador (Chrome, Firefox,
            Safari, Edge → Privacidad → Cookies). Tené en cuenta que bloquear las cookies esenciales
            puede impedir iniciar sesión o usar la plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Marco legal</h2>
          <p>
            Esta política se enmarca en la <strong>Ley N° 25.326 de Protección de los Datos
            Personales</strong> (Argentina) y, para visitantes de la UE, en el RGPD y la Directiva
            ePrivacy, que exigen consentimiento previo para cookies no esenciales.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Contacto</h2>
          <p>
            Consultas sobre cookies:{' '}
            <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.privacyEmail}`}>{BUSINESS.privacyEmail}</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
