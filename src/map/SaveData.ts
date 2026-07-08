/**
 * SaveData — persists map progress (discovered/visited rooms, collected map
 * items, current room) to localStorage. Swap the two functions for your own
 * save backend to integrate with a wider game save.
 */
import type { SerializedMapState } from './MapState.ts'

const STORAGE_KEY = 'castlevania97.map.v1'

export function saveMapState(state: SerializedMapState, key = STORAGE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // Map progress is a convenience; keep playing if storage is unavailable.
  }
}

export function loadMapState(key = STORAGE_KEY): SerializedMapState | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as SerializedMapState) : null
  } catch {
    return null
  }
}

export function clearMapState(key = STORAGE_KEY): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
