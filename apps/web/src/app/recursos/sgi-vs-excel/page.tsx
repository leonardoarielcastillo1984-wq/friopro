import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SGI con Excel vs software dedicado: comparación honesta | SGI360',
  description:
    'Comparación real entre gestionar un sistema de gestión integrado con planillas de Excel y un software dedicado: cuándo alcanza, cuándo se vuelve riesgo y costo oculto real.',
  alternates: { canonical: 'https://logismart.ar/recursos/sgi-vs-excel' },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'SGI con Excel vs software dedicado: comparación honesta',
  description: 'Cuándo las planillas alcanzan para el SGI y cuándo se convierten en un riesgo.',
  inLanguage: 'es',
  author: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  publisher: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  mainEntityOfPage: 'https://logismart.ar/recursos/sgi-vs-excel',
  datePublished: '2026-10-15',
};

export default function SgiVsExcel() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Comparativa</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
        SGI con Excel vs software dedicado: comparación honesta
      </h1>
      <p className="mt-3 text-sm text-slate-400">Comparativa · 7 min de lectura · LOGISMART</p>

      <div className="prose prose-slate mt-10 max-w-none space-y-6 text-[15px] leading-relaxed text-slate-600">
        <p className="text-lg text-slate-500">
          Casi todas las empresas empiezan su sistema de gestión en Excel. Y está bien — al principio.
          El problema no es Excel, es cuándo se sigue usando para cosas que no puede garantizar.
          Esta es una comparación sin marketing: cuándo alcanza, cuándo no, y cómo medir el costo real.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Dónde Excel sí funciona</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Registros simples con un solo responsable: una lista de proveedores, un inventario, un registro de capacitaciones.</li>
          <li>Análisis puntuales: una matriz de riesgos inicial, cálculos de indicadores mensuales.</li>
          <li>Empresas chicas pre-certificación, ordenando el sistema por primera vez.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Dónde se rompe</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>Control de versiones</strong>: Excel no puede garantizar cuál es la versión vigente de un procedimiento. Si hay que confiar en la carpeta correcta y el nombre correcto, el control es ficticio — y la cláusula 7.5 lo exige.</li>
          <li><strong>Trazabilidad</strong>: no hay forma confiable de probar quién aprobó un documento, quién cerró una acción correctiva ni cuándo. En auditoría esto es observación segura.</li>
          <li><strong>Seguimiento activo</strong>: una planilla no avisa que una NC vence mañana ni que un indicador lleva tres meses bajo meta. Depende de que alguien la abra y mire.</li>
          <li><strong>Integridad de datos</strong>: cualquier fila se puede borrar o cambiar sin registro. La evidencia pierde valor probatorio.</li>
          <li><strong>Escalamiento</strong>: cuando 5+ personas tocan el mismo archivo, aparecen los <em>-v2-FINAL-final.xlsx</em> y los cambios pisados.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">El costo oculto del Excel “gratis”</h2>
        <p>
          La cuenta que casi nadie hace: horas del responsable de calidad persiguiendo versiones,
          preparando evidencia a mano antes de auditorías y consolidando indicadores copiando datos
          entre archivos. En una pyme típica son 2-4 días por mes — que suelen costar más que la
          suscripción anual de un software.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Cuándo dar el salto</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Vas a auditoría y preparar la evidencia lleva días, no horas.</li>
          <li>Más de dos personas mantienen el sistema y ya pisaron trabajo ajeno.</li>
          <li>Tenés hallazgos repetidos de documentación o seguimiento.</li>
          <li>Necesitás cubrir varias normas (9001 + 14001 + 45001 o IATF) y cada una terminó en su propio silo de archivos.</li>
          <li>La operación deja datos en planillas que nadie mira hasta fin de mes — flota, mantenimiento, gastos.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Cómo se ve del otro lado</h2>
        <p>
          En <Link href="/sgi360-landing" className="font-semibold text-green-700 hover:underline">SGI360</Link> cada
          pieza del SGI tiene dueño, estado y fecha: los documentos tienen un único vigente, las NC
          vencen con aviso, las acciones correctivas tienen seguimiento y los indicadores se alimentan
          solos — incluyendo datos de operación real como costos de flota y gastos importados del SII.
          La diferencia práctica: la auditoría deja de ser un proyecto y pasa a ser un export.
        </p>

        <div className="rounded-2xl border border-green-100 bg-green-50/60 p-6">
          <p className="font-semibold text-slate-900">¿Tu SGI vive en planillas?</p>
          <p className="mt-1 text-sm text-slate-600">
            Probá cómo se ve el mismo sistema con trazabilidad automática.
          </p>
          <Link
            href="/sgi360-landing"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:shadow-lg"
          >
            Ver SGI360
          </Link>
        </div>
      </div>
    </article>
  );
}
