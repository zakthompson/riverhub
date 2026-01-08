import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import config
from rfid_reader import RFIDReader

load_dotenv()

logging.basicConfig(
    level=config.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)


manager = ConnectionManager()
rfid_reader: RFIDReader | None = None
rfid_polling_task: asyncio.Task | None = None


async def poll_rfid_reader():
    """
    Continuously poll the RFID reader and broadcast card reads to all clients.
    This runs in the background as a task during the app lifespan.
    """
    logger.info("Starting RFID polling task")

    while True:
        try:
            result = rfid_reader.read_card()

            if result:
                card_id, data = result
                message = {
                    "type": "card_read",
                    "cardId": card_id,
                    "data": data,
                    "timestamp": int(time.time())
                }
                logger.info(f"Card read: {card_id} -> {data}")
                await manager.broadcast(message)

            await asyncio.sleep(config.RFID_POLL_INTERVAL)

        except Exception as e:
            logger.error(f"Error in RFID polling task: {e}")
            await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown tasks.
    Initializes RFID reader and starts polling task on startup.
    """
    global rfid_reader, rfid_polling_task

    logger.info("Starting RiverHub backend...")
    logger.info(f"RFID mode: {config.RFID_MODE}")
    logger.info(f"WebSocket port: {config.WS_PORT}")

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
        logger.warning("Application will continue without RFID functionality")

    # Start RFID polling task if reader is initialized
    if rfid_reader:
        rfid_polling_task = asyncio.create_task(poll_rfid_reader())
        logger.info("RFID polling task started")

    yield

    # Shutdown
    logger.info("Shutting down RiverHub backend...")
    if rfid_polling_task:
        rfid_polling_task.cancel()
        try:
            await rfid_polling_task
        except asyncio.CancelledError:
            pass
    logger.info("Shutdown complete")


app = FastAPI(title="RiverHub", lifespan=lifespan)

# Mount static files for production mode
if config.SERVE_STATIC:
    static_path = Path(__file__).parent / config.STATIC_DIR
    if static_path.exists():
        app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")
        logger.info(f"Serving static files from {static_path}")
    else:
        logger.warning(f"Static directory not found: {static_path}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "rfid_mode": config.RFID_MODE,
        "rfid_available": rfid_reader is not None,
        "active_connections": len(manager.active_connections)
    }


@app.get("/")
async def serve_root():
    """Serve the React app's index.html in production mode"""
    if config.SERVE_STATIC:
        static_path = Path(__file__).parent / config.STATIC_DIR / "index.html"
        if static_path.exists():
            return FileResponse(static_path)
    return {"message": "RiverHub backend is running. Frontend should be served separately in dev mode."}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for bidirectional communication with frontend.
    Handles write requests and receives card read broadcasts.
    """
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            logger.info(f"Received message: {data}")

            message_type = data.get("type")

            if message_type == "write_request":
                # Handle RFID card write request
                write_data = data.get("data", "")

                if not rfid_reader:
                    await websocket.send_json({
                        "type": "write_complete",
                        "success": False,
                        "error": "RFID reader not available"
                    })
                    continue

                if not write_data:
                    await websocket.send_json({
                        "type": "write_complete",
                        "success": False,
                        "error": "No data provided"
                    })
                    continue

                logger.info(f"Write request received: {write_data}")

                try:
                    success = rfid_reader.write_card(write_data)
                    await websocket.send_json({
                        "type": "write_complete",
                        "success": success,
                        "error": None if success else "Write operation failed"
                    })
                except Exception as e:
                    logger.error(f"Error writing to card: {e}")
                    await websocket.send_json({
                        "type": "write_complete",
                        "success": False,
                        "error": str(e)
                    })
            else:
                logger.warning(f"Unknown message type: {message_type}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=config.WS_PORT)
