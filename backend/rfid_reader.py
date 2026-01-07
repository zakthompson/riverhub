import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)


class RFIDReader:
    def __init__(self, poll_interval: float = 0.5):
        self.poll_interval = poll_interval
        self.last_card_id: Optional[str] = None
        self.last_read_time: float = 0
        logger.info("RFID Reader initialized (stub mode)")

    def read_card(self) -> Optional[tuple[str, str]]:
        """
        Read RFID card and return (card_id, data) tuple.
        Returns None if no card is present or read fails.

        This is a stub implementation. Real implementation will use mfrc522 library.
        """
        return None

    def write_card(self, data: str) -> bool:
        """
        Write data to RFID card.
        Returns True if successful, False otherwise.

        This is a stub implementation. Real implementation will use mfrc522 library.
        """
        logger.info(f"Stub: Would write data: {data}")
        return True

    def should_read(self, card_id: str, debounce_seconds: float = 2.0) -> bool:
        """
        Check if we should process this card read (debouncing logic).
        """
        current_time = time.time()
        if card_id == self.last_card_id:
            time_since_last = current_time - self.last_read_time
            if time_since_last < debounce_seconds:
                return False

        self.last_card_id = card_id
        self.last_read_time = current_time
        return True
