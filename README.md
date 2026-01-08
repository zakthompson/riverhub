# RiverHub

A smart room dashboard for young children that plays music using RFID cards.

Tap an RFID card, and RiverHub reads the playlist URL, plays it on a Sonos speaker, and displays media controls on screen. When idle, it shows a playful clock.

## Project Status

**Current Phase:** Phase 2 Complete ✅
- ✅ Backend RFID WebSocket server (real + mock mode)
- ✅ Frontend WebSocket integration
- ✅ Bidirectional communication
- ✅ Development tooling for Pi

**Next Phase:** Phase 3 - Sonos Integration

## Quick Start

### Local Development (Mac)

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

### Raspberry Pi Development

See **[PI-SETUP.md](./PI-SETUP.md)** for complete setup instructions.

**Quick version:**
```bash
# On Pi (after setup)
cd /home/river/riverhub
./dev-pi.sh
```

Access at http://rpi.local:8765

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Project overview and development principles
- **[PLAN.md](./PLAN.md)** - Full implementation plan with phases
- **[DEV-WORKFLOW.md](./DEV-WORKFLOW.md)** - Development workflows (Mac vs Pi)
- **[PI-SETUP.md](./PI-SETUP.md)** - Raspberry Pi setup and deployment guide
- **[backend/README.md](./backend/README.md)** - Backend API documentation
- **[frontend/README.md](./frontend/README.md)** - Frontend development guide

## Architecture

```
┌─────────────────────────┐          ┌──────────────────────────┐
│  Python Backend         │          │  React Frontend          │
│  (FastAPI)              │◄───WS───►│  (Vite + TypeScript)     │
│                         │          │                          │
│  - RFID read/write      │          │  - Sonos control         │
│  - WebSocket server     │          │  - UI (clock/controls)   │
│  - Hardware only        │          │  - Business logic        │
└─────────────────────────┘          └──────────────────────────┘
         │                                       │
         │ GPIO/SPI                              │ HTTP/network
         ▼                                       ▼
   RC522 RFID Module                       Sonos Speaker
```

**Key Principle:** Python handles ONLY hardware. React handles everything else.

## Tech Stack

**Backend:**
- FastAPI (WebSocket + static serving)
- mfrc522 (RC522 RFID library)
- RPi.GPIO (GPIO access)
- Python 3.9+

**Frontend:**
- React + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- TanStack Query (state management)

**Development:**
- ESLint + Prettier (code quality)
- Husky (pre-commit hooks)
- watchexec (file watching)
- rsync (Mac → Pi sync)

## Features

### Implemented ✅
- RFID card reading (real RC522 + mock mode)
- WebSocket bidirectional communication
- Real-time card read broadcasts
- Card writing via web interface
- Connection status monitoring
- Auto-reconnection with backoff
- Development tooling for Pi
- Production static file serving

### Planned 🚧
- Sonos speaker integration
- Music playback controls
- Playful clock UI
- Card management UI

## Development

### Sync Changes to Pi

Keep this running while developing on Mac:
```bash
./sync.sh
```

Changes sync automatically to `/home/river/riverhub/` on Pi.

### Code Quality

All code must pass before committing:
```bash
# Frontend
cd frontend
npm run lint
npm run type-check
npm run build

# Backend
cd backend
source venv/bin/activate
python -m pylint *.py
python -m mypy .
```

Pre-commit hooks enforce these checks automatically.

## Configuration

### Backend `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `8765` | WebSocket server port |
| `RFID_MODE` | `real` | `real` or `mock` |
| `RFID_POLL_INTERVAL` | `0.5` | Polling interval (seconds) |
| `RFID_DEBOUNCE_SECONDS` | `2.0` | Debounce duplicate reads |
| `SERVE_STATIC` | `false` | Serve frontend build |
| `LOG_LEVEL` | `INFO` | Logging level |

### Frontend `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_URL` | `ws://localhost:8765/ws` | Backend WebSocket URL |
| `VITE_SONOS_SPEAKER_NAME` | `Bedroom` | Sonos speaker name |

## Contributing

This is a personal project, but follows strict coding standards:

1. **Aggressive Simplicity** - Always prefer the simplest solution
2. **DRY** - Don't repeat yourself
3. **Functional Style** - Pure functions where possible
4. **Zero Tolerance** - No broken code, no linting errors
5. **Production Quality** - Robust error handling, secure code

See [CLAUDE.md](./CLAUDE.md) for complete guidelines.

## Hardware

### RC522 RFID Module

Wiring to Raspberry Pi (see PI-SETUP.md for details):
- Uses SPI interface
- Connect to 3.3V (NOT 5V!)
- Standard pinout compatible with most RC522 modules

### Tested Hardware
- Raspberry Pi 4 Model B (4GB)
- RC522 RFID Reader Module
- MIFARE Classic 1K cards

## License

Private project - All rights reserved.

## Support

For issues or questions, see troubleshooting sections in:
- [PI-SETUP.md](./PI-SETUP.md#troubleshooting)
- [DEV-WORKFLOW.md](./DEV-WORKFLOW.md#troubleshooting)
