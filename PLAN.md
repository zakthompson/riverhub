# RiverHub Implementation Plan

## Architecture Decision (Updated - Phase 3)

**Hybrid Node.js + Python Subprocess Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│ Node.js Backend (port 8765)                                     │
│                                                                  │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────┐   │
│  │  WebSocket  │◄──►│   Integration   │◄──►│    Sonos     │   │
│  │   Server    │    │     Service     │    │   Service    │   │
│  └─────────────┘    └────────┬────────┘    └──────────────┘   │
│                              │                                  │
│                       ┌──────▼────────┐                         │
│                       │ RFID Service  │                         │
│                       │  (spawns ↓)   │                         │
│                       └───────────────┘                         │
│                              │                                  │
│                    ┌─────────▼─────────┐                        │
│                    │ Python subprocess │                        │
│                    │ (stdin/stdout)    │                        │
│                    └─────────┬─────────┘                        │
└──────────────────────────────┼─────────────────────────────────┘
                               │                ↕
                           GPIO/SPI      WebSocket (HTTP)
                               │                ↕
                               ↓         React Frontend
                        RC522 RFID       ┌──────────────┐
                         Module          │ - UI         │
                                         │ - useSonos   │
                                         │ - useWebSocket│
                                         └──────────────┘
                                               ↓
                                         Sonos Speaker
```

**Key Principles**:
- **Node.js** handles: Sonos control, WebSocket server, business logic, integrations
- **Python subprocess** handles: RFID hardware ONLY (stdin/stdout communication)
- **React frontend** handles: UI, receiving Sonos state updates, displaying controls
- **Integration Service** pattern: Reusable for future hardware (lights, sensors, etc.)

**Why This Architecture**:
- ✅ TypeScript-first (95% of codebase)
- ✅ Real-time Sonos polling (1-2 second updates)
- ✅ Reusable integration pattern
- ✅ `sonos` npm package requires Node.js (browser incompatible)
- ✅ Simple deployment (one Node.js service)
- ✅ Python isolated to hardware-only (~140 lines)

---

## Project Structure

```
riverhub/
├── backend/                      # Node.js backend
│   ├── src/
│   │   ├── index.ts              # Main entry point
│   │   ├── config.ts             # Environment config
│   │   ├── websocket.ts          # WebSocket server
│   │   ├── services/
│   │   │   ├── sonos.service.ts        # Sonos control (EventEmitter)
│   │   │   ├── rfid.service.ts         # Python subprocess manager
│   │   │   └── integration.service.ts  # Orchestration layer
│   │   └── types/
│   │       ├── sonos.types.ts
│   │       ├── rfid.types.ts
│   │       └── websocket.types.ts
│   ├── lib/
│   │   └── rfid/                 # Python RFID service (external)
│   │       ├── service.py        # Standalone service (stdin/stdout)
│   │       ├── reader.py         # RC522 hardware abstraction
│   │       ├── config.py         # Python config
│   │       ├── requirements.txt
│   │       └── README.md         # Protocol documentation
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/           # Clock, MediaControls (future)
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts   # WebSocket connection
│   │   │   └── useSonosState.ts  # Sonos state from backend
│   │   ├── services/
│   │   │   └── websocket.ts      # WebSocket client
│   │   ├── types/
│   │   │   └── websocket.ts      # Message types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env.example
│
├── CLAUDE.md
├── PLAN.md                       # This file
├── MIGRATION_PLAN.md             # Architecture migration details
├── README.md
├── .gitignore
├── dev.sh                        # Universal dev script (Pi + dev machine)
└── sync.sh                       # Remote dev sync (dev → Pi)
```

---

## Tech Stack

### Backend
- **Node.js** + **TypeScript** - Primary runtime
- **Express** - HTTP server + static file serving
- **ws** - WebSocket server
- **sonos** - Sonos speaker control
- **tsx** + **nodemon** - Hot reload (TypeScript + Python)
- **dotenv** - Environment config

### Python (Hardware Only)
- **mfrc522** - RC522 RFID library
- **RPi.GPIO** - GPIO access
- **python-dotenv** - Environment config

### Frontend
- **Vite** - Build tool
- **React** + **TypeScript**
- **Tailwind CSS** - Styling
- **TanStack Query** - State management (if needed)

---

## Message Protocols

### Python ↔ Node.js (stdin/stdout JSON lines)

**Python → Node.js (stdout):**
```json
{"type": "card_read", "cardId": "123456789", "data": "spotify:playlist:abc", "timestamp": 1234567890}
{"type": "write_complete", "success": true}
{"type": "error", "message": "Failed to read card"}
```

**Node.js → Python (stdin):**
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
{type: 'sonos_state', isPlaying: boolean, currentTrack: {...}, playbackState: string, volume: number, speakerName: string}

// Write result
{type: 'write_complete', success: boolean, error?: string}

// Errors
{type: 'error', source: 'sonos'|'rfid'|'system', message: string}
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

---

## Development Workflow

### Universal Development Script

**One script works everywhere:**
```bash
./dev.sh
```

**What it does:**
- Auto-detects platform (Raspberry Pi vs dev machine)
- Sets `RFID_MODE=real` on Pi, `RFID_MODE=mock` elsewhere
- Hot reloads TypeScript changes (tsx)
- Hot reloads Python changes (nodemon)
- Starts frontend dev server (Vite)

**No platform-specific scripts needed!**

### Remote Development (Optional)

For testing with real RFID hardware while coding on dev machine:

**On dev machine:**
```bash
./sync.sh  # Watches and syncs changes to Pi in real-time
```

**On Pi:**
```bash
./dev.sh   # Auto-reloads on sync changes
```

This allows manual testing with real RFID cards without constant committing/pulling.

---

## Configuration

### Backend `.env`
```bash
PORT=8765
RFID_MODE=mock                  # 'mock' or 'real' (auto-detected by dev.sh)
RFID_POLL_INTERVAL=0.5
RFID_DEBOUNCE_SECONDS=2.0
SONOS_SPEAKER_NAME=Bedroom      # Configure your speaker name
LOG_LEVEL=info
```

### Frontend `.env`
```bash
# Development (Vite proxy handles WebSocket)
VITE_WS_URL=ws://localhost:8765

# Production (served by backend)
VITE_WS_URL=ws://localhost:8765
```

---

## Implementation Phases

### ✅ Phase 0: Foundation
**Status**: Complete
- [x] Project documentation (CLAUDE.md)
- [x] Architecture decision
- [x] Plan document

---

### ✅ Phase 1: Project Scaffold
**Status**: Complete _(Original Python backend version)_
- [x] Backend and frontend directories created
- [x] FastAPI backend initialized (later replaced with Node.js)
- [x] React frontend with Vite + Tailwind
- [x] Environment configs

---

### ✅ Phase 2: WebSocket Communication
**Status**: Complete _(Original Python backend version)_
- [x] WebSocket communication established
- [x] RFID reading logic working
- [x] Frontend receiving card reads

---

### ✅ Phase 3: Sonos Integration + Architecture Migration
**Status**: Complete _(Migrated to hybrid Node.js + Python architecture)_

**What was completed:**
1. **Backend Restructure**
   - Created unified `backend/` folder with Node.js + TypeScript
   - Moved Python RFID code to `backend/lib/rfid/`
   - Ported Sonos service from frontend with EventEmitter pattern
   - Created config system with platform detection

2. **Python Subprocess Communication**
   - Created stdin/stdout JSON protocol
   - Built RFIDService managing Python subprocess
   - Implemented auto-restart on crash
   - Created standalone Python RFID service (~140 lines)

3. **Integration Layer**
   - Built IntegrationService orchestrating RFID → Sonos → Frontend
   - Created WebSocket server for frontend communication
   - Implemented Sonos state polling (1.5 second intervals)
   - Added health check endpoint

4. **Frontend Updates**
   - Removed browser-based Sonos code (incompatible with browser)
   - Created useSonosState hook for backend-provided state
   - Updated to receive real-time Sonos updates via WebSocket
   - Added Sonos Status UI section

5. **Development Tooling**
   - Created universal `dev.sh` (works on Pi + dev machine)
   - Updated `sync.sh` for new backend structure
   - Hot reload for TypeScript and Python changes

**Test results:**
- Card scan triggers Sonos playback ✅
- Frontend receives real-time Sonos state updates ✅
- Write requests work via WebSocket ✅
- Integration service orchestrates all flows ✅

**Key learnings:**
- `sonos` npm package requires Node.js runtime (browser incompatible)
- Hybrid architecture maximizes TypeScript while preserving Python RFID code
- Integration Service pattern provides reusable foundation for future devices

---

### Phase 4: Media Controls UI
**Goal**: Display playback controls when music is playing

**Tasks**:
1. Create `components/MediaControls.tsx`
   - Play/pause button
   - Next/previous track
   - Volume control
   - Current track info (already displayed in basic form)
2. Wire up controls to send Sonos commands via WebSocket
3. Show/hide controls based on playback state

**Completion Criteria**:
- Controls appear when music plays
- Buttons work (play, pause, skip, volume)
- Current track info displays

---

### Phase 5: Clock UI
**Goal**: Display playful clock when idle

**Tasks**:
1. Create `components/Clock.tsx`
   - Large time display
   - Update every second
   - Playful design (use Tailwind)
2. Conditional rendering in `App.tsx`:
   - Show Clock when idle
   - Show MediaControls when playing

**Completion Criteria**:
- Clock displays when no music playing
- Switches to MediaControls on playback

---

### Phase 6: Polish & Error Handling
**Goal**: Production-ready reliability

**Tasks**:
1. WebSocket auto-reconnect (already partially implemented)
   - Detect disconnects
   - Retry with exponential backoff
   - Show connection status in UI
2. RFID read debouncing (already implemented in Python)
3. Comprehensive error handling improvements
4. Production deployment
   - systemd service for Node.js backend
   - Serve static React build from backend
   - Auto-start on boot

**Completion Criteria**:
- App recovers from WebSocket disconnect
- Card reads are debounced
- All errors handled gracefully
- Production deployment working

---

## Critical Implementation Notes

### Node.js Backend Responsibilities
- Spawn and manage Python RFID subprocess
- Control Sonos speaker (discovery, playback, state polling)
- Serve WebSocket connections to frontend
- Orchestrate RFID events → Sonos actions → Frontend updates
- Serve static frontend files in production

### Python Subprocess Responsibilities
- Initialize RC522 hardware
- Poll for card reads (non-blocking, ~500ms interval)
- Write events to stdout as JSON lines
- Read commands from stdin as JSON lines
- **Does NOT**: Connect to network, manage WebSocket, control Sonos

### Frontend Responsibilities
- Connect to WebSocket
- Display Sonos state (received from backend)
- Render UI (clock, media controls, write interface)
- Send control commands to backend
- Handle UI state and interactions

### Sonos Integration
- Uses `sonos` npm package (Node.js only, local network)
- Discovery: Find speaker by room name (configurable via `SONOS_SPEAKER_NAME`)
- State polling: Every 1.5 seconds
- EventEmitter pattern for integration with other services

### Integration Service Pattern
- Central orchestration point for all hardware/service interactions
- Connects: RFID events → Sonos actions → Frontend notifications
- Reusable for future integrations:
  - **Pure software** (APIs, services) → TypeScript services only
  - **Hardware** (GPIO, I2C, SPI) → Python in `backend/lib/*/` + TypeScript manager
  - Example: Adding lights or sensors follows the same pattern

---

## How to Use This Plan

1. **Check current phase** - We're currently at Phase 3 complete, Phase 4 next
2. **Review MIGRATION_PLAN.md** - For detailed architecture migration info
3. **Test completion criteria** - Ensure phase works before moving on
4. **Update status** - Mark phases complete as you go

This plan is designed to be resumable. If context is lost:
1. Review this file + MIGRATION_PLAN.md
2. Identify current phase (Phase 3 complete)
3. Continue from Phase 4 task list
