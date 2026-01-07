# RiverHub Implementation Plan

## Architecture Decision

**WebSocket-based architecture with Python backend (RFID hardware) + React frontend (all business logic)**

```
Python Backend (FastAPI)          React Frontend (Vite)
┌─────────────────────┐          ┌──────────────────────┐
│ - RFID read/write   │◄───WS───►│ - Sonos control      │
│ - WebSocket server  │          │ - UI (clock/controls)│
│ - Hardware only     │          │ - Business logic     │
└─────────────────────┘          └──────────────────────┘
         │                                  │
         │ GPIO/SPI                         │ HTTP/network
         ▼                                  ▼
   RC522 RFID Module                  Sonos Speaker
```

**Key Principle**: Python handles ONLY hardware. React handles everything else.

---

## Project Structure

```
riverhub/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket server
│   ├── rfid_reader.py       # RC522 hardware abstraction
│   ├── config.py            # Environment-based config
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Clock, MediaControls, WriteCard
│   │   ├── hooks/           # useWebSocket, useSonos
│   │   ├── services/        # websocket.ts, sonos.ts
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env.example
│
├── CLAUDE.md
├── PLAN.md                  # This file (in repo)
├── README.md
├── .gitignore
└── sync.sh
```

---

## Tech Stack

### Backend
- **FastAPI** - WebSocket + static file serving
- **mfrc522** - RC522 RFID library
- **RPi.GPIO** - GPIO access
- **python-dotenv** - Environment config

### Frontend
- **Vite** - Build tool
- **React** + **TypeScript**
- **Tailwind CSS** - Styling
- **TanStack Query** - State management (if needed)
- **node-sonos** - Sonos control (local network, simpler than Cloud API)

---

## WebSocket Message Protocol

### Python → Frontend (Card Read)
```json
{
  "type": "card_read",
  "cardId": "123456789",
  "data": "spotify:playlist:abc123",
  "timestamp": 1234567890
}
```

### Frontend → Python (Write Request)
```json
{
  "type": "write_request",
  "data": "spotify:playlist:xyz789"
}
```

### Python → Frontend (Write Response)
```json
{
  "type": "write_complete",
  "success": true,
  "error": null
}
```

---

## Development vs Production Deployment

### Development (Dual Port)
- Python WebSocket: `ws://rpi:8765/ws`
- Vite dev server: `http://localhost:5173`
- Frontend connects to Python via config
- HMR enabled

### Production (Single Port)
- FastAPI serves static React build + WebSocket
- Single URL: `http://rpi:8000`
- WebSocket: `ws://rpi:8000/ws`

---

## Configuration

### Backend `.env`
```bash
WS_PORT=8765
RFID_POLL_INTERVAL=0.5
LOG_LEVEL=info
```

### Frontend `.env`
```bash
# Development
VITE_WS_URL=ws://rpi.local:8765/ws

# Production
VITE_WS_URL=ws://localhost:8000/ws
```

---

## Implementation Phases

### ✅ Phase 0: Foundation
**Status**: Complete
- [x] Project documentation (CLAUDE.md)
- [x] Architecture decision
- [x] Plan document (this file)

---

### Phase 1: Project Scaffold
**Goal**: Set up project structure

**Tasks**:
1. Create `backend/` and `frontend/` directories
2. Initialize FastAPI backend
   - `main.py` with WebSocket endpoint
   - `rfid_reader.py` (port from prototype)
   - `requirements.txt` (FastAPI, mfrc522, RPi.GPIO, python-dotenv)
3. Initialize React frontend
   - `npm create vite@latest frontend -- --template react-ts`
   - Install Tailwind CSS
   - Set up basic directory structure
4. Create `.env.example` files
5. Update `.gitignore`

**Completion Criteria**:
- Backend runs: `python backend/main.py`
- Frontend runs: `npm run dev` (in frontend/)
- No errors

---

### Phase 2: WebSocket Communication
**Goal**: Establish bidirectional WebSocket between frontend and backend

**Backend Tasks**:
1. Implement WebSocket handler in FastAPI
2. Port RFID reading logic from prototype
3. Broadcast card reads as JSON messages
4. Handle write requests from frontend

**Frontend Tasks**:
1. Create `services/websocket.ts` - WebSocket client
2. Create `hooks/useWebSocket.ts` - React hook for WebSocket
3. Display WebSocket connection status
4. Log incoming messages (debug)

**Test**:
- Tap RFID card → see message in browser console
- Send write request from browser → Python receives it

**Completion Criteria**:
- WebSocket connects on page load
- Card reads appear in frontend
- Write requests reach backend

---

### Phase 3: Sonos Integration
**Goal**: Play music when card is scanned

**Tasks**:
1. Install `node-sonos` in frontend
2. Create `services/sonos.ts` - Sonos abstraction
3. Create `hooks/useSonos.ts` - React hook for playback
4. Parse card data (expect `spotify:playlist:*` format)
5. Call `sonos.play()` with playlist URL
6. Handle errors (Sonos offline, invalid URL, etc.)

**Test**:
- Write playlist URL to card (via write.py temporarily)
- Tap card → Sonos plays playlist

**Completion Criteria**:
- Card scan triggers Sonos playback
- Errors are logged/displayed

---

### Phase 4: Media Controls UI
**Goal**: Display playback controls when music is playing

**Tasks**:
1. Create `components/MediaControls.tsx`
   - Play/pause button
   - Next/previous track
   - Volume control
   - Current track info
2. Update `useSonos` hook to fetch current state
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

### Phase 6: Card Writing UI
**Goal**: Allow writing cards from web interface

**Tasks**:
1. Create `components/WriteCard.tsx`
   - Text input for playlist URL
   - "Write" button
   - Instructions ("Place card on reader and click Write")
   - Success/error feedback
2. Send write request via WebSocket
3. Handle response from Python
4. Clear input on success

**Backend Tasks**:
1. Implement write logic in `rfid_reader.py`
2. Send `write_complete` response

**Completion Criteria**:
- Enter URL, click Write, place card → writes successfully
- Error shown if write fails
- Success message on completion

---

### Phase 7: Polish & Error Handling
**Goal**: Production-ready reliability

**Tasks**:
1. WebSocket auto-reconnect
   - Detect disconnects
   - Retry with exponential backoff
   - Show connection status in UI
2. RFID read debouncing
   - Ignore duplicate reads within 2 seconds
3. Comprehensive error handling
   - Sonos unreachable
   - Invalid card data
   - RFID read failures
4. Logging
   - Backend: structured logging (JSON)
   - Frontend: error boundary
5. Production deployment
   - FastAPI serves static React build
   - systemd service (auto-start on boot)

**Completion Criteria**:
- App recovers from WebSocket disconnect
- Card reads are debounced
- All errors handled gracefully
- Logs are useful for debugging

---

## Critical Implementation Notes

### Python Backend Responsibilities
- Initialize RC522 hardware
- Poll for card reads (non-blocking, ~500ms interval)
- Broadcast reads to all WebSocket clients
- Accept write requests and execute
- **Does NOT**: Parse URLs, control Sonos, maintain app state

### Frontend Responsibilities
- Connect to WebSocket
- Interpret card data (parse playlist URLs)
- Control Sonos (node-sonos library)
- Render UI (clock, media controls, write interface)
- Handle all business logic

### Sonos Integration
- Use `node-sonos` (local network, no OAuth)
- Discovery: Find speaker by room name (configurable)
- Playlist format: `spotify:playlist:<id>` or direct URLs
- Error handling: Speaker offline, invalid URL

### WebSocket Reliability
- Auto-reconnect with exponential backoff
- Heartbeat/ping every 30s to detect stale connections
- Display connection status prominently

---

## How to Use This Plan

1. **Check current phase** - Each phase is independent
2. **Complete tasks in order** - Don't skip phases
3. **Test completion criteria** - Ensure phase works before moving on
4. **Update status** - Mark phases complete as you go

This plan is designed to be resumable. If context is lost:
1. Review this file
2. Identify current phase
3. Continue from task list
