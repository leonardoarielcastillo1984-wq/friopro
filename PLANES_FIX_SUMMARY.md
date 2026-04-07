# SGI 360 - Planes Page Fix Summary

## Problem
The "Gestión de Planes" page was displaying hardcoded module features that didn't match the actual system modules available in the Sidebar menu. This caused a mismatch between what the Plans page showed and what modules were actually available in each plan tier.

## Solution
Modified the API's `/license/plans` endpoint to **dynamically generate the features list** from the actual `MODULE_CONFIG` configuration, instead of using hardcoded strings.

## Changes Made

### 1. Updated API Route (`/apps/api/src/routes/license.ts`)
- **Modified**: `/license/plans` endpoint (lines 182-264)
- **Change**: The features list is now generated dynamically based on:
  - Extracting modules from `MODULE_CONFIG`
  - Filtering modules by plan tier (BASIC, PROFESSIONAL, PREMIUM)
  - Sorting module names alphabetically
  - Building `features` array with user limits + available modules
  - Building `notIncluded` array with modules not available at that tier

### 2. Updated Mock API Server (`/apps/api/server-data.cjs`)
- **Added**: Complete license endpoints including:
  - `GET /license/setup` - Setup status endpoint
  - `GET /license/plans` - Plans listing with dynamic features
  - `GET /license/subscription` - Current subscription status
  - `POST /license/subscription` - Subscribe to plan
  - `POST /license/setup/pay` - Complete setup payment
- **Features**: Same dynamic generation logic as the main API route

## How It Works

The `MODULE_CONFIG` in the API defines all available modules and their minimum plan tier:

```javascript
const MODULE_CONFIG = {
  dashboard: { name: 'Panel General', minPlan: 'BASIC', ... },
  documents: { name: 'Documentos', minPlan: 'BASIC', ... },
  // ... more modules ...
  audit: { name: 'Auditoría IA', minPlan: 'PREMIUM', ... },
};
```

For each plan tier, the code:
1. Finds all modules where `minPlan <= currentTier`
2. Builds a sorted list of module names
3. Returns these as the `features` array in the plan response
4. Also lists modules as `notIncluded` for tiers where they're not available

## Plans Now Display

### BASIC Plan
- ✅ Panel General
- ✅ Documentos
- ✅ No Conformidades
- ✅ Indicadores
- ✅ Riesgos

### PROFESSIONAL Plan (Blue - "Más Popular")
- ✅ Panel General
- ✅ Documentos
- ✅ No Conformidades
- ✅ Indicadores
- ✅ Riesgos
- ✅ Auditorías
- ✅ Capacitaciones
- ✅ Mantenimiento
- ✅ Project360
- ✅ Simulacros
- ✅ Normativos
- ✅ Clientes
- ✅ Encuestas

### PREMIUM Plan
- ✅ All of the above PLUS:
- ✅ Auditoría IA
- ✅ Inteligencia
- ✅ RRHH

## Verification

To verify the changes are working:

```bash
# Test the /license/plans endpoint
curl http://localhost:3001/license/plans | jq '.plans[] | {tier, features}'

# Expected output shows dynamic features matching MODULE_CONFIG:
# BASIC: ["Hasta 5 usuarios", "Documentos", "Indicadores", "No Conformidades", "Panel General", "Riesgos"]
# PROFESSIONAL: ["Hasta 15 usuarios", "Auditorías", "Capacitaciones", "Clientes", ...]
# PREMIUM: ["Hasta 50 usuarios", "Auditoría IA", "Auditorías", ...]
```

## Benefits

1. ✅ **Single Source of Truth**: Module availability is defined once in `MODULE_CONFIG`
2. ✅ **Automatic Synchronization**: Adding or changing modules automatically updates plan features
3. ✅ **Consistency**: Plans page matches actual Sidebar menu modules
4. ✅ **Maintainability**: No need to update hardcoded lists when modules change

## Running the Servers

```bash
# API Server (uses server-data.cjs for development)
cd apps/api
node server-data.cjs

# Web Server (in another terminal)
cd apps/web
npm run dev
# Then open: http://localhost:3000
```

The Planes page is now accessible at: `http://localhost:3000/planes`

## Files Modified

1. `/apps/api/src/routes/license.ts` - Main API route (182-264)
2. `/apps/api/server-data.cjs` - Mock development server (added license endpoints)

## Next Steps

If modules are added or removed in the future:
1. Update `MODULE_CONFIG` in both files
2. The plan features will automatically reflect the changes
3. No additional code changes needed
