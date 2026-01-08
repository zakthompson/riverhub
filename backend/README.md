# RiverHub Backend

WebSocket server for RFID card reading/writing using FastAPI.

## Setup

1. Create virtual environment and install dependencies:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `8765` | WebSocket server port |
| `RFID_MODE` | `mock` | `real` for RC522 hardware, `mock` for testing |
| `RFID_POLL_INTERVAL` | `0.5` | Polling interval in seconds |
| `RFID_DEBOUNCE_SECONDS` | `2.0` | Ignore duplicate reads within this time |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |

## Running the Server

### Development (Mock Mode)
For testing on Mac without RC522 hardware:
```bash
source venv/bin/activate
python main.py
```

The mock mode will automatically simulate card taps every 5 seconds, cycling through 3 test cards with Spotify playlist URLs.

### Production (Real Mode)
On Raspberry Pi with RC522 hardware:
```bash
# Set RFID_MODE=real in .env
source venv/bin/activate
python main.py
```

## Testing

Test the WebSocket connection:
```bash
python test_websocket.py
```

Check health endpoint:
```bash
curl http://localhost:8765/health
```

## WebSocket Protocol

### Card Read (Server → Client)
Broadcast when a card is detected:
```json
{
  "type": "card_read",
  "cardId": "123456789",
  "data": "spotify:playlist:abc123",
  "timestamp": 1234567890
}
```

### Write Request (Client → Server)
Request to write data to card:
```json
{
  "type": "write_request",
  "data": "spotify:playlist:xyz789"
}
```

### Write Response (Server → Client)
Response after write attempt:
```json
{
  "type": "write_complete",
  "success": true,
  "error": null
}
```

## Mock Mode Cards

In mock mode, the following test cards are available:
- `mock123` → `spotify:playlist:37i9dQZF1DXcBWIGoYBM5M`
- `mock456` → `spotify:playlist:37i9dQZF1DX0XUsuxWHRQd`
- `mock789` → `spotify:playlist:37i9dQZF1DXaPCIWxzZwR1`

## Architecture

- **FastAPI**: WebSocket server and REST endpoints
- **Async polling**: Background task continuously polls RFID reader
- **Broadcast**: Card reads are broadcast to all connected WebSocket clients
- **Debouncing**: Prevents duplicate reads of same card within configured time
- **Mode switching**: Easy toggle between real hardware and mock for testing
