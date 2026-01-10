export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// Sonos types
export interface TrackInfo {
  title: string
  artist: string
  album: string
  albumArtUri?: string
  duration?: number
  position?: number
}

export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'transitioning'

// Incoming messages (from backend)
export interface CardReadMessage {
  type: 'card_read'
  cardId: string
  data: string
  timestamp: number
}

export interface SonosStateMessage {
  type: 'sonos_state'
  isPlaying: boolean
  currentTrack: TrackInfo | null
  playbackState: PlaybackState
  volume: number
  speakerName: string | null
}

export interface WriteCompleteMessage {
  type: 'write_complete'
  success: boolean
  error?: string
}

export interface ErrorMessage {
  type: 'error'
  source: 'sonos' | 'rfid' | 'system'
  message: string
  code?: string
}

export type WebSocketMessage =
  | CardReadMessage
  | SonosStateMessage
  | WriteCompleteMessage
  | ErrorMessage

// Outgoing messages (to backend)
export interface WriteRequestMessage {
  type: 'write_request'
  data: string
}

export interface SonosPlayUrlMessage {
  type: 'sonos_play_url'
  url: string
}

export interface SonosControlMessage {
  type: 'sonos_play' | 'sonos_pause' | 'sonos_next' | 'sonos_previous' | 'sonos_stop'
}

export interface SonosVolumeMessage {
  type: 'sonos_volume'
  volume: number
}

export type OutgoingMessage =
  | WriteRequestMessage
  | SonosPlayUrlMessage
  | SonosControlMessage
  | SonosVolumeMessage
