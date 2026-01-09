export interface CardReadEvent {
  type: 'card_read'
  cardId: string
  data: string
  timestamp: number
}

export interface WriteCompleteEvent {
  type: 'write_complete'
  success: boolean
  error?: string
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type RFIDEvent = CardReadEvent | WriteCompleteEvent | ErrorEvent

export interface WriteRequestCommand {
  type: 'write_request'
  data: string
}

export interface PingCommand {
  type: 'ping'
}

export type RFIDCommand = WriteRequestCommand | PingCommand
