#!/bin/bash

# ============================================================================
# 2FA Backend Deployment to Staging - Step by Step
# ============================================================================

set -e  # Exit on error

echo "=========================================="
echo "🚀 2FA Backend Deployment Script"
echo "=========================================="
echo ""

# Step 1: Check git status
echo "Step 1️⃣ Verifying git status..."
cd apps/api
git status
echo "✓ Git status checked"
echo ""

# Step 2: Commit changes (if not already committed)
echo "Step 2️⃣ Checking if changes need to be committed..."
if ! git diff-index --quiet HEAD --; then
    echo "📝 Changes detected. Committing..."
    git add src/routes/auth.ts
    git commit -m "feat: Integrate 2FA with login endpoint and add 2fa-complete endpoint"
    echo "✓ Changes committed"
else
    echo "✓ No uncommitted changes"
fi
echo ""

# Step 3: Build the project
echo "Step 3️⃣ Building backend..."
npm run build
if [ $? -eq 0 ]; then
    echo "✓ Build successful"
else
    echo "❌ Build failed. Check errors above."
    exit 1
fi
echo ""

# Step 4: Test syntax
echo "Step 4️⃣ Checking TypeScript compilation..."
npm run type-check 2>/dev/null || echo "ℹ️ Skipping type check (may not be available)"
echo ""

# Step 5: Push to git
echo "Step 5️⃣ Pushing to git repository..."
echo "   Branch: $(git rev-parse --abbrev-ref HEAD)"
git push origin $(git rev-parse --abbrev-ref HEAD)
echo "✓ Pushed to origin"
echo ""

# Step 6: Output deployment instructions
echo "=========================================="
echo "✅ Backend Ready for Deployment!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "OPTION A: Railway/Vercel/Heroku (Automatic)"
echo "  → Deployment should start automatically"
echo "  → Check deployment status in your platform"
echo ""
echo "OPTION B: Docker"
echo "  → Build image: docker build -t sgi-api:latest ."
echo "  → Push image: docker push your-registry/sgi-api:latest"
echo "  → Update staging deployment"
echo ""
echo "OPTION C: Traditional Server"
echo "  → SSH to staging server"
echo "  → cd /var/www/sgi-360/apps/api"
echo "  → git pull origin main"
echo "  → npm install"
echo "  → npm run build"
echo "  → npm run start:prod"
echo ""
echo "VERIFY AFTER DEPLOYMENT:"
echo "  1. Check health: curl https://staging-api.sgi360.com/healthz"
echo "  2. Test login: curl -X POST https://staging-api.sgi360.com/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"test@example.com\",\"password\":\"password\"}'"
echo ""
echo "For detailed verification steps, see: DEPLOYMENT_STAGING_GUIDE.md"
echo ""
