import logging
import time
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class RFIDReaderInterface(ABC):
    """Abstract interface for RFID reading/writing"""

    @abstractmethod
    def read_card(self) -> Optional[tuple[str, str]]:
        """Read RFID card and return (card_id, data) tuple or None"""
        pass

    @abstractmethod
    def write_card(self, data: str) -> bool:
        """Write data to RFID card. Returns True if successful"""
        pass


class RealRFIDReader(RFIDReaderInterface):
    """Real RFID reader using RC522 hardware"""

    def __init__(self):
        try:
            from mfrc522 import SimpleMFRC522

            self.reader = SimpleMFRC522()
            logger.info("Real RFID reader initialized (RC522)")
        except ImportError as e:
            logger.error("Failed to import mfrc522 library. Install with: pip install mfrc522")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize RFID reader: {e}")
            raise

    def read_card(self) -> Optional[tuple[str, str]]:
        """Read RFID card using read_no_block for non-blocking operation"""
        try:
            card_id, text = self.reader.read_no_block()
            if card_id and text:
                return (str(card_id), text.strip())
            return None
        except Exception as e:
            logger.error(f"Error reading RFID card: {e}")
            return None

    def write_card(self, data: str) -> bool:
        """Write data to RFID card"""
        try:
            import RPi.GPIO as GPIO

            self.reader.write(data)
            GPIO.cleanup()
            logger.info(f"Successfully wrote data to card: {data}")
            return True
        except Exception as e:
            logger.error(f"Error writing to RFID card: {e}")
            return False


class MockRFIDReader(RFIDReaderInterface):
    """Mock RFID reader for testing without hardware"""

    def __init__(self):
        self.mock_cards: dict[str, str] = {
            "mock123": "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
            "mock456": "spotify:playlist:37i9dQZF1DX0XUsuxWHRQd",
            "mock789": "spotify:playlist:37i9dQZF1DXaPCIWxzZwR1",
        }
        self.current_card_index = 0
        self.card_ids = list(self.mock_cards.keys())
        self.simulated_card_present = False
        self.last_mock_read_time = 0
        logger.info("Mock RFID reader initialized")
        logger.info(f"Available mock cards: {', '.join(self.card_ids)}")

    def read_card(self) -> Optional[tuple[str, str]]:
        """
        Simulate card reading. Returns a card every 5 seconds in rotation.
        This simulates a user tapping different cards.
        """
        current_time = time.time()

        # Simulate a card tap every 5 seconds
        if current_time - self.last_mock_read_time >= 5.0:
            self.last_mock_read_time = current_time
            card_id = self.card_ids[self.current_card_index]
            data = self.mock_cards[card_id]
            self.current_card_index = (self.current_card_index + 1) % len(self.card_ids)
            logger.info(f"Mock card read: {card_id} -> {data}")
            return (card_id, data)

        return None

    def write_card(self, data: str) -> bool:
        """Simulate writing to a card"""
        logger.info(f"Mock: Would write data: {data}")
        # In mock mode, just log and return success
        return True


class RFIDReader:
    """
    Main RFID reader class with debouncing and mode selection.
    """

    def __init__(self, mode: str = "real", poll_interval: float = 0.5, debounce_seconds: float = 2.0):
        self.poll_interval = poll_interval
        self.debounce_seconds = debounce_seconds
        self.last_card_id: Optional[str] = None
        self.last_read_time: float = 0

        # Initialize the appropriate reader implementation
        if mode == "mock":
            self.implementation: RFIDReaderInterface = MockRFIDReader()
        else:
            self.implementation: RFIDReaderInterface = RealRFIDReader()

    def read_card(self) -> Optional[tuple[str, str]]:
        """
        Read RFID card with debouncing.
        Returns (card_id, data) tuple if a new card is read, None otherwise.
        """
        result = self.implementation.read_card()

        if result is None:
            return None

        card_id, data = result

        # Apply debouncing
        if self.should_read(card_id):
            return (card_id, data)

        return None

    def write_card(self, data: str) -> bool:
        """Write data to RFID card"""
        return self.implementation.write_card(data)

    def should_read(self, card_id: str) -> bool:
        """
        Check if we should process this card read (debouncing logic).
        Prevents duplicate reads of the same card within debounce_seconds.
        """
        current_time = time.time()

        if card_id == self.last_card_id:
            time_since_last = current_time - self.last_read_time
            if time_since_last < self.debounce_seconds:
                logger.debug(f"Debouncing card {card_id} (last read {time_since_last:.1f}s ago)")
                return False

        self.last_card_id = card_id
        self.last_read_time = current_time
        return True
