import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { config } from '../config'
import type { RFIDEvent, RFIDCommand } from '../types/rfid.types'

export class RFIDService extends EventEmitter {
  private process: ChildProcess | null = null
  private isRestarting = false
  private restartTimeout: NodeJS.Timeout | null = null

  async start(): Promise<void> {
    if (this.process) {
      console.log('RFID service already running')
      return
    }

    console.log(`Starting RFID service in ${config.rfid.mode} mode...`)

    // Use venv Python if available (needed for dependencies like dotenv)
    let pythonCmd = 'python3'

    if (existsSync(config.paths.rfidVenvPython)) {
      pythonCmd = config.paths.rfidVenvPython
      console.log(`Using venv Python: ${pythonCmd}`)
    } else {
      console.warn(
        'Warning: Python venv not found at',
        config.paths.rfidVenvPython,
      )
      console.warn(
        'Run dev.sh to set up dependencies, or manually create venv:',
      )
      console.warn('  cd backend/lib/rfid && python3 -m venv venv')
      console.warn('  venv/bin/pip install -r requirements.txt')
      console.log(`Falling back to system Python: ${pythonCmd}`)
    }

    this.process = spawn(pythonCmd, [config.paths.rfidService], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RFID_MODE: config.rfid.mode,
        RFID_POLL_INTERVAL: String(config.rfid.pollInterval),
        RFID_DEBOUNCE_SECONDS: String(config.rfid.debounceSeconds),
      },
    })

    // Handle stdout - JSON lines with events
    if (this.process.stdout) {
      let buffer = ''
      this.process.stdout.on('data', (data: Buffer) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        lines.forEach((line) => {
          if (line.trim()) {
            try {
              const event = JSON.parse(line) as RFIDEvent
              this.emit('event', event)
            } catch (error) {
              console.error('Failed to parse RFID event:', line, error)
            }
          }
        })
      })
    }

    // Handle stderr - log errors
    if (this.process.stderr) {
      this.process.stderr.on('data', (data: Buffer) => {
        console.error('RFID service error:', data.toString())
      })
    }

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      console.warn(`RFID service exited with code ${code}, signal ${signal}`)
      this.process = null

      // Auto-restart unless intentionally stopped
      if (!this.isRestarting && code !== 0) {
        console.log('Auto-restarting RFID service in 2 seconds...')
        this.restartTimeout = setTimeout(() => {
          this.start()
        }, 2000)
      }
    })

    // Handle process errors
    this.process.on('error', (error) => {
      console.error('RFID service process error:', error)
      this.emit('error', error)
    })

    console.log('RFID service started successfully')
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.isRestarting = true

      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout)
        this.restartTimeout = null
      }

      if (!this.process) {
        resolve()
        return
      }

      console.log('Stopping RFID service...')

      // Set up exit handler
      const onExit = () => {
        this.process = null
        console.log('RFID service stopped')
        resolve()
      }

      this.process.once('exit', onExit)

      // Try graceful shutdown first
      this.process.kill('SIGTERM')

      // Force kill after 2 seconds if still running
      setTimeout(() => {
        if (this.process) {
          console.log('Force killing RFID service...')
          this.process.kill('SIGKILL')
        }
      }, 2000)
    })
  }

  sendCommand(command: RFIDCommand): void {
    if (!this.process?.stdin) {
      console.error('Cannot send command: RFID service not running')
      return
    }

    try {
      const line = JSON.stringify(command) + '\n'
      this.process.stdin.write(line)
    } catch (error) {
      console.error('Failed to send command to RFID service:', error)
    }
  }

  isRunning(): boolean {
    return this.process !== null
  }
}
