import logging
import time
from typing import Dict, Any
from fastapi import WebSocket

from .rfid_service import RFIDService
from .sonos_service import SonosService, SonosState
from .card_mapping_service import CardMappingService
from .websocket_service import WebSocketManager

logger = logging.getLogger(__name__)


class IntegrationService:
    """
    Orchestration layer connecting all services.
    Routes events between RFID, Sonos, Card Mappings, and WebSocket.
    """

    def __init__(
        self,
        rfid: RFIDService,
        sonos: SonosService,
        card_mappings: CardMappingService,
        ws_manager: WebSocketManager,
    ):
        self.rfid = rfid
        self.sonos = sonos
        self.card_mappings = card_mappings
        self.ws_manager = ws_manager

    async def setup(self) -> None:
        """Setup event handlers and start services"""
        # Start RFID polling with card read callback
        await self.rfid.start_polling(self.handle_card_read)

        # Start Sonos state polling with state update callback
        await self.sonos.start_polling(self.handle_sonos_state)

        logger.info("Integration service event handlers setup complete")

    async def handle_card_read(self, card_id: str, data: str) -> None:
        """
        Handle RFID card read event.
        Looks up card mapping and executes the configured action.
        """
        logger.info(f"Card read: {card_id}")

        # Look up card mapping
        mapping = self.card_mappings.get_mapping(card_id)

        if not mapping:
            logger.warning(f"No mapping found for card {card_id}")
            await self.ws_manager.broadcast(
                {
                    "type": "card_read",
                    "cardId": card_id,
                    "data": None,
                    "timestamp": time.time(),
                    "error": "Card not registered",
                }
            )
            return

        logger.info(f"Card {card_id} mapped to {mapping.type} action")

        # Broadcast card read to frontend
        await self.ws_manager.broadcast(
            {
                "type": "card_read",
                "cardId": card_id,
                "data": mapping.data,
                "actionType": mapping.type,
                "name": mapping.name,
                "timestamp": time.time(),
            }
        )

        # Execute action based on type
        await self.execute_card_action(mapping)

    async def execute_card_action(self, mapping: Any) -> None:
        """Execute the action configured for a card"""
        try:
            if mapping.type == "sonos":
                # Play Sonos content
                if isinstance(mapping.data, str):
                    # Check if it's a URI or a favorite title
                    if self._is_uri(mapping.data):
                        await self.sonos.play_url(mapping.data)
                    else:
                        # Treat as favorite title
                        await self.sonos.play_favorite_by_title(mapping.data)
                else:
                    logger.error("Invalid Sonos data format - expected string")

            # Future integrations go here:
            # elif mapping.type == "lights":
            #     await self.lights.set_scene(mapping.data)

            else:
                logger.warning(f"Unknown action type: {mapping.type}")

        except Exception as error:
            logger.error(f"Failed to execute {mapping.type} action: {error}")
            await self.ws_manager.broadcast(
                {
                    "type": "error",
                    "source": mapping.type,
                    "message": str(error),
                }
            )

    def _is_uri(self, string: str) -> bool:
        """Check if string looks like a URI (has a scheme)"""
        return (
            string.startswith("x-")
            or string.startswith("http://")
            or string.startswith("https://")
            or string.startswith("spotify:")
            or "://" in string
        )

    async def handle_sonos_state(self, state: SonosState) -> None:
        """
        Handle Sonos state update.
        Broadcasts state to all WebSocket clients.
        """
        # Convert to dict for JSON serialization
        message = {
            "type": "sonos_state",
            "playbackState": state.playback_state,
            "isPlaying": state.is_playing,
            "volume": state.volume,
            "speakerName": state.speaker_name,
            "currentTrack": None,
        }

        if state.current_track:
            message["currentTrack"] = {
                "title": state.current_track.title,
                "artist": state.current_track.artist,
                "album": state.current_track.album,
                "albumArtUri": state.current_track.album_art_uri,
                "duration": state.current_track.duration,
                "position": state.current_track.position,
            }

        await self.ws_manager.broadcast(message)

    async def handle_websocket_message(
        self, message: Dict[str, Any], websocket: WebSocket
    ) -> None:
        """
        Handle incoming WebSocket message from frontend.
        Routes to appropriate service.
        """
        try:
            msg_type = message.get("type")

            if msg_type == "sonos_play_url":
                await self.sonos.play_url(message["url"])

            elif msg_type == "sonos_play":
                await self.sonos.play()

            elif msg_type == "sonos_pause":
                await self.sonos.pause()

            elif msg_type == "sonos_next":
                await self.sonos.next()

            elif msg_type == "sonos_previous":
                await self.sonos.previous()

            elif msg_type == "sonos_volume":
                await self.sonos.set_volume(message["volume"])

            elif msg_type == "write_request":
                success = await self.rfid.write_card(message["data"])
                await self.ws_manager.send_personal(
                    {
                        "type": "write_complete",
                        "success": success,
                    },
                    websocket,
                )

            else:
                logger.warning(f"Unknown message type: {msg_type}")

        except Exception as error:
            logger.error(f"Error handling frontend message: {error}")
            await self.ws_manager.send_personal(
                {
                    "type": "error",
                    "source": "system",
                    "message": str(error),
                },
                websocket,
            )

    async def shutdown(self) -> None:
        """Cleanup on shutdown"""
        logger.info("Shutting down integration service...")
        self.rfid.stop_polling()
        self.sonos.stop_polling()
        logger.info("Integration service shutdown complete")
