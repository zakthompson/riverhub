# Raspberry Pi Setup Guide

Quick reference for setting up and running RiverHub on your Raspberry Pi.

## First-Time Setup

### 1. Install System Dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    inotify-tools \
    git
```

### 2. Clone or Sync Repository

If syncing from Mac using `sync.sh`:
```bash
# On Mac
./sync.sh
```

Or clone directly on Pi:
```bash
git clone <your-repo-url> /home/river/riverhub
cd /home/river/riverhub
```

### 3. Setup Configuration Files

```bash
# Backend - create .env file
cd /home/river/riverhub/backend
cp .env.example .env

# Frontend - create .env file
cd /home/river/riverhub/frontend
cp .env.example .env
```

**Important Notes:**
- ❌ **Don't create venv manually** - the dev script will create it
- ❌ **Don't run `pip install`** - the dev script will do it
- ❌ **Don't run `npm install`** - the dev script will do it

The dev script automatically:
- Creates Python venv with correct architecture
- Installs Python dependencies
- Installs npm dependencies with ARM64 binaries
- Rebuilds when dependencies change

## Running the Development Server

The `dev-pi.sh` script handles everything automatically:

```bash
cd /home/river/riverhub
./dev-pi.sh
```

**What it does:**
- Creates Python venv (if needed)
- Installs Python dependencies (if needed or when requirements.txt changes)
- Installs npm dependencies (if needed or when package.json changes)
- Builds the frontend
- Starts the backend with static file serving
- Watches for file changes and rebuilds/restarts automatically
- Serves the app on port 8765

**First run will take longer** (~2-3 minutes) as it:
1. Creates fresh Python venv
2. Installs Python packages
3. Installs all npm dependencies with ARM64 binaries

**Access the app:**
- On Pi: http://localhost:8765
- From network: http://rpi.local:8765 or http://<pi-ip>:8765

**To stop:**
- Press `Ctrl+C`

## Development Workflow

### Using Mac + Pi Together

**Terminal 1 (Mac)** - Auto-sync changes to Pi:
```bash
./sync.sh
```

**Terminal 2 (Pi)** - Run development server:
```bash
ssh river@rpi
cd /home/river/riverhub
./dev-pi.sh
```

**Terminal 3 (Mac)** - Edit code:
```bash
# Edit files in your IDE
# Changes are automatically synced to Pi
# Pi automatically rebuilds and restarts
```

**Browser** - Test changes:
- Open http://rpi.local:8765
- Changes reflect after rebuild (~2-3 seconds)

## Logs and Debugging

### View Real-Time Logs
```bash
tail -f /tmp/riverhub-dev.log
```

### Check Server Status
```bash
# See if backend is running
ps aux | grep "python.*main.py"

# Check what's listening on port 8765
sudo lsof -i :8765
```

### Test RFID Hardware
```bash
cd /home/river/riverhub/backend
source venv/bin/activate
python -c "from mfrc522 import SimpleMFRC522; reader = SimpleMFRC522(); print('RFID reader initialized successfully')"
```

### Manual Backend Run (without watch script)
```bash
cd /home/river/riverhub/backend
source venv/bin/activate
python main.py
```

## Production Deployment

For a production systemd service (auto-start on boot):

### 1. Create Service File

```bash
sudo nano /etc/systemd/system/riverhub.service
```

Contents:
```ini
[Unit]
Description=RiverHub RFID Music Controller
After=network.target

[Service]
Type=simple
User=river
WorkingDirectory=/home/river/riverhub/backend
Environment="PATH=/home/river/riverhub/backend/venv/bin"
ExecStart=/home/river/riverhub/backend/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable riverhub
sudo systemctl start riverhub
```

### 3. Manage Service

```bash
# Check status
sudo systemctl status riverhub

# View logs
sudo journalctl -u riverhub -f

# Restart
sudo systemctl restart riverhub

# Stop
sudo systemctl stop riverhub
```

## Troubleshooting

### Port Already in Use
```bash
# Find what's using port 8765
sudo lsof -i :8765

# Kill it (replace PID)
kill <PID>
```

### RFID Not Detected
- Check wiring connections (SPI pins)
- Verify SPI is enabled: `sudo raspi-config` → Interface Options → SPI → Enable
- Test with: `ls /dev/spi*` (should show `/dev/spidev0.0` and `/dev/spidev0.1`)

### Frontend Build Fails

**"Cannot find module @rollup/rollup-linux-arm64-gnu"**
- This means node_modules has x86_64 binaries from Mac
- Solution: `cd frontend && rm -rf node_modules && npm install`
- The dev-pi.sh script should handle this automatically

**Other build failures:**
- Check Node.js version: `node --version` (should be v18+)
- Clear node_modules: `rm -rf node_modules package-lock.json && npm install`
- Check disk space: `df -h`

### Backend Won't Start
- Check logs: `tail -f /tmp/riverhub-dev.log`
- Verify Python version: `python3 --version` (should be 3.9+)
- Reinstall dependencies: `pip install -r requirements.txt --force-reinstall`

### Permission Issues
```bash
# Fix ownership
sudo chown -R river:river /home/river/riverhub

# Fix execute permissions
chmod +x /home/river/riverhub/dev-pi.sh
```

## Network Access

### Find Pi's IP Address
```bash
hostname -I
```

### Enable Access from Other Devices

If you can't access from your Mac/phone:
1. Check firewall: `sudo ufw status`
2. Allow port 8765: `sudo ufw allow 8765/tcp`
3. Verify Pi is on same network as your device

### Use mDNS (Bonjour)
- Pi should be accessible at `rpi.local:8765`
- If not, install: `sudo apt-get install avahi-daemon`

## Hardware Setup

### RC522 RFID Module Wiring

| RC522 Pin | Pi GPIO Pin | Pi Pin Number |
|-----------|-------------|---------------|
| SDA       | GPIO8 (CE0) | Pin 24        |
| SCK       | GPIO11 (SCLK) | Pin 23      |
| MOSI      | GPIO10 (MOSI) | Pin 19      |
| MISO      | GPIO9 (MISO)  | Pin 21      |
| IRQ       | (not used)    | -           |
| GND       | Ground        | Pin 6       |
| RST       | GPIO25        | Pin 22      |
| 3.3V      | 3.3V          | Pin 1       |

**Important:** Always use 3.3V, NOT 5V! The RC522 module is not 5V tolerant.

## Performance Tips

- Use a Pi 4 or newer for best performance
- Use a microSD card with good write speeds (A1/A2 rating)
- Consider running from USB SSD for faster builds
- Close unused applications to free memory
- Use `htop` to monitor resource usage
