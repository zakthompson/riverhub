#!/bin/bash
# Quick debug script to check Pi configuration

echo "=== RiverHub Debug Info ==="
echo ""

echo "1. Backend .env file:"
if [ -f ~/riverhub/backend/.env ]; then
    grep -E "^(SERVE_STATIC|RFID_MODE|WS_PORT)" ~/riverhub/backend/.env || echo "  (no relevant settings found)"
else
    echo "  ✗ File does not exist!"
fi
echo ""

echo "2. Frontend build directory:"
if [ -d ~/riverhub/frontend/dist ]; then
    echo "  ✓ dist/ exists"
    ls -lh ~/riverhub/frontend/dist/
else
    echo "  ✗ dist/ does NOT exist - frontend not built yet!"
fi
echo ""

echo "3. Backend server status:"
if ps aux | grep -q "[p]ython.*main.py"; then
    echo "  ✓ Server is running"
    ps aux | grep "[p]ython.*main.py"
else
    echo "  ✗ Server is NOT running"
fi
echo ""

echo "4. Check what http://localhost:8765/health returns:"
curl -s http://localhost:8765/health 2>/dev/null || echo "  ✗ Cannot connect to server"
echo ""
echo ""

echo "5. Recent server logs:"
if [ -f /tmp/riverhub-dev.log ]; then
    echo "  Last 20 lines of /tmp/riverhub-dev.log:"
    tail -20 /tmp/riverhub-dev.log
else
    echo "  ✗ No log file found"
fi
