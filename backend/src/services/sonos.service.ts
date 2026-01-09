import { EventEmitter } from 'events';
import { AsyncDeviceDiscovery, Sonos } from 'sonos';
import { parseStringPromise, Builder } from 'xml2js';
import type {
  TrackInfo,
  PlaybackState,
  SonosError,
  SonosState,
} from '../types/sonos.types';

const POLLING_INTERVAL = 1500; // 1.5 seconds

export class SonosService extends EventEmitter {
  private device: Sonos | null = null;
  private speakerName: string;
  private isDiscovering = false;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(speakerName: string) {
    super();
    this.speakerName = speakerName;
  }

  async initialize(): Promise<void> {
    await this.discoverSpeaker();
    this.startPolling();
  }

  private async discoverSpeaker(): Promise<void> {
    if (this.device || this.isDiscovering) return;

    this.isDiscovering = true;
    try {
      console.log(`Discovering Sonos speakers on network...`);

      // Create discovery instance and discover all devices
      const discovery = new AsyncDeviceDiscovery();
      const devices = await discovery.discoverMultiple({
        timeout: 5000,
      });

      console.log(`Found ${devices.length} Sonos speaker(s)`);

      // Find the speaker with matching name
      for (const device of devices) {
        const name = await device.getName();
        console.log(`  - ${name}`);

        if (name === this.speakerName) {
          this.device = device;
          console.log(`✓ Connected to Sonos speaker: ${this.speakerName}`);
          return;
        }
      }

      // If we get here, the speaker wasn't found
      const availableNames = await Promise.all(devices.map((d: Sonos) => d.getName()));
      throw new Error(
        `Speaker "${this.speakerName}" not found. Available speakers: ${availableNames.join(', ')}`
      );
    } catch (error) {
      console.error('Error discovering Sonos speaker:', error);
      console.error(
        'Make sure the Sonos speaker is on the network and SONOS_SPEAKER_NAME in .env matches exactly.'
      );
      throw this.formatError(error);
    } finally {
      this.isDiscovering = false;
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      if (!this.device) return;

      try {
        const [playbackState, currentTrack, volume] = await Promise.all([
          this.getPlaybackState(),
          this.getCurrentTrack(),
          this.getVolume(),
        ]);

        const state: SonosState = {
          playbackState,
          currentTrack,
          volume,
          isPlaying: playbackState === 'playing',
          speakerName: this.speakerName,
        };

        this.emit('state', state);
      } catch (error) {
        console.error('Error polling Sonos state:', error);
      }
    }, POLLING_INTERVAL);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Get all Sonos Favorites
   * Returns list of favorites with their titles and URIs
   */
  async getFavorites(): Promise<Array<{ title: string; uri: string }>> {
    await this.ensureDeviceReady();

    try {
      const result = await this.device!.getFavorites();
      console.log(`Found ${result.items?.length || 0} Sonos favorites`);
      return result.items || [];
    } catch (error) {
      console.error('Error getting Sonos favorites:', error);
      throw this.formatError(error);
    }
  }

  /**
   * Play a favorite by its title
   * This fetches favorites with RAW metadata and plays the matching one
   */
  async playFavoriteByTitle(title: string): Promise<void> {
    await this.ensureDeviceReady();

    try {
      // Get raw Browse result with full DIDL-Lite metadata (not parsed)
      const browseResult = await this.device!.contentDirectoryService().Browse({
        ObjectID: 'FV:2',
        BrowseFlag: 'BrowseDirectChildren',
        Filter: '*',
        StartingIndex: '0',
        RequestedCount: '100',
        SortCriteria: '',
      });

      // Parse the DIDL-Lite XML to find our favorite
      const parsed = await parseStringPromise(browseResult.Result);

      const items = parsed['DIDL-Lite']?.container || parsed['DIDL-Lite']?.item || [];
      const itemArray = Array.isArray(items) ? items : [items];

      // Find matching favorite by title
      let matchedItem = null;
      for (const item of itemArray) {
        const itemTitle = item['dc:title']?.[0] || '';
        if (itemTitle.toLowerCase() === title.toLowerCase()) {
          matchedItem = item;
          break;
        }
      }

      if (!matchedItem) {
        throw new Error(`Favorite "${title}" not found`);
      }

      console.log(`Playing favorite: ${matchedItem['dc:title'][0]}`);

      // Extract URI from the item
      const uri = matchedItem.res?.[0]?._ || matchedItem.res?.[0];

      if (!uri) {
        throw new Error('No URI found in favorite item');
      }

      // Reconstruct the ORIGINAL DIDL-Lite for this item
      const builder = new Builder();
      const didlLite = {
        'DIDL-Lite': {
          $: parsed['DIDL-Lite'].$, // Copy namespaces
          container: matchedItem,
        },
      };
      const metadata = builder.buildObject(didlLite);

      console.log(`URI: ${uri}`);
      console.log(`Metadata: ${metadata.substring(0, 200)}...`);

      // Use setAVTransportURI with the ORIGINAL metadata
      await this.device!.setAVTransportURI({
        uri: uri,
        metadata: metadata,
        onlySetUri: false,
      });
    } catch (error) {
      console.error('Error playing favorite by title:', error);
      throw this.formatError(error);
    }
  }

  async playUrl(url: string): Promise<void> {
    await this.ensureDeviceReady();

    try {
      // Favorites and queued content need special handling
      if (this.isFavoriteUri(url)) {
        console.log(`Playing favorite/queued content: ${url}`);
        await this.playFavorite(url);
      } else {
        // Direct playback for simple URIs (spotify:track:xxx, etc.)
        console.log(`Playing URL directly: ${url}`);
        await this.device!.play(url);
      }
    } catch (error) {
      console.error('Error playing URL:', error);
      throw this.formatError(error);
    }
  }

  private isFavoriteUri(url: string): boolean {
    // Favorites and containers need to be queued
    return (
      url.startsWith('x-rincon-cpcontainer:') ||
      url.startsWith('x-sonosapi-stream:') ||
      url.startsWith('x-sonosapi-radio:') ||
      url.startsWith('x-rincon-playlist:')
    );
  }

  private async playFavorite(url: string): Promise<void> {
    // For library playlists and other containers, use setAVTransportURI with proper metadata
    const metadata = this.generateContainerMetadata(url);

    await this.device!.setAVTransportURI({
      uri: url,
      metadata: metadata,
      onlySetUri: false, // Will automatically call play()
    });
  }

  private generateContainerMetadata(uri: string): string {
    // Extract the container ID from the URI
    // Example: x-rincon-cpcontainer:1006206clibraryplaylist%3Ap.VJabuoWQJ44?sid=204&flags=8300&sn=1
    const match = uri.match(/^x-rincon-cpcontainer:(.*?)(\?|$)/);
    const containerId = match ? match[1] : uri.replace('x-rincon-cpcontainer:', '');

    // Generate DIDL-Lite metadata for container
    return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">` +
      `<container id="${containerId}" parentID="" restricted="true">` +
      `<dc:title></dc:title>` +
      `<upnp:class>object.container.playlistContainer</upnp:class>` +
      `<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/"></desc>` +
      `</container>` +
      `</DIDL-Lite>`;
  }

  async play(): Promise<void> {
    await this.ensureDeviceReady();

    try {
      await this.device!.play();
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async pause(): Promise<void> {
    await this.ensureDeviceReady();

    try {
      await this.device!.pause();
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async next(): Promise<void> {
    await this.ensureDeviceReady();

    try {
      await this.device!.next();
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async previous(): Promise<void> {
    await this.ensureDeviceReady();

    try {
      await this.device!.previous();
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async setVolume(volume: number): Promise<void> {
    await this.ensureDeviceReady();

    try {
      await this.device!.setVolume(volume);
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getVolume(): Promise<number> {
    await this.ensureDeviceReady();

    try {
      return await this.device!.getVolume();
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getCurrentTrack(): Promise<TrackInfo | null> {
    await this.ensureDeviceReady();

    try {
      const track = await this.device!.currentTrack();

      if (!track || !track.title) {
        return null;
      }

      return {
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        albumArtUri: track.albumArtUri,
        duration: track.duration,
        position: track.position,
      };
    } catch (error) {
      console.error('Error getting current track:', error);
      return null;
    }
  }

  async getPlaybackState(): Promise<PlaybackState> {
    await this.ensureDeviceReady();

    try {
      const state = await this.device!.getCurrentState();

      switch (state) {
        case 'playing':
          return 'playing';
        case 'paused':
          return 'paused';
        case 'stopped':
          return 'stopped';
        case 'transitioning':
          return 'transitioning';
        default:
          return 'stopped';
      }
    } catch (error) {
      console.error('Error getting playback state:', error);
      return 'stopped';
    }
  }

  private async ensureDeviceReady(): Promise<void> {
    if (!this.device) {
      await this.discoverSpeaker();
    }
  }

  private formatError(error: unknown): SonosError {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'code' in error ? String(error.code) : undefined,
      };
    }
    return {
      message: String(error),
    };
  }

  getSpeakerName(): string {
    return this.speakerName;
  }

  isConnected(): boolean {
    return this.device !== null;
  }
}
