export interface TrackInfo {
  title: string
  artist: string
  album: string
  albumArtUri?: string
  duration?: number
  position?: number
}

export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'transitioning'

export interface SonosState {
  isPlaying: boolean
  currentTrack: TrackInfo | null
  playbackState: PlaybackState
  volume: number
  speakerName: string | null
}

export interface SonosError {
  message: string
  code?: string
}
