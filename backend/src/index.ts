import express from 'express'
import { createServer } from 'http'
import path from 'path'
import { config } from './config'
import { RFIDService } from './services/rfid.service'
import { SonosService } from './services/sonos.service'
import { CardMappingService } from './services/card-mapping.service'
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

  // JSON body parser
  app.use(express.json())

  // Card mappings endpoints
  app.get('/api/cards', (req, res) => {
    try {
      const mappings = cardMappings.getAllMappings()
      res.json(mappings)
    } catch (error) {
      console.error('Error fetching card mappings:', error)
      res.status(500).json({
        error: 'Failed to fetch card mappings',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post('/api/cards/:cardId', async (req, res) => {
    try {
      const { cardId } = req.params
      const { type, data, name } = req.body

      if (!type || !data) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'Both "type" and "data" are required',
        })
        return
      }

      await cardMappings.setMapping(cardId, type, data, name)
      res.json({
        success: true,
        cardId,
        type,
        name,
      })
    } catch (error) {
      console.error('Error setting card mapping:', error)
      res.status(500).json({
        error: 'Failed to set card mapping',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.delete('/api/cards/:cardId', async (req, res) => {
    try {
      const { cardId } = req.params
      const deleted = await cardMappings.deleteMapping(cardId)

      if (!deleted) {
        res.status(404).json({
          error: 'Card not found',
          message: `No mapping exists for card ${cardId}`,
        })
        return
      }

      res.json({
        success: true,
        cardId,
      })
    } catch (error) {
      console.error('Error deleting card mapping:', error)
      res.status(500).json({
        error: 'Failed to delete card mapping',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })

  // Sonos favorites endpoint
  app.get('/api/favorites', async (req, res) => {
    try {
      const favorites = await sonos.getFavorites()
      res.json({
        count: favorites.length,
        favorites: favorites.map((fav) => ({
          title: fav.title,
          uri: fav.uri,
        })),
      })
    } catch (error) {
      console.error('Error fetching favorites:', error)
      res.status(500).json({
        error: 'Failed to fetch Sonos favorites',
        message: error instanceof Error ? error.message : String(error),
      })
    }
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

  // 1. Card Mapping Service
  const cardMappings = new CardMappingService()
  await cardMappings.load()

  // 2. RFID Service
  const rfid = new RFIDService()
  await rfid.start()

  // 3. Sonos Service
  const sonos = new SonosService(config.sonos.speakerName)
  try {
    await sonos.initialize()
  } catch (error) {
    console.error('⚠️  Failed to initialize Sonos service:', error)
    console.log('Continuing without Sonos - will retry on first playback attempt')
  }

  // 4. WebSocket Server
  const ws = new WSServer(server)

  // 5. Integration Service (connects everything)
  new IntegrationService(rfid, sonos, cardMappings, ws)

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

    // Set timeout for forced exit
    const forceExitTimeout = setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout')
      process.exit(1)
    }, 5000)

    try {
      // Stop services
      console.log('Stopping Sonos polling...')
      sonos.stopPolling()

      console.log('Stopping RFID service...')
      await rfid.stop()

      // Close server
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('Server closed')
          resolve()
        })
      })

      clearTimeout(forceExitTimeout)
      console.log('✅ Shutdown complete')
      process.exit(0)
    } catch (error) {
      console.error('Error during shutdown:', error)
      clearTimeout(forceExitTimeout)
      process.exit(1)
    }
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
