import express from 'express'
import { createServer } from 'http'
import path from 'path'
import { config } from './config'
import { RFIDService } from './services/rfid.service'
import { SonosService } from './services/sonos.service'
import { IntegrationService } from './services/integration.service'
import { WSServer } from './websocket'

async function main() {
  console.log('🚀 Starting RiverHub backend...')
  console.log(`Environment: ${config.nodeEnv}`)
  console.log(`Port: ${config.port}`)
  console.log(`RFID Mode: ${config.rfid.mode}`)

  // Create Express app
  const app = express()
  const server = createServer(app)

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      environment: config.nodeEnv,
      rfid: {
        mode: config.rfid.mode,
        running: rfid.isRunning(),
      },
      sonos: {
        connected: sonos.isConnected(),
        speaker: sonos.getSpeakerName(),
      },
      websocket: {
        clients: ws.getClientCount(),
      },
    })
  })

  // Serve static files in production
  if (config.nodeEnv === 'production') {
    console.log(`Serving static files from: ${config.paths.staticFiles}`)
    app.use(express.static(config.paths.staticFiles))

    app.get('*', (req, res) => {
      res.sendFile(path.join(config.paths.staticFiles, 'index.html'))
    })
  }

  // Initialize services
  console.log('\n📦 Initializing services...')

  // 1. RFID Service
  const rfid = new RFIDService()
  await rfid.start()

  // 2. Sonos Service
  const sonos = new SonosService(config.sonos.speakerName)
  try {
    await sonos.initialize()
  } catch (error) {
    console.error('⚠️  Failed to initialize Sonos service:', error)
    console.log('Continuing without Sonos - will retry on first playback attempt')
  }

  // 3. WebSocket Server
  const ws = new WSServer(server)

  // 4. Integration Service (connects everything)
  new IntegrationService(rfid, sonos, ws)

  // Start server
  server.listen(config.port, () => {
    console.log(`\n✅ RiverHub backend running on port ${config.port}`)
    console.log(`   WebSocket: ws://localhost:${config.port}`)
    console.log(`   Health check: http://localhost:${config.port}/health`)
    if (config.nodeEnv === 'development') {
      console.log(`   \n💡 Frontend dev server should connect to ws://localhost:${config.port}`)
    }
  })

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...')

    sonos.stopPolling()
    rfid.stop()

    server.close(() => {
      console.log('Server closed')
      process.exit(0)
    })

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the application
main().catch((error) => {
  console.error('Failed to start application:', error)
  process.exit(1)
})
