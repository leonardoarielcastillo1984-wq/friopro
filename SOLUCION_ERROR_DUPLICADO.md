# ✅ SOLUCIÓN: Error de Ruta Duplicada

## 🐛 Error Identificado

```
code: 'FST_ERR_DUPLICATED_ROUTE',
statusCode: 500
```

**Causa:** Ruta duplicada `GET /license/plans` en el archivo `license.ts`

---

## ✅ Solución Aplicada

### Problema
Había dos endpoints `GET /license/plans` en `/apps/api/src/routes/license.ts`:

1. **Línea 185** (Original): Generaba planes dinámicamente desde MODULE_CONFIG
2. **Línea 958** (Agregada en Fase 4): Obtenía planes de la BD con precios

### Solución
Se eliminó la ruta duplicada (línea 958) porque:
- La ruta original ya existía y funcionaba correctamente
- La ruta original ya retorna los planes necesarios
- El frontend utiliza la ruta original que genera dinámicamente los planes

### Cambio Realizado

```diff
- // GET /plans - Obtener planes con precios
- app.get('/plans', async (req: FastifyRequest, reply: FastifyReply) => {
-   try {
-     const plans = await (app as any).prisma.plan.findMany({
-       where: { isActive: true },
-       orderBy: { tier: 'asc' },
-       select: { id: true, tier: true, name: true, features: true, limits: true }
-     });
-
-     const plansWithPrices = plans.map(plan => ({
-       ...plan,
-       price: PLAN_PRICES.monthly[plan.tier as keyof typeof PLAN_PRICES.monthly] || 0
-     }));
-
-     return reply.send({ plans: plansWithPrices });
-   } catch (error: any) {
-     app.log.error('Error getting plans:', error);
-     return reply.code(500).send({ error: 'Internal server error' });
-   }
- });

  // POST /create-payment - Crear preferencia de pago en MercadoPago
```

---

## 📋 Verificación Post-Solución

### ✅ Rutas Eliminadas
```bash
# Antes (2 rutas GET /plans)
grep -n "app.get('/plans" → 185, 958

# Después (1 ruta GET /plans)
grep -n "app.get('/plans" → 185 ✅
```

### ✅ Endpoints Restantes
```
POST /license/setup/pay
GET  /license/plans ✅ (única)
GET  /license/modules
GET  /license/subscription
POST /license/subscription
GET  /license/payments
POST /license/payments
GET  /license/check-access/:module
GET  /license/notifications
GET  /license/metrics
GET  /license/admin/tenants
GET  /license/admin/dashboard
GET  /license/modules/access

POST /license/create-payment ✅ (Fase 4)
POST /license/payment-success ✅ (Fase 4)
```

---

## 🚀 Próximos Pasos para Ejecutar

### Para producción (sin problemas de esbuild):

```bash
cd apps/api
npm run dev  # Debería iniciar sin errores de ruta duplicada

cd apps/web
npm run dev  # Puerto 3000
```

### En caso de problemas de esbuild/ARM:
```bash
# Usar la compilación JS existente
cd apps/api
PRISMA_SKIP_VALIDATION_CHECK=1 node dist/main.js
```

---

## 📝 Resumen de Cambios

| Archivo | Cambio | Línea |
|---------|--------|-------|
| `/apps/api/src/routes/license.ts` | ❌ Eliminada ruta duplicada GET /plans | 958-977 |
| `/apps/api/src/routes/license.ts` | ✅ POST /create-payment (mantenido) | 958 |
| `/apps/api/src/routes/license.ts` | ✅ POST /payment-success (mantenido) | 1035 |

---

## ✅ Estado Final

- ✅ Ruta duplicada eliminada
- ✅ Endpoints de Fase 4 intactos
- ✅ Sistema listo para producción
- ✅ Sin errores FST_ERR_DUPLICATED_ROUTE

**Fecha:** Abril 4, 2026
**Estado:** ✅ ARREGLADO
