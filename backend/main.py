import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from services.rfid_service import RFIDService
from services.sonos_service import SonosService
from services.card_mapping_service import CardMappingService
from services.websocket_service import WebSocketManager
from services.integration_service import IntegrationService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration
PORT = int(os.getenv("PORT", "8765"))
NODE_ENV = os.getenv("NODE_ENV", "development")
RFID_MODE = os.getenv("RFID_MODE", "mock")
RFID_POLL_INTERVAL = float(os.getenv("RFID_POLL_INTERVAL", "0.5"))
RFID_DEBOUNCE_SECONDS = float(os.getenv("RFID_DEBOUNCE_SECONDS", "2.0"))
SONOS_SPEAKER_NAME = os.getenv("SONOS_SPEAKER_NAME", "Bedroom")
STATIC_FILES = os.getenv("STATIC_FILES", "../frontend/dist")
CARD_MAPPINGS_FILE = os.getenv("CARD_MAPPINGS_FILE", "card-mappings.json")

# Global service instances
rfid_service: Optional[RFIDService] = None
sonos_service: Optional[SonosService] = None
card_mapping_service: Optional[CardMappingService] = None
ws_manager: Optional[WebSocketManager] = None
integration_service: Optional[IntegrationService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    # Startup
    logger.info("🚀 Starting RiverHub backend...")
    logger.info(f"Environment: {NODE_ENV}")
    logger.info(f"Port: {PORT}")
    logger.info(f"RFID Mode: {RFID_MODE}")

    global rfid_service, sonos_service, card_mapping_service, ws_manager, integration_service

    # Initialize services
    logger.info("\n📦 Initializing services...")

    # 1. Card Mapping Service
    card_mapping_service = CardMappingService(CARD_MAPPINGS_FILE)
    await card_mapping_service.load()
    await card_mapping_service.start_watching()

    # 2. RFID Service
    rfid_service = RFIDService(
        mode=RFID_MODE,
        poll_interval=RFID_POLL_INTERVAL,
        debounce_seconds=RFID_DEBOUNCE_SECONDS,
    )

    # 3. Sonos Service
    sonos_service = SonosService(SONOS_SPEAKER_NAME)
    try:
        await sonos_service.initialize()
    except Exception as error:
        logger.error(f"⚠️  Failed to initialize Sonos service: {error}")
        logger.info("Continuing without Sonos - will retry on first playback attempt")

    # 4. WebSocket Manager
    ws_manager = WebSocketManager()

    # 5. Integration Service (connects everything)
    integration_service = IntegrationService(
        rfid_service, sonos_service, card_mapping_service, ws_manager
    )
    await integration_service.setup()

    logger.info(f"\n✅ RiverHub backend running on port {PORT}")
    logger.info(f"   WebSocket: ws://localhost:{PORT}/ws")
    logger.info(f"   Health check: http://localhost:{PORT}/health")

    yield

    # Shutdown
    logger.info("\n🛑 Shutting down gracefully...")
    if integration_service:
        await integration_service.shutdown()
    if card_mapping_service:
        await card_mapping_service.stop_watching()
    logger.info("✅ Shutdown complete")


# Create FastAPI app
app = FastAPI(title="RiverHub Backend", lifespan=lifespan)

# CORS middleware for development
if NODE_ENV == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:5174"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Pydantic models for API
class CardMappingCreate(BaseModel):
    type: str
    data: str
    name: Optional[str] = None


# HTTP API Endpoints


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "environment": NODE_ENV,
        "rfid": {
            "mode": RFID_MODE,
            "running": rfid_service.is_running() if rfid_service else False,
        },
        "sonos": {
            "connected": sonos_service.is_connected() if sonos_service else False,
            "speaker": SONOS_SPEAKER_NAME,
        },
        "websocket": {
            "clients": ws_manager.get_client_count() if ws_manager else 0,
        },
    }


@app.get("/api/cards")
async def get_cards():
    """Get all card mappings"""
    try:
        mappings = card_mapping_service.get_all_mappings()
        return {
            "cards": {
                card_id: {
                    "type": mapping.type,
                    "data": mapping.data,
                    "name": mapping.name,
                }
                for card_id, mapping in mappings.items()
            }
        }
    except Exception as error:
        logger.error(f"Error fetching card mappings: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@app.post("/api/cards/{card_id}")
async def create_or_update_card(card_id: str, mapping: CardMappingCreate):
    """Create or update a card mapping"""
    try:
        await card_mapping_service.set_mapping(
            card_id, mapping.type, mapping.data, mapping.name
        )
        return {"success": True, "cardId": card_id, "type": mapping.type}
    except Exception as error:
        logger.error(f"Error setting card mapping: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@app.delete("/api/cards/{card_id}")
async def delete_card(card_id: str):
    """Delete a card mapping"""
    try:
        deleted = await card_mapping_service.delete_mapping(card_id)
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Card {card_id} not found")
        return {"success": True, "cardId": card_id}
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error deleting card mapping: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/api/favorites")
async def get_favorites():
    """Get Sonos favorites"""
    try:
        favorites = await sonos_service.get_favorites()
        return {"count": len(favorites), "favorites": favorites}
    except Exception as error:
        logger.error(f"Error fetching favorites: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# WebSocket endpoint


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            # Handle message
            await integration_service.handle_websocket_message(data, websocket)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as error:
        logger.error(f"WebSocket error: {error}")
        ws_manager.disconnect(websocket)


# Static file serving (production)
if NODE_ENV == "production":
    static_dir = Path(STATIC_FILES)
    if static_dir.exists():
        logger.info(f"Serving static files from: {static_dir}")

        # Serve assets directory
        app.mount(
            "/assets",
            StaticFiles(directory=str(static_dir / "assets")),
            name="assets",
        )

        # SPA fallback - serve index.html for all other routes
        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            index_file = static_dir / "index.html"
            if index_file.exists():
                return FileResponse(index_file)
            raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        reload=(NODE_ENV == "development"),
    )
