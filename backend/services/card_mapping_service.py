import json
import logging
import asyncio
from pathlib import Path
from typing import Dict, Optional, Union, Callable
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class CardMapping:
    """Card mapping configuration"""
    type: str  # 'sonos', 'lights', etc.
    data: Union[str, dict]
    name: Optional[str] = None


@dataclass
class CardMappings:
    """Container for all card mappings"""
    cards: Dict[str, CardMapping]


class CardMappingService:
    """
    Manages card mappings stored in JSON file.
    Each RFID card ID maps to an action configuration.
    Automatically reloads when the file changes.
    """

    def __init__(self, mappings_file: str = "card-mappings.json"):
        self.mappings_file = Path(mappings_file)
        self.mappings: Dict[str, CardMapping] = {}
        self.loaded = False
        self._watch_task: Optional[asyncio.Task] = None
        self._should_watch = True
        self._on_change_callback: Optional[Callable] = None
        self._last_mtime: Optional[float] = None

    async def load(self) -> None:
        """Load card mappings from file"""
        if not self.mappings_file.exists():
            logger.warning(f"Card mappings file not found: {self.mappings_file}")
            logger.info("Creating empty mappings file...")
            await self._save()
            self.loaded = True
            return

        try:
            content = self.mappings_file.read_text()
            data = json.loads(content)

            # Convert dict to CardMapping objects
            self.mappings = {
                card_id: CardMapping(**mapping_data)
                for card_id, mapping_data in data.get("cards", {}).items()
            }

            # Track modification time
            self._last_mtime = self.mappings_file.stat().st_mtime

            logger.info(f"Loaded {len(self.mappings)} card mapping(s)")
            self.loaded = True
        except Exception as error:
            logger.error(f"Error loading card mappings: {error}")
            raise

    def get_mapping(self, card_id: str) -> Optional[CardMapping]:
        """Get mapping for a specific card ID"""
        if not self.loaded:
            raise RuntimeError("Card mappings not loaded. Call load() first.")

        return self.mappings.get(card_id)

    async def set_mapping(
        self,
        card_id: str,
        type_: str,
        data: Union[str, dict],
        name: Optional[str] = None,
    ) -> None:
        """Set mapping for a card ID"""
        if not self.loaded:
            await self.load()

        self.mappings[card_id] = CardMapping(
            type=type_,
            data=data,
            name=name,
        )

        await self._save()
        logger.info(f"Saved mapping for card {card_id} ({type_})")

    async def delete_mapping(self, card_id: str) -> bool:
        """Delete mapping for a card ID"""
        if not self.loaded:
            await self.load()

        if card_id not in self.mappings:
            return False

        del self.mappings[card_id]
        await self._save()
        logger.info(f"Deleted mapping for card {card_id}")
        return True

    def get_all_mappings(self) -> Dict[str, CardMapping]:
        """Get all mappings"""
        if not self.loaded:
            raise RuntimeError("Card mappings not loaded. Call load() first.")

        return self.mappings

    async def _save(self) -> None:
        """Save mappings to file"""
        try:
            # Convert CardMapping objects to dicts
            data = {
                "cards": {
                    card_id: asdict(mapping)
                    for card_id, mapping in self.mappings.items()
                }
            }

            self.mappings_file.write_text(json.dumps(data, indent=2))
        except Exception as error:
            logger.error(f"Error saving card mappings: {error}")
            raise

    def set_on_change_callback(self, callback: Callable) -> None:
        """Set callback to be called when mappings change"""
        self._on_change_callback = callback

    async def start_watching(self) -> None:
        """Start watching the mappings file for changes"""
        if self._watch_task is not None:
            logger.warning("File watching already started")
            return

        self._should_watch = True
        self._watch_task = asyncio.create_task(self._watch_file())
        logger.info(f"Started watching {self.mappings_file} for changes")

    async def stop_watching(self) -> None:
        """Stop watching the mappings file"""
        self._should_watch = False
        if self._watch_task:
            self._watch_task.cancel()
            try:
                await self._watch_task
            except asyncio.CancelledError:
                pass
            self._watch_task = None
            logger.info("Stopped watching card mappings file")

    async def _watch_file(self) -> None:
        """Watch the mappings file and reload on changes (polling approach)"""
        try:
            while self._should_watch:
                await asyncio.sleep(1.0)  # Check every second

                if not self.mappings_file.exists():
                    continue

                try:
                    current_mtime = self.mappings_file.stat().st_mtime

                    if self._last_mtime is not None and current_mtime > self._last_mtime:
                        logger.info(f"Card mappings file changed, reloading...")
                        await self.load()
                        logger.info(f"Reloaded {len(self.mappings)} card mapping(s)")

                        if self._on_change_callback:
                            await self._on_change_callback()
                except Exception as error:
                    logger.error(f"Error reloading card mappings: {error}")
        except asyncio.CancelledError:
            logger.debug("File watching cancelled")
        except Exception as error:
            logger.error(f"Error in file watching: {error}")
