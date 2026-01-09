# RiverHub

A smart room dashboard for young children that plays music using RFID cards.

Tap an RFID card, and RiverHub reads the playlist URL, plays it on a Sonos speaker, and displays media controls on screen. When idle, it shows a playful clock.

## Project Status

**Current Phase:** Phase 3 Complete ✅
- ✅ Hybrid Node.js + Python backend architecture
- ✅ Python RFID service with stdin/stdout protocol
- ✅ Node.js Sonos integration with real-time state polling
- ✅ WebSocket communication (backend ↔ frontend)
- ✅ Frontend receiving Sonos state updates
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
- Hot reloads TypeScript and Python changes automatically
- Starts backend (Node.js + Python subprocess)
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
- **[backend/lib/rfid/README.md](./backend/lib/rfid/README.md)** - Python RFID protocol documentation

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Node.js Backend (port 8765)                             │
│                                                          │
│  ┌───────────┐    ┌────────────┐    ┌──────────────┐  │
│  │ WebSocket │◄──►│Integration │◄──►│Sonos Service │  │
│  │  Server   │    │  Service   │    │(polling 1.5s)│  │
│  └───────────┘    └─────┬──────┘    └──────────────┘  │
│                          │                              │
│                   ┌──────▼───────┐                      │
│                   │RFID Service  │                      │
│                   │(spawns ↓)    │                      │
│                   └──────────────┘                      │
│                          │                              │
│                ┌─────────▼─────────┐                    │
│                │Python subprocess  │                    │
│                │(stdin/stdout JSON)│                    │
│                └─────────┬─────────┘                    │
└──────────────────────────┼─────────────────────────────┘
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
- **Node.js** handles: Sonos control, WebSocket server, business logic, integrations
- **Python subprocess** handles: RFID hardware ONLY (stdin/stdout communication)
- **React frontend** handles: UI, displaying Sonos state, user interactions
- **Integration Service** pattern: Reusable for future hardware (lights, sensors, etc.)

## Tech Stack

### Backend
- **Node.js** + **TypeScript** - Primary runtime and business logic
- **Express** - HTTP server + static file serving
- **ws** - WebSocket server
- **sonos** - Sonos speaker control (local network)
- **tsx** + **nodemon** - Hot reload (TypeScript + Python)
- **Python subprocess** - RFID hardware interface

### Python (Hardware Only)
- **mfrc522** - RC522 RFID library
- **RPi.GPIO** - GPIO access
- Python 3.9+

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
- Python subprocess communication (stdin/stdout JSON)
- Node.js backend orchestration
- Sonos speaker integration
- Real-time Sonos state polling (1.5 second updates)
- WebSocket bidirectional communication
- Card read broadcasts to frontend
- Card writing via web interface
- Sonos status display in UI
- Auto-reconnection with backoff
- Universal development script (Pi + dev machine)
- Hot reload (TypeScript + Python)

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
npm run lint
npm run type-check
npm run build
```

Pre-commit hooks enforce these checks automatically.

## Configuration

### Backend `.env`

```bash
PORT=8765
RFID_MODE=mock                   # 'mock' or 'real' (auto-set by dev.sh)
RFID_POLL_INTERVAL=0.5           # Card polling interval (seconds)
RFID_DEBOUNCE_SECONDS=2.0        # Debounce duplicate reads
SONOS_SPEAKER_NAME=Bedroom       # Configure your Sonos speaker name
LOG_LEVEL=info                   # Logging level
NODE_ENV=development             # 'development' or 'production'
```

### Frontend `.env`

```bash
VITE_WS_URL=ws://localhost:8765  # Backend WebSocket URL
```

## Project Structure

```
riverhub/
├── backend/                      # Node.js backend
│   ├── src/                      # TypeScript source
│   │   ├── index.ts              # Main entry point
│   │   ├── config.ts             # Environment config
│   │   ├── websocket.ts          # WebSocket server
│   │   ├── services/             # Sonos, RFID, Integration
│   │   └── types/                # TypeScript types
│   ├── lib/
│   │   └── rfid/                 # Python RFID service
│   │       ├── service.py        # Standalone service
│   │       ├── reader.py         # Hardware abstraction
│   │       └── README.md         # Protocol docs
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
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
npm run dev
```

Common issues:
- Node.js not installed
- Python 3 not available on Pi
- Missing dependencies: `npm install` in backend/

### Sonos not connecting

1. Check speaker name in `backend/.env` matches your Sonos speaker
2. Ensure Pi and Sonos are on the same network
3. Check backend logs for discovery errors
4. Visit http://localhost:8765/health to see Sonos connection status

### RFID not working on Pi

1. Ensure `RFID_MODE=real` in `backend/.env`
2. Check SPI is enabled: `sudo raspi-config` → Interface Options → SPI
3. Check wiring (3.3V, not 5V!)
4. Check Python dependencies installed: `cd backend/lib/rfid && pip install -r requirements.txt`

### Dev script won't start

1. Make executable: `chmod +x dev.sh`
2. Check Node.js installed: `node --version`
3. Check npm installed: `npm --version`
4. On Pi, check Python 3: `python3 --version`

## License

Private project - All rights reserved.
