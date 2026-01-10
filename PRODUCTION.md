# RiverHub Production Deployment (Kiosk Mode)

This guide covers deploying RiverHub to a Raspberry Pi in fullscreen kiosk mode.

## Quick Start

On your Raspberry Pi, run:

```bash
./install-kiosk.sh
```

This will:
1. Build the frontend for production
2. Set up the Python backend environment
3. Install systemd services for backend and kiosk mode
4. Enable automatic startup on boot

## What Gets Installed

### Services

1. **riverhub.service** - Python/FastAPI backend
   - Starts automatically on boot
   - Runs on port 8765
   - Serves both API and static frontend files

2. **riverhub-kiosk.service** - Chromium in fullscreen kiosk mode
   - Starts automatically when GUI loads
   - Opens `http://localhost:8765` in fullscreen
   - Disables screen blanking and power saving

### Scripts

- `build.sh` - Builds the React frontend for production
- `start-production.sh` - Starts the backend in production mode
- `kiosk.sh` - Launches Chromium in kiosk mode
- `install-kiosk.sh` - One-command installation

## Configuration

### Backend Configuration

Edit `backend/.env` to configure:

```bash
# Sonos Configuration (REQUIRED)
SONOS_SPEAKER_NAME=Bedroom    # Change to your speaker's name

# RFID Configuration
RFID_MODE=real                 # Use real RFID hardware
RFID_POLL_INTERVAL=0.5
RFID_DEBOUNCE_SECONDS=2.0

# Server
PORT=8765
NODE_ENV=production
STATIC_FILES=../frontend/dist
```

After changing configuration:
```bash
sudo systemctl restart riverhub
```

## Managing Services

### Backend Service

```bash
# Check status
sudo systemctl status riverhub

# Start/stop/restart
sudo systemctl start riverhub
sudo systemctl stop riverhub
sudo systemctl restart riverhub

# View logs (live)
sudo journalctl -u riverhub -f

# View logs (last 50 lines)
sudo journalctl -u riverhub -n 50
```

### Kiosk Service

```bash
# Check status
sudo systemctl status riverhub-kiosk

# Start/stop/restart
sudo systemctl start riverhub-kiosk
sudo systemctl stop riverhub-kiosk
sudo systemctl restart riverhub-kiosk

# View logs
sudo journalctl -u riverhub-kiosk -f
```

### Disable Auto-Start

To prevent services from starting on boot:

```bash
sudo systemctl disable riverhub
sudo systemctl disable riverhub-kiosk
```

To re-enable:

```bash
sudo systemctl enable riverhub
sudo systemctl enable riverhub-kiosk
```

## Manual Testing

### Test Backend Only

```bash
./start-production.sh
```

Then visit `http://localhost:8765` in a browser.

### Test Kiosk Mode

With the backend running:

```bash
./kiosk.sh
```

This will launch Chromium in fullscreen.

## Troubleshooting

### Backend won't start

Check logs:
```bash
sudo journalctl -u riverhub -n 100
```

Common issues:
- Missing `.env` file → Copy from `backend/.env.example`
- Python dependencies missing → Run `./start-production.sh` manually to see errors
- Port 8765 already in use → Check with `sudo lsof -i :8765`

### Kiosk mode won't start

Check logs:
```bash
sudo journalctl -u riverhub-kiosk -n 100
```

Common issues:
- Backend not running → Check `systemctl status riverhub`
- X server not ready → Kiosk service waits for `graphical.target`
- Chromium not installed → `sudo apt install chromium-browser`

### Screen blanking still happening

The kiosk script disables screen blanking, but you may also need to:

1. Disable screen blanking in Raspberry Pi OS settings
2. Edit `/etc/lightdm/lightdm.conf`:
   ```
   [Seat:*]
   xserver-command=X -s 0 -dpms
   ```

### RFID not working

1. Check RFID hardware connection (GPIO pins, SPI enabled)
2. Verify SPI is enabled: `sudo raspi-config` → Interface Options → SPI
3. Check logs for RFID errors: `sudo journalctl -u riverhub -f`
4. Test RFID directly: `cd backend && python3 lib/rfid/reader.py`

## Updating the Application

After pulling new code from git:

```bash
# Rebuild frontend
./build.sh

# Restart services
sudo systemctl restart riverhub
sudo systemctl restart riverhub-kiosk
```

## Uninstalling

```bash
# Stop and disable services
sudo systemctl stop riverhub riverhub-kiosk
sudo systemctl disable riverhub riverhub-kiosk

# Remove service files
sudo rm /etc/systemd/system/riverhub.service
sudo rm /etc/systemd/system/riverhub-kiosk.service
sudo systemctl daemon-reload
```

## Development vs Production

- **Development**: Use `./dev.sh` for hot-reload and development mode
- **Production**: Use `./install-kiosk.sh` for kiosk mode on Pi

Both can run on the same machine, but not simultaneously (port conflict).
