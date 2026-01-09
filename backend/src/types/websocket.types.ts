import type { TrackInfo, PlaybackState } from './sonos.types'

// Messages from backend to frontend
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

export type OutgoingMessage =
  | CardReadMessage
  | SonosStateMessage
  | WriteCompleteMessage
  | ErrorMessage

// Messages from frontend to backend
export interface SonosPlayUrlMessage {
  type: 'sonos_play_url'
  url: string
}

export interface SonosControlMessage {
  type: 'sonos_play' | 'sonos_pause' | 'sonos_next' | 'sonos_previous'
}

export interface SonosVolumeMessage {
  type: 'sonos_volume'
  volume: number
}

export interface WriteRequestMessage {
  type: 'write_request'
  data: string
}

export type IncomingMessage =
  | SonosPlayUrlMessage
  | SonosControlMessage
  | SonosVolumeMessage
  | WriteRequestMessage
