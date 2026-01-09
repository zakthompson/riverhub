#!/usr/bin/env python3
"""
RFID Service - Standalone service for RC522 RFID reading/writing
Communicates via stdin/stdout using JSON lines
"""

import json
import logging
import select
import sys
import time
from pathlib import Path

# Add current directory to path to import modules
sys.path.insert(0, str(Path(__file__).parent))

from config import config
from reader import RFIDReader

# Setup logging to stderr (stdout is for JSON messages)
logging.basicConfig(
    level=config.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger(__name__)


def send_event(event: dict) -> None:
    """Send an event to stdout as a JSON line"""
    try:
        print(json.dumps(event), flush=True)
    except Exception as e:
        logger.error(f"Failed to send event: {e}")


def handle_command(command: dict, rfid_reader: RFIDReader) -> None:
    """Handle incoming command from stdin"""
    try:
        command_type = command.get("type")

        if command_type == "write_request":
            data = command.get("data", "")
            if not data:
                send_event({
                    "type": "write_complete",
                    "success": False,
                    "error": "No data provided"
                })
                return

            logger.info(f"Write request received: {data}")
            success = rfid_reader.write_card(data)

            send_event({
                "type": "write_complete",
                "success": success,
                "error": None if success else "Write operation failed"
            })

        elif command_type == "ping":
            # Simple health check
            pass

        else:
            logger.warning(f"Unknown command type: {command_type}")

    except Exception as e:
        logger.error(f"Error handling command: {e}")
        send_event({
            "type": "error",
            "message": str(e)
        })


def main():
    """Main service loop"""
    logger.info("Starting RFID service...")
    logger.info(f"RFID mode: {config.RFID_MODE}")

    # Initialize RFID reader
    try:
        rfid_reader = RFIDReader(
            mode=config.RFID_MODE,
            poll_interval=config.RFID_POLL_INTERVAL,
            debounce_seconds=config.RFID_DEBOUNCE_SECONDS
        )
        logger.info("RFID reader initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize RFID reader: {e}")
        send_event({
            "type": "error",
            "message": f"Failed to initialize RFID reader: {e}"
        })
        sys.exit(1)

    logger.info("RFID service started, entering main loop")

    # Main loop
    while True:
        try:
            # Check for commands on stdin (non-blocking)
            if select.select([sys.stdin], [], [], 0)[0]:
                line = sys.stdin.readline()
                if not line:  # EOF
                    logger.info("Received EOF on stdin, exiting")
                    break

                line = line.strip()
                if line:
                    try:
                        command = json.loads(line)
                        handle_command(command, rfid_reader)
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse command: {e}")

            # Poll RFID reader
            result = rfid_reader.read_card()
            if result:
                card_id, data = result
                send_event({
                    "type": "card_read",
                    "cardId": card_id,
                    "data": data,
                    "timestamp": int(time.time())
                })
                logger.info(f"Card read: {card_id} -> {data}")

            # Sleep to avoid busy-waiting
            time.sleep(config.RFID_POLL_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Received interrupt, exiting")
            break
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            send_event({
                "type": "error",
                "message": str(e)
            })
            time.sleep(1)  # Avoid rapid error loops

    logger.info("RFID service stopped")


if __name__ == "__main__":
    main()
