import logging
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages WebSocket connections and broadcasting.
    Handles multiple client connections and message distribution.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(
                f"WebSocket client disconnected. Total clients: {len(self.active_connections)}"
            )

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Broadcast message to all connected clients"""
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as error:
                logger.error(f"Error broadcasting to client: {error}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

    async def send_personal(self, message: Dict[str, Any], websocket: WebSocket) -> None:
        """Send message to a specific client"""
        try:
            await websocket.send_json(message)
        except Exception as error:
            logger.error(f"Error sending personal message: {error}")
            self.disconnect(websocket)

    def get_client_count(self) -> int:
        """Get number of connected clients"""
        return len(self.active_connections)
