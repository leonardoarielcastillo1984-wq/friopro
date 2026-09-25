-- Vehiculo.tipoCombustible: combustible principal de la unidad.
-- Valores: DIESEL (default), NAFTA, GNC, ELECTRICO.
-- Sirve para pre-seleccionar el tipo en el hub del chofer / panel y para
-- calcular rendimiento comparando solo cargas del mismo tipo (km/L vs km/m³).
ALTER TABLE flota_vehiculos ADD COLUMN IF NOT EXISTS "tipoCombustible" TEXT NOT NULL DEFAULT 'DIESEL';
