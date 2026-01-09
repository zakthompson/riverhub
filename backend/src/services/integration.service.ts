import type { RFIDService } from './rfid.service'
import type { SonosService } from './sonos.service'
import type { CardMappingService } from './card-mapping.service'
import type { WSServer } from '../websocket'
import type { RFIDEvent } from '../types/rfid.types'
import type { SonosState } from '../types/sonos.types'
import type { IncomingMessage } from '../types/websocket.types'
import type { WebSocket } from 'ws'

export class IntegrationService {
  constructor(
    private rfid: RFIDService,
    private sonos: SonosService,
    private cardMappings: CardMappingService,
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
      console.log(`Card read: ${event.cardId}`)

      // Look up card mapping
      const mapping = this.cardMappings.getMapping(event.cardId)

      if (!mapping) {
        console.warn(`No mapping found for card ${event.cardId}`)
        this.ws.broadcast({
          type: 'card_read',
          cardId: event.cardId,
          data: null,
          timestamp: event.timestamp,
          error: 'Card not registered',
        })
        return
      }

      console.log(`Card ${event.cardId} mapped to ${mapping.type} action`)

      // Broadcast card read to frontend
      this.ws.broadcast({
        type: 'card_read',
        cardId: event.cardId,
        data: mapping.data,
        actionType: mapping.type,
        name: mapping.name,
        timestamp: event.timestamp,
      })

      // Execute action based on type
      await this.executeCardAction(mapping)
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

  private async executeCardAction(
    mapping: import('../types/card-mapping.types').CardMapping,
  ): Promise<void> {
    try {
      switch (mapping.type) {
        case 'sonos':
          // Play Sonos content
          if (typeof mapping.data === 'string') {
            // Check if it's a URI or a favorite title
            if (this.isUri(mapping.data)) {
              await this.sonos.playUrl(mapping.data)
            } else {
              // Treat as favorite title
              await this.sonos.playFavoriteByTitle(mapping.data)
            }
          } else {
            console.error('Invalid Sonos data format - expected string')
          }
          break

        // Future integrations will go here:
        // case 'lights':
        //   await this.lights.setScene(mapping.data)
        //   break

        default:
          console.warn(`Unknown action type: ${mapping.type}`)
      }
    } catch (error) {
      console.error(`Failed to execute ${mapping.type} action:`, error)
      this.ws.broadcast({
        type: 'error',
        source: mapping.type,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private isUri(str: string): boolean {
    // Check if string looks like a URI (has a scheme)
    return (
      str.startsWith('x-') ||
      str.startsWith('http://') ||
      str.startsWith('https://') ||
      str.startsWith('spotify:') ||
      str.includes('://')
    )
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

}
