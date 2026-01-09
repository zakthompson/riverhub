import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { CardMapping, CardMappings } from '../types/card-mapping.types'

const MAPPINGS_FILE = path.join(__dirname, '../../card-mappings.json')

export class CardMappingService {
  private mappings: CardMappings = { cards: {} }
  private loaded = false

  /**
   * Load card mappings from file
   */
  async load(): Promise<void> {
    if (!existsSync(MAPPINGS_FILE)) {
      console.warn(`Card mappings file not found: ${MAPPINGS_FILE}`)
      console.log('Creating empty mappings file...')
      await this.save()
      this.loaded = true
      return
    }

    try {
      const content = await readFile(MAPPINGS_FILE, 'utf-8')
      this.mappings = JSON.parse(content)
      console.log(
        `Loaded ${Object.keys(this.mappings.cards).length} card mapping(s)`
      )
      this.loaded = true
    } catch (error) {
      console.error('Error loading card mappings:', error)
      throw error
    }
  }

  /**
   * Get mapping for a specific card ID
   */
  getMapping(cardId: string): CardMapping | null {
    if (!this.loaded) {
      throw new Error('Card mappings not loaded. Call load() first.')
    }

    return this.mappings.cards[cardId] || null
  }

  /**
   * Set mapping for a card ID
   */
  async setMapping(
    cardId: string,
    type: string,
    data: string | object,
    name?: string
  ): Promise<void> {
    if (!this.loaded) {
      await this.load()
    }

    this.mappings.cards[cardId] = {
      id: cardId,
      type,
      data,
      ...(name && { name }),
    }

    await this.save()
    console.log(`Saved mapping for card ${cardId} (${type})`)
  }

  /**
   * Delete mapping for a card ID
   */
  async deleteMapping(cardId: string): Promise<boolean> {
    if (!this.loaded) {
      await this.load()
    }

    if (!this.mappings.cards[cardId]) {
      return false
    }

    delete this.mappings.cards[cardId]
    await this.save()
    console.log(`Deleted mapping for card ${cardId}`)
    return true
  }

  /**
   * Get all mappings
   */
  getAllMappings(): CardMappings {
    if (!this.loaded) {
      throw new Error('Card mappings not loaded. Call load() first.')
    }

    return this.mappings
  }

  /**
   * Save mappings to file
   */
  private async save(): Promise<void> {
    try {
      await writeFile(MAPPINGS_FILE, JSON.stringify(this.mappings, null, 2))
    } catch (error) {
      console.error('Error saving card mappings:', error)
      throw error
    }
  }
}
