# RFID Service

Python service for reading and writing RC522 RFID cards. Communicates via stdin/stdout using JSON lines.

## Architecture

This service is managed as a subprocess by the Node.js backend. It handles only hardware operations (RFID reading/writing) and communicates using a simple JSON protocol over stdin/stdout.

## Protocol

### Input (stdin) - Commands

Commands are sent as JSON lines to stdin:

```json
{"type": "write_request", "data": "spotify:playlist:abc123"}
{"type": "ping"}
```

### Output (stdout) - Events

Events are sent as JSON lines to stdout:

```json
{"type": "card_read", "cardId": "123456789", "data": "spotify:playlist:abc", "timestamp": 1234567890}
{"type": "write_complete", "success": true}
{"type": "write_complete", "success": false, "error": "Write operation failed"}
{"type": "error", "message": "Error description"}
```

## Environment Variables

- `RFID_MODE`: `real` or `mock` (default: `mock`)
- `RFID_POLL_INTERVAL`: Polling interval in seconds (default: `0.5`)
- `RFID_DEBOUNCE_SECONDS`: Debounce time for card reads (default: `2.0`)

## Files

- `service.py`: Main service loop (stdin/stdout communication)
- `reader.py`: RFID reader abstraction with Real/Mock implementations
- `config.py`: Configuration loader
- `requirements.txt`: Python dependencies

## Running Standalone

For testing purposes, you can run the service standalone:

```bash
cd backend/lib/rfid
export RFID_MODE=mock
python3 service.py
```

Then interact via stdin/stdout:

```bash
# Read mode - service will output card_read events
# Type commands:
{"type": "write_request", "data": "test data"}
```

## Integration

The Node.js backend spawns this service as a subprocess and manages:
- Process lifecycle (start/stop/restart)
- Command sending (write requests)
- Event receiving (card reads, write completions)
- Error handling and logging

See `backend/src/services/rfid.service.ts` for the Node.js integration code.
