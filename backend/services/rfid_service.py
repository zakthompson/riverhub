import asyncio
import logging
from typing import Any, Optional, Callable, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RFIDEvent:
    """RFID card read event"""
    card_id: str
    data: str
    timestamp: float


class RFIDService:
    """
    RFID card reading service.
    Directly uses RFIDReader from lib/rfid (no subprocess needed).
    """

    def __init__(
        self,
        mode: str = "mock",
        poll_interval: float = 0.5,
        debounce_seconds: float = 2.0,
    ):
        self.mode = mode
        self.poll_interval = poll_interval
        self.debounce_seconds = debounce_seconds
        self.reader: Optional[Any] = None
        self._polling = False
        self._polling_task: Optional[asyncio.Task] = None

        # Initialize reader
        self._init_reader()

    def _init_reader(self) -> None:
        """Initialize RFID reader"""
        try:
            # Import from lib/rfid
            import sys
            from pathlib import Path

            # Add lib/rfid to path if not already there
            rfid_path = Path(__file__).parent.parent / "lib" / "rfid"
            if str(rfid_path) not in sys.path:
                sys.path.insert(0, str(rfid_path))

            from reader import RFIDReader

            self.reader = RFIDReader(
                mode=self.mode,
                poll_interval=self.poll_interval,
                debounce_seconds=self.debounce_seconds,
            )

            logger.info(f"RFID reader initialized (mode: {self.mode})")

        except Exception as error:
            logger.error(f"Failed to initialize RFID reader: {error}")
            raise

    async def start_polling(
        self, callback: Callable[[str, str], None]
    ) -> None:
        """Start polling for RFID cards"""
        if self._polling:
            return

        self._polling = True
        self._polling_task = asyncio.create_task(self._poll_loop(callback))
        logger.info(f"Started RFID polling (mode: {self.mode})")

    def stop_polling(self) -> None:
        """Stop polling for RFID cards"""
        self._polling = False
        if self._polling_task:
            self._polling_task.cancel()
            self._polling_task = None
        logger.info("Stopped RFID polling")

    async def _poll_loop(self, callback: Callable[[str, str], None]) -> None:
        """Background task that polls for RFID cards"""
        while self._polling:
            try:
                # Read card (blocking call, run in executor)
                result = await asyncio.to_thread(self.reader.read_card)

                if result:
                    card_id, data = result
                    logger.info(f"Card read: {card_id} -> {data}")

                    # Invoke callback
                    await callback(card_id, data)

            except asyncio.CancelledError:
                break
            except Exception as error:
                logger.error(f"Error reading RFID card: {error}")

            # Small delay between polls
            await asyncio.sleep(self.poll_interval)

    async def write_card(self, data: str) -> bool:
        """Write data to RFID card"""
        if not self.reader:
            logger.error("RFID reader not initialized")
            return False

        try:
            # Blocking write operation
            success = await asyncio.to_thread(self.reader.write_card, data)

            if success:
                logger.info(f"Successfully wrote to card: {data}")
            else:
                logger.warning("Failed to write to card")

            return success

        except Exception as error:
            logger.error(f"Error writing to RFID card: {error}")
            return False

    def is_running(self) -> bool:
        """Check if polling is active"""
        return self._polling
