import asyncio
import logging
from typing import Optional, Callable, List, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TrackInfo:
    """Information about currently playing track"""
    title: str
    artist: str
    album: str
    album_art_uri: Optional[str] = None
    duration: Optional[str] = None
    position: Optional[str] = None


@dataclass
class SonosState:
    """Current Sonos player state"""
    playback_state: str  # 'PLAYING', 'PAUSED_PLAYBACK', 'STOPPED'
    current_track: Optional[TrackInfo]
    volume: int
    is_playing: bool
    speaker_name: str


class SonosService:
    """
    Sonos control using SoCo library.
    Handles speaker discovery, playback control, and state polling.
    """

    POLLING_INTERVAL = 1.5  # seconds

    def __init__(self, speaker_name: str):
        self.speaker_name = speaker_name
        self.speaker: Optional[Any] = None  # SoCo speaker instance
        self._polling = False
        self._polling_task: Optional[asyncio.Task] = None
        self._discovering = False

    async def initialize(self) -> None:
        """Initialize Sonos service by discovering speaker"""
        await self.discover_speaker()

    async def discover_speaker(self) -> None:
        """Discover Sonos speaker on network by name"""
        if self.speaker or self._discovering:
            return

        self._discovering = True
        try:
            logger.info("Discovering Sonos speakers on network...")

            # Import here to avoid issues if soco not installed
            import soco

            # Discover all speakers (blocking call)
            devices = await asyncio.to_thread(soco.discovery.discover, timeout=5)

            if not devices:
                raise RuntimeError("No Sonos speakers found on network")

            logger.info(f"Found {len(devices)} Sonos speaker(s)")

            # Find speaker matching our configured name
            for device in devices:
                name = await asyncio.to_thread(lambda: device.player_name)
                logger.info(f"  - {name}")

                if name == self.speaker_name:
                    self.speaker = device
                    logger.info(f"✓ Connected to Sonos speaker: {self.speaker_name}")
                    return

            # If we get here, speaker wasn't found
            available_names = [await asyncio.to_thread(lambda d=d: d.player_name) for d in devices]
            raise RuntimeError(
                f'Speaker "{self.speaker_name}" not found. '
                f'Available speakers: {", ".join(available_names)}'
            )

        except Exception as error:
            logger.error(f"Error discovering Sonos speaker: {error}")
            logger.error(
                "Make sure the Sonos speaker is on the network and "
                "SONOS_SPEAKER_NAME in .env matches exactly."
            )
            raise
        finally:
            self._discovering = False

    async def get_favorites(self) -> List[Dict[str, str]]:
        """Get all Sonos Favorites"""
        await self._ensure_device_ready()

        try:
            # Get favorites from Sonos music library (blocking)
            favorites_result = await asyncio.to_thread(
                self.speaker.music_library.get_sonos_favorites
            )

            # Convert to simple dict format
            favorites = [
                {"title": fav.title, "uri": fav.resources[0].uri}
                for fav in favorites_result
                if fav.resources
            ]

            logger.info(f"Found {len(favorites)} Sonos favorites")
            return favorites

        except Exception as error:
            logger.error(f"Error getting Sonos favorites: {error}")
            raise

    async def play_favorite_by_title(self, title: str) -> None:
        """
        Play a favorite by its title.
        Fetches all favorites and plays the one matching the title.
        """
        await self._ensure_device_ready()

        try:
            # Get all favorites
            favorites = await self.get_favorites()

            # Find matching favorite (case-insensitive)
            matching_favorite = None
            for fav in favorites:
                if fav["title"].lower() == title.lower():
                    matching_favorite = fav
                    break

            if not matching_favorite:
                raise ValueError(f'Favorite "{title}" not found')

            logger.info(f"Playing favorite: {matching_favorite['title']}")

            # Use add_uri_to_queue for favorites/playlists, then play from queue
            uri = matching_favorite["uri"]

            # Clear queue and add favorite
            await asyncio.to_thread(self.speaker.clear_queue)
            await asyncio.to_thread(self.speaker.add_uri_to_queue, uri)

            # Play from queue
            await asyncio.to_thread(self.speaker.play_from_queue, 0)

        except Exception as error:
            logger.error(f"Error playing favorite by title: {error}")
            raise

    async def play_url(self, url: str) -> None:
        """Play a URL/URI directly"""
        await self._ensure_device_ready()

        try:
            logger.info(f"Playing URL: {url}")

            # Handle Apple Music share links with ShareLinkPlugin
            if self._is_apple_music_url(url):
                logger.info("Detected Apple Music URL, using ShareLinkPlugin")
                await self._play_apple_music_sharelink(url)
            # For URIs that need queueing (playlists, albums, etc.)
            elif self._needs_queueing(url):
                await asyncio.to_thread(self.speaker.clear_queue)
                await asyncio.to_thread(self.speaker.add_uri_to_queue, url)
                await asyncio.to_thread(self.speaker.play_from_queue, 0)
            else:
                # Direct playback for tracks
                await asyncio.to_thread(self.speaker.play_uri, url)

        except Exception as error:
            logger.error(f"Error playing URL: {error}")
            raise

    async def _play_apple_music_sharelink(self, url: str) -> None:
        """Play Apple Music share link using ShareLinkPlugin"""
        try:
            # Import ShareLinkPlugin
            from soco.plugins.sharelink import ShareLinkPlugin

            # Clear the queue
            logger.info("Clearing Sonos queue for Apple Music link")
            await asyncio.to_thread(self.speaker.clear_queue)

            # Initialize ShareLinkPlugin and add to queue
            logger.info(f"Adding Apple Music link to queue: {url}")
            sharelink = ShareLinkPlugin(self.speaker)
            position = await asyncio.to_thread(
                sharelink.add_share_link_to_queue, url
            )

            logger.info(f"Apple Music link added at queue position {position}")

            # Play from the start of the queue
            await asyncio.to_thread(self.speaker.play_from_queue, 0)
            logger.info("Started playback from queue")

        except ImportError:
            logger.error("ShareLinkPlugin not available. Update SoCo to version 0.26.0+")
            raise RuntimeError(
                "ShareLinkPlugin not available. Please update SoCo to version 0.26.0 or later."
            )
        except Exception as error:
            logger.error(f"Error playing Apple Music share link: {error}")
            raise

    def _is_apple_music_url(self, url: str) -> bool:
        """Check if URL is an Apple Music share link"""
        return "music.apple.com" in url.lower()

    def _needs_queueing(self, url: str) -> bool:
        """Check if URL needs to be queued vs played directly"""
        return (
            url.startswith("x-rincon-cpcontainer:")
            or url.startswith("x-sonosapi-stream:")
            or url.startswith("x-sonosapi-radio:")
            or url.startswith("x-rincon-playlist:")
            or "album" in url.lower()
            or "playlist" in url.lower()
        )

    async def play(self) -> None:
        """Resume playback"""
        await self._ensure_device_ready()
        await asyncio.to_thread(self.speaker.play)

    async def pause(self) -> None:
        """Pause playback"""
        await self._ensure_device_ready()
        await asyncio.to_thread(self.speaker.pause)

    async def next(self) -> None:
        """Skip to next track"""
        await self._ensure_device_ready()
        await asyncio.to_thread(self.speaker.next)

    async def previous(self) -> None:
        """Go to previous track"""
        await self._ensure_device_ready()
        await asyncio.to_thread(self.speaker.previous)

    async def get_volume(self) -> int:
        """Get current volume (0-100)"""
        await self._ensure_device_ready()
        return await asyncio.to_thread(lambda: self.speaker.volume)

    async def set_volume(self, volume: int) -> None:
        """Set volume (0-100)"""
        await self._ensure_device_ready()
        await asyncio.to_thread(setattr, self.speaker, "volume", volume)

    async def get_current_track(self) -> Optional[TrackInfo]:
        """Get currently playing track info"""
        await self._ensure_device_ready()

        try:
            track_info = await asyncio.to_thread(self.speaker.get_current_track_info)

            if not track_info or not track_info.get("title"):
                return None

            return TrackInfo(
                title=track_info.get("title", "Unknown"),
                artist=track_info.get("artist", "Unknown Artist"),
                album=track_info.get("album", "Unknown Album"),
                album_art_uri=track_info.get("album_art"),
                duration=track_info.get("duration"),
                position=track_info.get("position"),
            )
        except Exception as error:
            logger.error(f"Error getting current track: {error}")
            return None

    async def get_playback_state(self) -> str:
        """Get current playback state"""
        await self._ensure_device_ready()

        try:
            state = await asyncio.to_thread(self.speaker.get_current_transport_info)
            return state.get("current_transport_state", "STOPPED")
        except Exception as error:
            logger.error(f"Error getting playback state: {error}")
            return "STOPPED"

    async def get_current_state(self) -> SonosState:
        """Get complete current state"""
        playback_state = await self.get_playback_state()
        current_track = await self.get_current_track()
        volume = await self.get_volume()

        return SonosState(
            playback_state=playback_state,
            current_track=current_track,
            volume=volume,
            is_playing=playback_state == "PLAYING",
            speaker_name=self.speaker_name,
        )

    async def start_polling(self, callback: Callable[[SonosState], None]) -> None:
        """Start polling Sonos state and calling callback with updates"""
        if self._polling:
            return

        self._polling = True
        self._polling_task = asyncio.create_task(self._poll_loop(callback))
        logger.info("Started Sonos state polling")

    def stop_polling(self) -> None:
        """Stop polling Sonos state"""
        self._polling = False
        if self._polling_task:
            self._polling_task.cancel()
            self._polling_task = None
        logger.info("Stopped Sonos state polling")

    async def _poll_loop(self, callback: Callable[[SonosState], None]) -> None:
        """Background task that polls Sonos state"""
        while self._polling:
            try:
                if self.speaker:
                    state = await self.get_current_state()
                    await callback(state)
            except asyncio.CancelledError:
                break
            except Exception as error:
                logger.error(f"Error polling Sonos state: {error}")

            await asyncio.sleep(self.POLLING_INTERVAL)

    async def _ensure_device_ready(self) -> None:
        """Ensure speaker is discovered and ready"""
        if not self.speaker:
            await self.discover_speaker()

    def is_connected(self) -> bool:
        """Check if connected to speaker"""
        return self.speaker is not None
