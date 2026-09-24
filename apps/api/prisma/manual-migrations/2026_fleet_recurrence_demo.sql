-- ═══════════════════════════════════════════════════════════════
-- DATOS DE DEMOSTRACIÓN — Análisis de reparaciones recurrentes
-- Caso: un camión DEMO con 3 reparaciones distintas sobre el mismo
-- componente padre "Burro de arranque" (carbones → automático →
-- bendix), que deben agruparse y disparar la regla de recurrencia.
--
-- AISLADO: crea un vehículo dominio 'DEMO-BURRO' claramente
-- identificado. NO toca registros operativos reales.
-- Idempotente: si ya existe el vehículo DEMO-BURRO no duplica.
--
-- Aplicar en TESTING:
--   docker exec -i sgi-postgres-testing psql -U sgi -d sgi < 2026_fleet_recurrence_demo.sql
-- Por defecto usa el primer tenant ACTIVE; para otro tenant:
--   docker exec -i sgi-postgres-testing psql -U sgi -d sgi -v tenant_id='<uuid>' -f ...
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tenant    UUID;
  v_vehiculo  UUID;
  v_asset     UUID;
  v_comp      UUID;
  v_inst      UUID;
  v_ot1       UUID := gen_random_uuid();
  v_ot2       UUID := gen_random_uuid();
  v_ot3       UUID := gen_random_uuid();
BEGIN
  -- Tenant: parámetro -v tenant_id o primer ACTIVE
  SELECT COALESCE(NULLIF(current_setting('vars.tenant_id', true), '')::uuid,
                  (SELECT id FROM "Tenant" WHERE status = 'ACTIVE' ORDER BY "createdAt" LIMIT 1),
                  (SELECT id FROM "Tenant" ORDER BY "createdAt" LIMIT 1))
    INTO v_tenant;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No hay tenant disponible para el demo';
  END IF;

  -- Idempotencia: si ya existe el vehículo demo, salir
  SELECT id INTO v_vehiculo FROM flota_vehiculos WHERE "tenantId" = v_tenant AND dominio = 'DEMO-BURRO';
  IF v_vehiculo IS NOT NULL THEN
    RAISE NOTICE 'Demo ya existe (vehiculo %). No se duplica.', v_vehiculo;
    RETURN;
  END IF;

  -- Activo de mantenimiento + vehículo DEMO
  v_asset := gen_random_uuid();
  INSERT INTO maintenance_assets (id, "tenantId", code, name, category, status, "currentOdometer")
  VALUES (v_asset, v_tenant, 'DEMO-BURRO-ASSET', 'Camión DEMO recurrencias', 'VEHICLE', 'ACTIVE', 148000);

  v_vehiculo := gen_random_uuid();
  INSERT INTO flota_vehiculos (id, "tenantId", dominio, tipo, marca, modelo, anio, "currentOdometer", status, "estadoOperativo", "maintenanceAssetId")
  VALUES (v_vehiculo, v_tenant, 'DEMO-BURRO', 'CAMION', 'Demo', 'Recurrencias', 2020, 148000, 'ACTIVO', 'OPERATIVO', v_asset);

  -- Componente padre + regla de recurrencia (3 en 180 días — config de demo)
  v_comp := gen_random_uuid();
  INSERT INTO fleet_components (id, "tenantId", nombre, categoria, sinonimos)
  VALUES (v_comp, v_tenant, 'Burro de arranque', 'ELECTRICO', ARRAY['motor de arranque','arranque','starter','burro']);

  INSERT INTO fleet_recurrence_rules (id, "tenantId", "componentId", "maxIntervenciones", "ventanaDias", "soloFallas")
  VALUES (gen_random_uuid(), v_tenant, v_comp, 3, 180, true);

  -- Instancia instalada del burro (la pieza física actual)
  v_inst := gen_random_uuid();
  INSERT INTO fleet_component_instances (id, "tenantId", "componentId", "serialNumber", notas)
  VALUES (v_inst, v_tenant, v_comp, 'BOSCH-0001-DEMO', 'Burro original del vehículo demo');
  INSERT INTO fleet_component_installations (id, "tenantId", "instanceId", "vehiculoId", "installedAt", "installedKm", motivo)
  VALUES (gen_random_uuid(), v_tenant, v_inst, v_vehiculo, now() - interval '400 days', 0, 'INSTALACION_INICIAL');

  -- ── 3 OTs completadas: misma falla de fondo (burro), piezas distintas ──
  -- OT1: cambio de carbones (hace ~5 meses)
  INSERT INTO work_orders (id, "tenantId", code, title, description, type, priority, status, "assetId", "scheduledDate", "startedAt", "completedAt", "laborCost", "partsCost", "totalCost")
  VALUES (v_ot1, v_tenant, 'OT-DEMO-001', 'No arranca — cambio de carbones del burro', 'El motor de arranque giraba débil. Se cambiaron los carbones.', 'CORRECTIVE', 'HIGH', 'COMPLETED', v_asset,
          now() - interval '150 days', now() - interval '150 days', now() - interval '149 days', 18000, 9500, 27500);
  -- OT2: cambio del automático/solenoide (hace ~3 meses)
  INSERT INTO work_orders (id, "tenantId", code, title, description, type, priority, status, "assetId", "scheduledDate", "startedAt", "completedAt", "laborCost", "partsCost", "totalCost")
  VALUES (v_ot2, v_tenant, 'OT-DEMO-002', 'Arranque falla de nuevo — automático del burro', 'El burro no acoplaba. Se reemplazó el automático (solenoide).', 'CORRECTIVE', 'HIGH', 'COMPLETED', v_asset,
          now() - interval '90 days', now() - interval '90 days', now() - interval '89 days', 18000, 22000, 40000);
  -- OT3: reparación del bendix (hace ~1 mes)
  INSERT INTO work_orders (id, "tenantId", code, title, description, type, priority, status, "assetId", "scheduledDate", "startedAt", "completedAt", "laborCost", "partsCost", "totalCost")
  VALUES (v_ot3, v_tenant, 'OT-DEMO-003', 'Ruido al arrancar — bendix del burro de arranque', 'Bendix con juego. Se reparó y ajustó.', 'CORRECTIVE', 'MEDIUM', 'COMPLETED', v_asset,
          now() - interval '30 days', now() - interval '30 days', now() - interval '29 days', 15000, 6000, 21000);

  -- Vínculos OT↔componente (clasificación CONFIRMADA, subcomponentes distintos)
  INSERT INTO fleet_work_order_components (id, "tenantId", "workOrderId", "componentId", "instanceId", subcomponente, sintoma, causa, "trabajoRealizado", clasificacion)
  VALUES
    (gen_random_uuid(), v_tenant, v_ot1, v_comp, v_inst, 'carbones', 'Arranque débil / no arranca', 'Carbones gastados', 'Cambio de carbones', 'CONFIRMADA'),
    (gen_random_uuid(), v_tenant, v_ot2, v_comp, v_inst, 'automático (solenoide)', 'No acopla el piñón', 'Solenoide defectuoso', 'Reemplazo de automático', 'CONFIRMADA'),
    (gen_random_uuid(), v_tenant, v_ot3, v_comp, v_inst, 'bendix', 'Ruido metálico al arrancar', 'Bendix con juego', 'Reparación y ajuste de bendix', 'CONFIRMADA');

  -- Historial de mantenimiento del vehículo (con odómetro para km entre fallas)
  INSERT INTO vehiculo_historial_mantenimiento (id, "tenantId", "vehiculoId", "workOrderId", fecha, tipo, descripcion, costo, odometro)
  VALUES
    (gen_random_uuid(), v_tenant, v_vehiculo, v_ot1, now() - interval '149 days', 'CORRECTIVE', 'No arranca — cambio de carbones del burro', 27500, 120000),
    (gen_random_uuid(), v_tenant, v_vehiculo, v_ot2, now() - interval '89 days', 'CORRECTIVE', 'Arranque falla de nuevo — automático del burro', 40000, 134000),
    (gen_random_uuid(), v_tenant, v_vehiculo, v_ot3, now() - interval '29 days', 'CORRECTIVE', 'Ruido al arrancar — bendix del burro de arranque', 21000, 145000);

  RAISE NOTICE 'Demo creado: vehiculo %, componente %, instancia %, OTs % % %', v_vehiculo, v_comp, v_inst, v_ot1, v_ot2, v_ot3;
END $$;
