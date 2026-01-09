// Type declarations for sonos package (no official @types available)
declare module 'sonos' {
  export class Sonos {
    constructor(host: string, port?: number)
    getName(): Promise<string>
    play(uri?: string): Promise<any>
    pause(): Promise<any>
    next(): Promise<any>
    previous(): Promise<any>
    setVolume(volume: number): Promise<any>
    getVolume(): Promise<number>
    currentTrack(): Promise<any>
    getCurrentState(): Promise<string>
    getFavorites(): Promise<{ items: Array<{ title: string; uri: string }> }>
    flush(): Promise<any>
    queue(uri: string | { uri: string; metadata: string }, position?: number): Promise<any>
    selectQueue(): Promise<any>
    setAVTransportURI(options: string | {
      uri: string
      metadata: string
      onlySetUri?: boolean
    }): Promise<any>
    contentDirectoryService(): {
      Browse(options: {
        ObjectID: string
        BrowseFlag: string
        Filter: string
        StartingIndex: string
        RequestedCount: string
        SortCriteria: string
      }): Promise<{
        Result: string
        NumberReturned: string
        TotalMatches: string
        UpdateID: string
      }>
    }
  }

  export class AsyncDeviceDiscovery {
    discoverMultiple(options?: { timeout?: number }): Promise<Sonos[]>
  }
}
