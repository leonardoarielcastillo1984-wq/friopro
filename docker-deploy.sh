#!/bin/bash

# ============================================================================
# 🐳 Docker Deployment Script - Automático
# ============================================================================
# Uso: ./docker-deploy.sh tu-usuario/sgi-api:staging
# Ej:  ./docker-deploy.sh myuser/sgi-api:staging
# ============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
IMAGE_TAG=${1:-"sgi-api:staging"}
REGISTRY=""

# Detectar registry
if [[ $IMAGE_TAG == *"/"* ]]; then
    REGISTRY=$(echo $IMAGE_TAG | cut -d'/' -f1)
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🐳 Docker Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Image tag: $IMAGE_TAG${NC}"
if [ -n "$REGISTRY" ]; then
    echo -e "${YELLOW}Registry: $REGISTRY${NC}"
fi
echo ""

# Step 1: Build
echo -e "${BLUE}Step 1️⃣ Building Docker image...${NC}"
docker build -t $IMAGE_TAG -f apps/api/Dockerfile . || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Image built successfully${NC}"
echo ""

# Step 2: Verify image
echo -e "${BLUE}Step 2️⃣ Verifying image...${NC}"
docker images | grep -E "${IMAGE_TAG%:*}" || echo "Image not found"
echo -e "${GREEN}✓ Image verification complete${NC}"
echo ""

# Step 3: Push (if registry specified)
if [ -n "$REGISTRY" ]; then
    echo -e "${BLUE}Step 3️⃣ Pushing image to registry: $REGISTRY${NC}"

    # Check if logged in
    if ! docker info | grep -q "Username"; then
        echo -e "${YELLOW}⚠ Not logged in to Docker. Running: docker login${NC}"
        docker login
    fi

    docker push $IMAGE_TAG || {
        echo -e "${RED}❌ Push failed${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Image pushed successfully${NC}"
    echo ""
fi

# Step 4: Output instructions
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Docker image ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ -n "$REGISTRY" ]; then
    echo -e "${YELLOW}Next steps for your staging server:${NC}"
    echo ""
    echo -e "${BLUE}# Pull new image${NC}"
    echo "docker pull $IMAGE_TAG"
    echo ""
    echo -e "${BLUE}# Stop old container${NC}"
    echo "docker stop sgi-api && docker rm sgi-api"
    echo ""
    echo -e "${BLUE}# Run new container${NC}"
    echo "docker run -d \\"
    echo "  --name sgi-api \\"
    echo "  --restart unless-stopped \\"
    echo "  -p 3001:3001 \\"
    echo "  -e DATABASE_URL=\"postgresql://...\" \\"
    echo "  -e JWT_SECRET=\"your-secret\" \\"
    echo "  -e NODE_ENV=\"staging\" \\"
    echo "  $IMAGE_TAG"
    echo ""
else
    echo -e "${YELLOW}Next step: Push image to registry${NC}"
    echo ""
    echo "docker tag sgi-api:staging your-registry/sgi-api:staging"
    echo "docker push your-registry/sgi-api:staging"
    echo ""
fi

echo -e "${BLUE}Verify deployment:${NC}"
echo "curl https://staging-api.tu-dominio.com/healthz"
echo ""

echo -e "${GREEN}Done! 🚀${NC}"
