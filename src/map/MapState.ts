/**
 * MapState — the PLAYER-SPECIFIC map progress (what has been revealed /
 * discovered / visited, which map items are collected, and the current room).
 * It knows nothing about static room layout; that lives in MapData. Kept plain
 * and serializable so SaveData can round-trip it.
 */
import { DISCOVERY_RANK, type DiscoveryState } from './types.ts'

/** The shape persisted to disk. */
export interface SerializedMapState {
  currentRoomId: string | null
  /** roomId -> highest discovery state reached. */
  states: Record<string, DiscoveryState>
  /** roomIds whose map item has been collected. */
  itemsCollected: string[]
}

export class MapState {
  currentRoomId: string | null = null
  private readonly states = new Map<string, DiscoveryState>()
  private readonly itemsCollected = new Set<string>()

  /** Current discovery state of a room ('unknown' if never touched). */
  getState(id: string): DiscoveryState {
    return this.states.get(id) ?? 'unknown'
  }

  /** Raise a room to at least `state` — never downgrades a more-known room. */
  setState(id: string, state: DiscoveryState): void {
    if (DISCOVERY_RANK[state] > DISCOVERY_RANK[this.getState(id)]) {
      this.states.set(id, state)
    }
  }

  isDiscovered(id: string): boolean {
    return DISCOVERY_RANK[this.getState(id)] >= DISCOVERY_RANK.discovered
  }

  isVisited(id: string): boolean {
    return this.getState(id) === 'visited'
  }

  isItemCollected(id: string): boolean {
    return this.itemsCollected.has(id)
  }

  collectItem(id: string): void {
    this.itemsCollected.add(id)
  }

  /** All room ids the player knows about at all (revealed or better). */
  knownRoomIds(): string[] {
    return [...this.states.keys()].filter((id) => this.getState(id) !== 'unknown')
  }

  toJSON(): SerializedMapState {
    return {
      currentRoomId: this.currentRoomId,
      states: Object.fromEntries(this.states),
      itemsCollected: [...this.itemsCollected],
    }
  }

  static fromJSON(data: SerializedMapState | null | undefined): MapState {
    const state = new MapState()
    if (!data) return state
    state.currentRoomId = data.currentRoomId ?? null
    for (const [id, s] of Object.entries(data.states ?? {})) {
      if (s in DISCOVERY_RANK) state.states.set(id, s as DiscoveryState)
    }
    for (const id of data.itemsCollected ?? []) state.itemsCollected.add(id)
    return state
  }
}
