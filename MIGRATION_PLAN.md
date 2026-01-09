# RiverHub Phase 3: Sonos Integration via Node.js Backend

## Problem

The `sonos` npm package requires Node.js runtime APIs (network, dgram, etc.) and cannot run in the browser. Current frontend implementation fails with `u.networkInterfaces is not a function` on the Raspberry Pi.

## Solution Architecture

**Hybrid Node.js + Python (Single Service)**
- Node.js backend becomes the primary service (replaces FastAPI)
- Python RFID service runs as a managed subprocess (stdin/stdout communication)
- Node.js handles: Sonos control, WebSocket server, business logic, future integrations
- Python handles: RFID hardware only (~50 lines, no web framework)
- Single `backend/` folder with Node.js + Python in `backend/lib/`
- Single systemd service for deployment

### Why This Architecture

✅ **TypeScript-first**: 95% of code in your expert language
✅ **Real-time polling**: Node.js event loop handles 1-2s Sonos updates efficiently
✅ **Reusable pattern**: Integration service model works for lights, sensors, etc.
✅ **Simple deployment**: One service to start, one port to expose
✅ **Best libraries**: `sonos` npm package is mature and full-featured
✅ **Minimal Python**: Keeps hardware code isolated at ~50 lines
✅ **Universal dev script**: One `./dev.sh` command works on Pi and dev machine
✅ **Auto-mocking**: Automatically uses mock RFID on dev machines
✅ **Hot reload everything**: TypeScript AND Python changes reload automatically

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Node.js Backend (port 8765)                                 │
│                                                              │
│  WebSocket Server ←→ Integration Service ←→ Sonos Service   │
│         ↕                      ↕                             │
│    Frontend              RFID Service                        │
│                         (spawns Python)                      │
│                               ↓                              │
│                    Python subprocess (stdin/stdout)          │
└────────────────────────────┬─────────────────────────────────┘
                             │
                    ┌────────┴─────────┐
                    ↓                  ↓
              RC522 RFID          Sonos Speaker
```

## File Structure Changes

```
riverhub/
├── backend/                   # NEW - Single unified backend (Node.js)
│   ├── src/
│   │   ├── index.ts           # Main entry point
│   │   ├── server.ts          # Express/Hono server
│   │   ├── websocket.ts       # WebSocket handler
│   │   ├── config.ts          # Environment config
│   │   ├── services/
│   │   │   ├── sonos.service.ts        # Sonos control (moved from frontend)
│   │   │   ├── rfid.service.ts         # Python subprocess manager
│   │   │   └── integration.service.ts  # Orchestration layer
│   │   └── types/
│   │       ├── sonos.types.ts          # Moved from frontend
│   │       ├── rfid.types.ts
│   │       └── websocket.types.ts
│   ├── lib/
│   │   └── rfid/              # Python RFID service (external code)
│   │       ├── service.py     # NEW - Simplified service (stdin/stdout)
│   │       ├── reader.py      # Port of rfid_reader.py
│   │       ├── config.py      # Port of config.py
│   │       └── requirements.txt
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── dev.sh                     # NEW - Universal dev script (works on Pi & dev machine)
│
└── frontend/                  # MODIFIED
    └── src/
        ├── services/
        │   ├── sonos.ts       # REMOVED - Moved to backend
        │   └── websocket.ts   # MODIFIED - Updated protocol
        ├── hooks/
        │   └── useSonos.ts    # REMOVED - Backend handles Sonos
        └── types/
            └── sonos.ts       # REMOVED - Moved to backend
```

## Implementation Steps

### Phase 1: Restructure Backend Folder

**1.1 Rename and reorganize existing backend**
```bash
# Current: backend/ (Python FastAPI)
# New: backend/lib/rfid/ (Python RFID only)
mkdir -p backend/lib/rfid
mv backend/rfid_reader.py backend/lib/rfid/reader.py
mv backend/config.py backend/lib/rfid/config.py
```

**1.2 Initialize Node.js in backend folder**
```bash
cd backend
npm init -y
npm install express ws sonos dotenv
npm install -D typescript @types/node @types/express @types/ws tsx nodemon
```

**1.3 Create TypeScript configuration**
- `backend/tsconfig.json` - TypeScript config (exclude lib/ folder)
- `backend/.env.example` - Environment variables (SONOS_SPEAKER_NAME, PORT, RFID_MODE, etc.)
- `backend/src/config.ts` - Config loader with platform detection

**1.4 Port Sonos service from frontend**
- Copy `frontend/src/services/sonos.ts` → `backend/src/services/sonos.service.ts`
- Copy `frontend/src/types/sonos.ts` → `backend/src/types/sonos.types.ts`
- Minimal changes: Use EventEmitter instead of React hooks

### Phase 2: Create Python Subprocess Communication

**2.1 Create RFID service manager**
- `backend/src/services/rfid.service.ts`
- Spawns Python as child process (`python lib/rfid/service.py`)
- Parses JSON lines from stdout
- Sends JSON lines to stdin
- Auto-restarts on crash
- Respects RFID_MODE environment variable (real/mock)

**2.2 Refactor Python RFID code**
- Create `backend/lib/rfid/service.py`:
  - Remove FastAPI, WebSocket server (from old main.py)
  - Read commands from stdin (JSON lines)
  - Write events to stdout (JSON lines)
  - Import and use existing RFIDReader abstraction
- Update `backend/lib/rfid/requirements.txt`: Remove fastapi, uvicorn, websockets
- Keep `reader.py` and `config.py` unchanged (just moved)

### Phase 3: Create Integration Layer

**3.1 Build integration service**
- `backend-node/src/services/integration.service.ts`
- Connects RFID events → Sonos actions
- Pattern for all future integrations (lights, sensors, etc.)
- Handles errors, logging, state management

**3.2 Create WebSocket server**
- `backend-node/src/websocket.ts`
- Handles frontend connections
- Broadcasts Sonos state updates (1-2s polling)
- Forwards write requests to RFID service

**3.3 Create main server**
- `backend-node/src/index.ts`
- Initialize services (RFID, Sonos, Integration)
- Start WebSocket server
- Serve static frontend files in production

### Phase 4: Update Frontend

**4.1 Remove browser-based Sonos code**
- Delete `frontend/src/services/sonos.ts`
- Delete `frontend/src/hooks/useSonos.ts`
- Delete `frontend/src/types/sonos.ts`

**4.2 Update WebSocket integration**
- Modify `frontend/src/services/websocket.ts` - Remove Sonos imports
- Update `frontend/src/types/websocket.ts` - New message types
- Modify `frontend/src/App.tsx` - Remove useSonos hook, display backend-provided state

### Phase 5: Create Universal Development Script

**5.1 Create dev.sh (root level)**
- Platform detection (checks for RPi-specific files/architecture)
- Auto-sets RFID_MODE based on platform:
  - RPi: `RFID_MODE=real`
  - Dev machine: `RFID_MODE=mock`
- Starts backend with tsx (hot reload for TypeScript)
- Monitors `backend/lib/rfid/**/*.py` for changes
- Auto-restarts Python subprocess on changes
- Starts frontend dev server
- Single script works on both Pi and dev machine

**Example dev.sh:**
```bash
#!/bin/bash

# Detect platform
if [ -f /proc/device-tree/model ] && grep -q "Raspberry Pi" /proc/device-tree/model; then
  export RFID_MODE=real
  echo "🥧 Running on Raspberry Pi - using real RFID hardware"
else
  export RFID_MODE=mock
  echo "💻 Running on dev machine - using mock RFID"
fi

# Start backend (tsx watches TypeScript, nodemon watches Python)
cd backend
npm run dev &  # Uses tsx + nodemon for both TS and Python

# Start frontend
cd ../frontend
npm run dev &

wait
```

**5.2 Update backend package.json scripts**
```json
{
  "scripts": {
    "dev": "nodemon --watch 'src/**/*.ts' --watch 'lib/rfid/**/*.py' --exec 'tsx src/index.ts'",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**5.3 Update sync.sh for new backend structure**
- Keep sync.sh for remote dev workflow (dev machine → Pi)
- Update file paths to reflect new `backend/` structure (not `backend-node/`)
- Update exclusions for `backend/node_modules/`, `backend/dist/`, `backend/lib/rfid/__pycache__/`
- Ensure it syncs both TypeScript and Python code
- Pi runs `dev.sh` which auto-reloads on sync changes

**Remote dev workflow:**
```bash
# On dev machine (coding):
./sync.sh  # Watches and syncs changes to Pi

# On Pi (running):
./dev.sh   # Auto-reloads on changes from sync
```

**5.4 Update documentation**
- **PLAN.md**: Update architecture section with new backend structure
- **PLAN.md**: Update Phase 2 status (mark as complete)
- **PLAN.md**: Add Phase 3 notes about new architecture
- **README.md**: Update dev workflow instructions
- **README.md**: Document universal dev.sh usage
- **README.md**: Document remote dev workflow (sync.sh + dev.sh)
- **backend/lib/rfid/README.md**: NEW - Document Python service protocol
- Remove outdated references to separate backend folders

**5.5 Production deployment**
- Create systemd service file for Node.js backend
- Update build process (compile TypeScript)
- Update Pi setup instructions

## Message Protocol

### Python → Node.js (stdout/stdin JSON lines)

**Python outputs to stdout:**
```json
{"type": "card_read", "cardId": "123456789", "data": "spotify:playlist:abc", "timestamp": 1234567890}
{"type": "write_complete", "success": true}
{"type": "error", "message": "Failed to read card"}
```

**Node.js sends to stdin:**
```json
{"type": "write_request", "data": "spotify:playlist:xyz"}
{"type": "ping"}
```

### Node.js ↔ Frontend (WebSocket)

**Backend → Frontend:**
```typescript
// Card read
{type: 'card_read', cardId: string, data: string, timestamp: number}

// Sonos state (pushed every 1-2s)
{type: 'sonos_state', isPlaying: boolean, currentTrack: {...}, playbackState: string, volume: number}

// Write result
{type: 'write_complete', success: boolean, error?: string}

// Errors
{type: 'error', source: 'sonos'|'rfid', message: string}
```

**Frontend → Backend:**
```typescript
// Playback control
{type: 'sonos_play_url', url: string}
{type: 'sonos_play' | 'sonos_pause' | 'sonos_next' | 'sonos_previous'}
{type: 'sonos_volume', volume: number}

// Card writing
{type: 'write_request', data: string}
```

## Critical Files to Create/Modify

### New Files (Backend)
1. **backend/src/services/integration.service.ts** - Core orchestration layer
2. **backend/src/services/rfid.service.ts** - Python subprocess manager
3. **backend/src/services/sonos.service.ts** - Port from frontend with EventEmitter
4. **backend/src/websocket.ts** - WebSocket server for frontend
5. **backend/src/index.ts** - Main entry point
6. **backend/lib/rfid/service.py** - Refactored minimal service (stdin/stdout)

### Modified/Moved Files (Backend)
7. **backend/lib/rfid/reader.py** - Moved from backend/rfid_reader.py
8. **backend/lib/rfid/config.py** - Moved from backend/config.py
9. **backend/lib/rfid/requirements.txt** - Simplified (remove FastAPI, uvicorn)

### Modified Files (Frontend)
10. **frontend/src/App.tsx** - Remove useSonos, update to use backend state
11. **frontend/src/services/websocket.ts** - Update message types
12. **frontend/src/types/websocket.ts** - New protocol types

### Configuration Files
13. **backend/package.json** - Node.js dependencies (express, ws, sonos, etc.)
14. **backend/tsconfig.json** - TypeScript config (exclude lib/ folder)
15. **dev.sh** - Universal dev script with platform detection
16. **sync.sh** - Updated for new backend structure

### Documentation Files
17. **PLAN.md** - Updated architecture and phase status
18. **README.md** - Updated dev workflow, universal dev.sh, remote dev workflow
19. **backend/lib/rfid/README.md** - NEW - Python service protocol docs

## Pattern for Future Integrations

This architecture establishes a reusable pattern with `backend/lib/` for external services:

**Adding Philips Hue Lights (Example - Pure Node.js):**
1. Create `backend/src/services/hue.service.ts` - Use Philips Hue npm package
2. Update `integration.service.ts` to connect RFID → Hue actions
3. No Python needed - pure TypeScript integration

**Adding Temperature Sensor (Example - Requires Python Hardware Access):**
1. Create `backend/lib/sensor/service.py` - Python service (stdin/stdout pattern)
2. Create `backend/lib/sensor/requirements.txt` - Python dependencies
3. Create `backend/src/services/sensor.service.ts` - Subprocess manager
4. Update `integration.service.ts` to handle sensor events
5. Update `dev.sh` to auto-detect if sensor hardware is present

**Pattern Summary:**
- **Pure software integrations** (APIs, network services) → TypeScript services only
- **Hardware integrations** (GPIO, I2C, SPI) → Python in `backend/lib/*/` + TypeScript manager
- **Integration Service** → Central orchestration point for all interactions
- **dev.sh** → Automatically handles mocking on non-Pi platforms

## Deployment Strategy

### Development (Works on BOTH Pi and Dev Machine)
```bash
# Single command - auto-detects platform and uses appropriate mode
./dev.sh
```

**What it does:**
- ✅ Auto-detects Raspberry Pi vs dev machine
- ✅ Sets RFID_MODE=real on Pi, RFID_MODE=mock elsewhere
- ✅ Hot reloads TypeScript changes (tsx)
- ✅ Hot reloads Python changes (nodemon)
- ✅ Starts frontend dev server
- ✅ No need for sync.sh or separate Pi scripts

### Production (Pi)
```bash
# Build once
cd backend && npm run build
cd frontend && npm run build

# Run via systemd
sudo systemctl start riverhub
```

**systemd service file:**
```ini
[Unit]
Description=RiverHub
After=network.target

[Service]
Type=simple
User=river
WorkingDirectory=/home/river/riverhub/backend
Environment="NODE_ENV=production"
Environment="RFID_MODE=real"
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Testing Strategy

1. **Test Python RFID service standalone**: Pipe JSON to stdin, verify stdout
2. **Test Node.js Sonos service**: Unit tests with mocked Sonos device
3. **Test integration service**: Mock both RFID and Sonos, verify orchestration
4. **Test end-to-end**: Full stack on Pi with real hardware

## Success Criteria

- ✅ Card tap triggers Sonos playback within 500ms
- ✅ Frontend receives real-time Sonos updates every 1-2 seconds
- ✅ Single command starts entire system (`systemctl start riverhub`)
- ✅ 95%+ of codebase is TypeScript
- ✅ Python RFID code under 100 lines total
- ✅ Pattern documented for adding future integrations

## Trade-offs Accepted

- **Two processes**: Node.js + Python subprocess (minimal complexity, isolated concerns)
- **Process communication**: stdin/stdout JSON lines (simple, no network overhead)
- **Not pure Python**: But keeps expertise in TypeScript where you're strongest
- **Not pure Node.js**: But keeps battle-tested Python RFID hardware code

This architecture maximizes your TypeScript expertise while preserving the reliable Python RFID implementation, and establishes a clear pattern for future growth.
