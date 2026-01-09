import os
from typing import Literal

from dotenv import load_dotenv

load_dotenv()


class Config:
    WS_PORT: int = int(os.getenv("WS_PORT", "8765"))
    RFID_POLL_INTERVAL: float = float(os.getenv("RFID_POLL_INTERVAL", "0.5"))
    RFID_MODE: Literal["real", "mock"] = os.getenv("RFID_MODE", "real").lower()  # type: ignore
    RFID_DEBOUNCE_SECONDS: float = float(os.getenv("RFID_DEBOUNCE_SECONDS", "2.0"))
    SERVE_STATIC: bool = os.getenv("SERVE_STATIC", "false").lower() == "true"
    STATIC_DIR: str = os.getenv("STATIC_DIR", "../frontend/dist")
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = os.getenv(
        "LOG_LEVEL", "INFO"
    ).upper()  # type: ignore


config = Config()
