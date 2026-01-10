#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "🚀 Starting RiverHub backend..."

# Navigate to backend directory
cd "$BACKEND_DIR"

# Check if .env exists, if not copy from .env.example
if [ ! -f .env ]; then
    echo "⚠️  No .env file found, copying from .env.example..."
    cp .env.example .env
    echo "⚙️  Please edit backend/.env to configure your Sonos speaker and settings"
fi

# Install Python dependencies if needed
if [ ! -d "venv" ]; then
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "📦 Installing Python dependencies..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check if running on Raspberry Pi
if grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "🍓 Raspberry Pi detected, installing Pi-specific dependencies..."
    pip install -q -r lib/rfid/requirements-pi.txt || true
fi

# Set production environment
export NODE_ENV=production
export RFID_MODE=real

# Start the backend with uvicorn
echo "✅ Starting backend on port 8765..."
exec uvicorn main:app --host 0.0.0.0 --port 8765 --log-level info
