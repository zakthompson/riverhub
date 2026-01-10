# RiverHub

A smart room dashboard for young children that plays music using RFID cards.

Tap an RFID card, and RiverHub reads the playlist URL, plays it on a Sonos speaker, and displays media controls on screen. When idle, it shows a playful clock.

## Project Status

**Current Phase:** Phase 3 Complete ✅ - Pure Python Backend
- ✅ Pure Python backend with FastAPI
- ✅ Python RFID service (direct import, no subprocess)
- ✅ Sonos integration with SoCo library (real-time state polling)
- ✅ WebSocket communication (backend ↔ frontend)
- ✅ HTTP API for cards and favorites
- ✅ Universal development script (Pi + dev machine)

**Next Phase:** Phase 4 - Media Controls UI

## Quick Start

### Universal Development (Works on Pi AND Dev Machine)

**One command starts everything:**
```bash
./dev.sh
```

**What it does:**
- Auto-detects your platform (Raspberry Pi vs dev machine)
- Sets `RFID_MODE=real` on Pi, `RFID_MODE=mock` on dev machines
- Hot reloads Python backend changes automatically (uvicorn)
- Starts backend (Python FastAPI)
- Starts frontend dev server (Vite)

Access at:
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:8765
- **Health Check:** http://localhost:8765/health

### Remote Development (Optional)

For testing with real RFID hardware while coding on your dev machine:

**On dev machine:**
```bash
./sync.sh  # Watches and syncs changes to Pi in real-time
```

**On Pi:**
```bash
./dev.sh   # Auto-reloads on changes
```

This allows manual testing with real RFID cards without constant committing/pulling.

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Project overview and development principles
- **[PLAN.md](./PLAN.md)** - Implementation plan with phases and architecture details
- **[backend/CARD-MAPPINGS.md](./backend/CARD-MAPPINGS.md)** - Card mapping system documentation

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Python Backend (FastAPI, port 8765)                     │
│                                                          │
│  ┌───────────┐    ┌────────────┐    ┌──────────────┐  │
│  │ WebSocket │◄──►│Integration │◄──►│Sonos Service │  │
│  │  Manager  │    │  Service   │    │  (SoCo lib)  │  │
│  │           │    │            │    │(polling 1.5s)│  │
│  └───────────┘    └─────┬──────┘    └──────────────┘  │
│                          │                              │
│                   ┌──────▼───────┐                      │
│                   │RFID Service  │                      │
│                   │(direct import│                      │
│                   │lib/rfid/)    │                      │
│                   └──────┬───────┘                      │
│                          │                              │
│  ┌────────────────┐      │       ┌──────────────┐      │
│  │Card Mapping   │◄─────┴──────►│HTTP API      │      │
│  │Service        │               │(/health,     │      │
│  │(JSON file)    │               │ /api/cards,  │      │
│  │               │               │ /api/fav...)│      │
│  └───────────────┘               └──────────────┘      │
└──────────────────────────┬─────────────────────────────┘
                           │              ↕
                       GPIO/SPI    WebSocket (HTTP)
                           │              ↕
                           ↓       React Frontend
                    RC522 RFID     ┌──────────────┐
                      Module       │- Sonos UI    │
                                   │- Card write  │
                                   │- Controls    │
                                   └──────────────┘
                                         ↓
                                   Sonos Speaker
```

**Key Principles:**
- **Python + FastAPI** handles: Sonos control (SoCo), RFID hardware, WebSocket server, HTTP API
- **Direct RFID import** no subprocess communication needed
- **React frontend** handles: UI, displaying Sonos state, user interactions
- **Integration Service** pattern: Reusable orchestration for future hardware (lights, sensors, etc.)
- **Pure Python** backend: Simpler deployment, single process, unified codebase

## Tech Stack

### Backend
- **Python 3.9+** - Primary runtime
- **FastAPI** - Modern async web framework
- **uvicorn** - ASGI server with hot reload
- **SoCo** - Sonos speaker control (local network)
- **python-dotenv** - Environment configuration
- **mfrc522** - RC522 RFID library (Pi only)
- **RPi.GPIO** - GPIO access (Pi only)

### Frontend
- **React** + **TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **TanStack Query** - State management (if needed)

### Development
- **ESLint** + **Prettier** - Code quality
- **Husky** - Pre-commit hooks
- **watchexec** - File watching (sync.sh)
- **rsync** - Remote sync (dev machine → Pi)

## Features

### Implemented ✅
- RFID card reading (real RC522 + mock mode)
- Python FastAPI backend with async/await
- Sonos speaker integration with SoCo library
- Real-time Sonos state polling (1.5 second updates)
- WebSocket bidirectional communication
- Card read broadcasts to frontend
- Card writing via web interface
- HTTP API for cards and favorites
- Sonos status display in UI
- Auto-reconnection with backoff
- Universal development script (Pi + dev machine)
- Hot reload with uvicorn

### Planned 🚧
- Enhanced media playback controls
- Playful clock UI
- Card management UI

## Development Workflow

### Starting Development

**Local or Pi:**
```bash
./dev.sh
```

That's it! The script auto-detects your platform and configures everything appropriately.

### Remote Development Workflow

If you want to code on your dev machine but test with real RFID hardware on the Pi:

1. **Dev machine:** Run `./sync.sh` to sync changes to Pi
2. **Pi:** Run `./dev.sh` to run the app with auto-reload
3. Code on dev machine, test on Pi in real-time

### Code Quality

All code must pass before committing:

**Frontend:**
```bash
cd frontend
npm run lint
npm run type-check
npm run build
```

**Backend:**
```bash
cd backend
python3 -m py_compile main.py services/*.py  # Syntax check
venv/bin/python -m pytest                     # Run tests (when added)
```

Pre-commit hooks enforce these checks automatically.

## Configuration

### Backend `.env`

```bash
# Server Configuration
PORT=8765
NODE_ENV=development              # 'development' or 'production'
STATIC_FILES=../frontend/dist    # Frontend build directory

# RFID Configuration
RFID_MODE=mock                    # 'mock' or 'real' (auto-set by dev.sh)
RFID_POLL_INTERVAL=0.5            # Card polling interval (seconds)
RFID_DEBOUNCE_SECONDS=2.0         # Debounce duplicate reads

# Sonos Configuration
SONOS_SPEAKER_NAME=Bedroom        # Configure your Sonos speaker name

# Card Mappings
CARD_MAPPINGS_FILE=card-mappings.json

# Logging
LOG_LEVEL=info                    # Logging level
```

### Frontend `.env`

```bash
VITE_WS_URL=ws://localhost:8765  # Backend WebSocket URL
```

## Project Structure

```
riverhub/
├── backend/                      # Python backend
│   ├── main.py                   # FastAPI application entry point
│   ├── services/                 # Service modules
│   │   ├── card_mapping_service.py   # Card configuration
│   │   ├── sonos_service.py          # Sonos control (SoCo)
│   │   ├── rfid_service.py           # RFID reader integration
│   │   ├── websocket_service.py      # WebSocket manager
│   │   └── integration_service.py    # Orchestration layer
│   ├── lib/
│   │   └── rfid/                 # RFID hardware code
│   │       ├── reader.py         # Hardware abstraction
│   │       ├── config.py         # RFID configuration
│   │       └── requirements-pi.txt   # Pi-specific deps
│   ├── requirements.txt          # Python dependencies
│   ├── card-mappings.json        # Card configuration data
│   ├── CARD-MAPPINGS.md          # Card mapping docs
│   └── .env.example              # Environment template
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── hooks/                # useWebSocket, useSonosState
│   │   ├── services/             # WebSocket client
│   │   ├── types/                # TypeScript types
│   │   └── App.tsx
│   └── package.json
│
├── dev.sh                        # Universal dev script
├── sync.sh                       # Remote dev sync
├── PLAN.md                       # Implementation plan
└── CLAUDE.md                     # Development principles
```

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

Wiring to Raspberry Pi:
- Uses SPI interface
- Connect to 3.3V (NOT 5V!)
- Standard pinout compatible with most RC522 modules

### Sonos Speaker

- Must be on the same local network as the Pi
- Configure speaker name in `backend/.env` (`SONOS_SPEAKER_NAME`)
- No OAuth required (uses local network discovery)

### Tested Hardware
- Raspberry Pi 4 Model B (4GB)
- RC522 RFID Reader Module
- MIFARE Classic 1K cards
- Sonos speaker (any model with local network support)

## Troubleshooting

### Backend won't start

Check the logs:
```bash
cd backend
venv/bin/uvicorn main:app --reload --port 8765
```

Common issues:
- Python 3.9+ not installed
- Missing dependencies: `cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt`
- On Pi: Missing hardware deps: `venv/bin/pip install -r lib/rfid/requirements-pi.txt`
- Port 8765 already in use

### Sonos not connecting

1. Check speaker name in `backend/.env` matches your Sonos speaker
2. Ensure Pi and Sonos are on the same network
3. Check backend logs for discovery errors
4. Visit http://localhost:8765/health to see Sonos connection status

### RFID not working on Pi

1. Ensure `RFID_MODE=real` in `backend/.env`
2. Check SPI is enabled: `sudo raspi-config` → Interface Options → SPI
3. Check wiring (3.3V, not 5V!)
4. Check hardware dependencies installed: `cd backend && venv/bin/pip install -r lib/rfid/requirements-pi.txt`
5. Check permissions: User must be in `gpio` and `spi` groups

### Dev script won't start

1. Make executable: `chmod +x dev.sh`
2. Check Python 3.9+ installed: `python3 --version`
3. Check Node.js installed (for frontend): `node --version`
4. Check npm installed (for frontend): `npm --version`
5. Ensure virtual environment can be created: `python3 -m venv --help`

## License

Private project - All rights reserved.
