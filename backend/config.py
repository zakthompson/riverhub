import os
from typing import Literal

from dotenv import load_dotenv

load_dotenv()


class Config:
    WS_PORT: int = int(os.getenv("WS_PORT", "8765"))
    RFID_POLL_INTERVAL: float = float(os.getenv("RFID_POLL_INTERVAL", "0.5"))
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = os.getenv(
        "LOG_LEVEL", "INFO"
    ).upper()  # type: ignore


config = Config()
