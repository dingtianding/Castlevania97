/**
 * MapService — the orchestration layer over MapData (static layout) and
 * MapState (player progress). Gameplay calls this when the player enters a
 * room, finds a map item, unlocks a door, etc. It owns save/load and a debug
 * "reveal everything" switch.
 *
 * It deliberately does NOT enforce gameplay: `canTraverse` is a helper the
 * gameplay layer may consult, but the service never blocks movement itself.
 */
import type { Connection, MapData, Requirement, Room } from './types.ts'
import { MapState } from './MapState.ts'
import { loadMapState, saveMapState } from './SaveData.ts'

export interface MapServiceOptions {
  /** Persist to localStorage under this key. */
  saveKey?: string
  /** Reveal every room regardless of progress (map debugging). */
  debugRevealAll?: boolean
}

export class MapService {
  readonly data: MapData
  readonly state: MapState
  debugRevealAll: boolean
  private readonly saveKey: string | undefined

  constructor(data: MapData, state = new MapState(), options: MapServiceOptions = {}) {
    this.data = data
    this.state = state
    this.debugRevealAll = options.debugRevealAll ?? false
    this.saveKey = options.saveKey
  }

  // --- lookups ---------------------------------------------------------------

  getRoom(id: string): Room | undefined {
    return this.data.rooms[id]
  }

  currentRoom(): Room | undefined {
    return this.state.currentRoomId ? this.getRoom(this.state.currentRoomId) : undefined
  }

  connectionsFrom(id: string): Connection[] {
    return this.getRoom(id)?.connections ?? []
  }

  /** Neighbour room ids of a room (via its connections). */
  neighbours(id: string): string[] {
    return this.connectionsFrom(id).map((c) => c.to)
  }

  // --- discovery -------------------------------------------------------------

  /** The player entered a room: mark it discovered + visited, make it current,
   *  and save. Returns true if this was a new discovery. */
  enterRoom(id: string): boolean {
    if (!this.getRoom(id)) return false
    const wasNew = !this.state.isDiscovered(id)
    this.state.setState(id, 'visited')
    this.state.currentRoomId = id
    this.save()
    return wasNew
  }

  /** Mark a room seen-into (filled) without necessarily entering it. */
  discoverRoom(id: string): void {
    if (this.getRoom(id)) this.state.setState(id, 'discovered')
  }

  /** Reveal room OUTLINES (e.g. a found "castle map" item) without marking them
   *  visited. Pass a zone to reveal a whole area, or ids to reveal specific
   *  rooms. Already-discovered rooms keep their higher state. */
  reveal(opts: { zone?: string; ids?: string[] } = {}): void {
    const rooms = Object.values(this.data.rooms).filter((r) => {
      if (opts.ids && !opts.ids.includes(r.id)) return false
      if (opts.zone && r.zone !== opts.zone) return false
      return true
    })
    for (const r of rooms) this.state.setState(r.id, 'revealed')
  }

  collectItem(id: string): void {
    this.state.collectItem(id)
    this.save()
  }

  // --- gameplay helpers (advisory only) -------------------------------------

  /** Whether a connection can be traversed given the abilities/keys the player
   *  owns. Gameplay decides what to do with this; the map never blocks movement. */
  canTraverse(connection: Connection, owned: ReadonlySet<Requirement> | Requirement[]): boolean {
    if (!connection.requirement) return true
    const set = Array.isArray(owned) ? new Set(owned) : owned
    return set.has(connection.requirement)
  }

  // --- persistence -----------------------------------------------------------

  save(): void {
    saveMapState(this.state.toJSON(), this.saveKey)
  }

  /** Build a service from persisted progress (or a fresh one if none). */
  static load(data: MapData, options: MapServiceOptions = {}): MapService {
    const saved = loadMapState(options.saveKey)
    return new MapService(data, MapState.fromJSON(saved), options)
  }
}
