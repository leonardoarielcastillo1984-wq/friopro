-- Crear tabla drill_scenarios
CREATE TABLE IF NOT EXISTS drill_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(100) NOT NULL,
    objectives JSONB DEFAULT '[]'::jsonb,
    scope JSONB,
    schedule JSONB,
    coordinator JSONB,
    evaluators JSONB DEFAULT '[]'::jsonb,
    resources JSONB,
    procedures JSONB DEFAULT '[]'::jsonb,
    results JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drill_scenarios_tenant_id ON drill_scenarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drill_scenarios_status ON drill_scenarios(status);
CREATE INDEX IF NOT EXISTS idx_drill_scenarios_deleted_at ON drill_scenarios(deleted_at);

-- Crear tabla contingency_plans
CREATE TABLE IF NOT EXISTS contingency_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(100) NOT NULL,
    version VARCHAR(20) DEFAULT '1.0',
    coverage JSONB,
    objectives JSONB DEFAULT '[]'::jsonb,
    procedures JSONB DEFAULT '[]'::jsonb,
    resources JSONB DEFAULT '[]'::jsonb,
    contacts JSONB DEFAULT '[]'::jsonb,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contingency_plans_tenant_id ON contingency_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contingency_plans_status ON contingency_plans(status);
CREATE INDEX IF NOT EXISTS idx_contingency_plans_deleted_at ON contingency_plans(deleted_at);

-- Crear tabla emergency_resources
CREATE TABLE IF NOT EXISTS emergency_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 1,
    location VARCHAR(255),
    specifications JSONB,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_resources_tenant_id ON emergency_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_resources_status ON emergency_resources(status);
CREATE INDEX IF NOT EXISTS idx_emergency_resources_category ON emergency_resources(category);
CREATE INDEX IF NOT EXISTS idx_emergency_resources_deleted_at ON emergency_resources(deleted_at);
