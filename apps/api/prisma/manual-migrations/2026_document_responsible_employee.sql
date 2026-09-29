-- Responsable funcional del documento como Employee (el responsable real no
-- siempre es usuario de plataforma; ownerId es FK a PlatformUser).
-- Aditiva e idempotente. Aplicar en prod: docker exec -i sgi-postgres psql -U sgi -d sgi < 2026_document_responsible_employee.sql
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "responsibleEmployeeId" UUID;
