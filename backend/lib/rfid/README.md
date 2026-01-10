# RFID Library

Python library for reading and writing RC522 RFID cards. Provides hardware abstraction with Real and Mock implementations.

## Architecture

This library is directly imported by the Python backend's `RFIDService` (no subprocess). It handles hardware operations (RFID reading/writing) via the RC522 module on Raspberry Pi, or provides mock card reads for development.

## Files

- `reader.py`: RFID reader abstraction with `RealRFIDReader` and `MockRFIDReader` implementations
- `config.py`: Configuration loader (reads environment variables)
- `requirements-pi.txt`: Raspberry Pi-specific hardware dependencies (mfrc522, RPi.GPIO)
- `requirements.txt`: Cross-platform dependencies (currently empty, kept for future use)

## Configuration

Environment variables (loaded via `config.py`):

- `RFID_MODE`: `real` or `mock` (default: `mock`)
  - `real`: Use actual RC522 hardware (Raspberry Pi only)
  - `mock`: Generate mock card reads for development
- `RFID_POLL_INTERVAL`: Polling interval in seconds (default: `0.5`)
- `RFID_DEBOUNCE_SECONDS`: Debounce time for duplicate card reads (default: `2.0`)

## Usage

The library is imported by `backend/services/rfid_service.py`:

```python
from lib.rfid.reader import RFIDReader

# Initialize reader (automatically selects Real or Mock based on RFID_MODE)
reader = RFIDReader(
    mode="mock",  # or "real"
    poll_interval=0.5,
    debounce_seconds=2.0
)

# Read a card (blocking call)
result = reader.read_card()
if result:
    card_id, data = result
    print(f"Card: {card_id} -> {data}")

# Write to a card (blocking call)
success = reader.write_card("spotify:playlist:abc123")
```

## Mock Reader

The mock reader generates realistic card reads for development:

- Provides 3 mock card IDs: `mock123`, `mock456`, `mock789`
- Each mock card has associated Spotify playlist URLs
- Randomly selects a card every 5-10 reads
- Respects debounce timing (won't return same card within debounce period)

## Real Reader (Raspberry Pi)

The real reader interfaces with RC522 hardware via SPI:

- Uses `mfrc522` library for RC522 communication
- Uses `RPi.GPIO` for GPIO access
- Reads 16-sector MIFARE Classic 1K cards
- Supports reading and writing text data
- Implements debouncing to prevent duplicate reads

## Hardware Setup

For Raspberry Pi with RC522 module:

1. **Install dependencies:**
   ```bash
   cd backend
   venv/bin/pip install -r lib/rfid/requirements-pi.txt
   ```

2. **Enable SPI:**
   ```bash
   sudo raspi-config
   # Interface Options → SPI → Enable
   ```

3. **Wire RC522 module:**
   - 3.3V (NOT 5V!)
   - Standard SPI pins (MOSI, MISO, SCK, SDA, RST, GND)

4. **Set RFID_MODE:**
   ```bash
   # In backend/.env
   RFID_MODE=real
   ```

## Integration

The backend's `RFIDService` class (in `services/rfid_service.py`) handles:
- Reader initialization (direct import)
- Async polling loop with `asyncio.to_thread()`
- Card read event callbacks to IntegrationService
- Card write operations
- Error handling and logging

**No subprocess communication needed** - the reader is imported directly into the Python backend process.
