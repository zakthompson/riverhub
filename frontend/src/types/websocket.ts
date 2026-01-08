export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface CardReadMessage {
  type: 'card_read'
  cardId: string
  data: string
  timestamp: number
}

export interface WriteRequestMessage {
  type: 'write_request'
  data: string
}

export interface WriteCompleteMessage {
  type: 'write_complete'
  success: boolean
  error: string | null
}

export type WebSocketMessage = CardReadMessage | WriteCompleteMessage
export type OutgoingMessage = WriteRequestMessage
