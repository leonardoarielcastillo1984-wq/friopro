import { BUSINESS, LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata = {
  title: 'Política de Reembolsos — Logismart',
  description: 'Condiciones de cancelación y reembolso de las suscripciones de Logismart.',
};

export default function ReembolsosPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Política de Reembolsos y Cancelación</h1>
      <p className="text-xs text-slate-500 mb-8">Última actualización: {LEGAL_LAST_UPDATED}</p>

      <div className="space-y-8 text-sm leading-relaxed text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Período de prueba</h2>
          <p>
            Las nuevas cuentas disponen de un período de prueba gratuita sin necesidad de tarjeta de
            crédito. Durante la prueba podés usar el módulo contratado sin cargo; al finalizar, el
            servicio se suspende salvo que actives una suscripción paga.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Cancelación</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Podés cancelar tu suscripción en cualquier momento desde <strong>Licencia → Planes</strong> dentro de la plataforma, o escribiendo a <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.</li>
            <li>La cancelación es efectiva al final del ciclo de facturación ya pagado: conservás el acceso hasta esa fecha y no se generan nuevos cargos.</li>
            <li>No hay contratos anuales obligatorios ni penalidades por cancelar.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Reembolsos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Regla general:</strong> los pagos mensuales ya efectuados no son reembolsables, porque el servicio digital se pone a disposición de inmediato durante el ciclo completo.</li>
            <li><strong>Excepciones:</strong> evaluamos reembolsos proporcionales o totales en caso de (a) cobros duplicados o por error, (b) fallas graves del servicio que hayan impedido su uso durante más de 48 horas continuas y no sean atribuibles al usuario ni a terceros, o (c) cuando la ley de defensa del consumidor lo exija.</li>
            <li>Las solicitudes se evalúan dentro de los 10 días hábiles y se resuelven por el mismo medio de pago utilizado (Mercado Pago).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Derecho de revocación (consumidores)</h2>
          <p>
            Si contratás como consumidor final, el <strong>art. 34 de la Ley N° 24.240 de Defensa del
            Consumidor</strong> y el art. 1110 del Código Civil y Comercial pueden otorgarte un derecho
            de revocación dentro de los 10 días de la contratación a distancia, salvo que el servicio
            digital se haya ejecutado completamente con tu consentimiento expreso. Para ejercerlo
            escribinos a <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>{' '}
            con el asunto "Revocación".
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Suspensión por falta de pago</h2>
          <p>
            Ante un pago rechazado, Mercado Pago reintenta el cobro; si la deuda persiste, la
            suscripción se suspende. Tus datos se conservan por un período de gracia antes de su
            eliminación, conforme a la{' '}
            <a className="text-orange-600 hover:underline" href="/legal/privacidad">Política de Privacidad</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Contacto</h2>
          <p>
            {BUSINESS.name} — {BUSINESS.location}. Consultas de facturación y reembolsos:{' '}
            <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> — WhatsApp:{' '}
            <a className="text-orange-600 hover:underline" href={`https://wa.me/${BUSINESS.whatsappIntl}`} target="_blank" rel="noopener noreferrer">{BUSINESS.whatsapp}</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
