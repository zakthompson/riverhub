#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🎯 RiverHub Kiosk Mode Installation"
echo "===================================="
echo ""

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi"
    echo "Installation will continue but may not work as expected"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x "$SCRIPT_DIR/build.sh"
chmod +x "$SCRIPT_DIR/start-production.sh"
chmod +x "$SCRIPT_DIR/kiosk.sh"
chmod +x "$SCRIPT_DIR/dev.sh"
chmod +x "$SCRIPT_DIR/sync.sh" 2>/dev/null || true

# Build frontend
echo ""
echo "📦 Building frontend for production..."
"$SCRIPT_DIR/build.sh"

# Set up backend environment
echo ""
echo "⚙️  Setting up backend environment..."
cd "$SCRIPT_DIR/backend"

if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created backend/.env from template"
    echo "⚠️  Please edit backend/.env to configure your Sonos speaker name"
fi

# Update service files with correct path and user
echo ""
echo "📝 Updating systemd service files..."
INSTALL_PATH="$SCRIPT_DIR"
INSTALL_USER="$USER"

echo "   Install path: $INSTALL_PATH"
echo "   Running as user: $INSTALL_USER"

sed -i "s|INSTALL_PATH|$INSTALL_PATH|g" "$SCRIPT_DIR/riverhub.service"
sed -i "s|INSTALL_USER|$INSTALL_USER|g" "$SCRIPT_DIR/riverhub.service"

sed -i "s|INSTALL_PATH|$INSTALL_PATH|g" "$SCRIPT_DIR/riverhub-kiosk.service"
sed -i "s|INSTALL_USER|$INSTALL_USER|g" "$SCRIPT_DIR/riverhub-kiosk.service"

# Install systemd services
echo ""
echo "🔧 Installing systemd services..."
sudo cp "$SCRIPT_DIR/riverhub.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/riverhub-kiosk.service" /etc/systemd/system/
sudo systemctl daemon-reload

# Enable and start backend service
echo ""
echo "🚀 Enabling RiverHub backend service..."
sudo systemctl enable riverhub.service
sudo systemctl restart riverhub.service

# Enable kiosk service (will start on next boot when GUI loads)
echo "🌐 Enabling RiverHub kiosk service..."
sudo systemctl enable riverhub-kiosk.service

# Check backend status
echo ""
echo "📊 Backend service status:"
sudo systemctl status riverhub.service --no-pager || true

echo ""
echo "✅ Installation complete!"
echo ""
echo "Services installed:"
echo "  • riverhub.service      - Backend (running now)"
echo "  • riverhub-kiosk.service - Chromium kiosk (starts with GUI)"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status riverhub         - Check backend status"
echo "  sudo systemctl restart riverhub        - Restart backend"
echo "  sudo systemctl status riverhub-kiosk   - Check kiosk status"
echo "  sudo journalctl -u riverhub -f         - View backend logs"
echo "  sudo journalctl -u riverhub-kiosk -f   - View kiosk logs"
echo ""
echo "To start kiosk mode now (without rebooting):"
echo "  sudo systemctl start riverhub-kiosk"
echo ""
echo "The app will automatically start in fullscreen kiosk mode on next boot!"
