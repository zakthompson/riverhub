import type { RFIDService } from './rfid.service'
import type { SonosService } from './sonos.service'
import type { WSServer } from '../websocket'
import type { RFIDEvent } from '../types/rfid.types'
import type { SonosState } from '../types/sonos.types'
import type { IncomingMessage } from '../types/websocket.types'
import type { WebSocket } from 'ws'

export class IntegrationService {
  constructor(
    private rfid: RFIDService,
    private sonos: SonosService,
    private ws: WSServer,
  ) {
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // RFID events → Sonos actions + Frontend notifications
    this.rfid.on('event', (event: RFIDEvent) => {
      this.handleRFIDEvent(event)
    })

    // Sonos state changes → Frontend updates
    this.sonos.on('state', (state: SonosState) => {
      this.ws.broadcast({
        type: 'sonos_state',
        ...state,
      })
    })

    // Frontend messages → RFID/Sonos actions
    this.ws.onMessage((message: IncomingMessage, client: WebSocket) => {
      this.handleFrontendMessage(message, client)
    })

    console.log('Integration service event handlers setup complete')
  }

  private async handleRFIDEvent(event: RFIDEvent): Promise<void> {
    if (event.type === 'card_read') {
      console.log(`Card read: ${event.cardId} -> ${event.data}`)

      // Broadcast card read to frontend
      this.ws.broadcast({
        type: 'card_read',
        cardId: event.cardId,
        data: event.data,
        timestamp: event.timestamp,
      })

      // Auto-play on Sonos if data looks like a URL
      if (event.data && this.isValidPlaylistUrl(event.data)) {
        try {
          await this.sonos.playUrl(event.data)
        } catch (error) {
          console.error('Failed to play URL on Sonos:', error)
          this.ws.broadcast({
            type: 'error',
            source: 'sonos',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
    } else if (event.type === 'write_complete') {
      // Forward write completion to frontend
      this.ws.broadcast({
        type: 'write_complete',
        success: event.success,
        error: event.error,
      })
    } else if (event.type === 'error') {
      // Forward RFID errors to frontend
      this.ws.broadcast({
        type: 'error',
        source: 'rfid',
        message: event.message,
      })
    }
  }

  private async handleFrontendMessage(
    message: IncomingMessage,
    client: WebSocket,
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'sonos_play_url':
          await this.sonos.playUrl(message.url)
          break

        case 'sonos_play':
          await this.sonos.play()
          break

        case 'sonos_pause':
          await this.sonos.pause()
          break

        case 'sonos_next':
          await this.sonos.next()
          break

        case 'sonos_previous':
          await this.sonos.previous()
          break

        case 'sonos_volume':
          await this.sonos.setVolume(message.volume)
          break

        case 'write_request':
          this.rfid.sendCommand({
            type: 'write_request',
            data: message.data,
          })
          break

        default:
          console.warn('Unknown message type:', (message as any).type)
      }
    } catch (error) {
      console.error('Error handling frontend message:', error)
      this.ws.send(client, {
        type: 'error',
        source: 'system',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private isValidPlaylistUrl(url: string): boolean {
    // Check for Spotify URIs or URLs
    if (url.startsWith('spotify:')) return true
    if (url.includes('spotify.com')) return true

    // Check for Apple Music URLs
    if (url.includes('music.apple.com')) return true

    // Check for generic http(s) URLs
    if (url.startsWith('http://') || url.startsWith('https://')) return true

    return false
  }
}
