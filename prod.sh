#!/bin/bash

echo "🏭 Modo producción - Docker Compose..."

# Verificar archivo .env de producción
if [ ! -f ".env.prod" ]; then
    echo "📝 Creando .env.prod de ejemplo..."
    cat > .env.prod << 'EOF'
# Producción - SGI 360
POSTGRES_USER=sgi
POSTGRES_PASSWORD=CAMBIAR_ESTA_CONTRASEÑA_SEGURA
POSTGRES_DB=sgi
POSTGRES_AUDITOR_PASSWORD=OTRA_CONTRASEÑA_SEGURA

# API
API_PORT=3001
JWT_SECRET=CAMBIAR_JWT_SECRET_SEGURO
REDIS_URL=redis://redis:6379

# Storage
STORAGE_BACKEND=s3
S3_BUCKET=sgi360-uploads
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=TU_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=TU_SECRET_KEY

# Email
EMAIL_PROVIDER=resend
EMAIL_FROM=SGI 360 <noreply@sgi360.app>
RESEND_API_KEY=TU_RESEND_API_KEY

# LLM
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=TU_ANTHROPIC_API_KEY
EOF
    echo "⚠️  Por favor, editá .env.prod con tus datos reales"
    exit 1
fi

# Construir y levantar producción
echo "🏗️ Construyendo imágenes..."
docker compose -f infra/docker-compose.prod.yml build

echo "🚀 Iniciando producción..."
docker compose -f infra/docker-compose.prod.yml up -d

echo "✅ Producción iniciada!"
echo "🌐 Web: http://localhost:3000"
echo "📊 Logs: docker compose -f infra/docker-compose.prod.yml logs -f"
