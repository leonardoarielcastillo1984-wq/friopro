// ============================================================
// Holder a nivel módulo del pipeline financiero de /finanzas.
// Lo llena finanzasRoutes al registrarse; lo lee centro-empresa en
// tiempo de request. Es un singleton de módulo porque Fastify
// encapsula los decorators por plugin — un app.decorate() dentro de
// finanzasRoutes NO se propaga a routers hermanos.
// ============================================================

export interface FinanzaCore {
  recolectarLineas?: (
    tenantId: string,
    desde: Date,
    hasta: Date,
    moneda: string | null,
    centroCostoId: string | null,
  ) => Promise<any[]>;
  recolectarConsolidado?: (
    tenantId: string,
    desde: Date,
    hasta: Date,
    centroCostoId: string | null,
  ) => Promise<any>;
  configMoneda?: (tenantId: string) => Promise<{
    monedaLocal: string | null;
    monedaDefault: string | null;
  }>;
  calcularAlertas?: (
    tenantId: string,
    anio: number,
    mes: number,
    moneda: string | null,
    centroCostoId: string | null,
  ) => Promise<{
    alertas: { severidad: string; tipo: string; mensaje: string; impacto: number; ref: string | null }[];
    umbrales: { atencion: number; critica: number };
    actualizadoEn: Date | null;
  }>;
}

export const finanzaCore: FinanzaCore = {};
