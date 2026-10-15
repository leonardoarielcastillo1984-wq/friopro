import { BUSINESS, LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata = {
  title: 'Aviso sobre Inteligencia Artificial — Logismart',
  description: 'Información sobre el uso de Inteligencia Artificial en la plataforma Logismart.',
};

export default function AvisoIaPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Aviso sobre Inteligencia Artificial</h1>
      <p className="text-xs text-slate-500 mb-8">Última actualización: {LEGAL_LAST_UPDATED}</p>

      <div className="space-y-8 text-sm leading-relaxed text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Uso de IA en la plataforma</h2>
          <p>
            {BUSINESS.name} incorpora funcionalidades de Inteligencia Artificial (IA) como
            herramientas de asistencia en tareas de redacción, análisis, clasificación y generación de
            contenido dentro de sus módulos. El uso de estas funciones es opcional y complementario a
            la operación manual de la plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Naturaleza del contenido generado</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>El contenido generado por IA tiene carácter <strong>orientativo y no vinculante</strong>.</li>
            <li>Puede contener errores, imprecisiones, omisiones o información desactualizada.</li>
            <li><strong>No constituye asesoramiento profesional</strong> legal, técnico, contable, de seguridad laboral ni de ninguna otra disciplina regulada.</li>
            <li>No reemplaza el criterio de profesionales especializados ni garantiza el cumplimiento de normas ISO, requisitos legales o regulatorios.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Responsabilidad del usuario</h2>
          <p>
            El usuario es el <strong>único responsable</strong> de revisar, validar y aprobar todo
            contenido generado por IA antes de su uso oficial dentro de su organización, así como de
            las decisiones tomadas en base a dicho contenido.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Datos utilizados por la IA</h2>
          <p>
            Las consultas a las funciones de IA se procesan mediante proveedores externos de modelos
            de lenguaje bajo acuerdos de confidencialidad. Te recomendamos <strong>no ingresar
            datos personales sensibles, secretos comerciales ni información confidencial</strong> en
            las consultas a la IA. Los datos aislados por tenant no se comparten entre organizaciones.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Limitaciones</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Las consultas a la IA pueden tener un <strong>límite mensual</strong> según el plan contratado.</li>
            <li>{BUSINESS.name} no garantiza la disponibilidad ininterrumpida de las funciones de IA, que dependen de proveedores externos.</li>
            <li>{BUSINESS.name} no se responsabiliza por daños derivados del uso de contenido generado por IA sin revisión humana.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Transparencia</h2>
          <p>
            En cumplimiento del principio de transparencia algorítmica, informamos que cuando
            interactuás con las funciones de IA lo hacés con un sistema automatizado, no con una
            persona. Este aviso cumple con las mejores prácticas de divulgación sobre sistemas de IA.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Contacto</h2>
          <p>
            Consultas sobre el uso de IA:{' '}
            <a className="text-orange-600 hover:underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
