# Development Workflow

This document explains how to develop RiverHub both locally on your Mac and remotely on the Raspberry Pi.

## Local Development (Mac)

Best for rapid iteration on the frontend with mock RFID data.

### Setup

1. **Backend** (Terminal 1):
```bash
cd backend
source venv/bin/activate
python main.py
```

2. **Frontend** (Terminal 2):
```bash
cd frontend
npm run dev
```

3. Open http://localhost:5173 in your browser

### Features
- Hot module replacement (HMR) for instant frontend updates
- Mock RFID mode (simulates card taps every 5 seconds)
- No RC522 hardware required
- Fast build times

### Configuration
- Backend uses `backend/.env` with `RFID_MODE=mock`
- Frontend uses `frontend/.env` with `VITE_WS_URL=ws://localhost:8765/ws`

---

## Pi Development (Raspberry Pi)

Best for testing with real RFID hardware and production-like environment.

### Prerequisites

On your Raspberry Pi, install required tools:
```bash
sudo apt-get update
sudo apt-get install inotify-tools
```

### Syncing Changes from Mac to Pi

Use the provided sync script to automatically push changes:
```bash
# On Mac - watches for file changes and syncs to Pi
./sync.sh
```

This uses `watchexec` to monitor file changes and `rsync` to copy them to `/home/river/riverhub/` on the Pi.

**What gets synced:**
- All source code files
- Configuration files
- `package.json` (but NOT `node_modules/`)
- `requirements.txt` (but NOT `venv/`)

**What gets excluded (architecture-specific):**
- `node_modules/` - Contains native ARM64 binaries on Pi, x86_64 on Mac
- `backend/venv/` - Python virtual environment (architecture-specific)
- `frontend/dist/` - Build output (generated on each machine)
- `.vite/` - Vite cache
- `*.log` - Log files

**Why exclude these?**
Native dependencies like Rollup contain compiled binaries that are specific to the CPU architecture (ARM64 on Pi, x86_64 on Mac). Syncing these causes "Cannot find module @rollup/rollup-linux-arm64-gnu" errors. Each machine manages its own dependencies.

### Running the Development Server on Pi

SSH into your Pi and run:
```bash
cd /home/river/riverhub
./dev-pi.sh
```

This script will:
1. Build the frontend (`npm run build`)
2. Start the backend server with static file serving
3. Watch for file changes:
   - **Frontend changes** → Rebuild frontend, restart server
   - **Backend changes** → Restart server
4. Serve everything on port 8765

### Accessing the App

After starting `dev-pi.sh`, access the app at:
- From Pi: http://localhost:8765
- From Mac: http://rpi.local:8765 (or http://<pi-ip>:8765)

### Configuration

The dev script automatically creates `.env` files with production defaults:
- `SERVE_STATIC=true` - Backend serves frontend build
- `RFID_MODE=real` - Use real RC522 hardware
- WebSocket available at `ws://localhost:8765/ws`

### Logs

Server logs are written to `/tmp/riverhub-dev.log`:
```bash
# Watch logs in real-time
tail -f /tmp/riverhub-dev.log
```

### Stopping the Server

Press `Ctrl+C` to gracefully stop the development server.

---

## Workflow Comparison

| Feature | Local (Mac) | Pi |
|---------|-------------|-----|
| **Frontend HMR** | ✅ Instant | ❌ Requires rebuild (~2-3s) |
| **RFID Testing** | ⚠️ Mock only | ✅ Real hardware |
| **Iteration Speed** | ⚡ Very fast | 🐌 Slower |
| **Environment** | Development | Production-like |
| **Best For** | UI/UX work | Hardware integration |

---

## Recommended Development Flow

1. **Start on Mac** - Build out UI and logic with mock RFID
   - Run backend and frontend separately
   - Use browser DevTools
   - Iterate quickly with HMR

2. **Test on Pi** - Validate with real hardware
   - Keep `sync.sh` running to auto-sync changes
   - Run `dev-pi.sh` on Pi
   - Test actual RFID card scanning

3. **Iterate** - Make changes on Mac, test on Pi
   - Edit files on Mac
   - `sync.sh` pushes changes to Pi automatically
   - `dev-pi.sh` rebuilds and restarts automatically
   - Test changes in browser pointing to Pi

---

## Production Deployment

For final production deployment (not covered in this doc), you would:
1. Build frontend: `cd frontend && npm run build`
2. Copy dist files to Pi
3. Run backend with `SERVE_STATIC=true` and `RFID_MODE=real`
4. Set up systemd service for auto-start on boot

---

## Troubleshooting

### Backend won't start on Pi
- Check logs: `tail -f /tmp/riverhub-dev.log`
- Verify `.env` exists in `backend/` directory
- Check port 8765 is not in use: `sudo lsof -i :8765`

### Frontend build fails
- Ensure Node.js is installed on Pi: `node --version`
- Check npm dependencies: `cd frontend && npm install`
- Check disk space: `df -h`

### RFID not working
- Verify RC522 is properly connected
- Check `RFID_MODE=real` in backend `.env`
- See backend logs for hardware errors

### Sync not working
- Verify Pi is reachable: `ping rpi`
- Check SSH access: `ssh river@rpi`
- Verify rsync is installed on both machines
