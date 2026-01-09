import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

export const config = {
  port: parseInt(process.env.PORT || '8765', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  rfid: {
    mode: process.env.RFID_MODE || 'mock',
    pollInterval: parseFloat(process.env.RFID_POLL_INTERVAL || '0.5'),
    debounceSeconds: parseFloat(process.env.RFID_DEBOUNCE_SECONDS || '2.0'),
  },

  sonos: {
    speakerName: process.env.SONOS_SPEAKER_NAME || 'Bedroom',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  paths: {
    rfidService: path.join(__dirname, '../lib/rfid/service.py'),
    rfidVenvPython: path.join(__dirname, '../lib/rfid/venv/bin/python3'),
    staticFiles: path.join(__dirname, '../../frontend/dist'),
  },
}
