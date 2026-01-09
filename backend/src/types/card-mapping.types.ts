export interface CardMapping {
  id: string
  type: 'sonos' | 'lights' | string // Extensible for future integrations
  data: string | object // Flexible payload
  name?: string // Optional friendly name
}

export interface CardMappings {
  cards: {
    [cardId: string]: CardMapping
  }
}
