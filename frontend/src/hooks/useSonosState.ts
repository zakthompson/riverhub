import { useEffect, useState, useRef } from 'react'
import { getWebSocketClient } from '../services/websocket'
import type { SonosStateMessage } from '../types/websocket'

export interface UseSonosStateReturn {
  sonosState: SonosStateMessage | null
  sonosError: string | null
}

export function useSonosState(): UseSonosStateReturn {
  const [sonosState, setSonosState] = useState<SonosStateMessage | null>(null)
  const [sonosError, setSonosError] = useState<string | null>(null)
  const clientRef = useRef(getWebSocketClient())

  useEffect(() => {
    const client = clientRef.current

    const unsubscribe = client.onMessage((message) => {
      if (message.type === 'sonos_state') {
        setSonosState(message)
        setSonosError(null)
      }
      if (message.type === 'error' && message.source === 'sonos') {
        setSonosError(message.message)
      }
    })

    return () => unsubscribe()
  }, [])

  return { sonosState, sonosError }
}
