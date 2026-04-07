# Emergency Management API Endpoints

All endpoints require JWT authentication header:
```
Authorization: Bearer <token>
```

Base URL: `http://localhost:3002/emergency`

---

## Drill Scenarios Endpoints

### Get All Drills
```
GET /emergency/drills
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "tenant-uuid",
    "name": "Simulacro de Incendio 2024",
    "description": "Simulacro de evacuación ante incendio",
    "type": "FIRE",
    "severity": "HIGH",
    "category": "NATURAL_DISASTER",
    "status": "PLANNED",
    "objectives": ["Evacuar edificio en menos de 10 minutos", "Verificar conteos en puntos de reunión"],
    "scope": {
      "areas": ["Planta Baja", "Primer Piso", "Segundo Piso"],
      "departments": ["RRHH", "Operaciones", "IT"],
      "participants": 150,
      "external_agencies": ["Bomberos Locales"]
    },
    "schedule": {
      "plannedDate": "2024-04-15T09:00:00Z",
      "duration": 2,
      "start_time": "09:00",
      "end_time": "11:00"
    },
    "coordinator": {
      "id": "user-uuid",
      "name": "Admin User",
      "email": "admin@sgi360.com",
      "phone": "+1234567890"
    },
    "evaluators": [
      {"id": "evaluator-uuid", "name": "Evaluador 1", "email": "evaluator@sgi360.com"}
    ],
    "resources": {
      "equipment": ["Extintores", "Equipos de Protección"],
      "personnel": ["Coordinador de Seguridad", "Médico"],
      "facilities": ["Punto de Reunión A", "Punto de Reunión B"]
    },
    "procedures": ["Procedimiento de evacuación", "Búsqueda y rescate"],
    "evaluationCriteria": ["Tiempo de evacuación", "Efectividad de comunicación"],
    "results": null,
    "createdAt": "2024-04-01T10:30:00Z",
    "updatedAt": "2024-04-01T10:30:00Z",
    "startedAt": null,
    "completedAt": null,
    "createdById": "user-uuid",
    "deletedAt": null
  }
]
```

### Get Specific Drill
```
GET /emergency/drills/:id
```

**Response:** Same object as above

---

### Create New Drill
```
POST /emergency/drills
Content-Type: application/json

{
  "name": "Simulacro de Terremoto",
  "description": "Prueba de procedimientos ante sismo",
  "type": "NATURAL_DISASTER",
  "severity": "CRITICAL",
  "category": "NATURAL_DISASTER",
  "objectives": ["Evaluar respuesta", "Identificar mejoras"],
  "scope": {
    "areas": ["Todo el edificio"],
    "departments": ["Todas"],
    "participants": 200,
    "external_agencies": ["Protección Civil"]
  },
  "schedule": {
    "plannedDate": "2024-05-01T10:00:00Z",
    "duration": 3,
    "start_time": "10:00",
    "end_time": "13:00"
  },
  "coordinator": {
    "name": "Coordinador Seguridad",
    "email": "coord@company.com",
    "phone": "1234567890"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "new-uuid-generated",
  "tenantId": "current-tenant-id",
  "name": "Simulacro de Terremoto",
  "description": "Prueba de procedimientos ante sismo",
  "type": "NATURAL_DISASTER",
  "severity": "CRITICAL",
  "status": "PLANNED",
  "createdAt": "2024-04-02T14:20:00Z",
  "updatedAt": "2024-04-02T14:20:00Z",
  "createdById": "current-user-id",
  ...
}
```

---

### Update Drill
```
PUT /emergency/drills/:id
Content-Type: application/json

{
  "name": "Simulacro Actualizado",
  "status": "IN_PROGRESS",
  "objectives": ["Objetivo actualizado"],
  ...
}
```

**Response:** Updated drill object

---

### Delete Drill (Soft Delete)
```
DELETE /emergency/drills/:id
```

**Response:**
```json
{
  "success": true,
  "id": "drill-id"
}
```

---

### Start Drill
```
POST /emergency/drills/:id/start
```

**Response:**
```json
{
  "id": "drill-id",
  "status": "IN_PROGRESS",
  "startedAt": "2024-04-02T15:00:00Z",
  ...
}
```

---

### Complete Drill
```
POST /emergency/drills/:id/complete
Content-Type: application/json

{
  "results": {
    "evacuationTime": "9.5 minutes",
    "issues": ["Some minor issues"],
    "score": 8.5,
    "recommendations": ["Improve signage"]
  }
}
```

**Response:**
```json
{
  "id": "drill-id",
  "status": "COMPLETED",
  "completedAt": "2024-04-02T17:00:00Z",
  "results": {
    "evacuationTime": "9.5 minutes",
    ...
  },
  ...
}
```

---

## Contingency Plans Endpoints

### Get All Plans
```
GET /emergency/contingency-plans
```

**Response:**
```json
[
  {
    "id": "plan-uuid",
    "tenantId": "tenant-uuid",
    "name": "Plan de Continuidad - Incendio",
    "description": "Plan para mantener operaciones durante incendio",
    "type": "FIRE",
    "status": "DRAFT",
    "objectives": ["Minimizar downtime", "Proteger datos"],
    "triggers": ["Incendio detectado", "Orden de evacuación"],
    "responsibilities": {
      "IT": ["Backup de datos", "Redirigir tráfico"],
      "RRHH": ["Comunicar con empleados"]
    },
    "procedures": ["Activar backup", "Comunicar a clientes"],
    "resources": {"equipment": ["Servidores backup"], "personnel": []},
    "communications": {"primary": "email@company.com", "backup": "phone"},
    "timeline": {"phase1": "Inmediato", "phase2": "30 minutos"},
    "createdAt": "2024-04-01T10:00:00Z",
    "updatedAt": "2024-04-01T10:00:00Z",
    "createdById": "user-uuid",
    "deletedAt": null
  }
]
```

### Create Plan
```
POST /emergency/contingency-plans
Content-Type: application/json

{
  "name": "Plan de Respuesta - Falla de IT",
  "description": "Procesos alternativos si sistemas caen",
  "type": "INFRASTRUCTURE_FAILURE",
  "objectives": ["Mantener operaciones críticas"],
  "triggers": ["Apagón", "Falla de sistemas"],
  "responsibilities": {
    "IT": ["Diagnóstico y reparación"],
    "Operaciones": ["Tareas manuales"]
  },
  "procedures": ["Activar modo manual", "Usar calculadoras paper"],
  "resources": {
    "equipment": ["Generadores", "Equipos manuales"],
    "personnel": ["Técnicos IT", "Staff operaciones"]
  }
}
```

**Response (201 Created):** Created plan object

---

## Emergency Resources Endpoints

### Get All Resources
```
GET /emergency/resources
```

**Response:**
```json
[
  {
    "id": "resource-uuid",
    "tenantId": "tenant-uuid",
    "name": "Desfibrilador",
    "description": "Desfibrilador automático externo",
    "type": "EQUIPMENT",
    "category": "MEDICAL",
    "quantity": 5,
    "location": "Recepción, Pisos 1-4",
    "status": "AVAILABLE",
    "contactInfo": {
      "responsible": "Personal Médico",
      "phone": "ext. 1234"
    },
    "specifications": {
      "model": "Modelo XYZ",
      "lastCalibration": "2024-03-15"
    },
    "maintenanceSchedule": {
      "lastMaintenance": "2024-03-15",
      "nextScheduled": "2024-06-15"
    },
    "createdAt": "2024-03-01T10:00:00Z",
    "updatedAt": "2024-03-01T10:00:00Z",
    "createdById": "user-uuid",
    "deletedAt": null
  }
]
```

### Create Resource
```
POST /emergency/resources
Content-Type: application/json

{
  "name": "Generador Eléctrico",
  "description": "Generador de respaldo para emergencias",
  "type": "EQUIPMENT",
  "category": "INFRASTRUCTURE",
  "quantity": 2,
  "location": "Sótano",
  "contactInfo": {
    "responsible": "Mantenimiento",
    "phone": "ext. 5678"
  },
  "specifications": {
    "capacity": "50 kW",
    "fuelType": "Diésel"
  }
}
```

**Response (201 Created):** Created resource object

---

## Statistics Endpoint

### Get Emergency Statistics
```
GET /emergency/stats
```

**Response:**
```json
{
  "total_drills": 5,
  "completed_drills": 2,
  "planned_drills": 3,
  "contingency_plans": 8,
  "active_plans": 3,
  "resources_available": 42,
  "participation_rate": 0,
  "average_score": 0,
  "critical_issues": 0
}
```

---

## Error Responses

### Unauthorized (No token or invalid token)
```
401 Unauthorized
{
  "error": "Unauthorized"
}
```

### Forbidden (Tenant mismatch)
```
403 Forbidden
{
  "error": "Forbidden"
}
```

### Not Found (Resource doesn't exist)
```
404 Not Found
{
  "error": "Drill not found"
}
```

### Bad Request (Missing required fields)
```
400 Bad Request
{
  "error": "Missing required fields"
}
```

### Server Error
```
500 Internal Server Error
{
  "error": "Failed to create drill"
}
```

---

## Testing with cURL

```bash
# Get all drills
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/emergency/drills

# Create a drill
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Drill",
    "type": "FIRE",
    "severity": "HIGH"
  }' \
  http://localhost:3002/emergency/drills

# Get specific drill
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/emergency/drills/DRILL_ID

# Update drill
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}' \
  http://localhost:3002/emergency/drills/DRILL_ID

# Delete drill
curl -X DELETE -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/emergency/drills/DRILL_ID

# Get stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/emergency/stats
```

---

## Database Schema

All data is stored in PostgreSQL with full RLS (Row-Level Security) isolation per tenant.

### Tables
- `drill_scenarios` - Emergency drills/simulacros
- `contingency_plans` - Disaster recovery plans
- `emergency_resources` - Equipment, personnel, facilities

### Key Fields
- `tenantId` - Tenant isolation (RLS enforced)
- `createdBy` - Audit trail
- `createdAt`, `updatedAt`, `deletedAt` - Timestamps for audit
- JSONB fields for flexible data structures (objectives, resources, schedule, etc.)

All data persists permanently in the database and survives server restarts and page refreshes.
