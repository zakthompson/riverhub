import { useEffect, useState } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import './App.css'

function App() {
  const { status, lastMessage, messages, sendMessage, isConnected } = useWebSocket(10)
  const [writeData, setWriteData] = useState('')

  useEffect(() => {
    if (lastMessage) {
      console.log('📨 Message received:', lastMessage)
    }
  }, [lastMessage])

  const handleWriteRequest = () => {
    if (!writeData.trim()) {
      alert('Please enter data to write')
      return
    }

    sendMessage({
      type: 'write_request',
      data: writeData,
    })
    setWriteData('')
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-500'
      case 'connecting':
        return 'text-yellow-500'
      case 'disconnected':
        return 'text-gray-500'
      case 'error':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return '● Connected'
      case 'connecting':
        return '○ Connecting...'
      case 'disconnected':
        return '○ Disconnected'
      case 'error':
        return '✗ Error'
      default:
        return '○ Unknown'
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">RiverHub</h1>
          <p className="text-gray-400">RFID Music Controller</p>
        </header>

        <div className="mb-6 rounded-lg bg-gray-800 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">WebSocket Status</h2>
            <span className={`font-mono ${getStatusColor()}`}>{getStatusText()}</span>
          </div>
          <p className="text-sm text-gray-400">
            {isConnected
              ? 'Connected to RFID backend. Waiting for card scans...'
              : 'Not connected. Check that the backend is running.'}
          </p>
        </div>

        <div className="mb-6 rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Write Card</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={writeData}
              onChange={(e) => setWriteData(e.target.value)}
              placeholder="Enter playlist URL (e.g., spotify:playlist:abc123)"
              className="flex-1 rounded border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              disabled={!isConnected}
            />
            <button
              onClick={handleWriteRequest}
              disabled={!isConnected}
              className="rounded bg-blue-600 px-6 py-2 font-semibold transition-colors hover:bg-blue-700 disabled:bg-gray-600"
            >
              Write
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {isConnected ? 'Place card on reader and click Write' : 'Connect to backend first'}
          </p>
        </div>

        <div className="rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Recent Messages ({messages.length})</h2>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                No messages yet. Waiting for card scans...
              </p>
            ) : (
              messages
                .slice()
                .reverse()
                .map((msg, idx) => (
                  <div key={idx} className="rounded bg-gray-700 p-3 font-mono text-sm">
                    <div className="mb-1 flex items-start justify-between">
                      <span className="font-semibold text-blue-400">{msg.type}</span>
                      {msg.type === 'card_read' && (
                        <span className="text-xs text-gray-400">
                          {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {msg.type === 'card_read' && (
                      <>
                        <div className="text-gray-300">
                          <span className="text-gray-500">Card ID:</span> {msg.cardId}
                        </div>
                        <div className="text-gray-300">
                          <span className="text-gray-500">Data:</span> {msg.data}
                        </div>
                      </>
                    )}
                    {msg.type === 'write_complete' && (
                      <>
                        <div className="text-gray-300">
                          <span className="text-gray-500">Success:</span>{' '}
                          {msg.success ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-red-400">✗</span>
                          )}
                        </div>
                        {msg.error && (
                          <div className="text-red-400">
                            <span className="text-gray-500">Error:</span> {msg.error}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
