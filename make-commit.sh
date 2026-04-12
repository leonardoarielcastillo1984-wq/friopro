#!/bin/bash

# Navigate to the project directory
PROJECT_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
cd "$PROJECT_DIR" || { echo "Failed to navigate to project directory"; exit 1; }

echo "=========================================="
echo "  Commit: Null Safety Fixes"
echo "=========================================="
echo ""
echo "Directory: $PROJECT_DIR"
echo ""

# Remove git lock file if it exists
if [ -f ".git/index.lock" ]; then
    echo "🔓 Removing git lock file..."
    rm -f ".git/index.lock"
    sleep 1
fi

# Show current status
echo "📋 Current git status:"
git status --short
echo ""

# Stage all changes
echo "📦 Staging all changes..."
git add -A
echo "✓ Changes staged"
echo ""

# Show what will be committed
echo "📝 Files being committed:"
git diff --cached --name-only
echo ""

# Create the commit
echo "✨ Creating commit..."
git commit -m "fix: null safety fixes across all components"

COMMIT_RESULT=$?

if [ $COMMIT_RESULT -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Commit created."
    echo ""
    echo "Commit details:"
    git log -1 --oneline
    echo ""
    echo "=========================================="
    echo "Next steps:"
    echo "1. Review changes: git log -1 --stat"
    echo "2. Push to remote: git push origin main"
    echo "=========================================="
else
    echo ""
    echo "❌ Commit failed. Error code: $COMMIT_RESULT"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check git status: git status"
    echo "2. Verify files exist: ls -la apps/web/src/lib/api.ts"
    echo "3. Try manual add: git add ."
    exit 1
fi
