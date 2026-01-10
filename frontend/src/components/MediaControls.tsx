import { useState } from 'react'
import type { SonosStateMessage } from '../types/websocket'

interface MediaControlsProps {
  sonosState: SonosStateMessage
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onVolumeChange: (volume: number) => void
}

export function MediaControls({
  sonosState,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onVolumeChange,
}: MediaControlsProps) {
  const [pendingIsPlaying, setPendingIsPlaying] = useState<boolean | null>(null)
  const [pendingVolume, setPendingVolume] = useState<number | null>(null)

  // Derive display state: use pending value if it differs from server state
  // Once server state catches up, automatically use server state instead
  const displayIsPlaying =
    pendingIsPlaying !== null && pendingIsPlaying !== sonosState.isPlaying
      ? pendingIsPlaying
      : sonosState.isPlaying

  const displayVolume =
    pendingVolume !== null && Math.abs(pendingVolume - sonosState.volume) >= 2
      ? pendingVolume
      : sonosState.volume

  const handlePlayPause = () => {
    const newState = !displayIsPlaying
    setPendingIsPlaying(newState)
    if (newState) {
      onPlay()
    } else {
      onPause()
    }
  }

  const handleNext = () => {
    onNext()
  }

  const handlePrevious = () => {
    onPrevious()
  }

  const handleVolumeUp = () => {
    const newVolume = Math.min(100, displayVolume + 2)
    setPendingVolume(newVolume)
    onVolumeChange(newVolume)
  }

  const handleVolumeDown = () => {
    const newVolume = Math.max(0, displayVolume - 2)
    setPendingVolume(newVolume)
    onVolumeChange(newVolume)
  }

  const { currentTrack } = sonosState

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-pink-900 via-pink-500 to-pink-900 p-8 text-white">
      <div className="flex h-full w-full max-w-6xl items-center gap-12">
        {/* Left Side - Album Art */}
        <div className="flex h-full flex-1 items-center justify-center">
          {currentTrack?.albumArtUri ? (
            <img
              src={currentTrack.albumArtUri}
              alt={currentTrack.album || 'Album art'}
              className="max-h-full w-full max-w-lg rounded-3xl object-contain shadow-2xl"
            />
          ) : (
            <div className="flex aspect-square w-full max-w-lg items-center justify-center rounded-3xl bg-gray-800 shadow-2xl">
              <svg
                className="h-32 w-32 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Right Side - Controls and Info */}
        <div className="flex flex-1 flex-col justify-center gap-8">
          {/* Track Info */}
          {currentTrack && (
            <div className="text-left">
              <h2 className="mb-2 line-clamp-2 text-4xl font-bold">{currentTrack.title}</h2>
              <p className="line-clamp-1 text-2xl text-gray-300">{currentTrack.artist}</p>
              {currentTrack.album && (
                <p className="line-clamp-1 text-xl text-gray-400">{currentTrack.album}</p>
              )}
            </div>
          )}

          {/* Playback Controls */}
          <div className="flex items-center gap-6">
            <button
              onClick={handlePrevious}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
              aria-label="Previous track"
            >
              <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              onClick={handlePlayPause}
              className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-pink-500 shadow-xl transition-all hover:scale-105 active:scale-95"
              aria-label={displayIsPlaying ? 'Pause' : 'Play'}
            >
              {displayIsPlaying ? (
                <svg className="h-14 w-14" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="h-14 w-14" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleNext}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
              aria-label="Next track"
            >
              <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          {/* Volume Control */}
          <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
                <span className="text-lg font-semibold">Volume</span>
              </div>
              <span className="text-2xl font-bold">{displayVolume}%</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleVolumeDown}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20 active:scale-95"
                aria-label="Volume down"
              >
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 13H5v-2h14v2z" />
                </svg>
              </button>
              <div className="relative flex-1">
                <div
                  className="h-3 rounded-full bg-white/20"
                  style={{
                    background: `linear-gradient(to right, white ${displayVolume}%, rgba(255,255,255,0.2) ${displayVolume}%)`,
                  }}
                />
              </div>
              <button
                onClick={handleVolumeUp}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20 active:scale-95"
                aria-label="Volume up"
              >
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Speaker Name */}
          <div className="text-left text-sm text-gray-400">Playing on {sonosState.speakerName}</div>
        </div>
      </div>
    </div>
  )
}
