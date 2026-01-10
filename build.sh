#!/bin/bash
set -e

echo "🏗️  Building RiverHub frontend..."

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Build frontend
echo "⚛️  Building React app..."
npm run build

echo "✅ Frontend build complete! Output: frontend/dist/"
