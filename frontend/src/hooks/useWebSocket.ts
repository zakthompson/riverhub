import { useEffect, useState, useCallback, useRef } from 'react'
import { getWebSocketClient } from '../services/websocket'
import type { WebSocketMessage, OutgoingMessage } from '../types/websocket'
import type { WebSocketStatus } from '../types/websocket'

export interface UseWebSocketReturn {
  status: WebSocketStatus
  lastMessage: WebSocketMessage | null
  messages: WebSocketMessage[]
  sendMessage: (message: OutgoingMessage) => void
  isConnected: boolean
}

export function useWebSocket(maxMessages = 10): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('connecting')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [messages, setMessages] = useState<WebSocketMessage[]>([])
  const clientRef = useRef(getWebSocketClient())

  useEffect(() => {
    const client = clientRef.current

    const unsubscribeStatus = client.onStatusChange((newStatus) => {
      setStatus(newStatus)
    })

    const unsubscribeMessage = client.onMessage((message) => {
      setLastMessage(message)
      setMessages((prev) => [...prev, message].slice(-maxMessages))
    })

    client.connect()

    return () => {
      unsubscribeStatus()
      unsubscribeMessage()
      client.disconnect()
    }
  }, [maxMessages])

  const sendMessage = useCallback((message: OutgoingMessage) => {
    clientRef.current.send(message)
  }, [])

  return {
    status,
    lastMessage,
    messages,
    sendMessage,
    isConnected: status === 'connected',
  }
}
