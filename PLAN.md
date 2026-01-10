# RiverHub Implementation Plan

## Architecture Decision (Updated - Phase 3 Complete)

**Pure Python Backend with FastAPI**

```
┌─────────────────────────────────────────────────────────────┐
│ Python Backend (FastAPI, port 8765)                         │
│                                                              │
│  ┌───────────┐    ┌────────────┐    ┌──────────────┐      │
│  │ WebSocket │◄──►│Integration │◄──►│Sonos Service │      │
│  │  Manager  │    │  Service   │    │  (SoCo lib)  │      │
│  │           │    │            │    │(polling 1.5s)│      │
│  └───────────┘    └─────┬──────┘    └──────────────┘      │
│                          │                                  │
│                   ┌──────▼───────┐                          │
│                   │RFID Service  │                          │
│                   │(direct import│                          │
│                   │lib/rfid/)    │                          │
│                   └──────┬───────┘                          │
│                          │                                  │
│  ┌────────────────┐      │       ┌──────────────┐          │
│  │Card Mapping   │◄─────┴──────►│HTTP API      │          │
│  │Service        │               │(/health,     │          │
│  │(JSON file)    │               │ /api/cards,  │          │
│  │               │               │ /api/fav...) │          │
│  └───────────────┘               └──────────────┘          │
└──────────────────────────┬─────────────────────────────────┘
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

**Key Principles**:
- **Python + FastAPI** handles: Sonos control (SoCo), RFID hardware, WebSocket server, HTTP API
- **Direct RFID import**: No subprocess communication needed
- **React frontend** handles: UI, displaying Sonos state, user interactions
- **Integration Service** pattern: Reusable orchestration for future hardware (lights, sensors, etc.)
- **Pure Python** backend: Simpler deployment, single process, unified codebase

**Why This Architecture**:
- ✅ Unified Python codebase (easier to maintain)
- ✅ Real-time Sonos polling with SoCo (1.5 second updates)
- ✅ No subprocess overhead (direct import)
- ✅ SoCo library more reliable than node-sonos
- ✅ Apple Music support via ShareLinkPlugin
- ✅ Simple deployment (single Python process)
- ✅ Async/await throughout for better concurrency

---

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
├── README.md
├── .gitignore
├── dev.sh                        # Universal dev script (Pi + dev machine)
└── sync.sh                       # Remote dev sync (dev → Pi)
```

---

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
- **Vite** - Build tool
- **React** + **TypeScript**
- **Tailwind CSS** - Styling
- **TanStack Query** - State management (if needed)

### Development
- **ESLint** + **Prettier** - Code quality
- **Husky** - Pre-commit hooks
- **watchexec** - File watching (sync.sh)
- **rsync** - Remote sync (dev machine → Pi)

---

## Message Protocols

### Backend ↔ Frontend (WebSocket)

**Backend → Frontend:**
```typescript
// Card read (successful)
{
  type: 'card_read',
  cardId: string,
  data: string,
  actionType: string,
  name: string,
  timestamp: number
}

// Card read (duplicate - ignored)
{
  type: 'card_read',
  cardId: string,
  data: string,
  actionType: string,
  name: string,
  timestamp: number,
  ignored: true,
  reason: "Already playing"
}

// Card read (not registered)
{
  type: 'card_read',
  cardId: string,
  data: null,
  timestamp: number,
  error: "Card not registered"
}

// Sonos state (pushed every 1.5s)
{
  type: 'sonos_state',
  playbackState: string,  // 'PLAYING', 'PAUSED_PLAYBACK', 'STOPPED'
  isPlaying: boolean,
  volume: number,
  speakerName: string,
  currentTrack: {
    title: string,
    artist: string,
    album: string,
    albumArtUri: string,
    duration: string,
    position: string
  } | null
}

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

### Card Mapping Format

Cards are stored in `card-mappings.json`:
```json
{
  "cards": {
    "923050338627": {
      "type": "sonos",
      "data": "title:Calm River",
      "name": "Calm River"
    },
    "111111111": {
      "type": "sonos",
      "data": "url:https://music.apple.com/album/1715961558",
      "name": "Apple Music Album"
    }
  }
}
```

**Data Prefix Support:**
- `title:Calm River` - Play Sonos favorite by title
- `url:https://music.apple.com/...` - Play Apple Music (via ShareLinkPlugin)
- `url:spotify:playlist:...` - Play Spotify playlist
- `url:x-rincon-cpcontainer:...` - Play Sonos native URI

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
- Hot reloads Python backend changes (uvicorn --reload)
- Starts frontend dev server (Vite)
- Installs dependencies automatically

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
# Server Configuration
PORT=8765
NODE_ENV=development              # 'development' or 'production'
STATIC_FILES=../frontend/dist    # Frontend build directory

# RFID Configuration
RFID_MODE=mock                    # 'mock' or 'real' (auto-detected by dev.sh)
RFID_POLL_INTERVAL=0.5            # Card polling interval (seconds)
RFID_DEBOUNCE_SECONDS=2.0         # Debounce duplicate reads

# Sonos Configuration
SONOS_SPEAKER_NAME=Bedroom        # Configure your speaker name

# Card Mappings
CARD_MAPPINGS_FILE=card-mappings.json

# Logging
LOG_LEVEL=info                    # Logging level
```

### Frontend `.env`
```bash
# WebSocket URL (both development and production)
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

### ✅ Phase 3: Sonos Integration + Pure Python Backend
**Status**: Complete _(Migrated to pure Python backend with FastAPI and SoCo)_

**What was completed:**

1. **Pure Python Backend with FastAPI**
   - Migrated from hybrid Node.js + Python subprocess to unified Python backend
   - Implemented FastAPI for HTTP and WebSocket on single port (8765)
   - All services in Python (CardMapping, Sonos, RFID, WebSocket, Integration)
   - Direct RFID import (no subprocess communication needed)

2. **Sonos Integration with SoCo**
   - Replaced node-sonos (UPnP errors) with SoCo library
   - Implemented speaker discovery by name
   - Added real-time state polling (1.5 second intervals)
   - Async/await throughout with `asyncio.to_thread()` for blocking SoCo calls
   - **Apple Music support via ShareLinkPlugin** (clear queue → parse URL → play)

3. **Card Mapping System**
   - JSON-based card configuration (card-mappings.json)
   - Prefix support: `title:` for favorites, `url:` for direct URLs
   - Support for Apple Music, Spotify, and Sonos native URIs
   - Duplicate card tap prevention (tracks current playing card)

4. **Integration Layer**
   - IntegrationService orchestrating RFID → Sonos → Frontend
   - Automatic Apple Music URL detection
   - Error handling with proper fallbacks
   - WebSocket broadcasting for real-time updates

5. **HTTP API Endpoints**
   - `GET /health` - System health check
   - `GET /api/cards` - List all card mappings
   - `POST /api/cards/{card_id}` - Create/update card mapping
   - `DELETE /api/cards/{card_id}` - Delete card mapping
   - `GET /api/favorites` - List Sonos favorites

6. **Frontend Updates**
   - Removed browser-based Sonos code (incompatible with browser)
   - Created useSonosState hook for backend-provided state
   - Updated to receive real-time Sonos updates via WebSocket
   - Added Sonos Status UI section

7. **Development Tooling**
   - Updated `dev.sh` for Python uvicorn backend
   - Automatic platform detection (Pi vs dev machine)
   - Hot reload with uvicorn --reload
   - Automatic dependency installation

**Test results:**
- Card tap triggers Apple Music playback successfully ✅
- No UPnP errors (SoCo works reliably) ✅
- Duplicate taps ignored correctly ✅
- Frontend receives real-time Sonos state updates ✅
- Integration service orchestrates all flows ✅
- All HTTP API endpoints working ✅

**Key learnings:**
- SoCo library far more reliable than node-sonos
- ShareLinkPlugin essential for Apple Music support
- Pure Python simpler to deploy and maintain
- Direct import eliminates subprocess complexity
- Integration Service pattern provides reusable foundation for future devices

**Commits:**
- 569ec90: Migrate to pure Python backend with FastAPI and SoCo
- 4dd76ba: Improve card mapping system with prefix support
- 3c50f72: Add Apple Music share link support via ShareLinkPlugin
- c608e1d: Prevent duplicate card taps from restarting playback

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

### Python Backend Responsibilities
- Initialize and manage all services (RFID, Sonos, Card Mapping, WebSocket, Integration)
- Control Sonos speaker via SoCo (discovery, playback, state polling)
- Serve WebSocket connections to frontend
- Serve HTTP API endpoints
- Orchestrate RFID events → Sonos actions → Frontend updates
- Serve static frontend files in production (from `STATIC_FILES` path)
- Direct import of RFID reader (no subprocess needed)

### RFID Service Responsibilities
- Direct import from `lib/rfid/reader.py`
- Initialize RC522 hardware (or mock reader)
- Poll for card reads using async loop (~500ms interval)
- Invoke callback with card ID when detected
- Support card writing via `write_card()` method
- Debounce duplicate reads within configured timeframe

### Sonos Service Responsibilities
- Discover speaker by name using SoCo
- Poll speaker state every 1.5 seconds
- Handle Apple Music URLs via ShareLinkPlugin (clear queue → add → play)
- Handle Sonos favorites by title (fetch list → find match → queue → play)
- Handle generic URLs/URIs (queue vs direct playback based on type)
- Invoke callback with state updates for broadcasting

### Integration Service Responsibilities
- Central orchestration point for all service interactions
- Route RFID events → Card mapping lookup → Sonos playback
- Broadcast events to frontend via WebSocket
- Parse card data prefixes (`title:` vs `url:`)
- Track currently playing card to prevent duplicate taps
- Handle errors and broadcast to frontend

### Frontend Responsibilities
- Connect to WebSocket (ws://localhost:8765/ws)
- Display Sonos state (received from backend)
- Render UI (clock, media controls, write interface)
- Send control commands to backend via WebSocket
- Handle UI state and interactions

### Card Mapping System
- JSON file storage (`card-mappings.json`)
- Card ID as dictionary key (no duplicate `id` field)
- Prefix-based data format:
  - `title:Calm River` → Play Sonos favorite
  - `url:https://...` → Play URL (auto-detects Apple Music for ShareLinkPlugin)
- Supports Sonos, lights, and other integration types (extensible)

### Integration Service Pattern
- Reusable for future integrations:
  - **Pure software** (APIs, services) → Python services only
  - **Hardware** (GPIO, I2C, SPI) → Python in `backend/lib/*/` + service wrapper
  - Example: Adding lights or sensors follows the same pattern

---

## How to Use This Plan

1. **Check current phase** - We're currently at Phase 3 complete, Phase 4 next
2. **Test completion criteria** - Ensure phase works before moving on
3. **Update status** - Mark phases complete as you go

This plan is designed to be resumable. If context is lost:
1. Review this file and README.md for current architecture
2. Identify current phase (Phase 3 complete)
3. Continue from Phase 4 task list
