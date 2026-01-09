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
  }

  export class AsyncDeviceDiscovery {
    discoverMultiple(options?: { timeout?: number }): Promise<Sonos[]>
  }
}
