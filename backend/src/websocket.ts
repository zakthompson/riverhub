import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { OutgoingMessage, IncomingMessage } from './types/websocket.types'

export class WSServer {
  private wss: WebSocketServer
  private clients: Set<WebSocket> = new Set()

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server })
    this.setupWebSocketServer()
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Frontend client connected')
      this.clients.add(ws)

      ws.on('message', (data: Buffer) => {
        try {
          const message: IncomingMessage = JSON.parse(data.toString())
          this.handleMessage(ws, message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      })

      ws.on('close', () => {
        console.log('Frontend client disconnected')
        this.clients.delete(ws)
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.clients.delete(ws)
      })
    })
  }

  private handleMessage(ws: WebSocket, message: IncomingMessage): void {
    // Messages are handled by the integration service
    // This event will be listened to by the integration service
    this.wss.emit('message', message, ws)
  }

  broadcast(message: OutgoingMessage): void {
    const data = JSON.stringify(message)

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data)
        } catch (error) {
          console.error('Failed to send message to client:', error)
        }
      }
    })
  }

  send(ws: WebSocket, message: OutgoingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message))
      } catch (error) {
        console.error('Failed to send message to specific client:', error)
      }
    }
  }

  onMessage(callback: (message: IncomingMessage, ws: WebSocket) => void): void {
    this.wss.on('message', callback)
  }

  getClientCount(): number {
    return this.clients.size
  }
}
