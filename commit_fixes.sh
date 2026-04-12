#!/bin/bash
# Script to commit null safety fixes

cd "$(dirname "$0")" || exit 1

echo "=========================================="
echo "Git Commit: Null Safety Fixes"
echo "=========================================="
echo ""

# Check git status
echo "Current git status:"
git status --short
echo ""

# Stage all changes
echo "Staging changes..."
git add -A

# Show what will be committed
echo ""
echo "Files to be committed:"
git diff --cached --name-only
echo ""

# Commit with the specified message
echo "Creating commit..."
git commit -m "fix: null safety fixes across all components"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Commit successful!"
    echo ""
    echo "To push these changes:"
    echo "  git push origin main"
    echo ""
    echo "Commit details:"
    git log -1 --oneline
else
    echo ""
    echo "❌ Commit failed. Check the error message above."
    exit 1
fi
