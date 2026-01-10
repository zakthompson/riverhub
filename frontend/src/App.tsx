import { useWebSocket } from './hooks/useWebSocket'
import { useSonosState } from './hooks/useSonosState'
import { MediaControls } from './components/MediaControls'
import { Clock } from './components/Clock'
import './App.css'

function App() {
  const { sendMessage } = useWebSocket(10)
  const { sonosState } = useSonosState()

  const handlePlay = () => {
    sendMessage({ type: 'sonos_play' })
  }

  const handlePause = () => {
    sendMessage({ type: 'sonos_pause' })
  }

  const handleNext = () => {
    sendMessage({ type: 'sonos_next' })
  }

  const handlePrevious = () => {
    sendMessage({ type: 'sonos_previous' })
  }

  const handleStop = () => {
    sendMessage({ type: 'sonos_stop' })
  }

  const handleVolumeChange = (volume: number) => {
    sendMessage({ type: 'sonos_volume', volume })
  }

  // Show MediaControls when there's an active track
  if (sonosState?.currentTrack) {
    return (
      <MediaControls
        sonosState={sonosState}
        onPlay={handlePlay}
        onPause={handlePause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onStop={handleStop}
        onVolumeChange={handleVolumeChange}
      />
    )
  }

  // Show Clock when idle (no music playing)
  return <Clock />
}

export default App
