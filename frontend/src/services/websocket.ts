import type { WebSocketMessage, OutgoingMessage } from '../types/websocket'

export type MessageHandler = (message: WebSocketMessage) => void
export type StatusChangeHandler = (
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private messageHandlers: Set<MessageHandler> = new Set()
  private statusChangeHandlers: Set<StatusChangeHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private reconnectTimeout: number | null = null
  private shouldReconnect = true

  constructor(url: string) {
    this.url = url
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected')
      return
    }

    this.notifyStatusChange('connecting')
    console.log(`Connecting to WebSocket: ${this.url}`)

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.notifyStatusChange('connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage
          console.log('WebSocket message received:', message)
          this.notifyMessageHandlers(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.notifyStatusChange('error')
      }

      this.ws.onclose = () => {
        console.log('WebSocket closed')
        this.notifyStatusChange('disconnected')
        this.attemptReconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      this.notifyStatusChange('error')
      this.attemptReconnect()
    }
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(message: OutgoingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
      console.log('WebSocket message sent:', message)
    } else {
      console.error('WebSocket is not connected. Cannot send message.')
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusChangeHandlers.add(handler)
    return () => this.statusChangeHandlers.delete(handler)
  }

  private notifyMessageHandlers(message: WebSocketMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message)
      } catch (error) {
        console.error('Error in message handler:', error)
      }
    })
  }

  private notifyStatusChange(status: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    this.statusChangeHandlers.forEach((handler) => {
      try {
        handler(status)
      } catch (error) {
        console.error('Error in status change handler:', error)
      }
    })
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.notifyStatusChange('error')
      return
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    )

    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, delay) as unknown as number
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }
}

let wsClient: WebSocketClient | null = null

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8765/ws'
    wsClient = new WebSocketClient(wsUrl)
  }
  return wsClient
}
