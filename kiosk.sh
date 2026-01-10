#!/bin/bash

# RiverHub Kiosk Mode - Launches Chromium in fullscreen

# URL to open (backend serves frontend on this port)
URL="http://localhost:8765"

# Wait for backend to be ready
echo "⏳ Waiting for RiverHub backend..."
for i in {1..30}; do
    if curl -s "$URL/health" > /dev/null 2>&1; then
        echo "✅ Backend is ready!"
        break
    fi
    sleep 1
done

# Disable screen blanking and power management
xset s off
xset -dpms
xset s noblank

# Kill any existing Chromium instances
pkill -f chromium-browser || true
sleep 1

echo "🌐 Launching Chromium in kiosk mode..."

# Launch Chromium in kiosk mode (foreground so systemd can track it)
exec chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-features=TranslateUI \
    --no-first-run \
    --fast \
    --fast-start \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --app="$URL"
