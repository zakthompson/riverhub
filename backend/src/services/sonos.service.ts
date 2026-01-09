import { EventEmitter } from 'events';
import { AsyncDeviceDiscovery, Sonos } from 'sonos';
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
      const availableNames = await Promise.all(devices.map((d) => d.getName()));
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

  async playUrl(url: string): Promise<void> {
    await this.ensureDeviceReady();

    try {
      console.log(`Playing URL: ${url}`);
      await this.device!.play(url);
    } catch (error) {
      console.error('Error playing URL:', error);
      throw this.formatError(error);
    }
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
