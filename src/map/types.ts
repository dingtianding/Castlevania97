/**
 * Metroidvania map module — data models.
 *
 * The world is a GRAPH OF ROOMS, not one giant tilemap. Each room is a
 * rectangle on a coarse map grid (measured in map CELLS, not pixels), and rooms
 * link to each other through connections (doors, gates, shafts, warps, secrets).
 * Room interiors (the actual platforming tilemaps) live elsewhere — this module
 * only cares about the room-level graph and what the player has discovered.
 *
 * To add rooms later you only edit data (see sampleMap.ts) — nothing here is
 * hardcoded to a specific layout.
 */

/** Which way a connection leaves a room. */
export type Direction = 'up' | 'down' | 'left' | 'right' | 'elevator' | 'portal' | 'hidden'

/** What kind of link a connection is (affects gameplay, and optionally the map). */
export type ConnectionType =
  | 'normal' // a plain doorway
  | 'locked' // needs a key
  | 'ability' // needs a traversal ability (double jump, mist, ...)
  | 'oneway' // a drop you can't climb back up
  | 'secret' // a hidden/false wall
  | 'breakable' // a wall you can destroy
  | 'boss' // a boss gate
  | 'warp' // a teleport link

/** A gameplay requirement id, e.g. 'double-jump', 'key-red', 'mist', 'switch-1'.
 *  The map only STORES requirements; gameplay code decides whether the player
 *  can actually pass. */
export type Requirement = string

/** Special markers a room can display on the map. */
export type RoomIcon = 'save' | 'warp' | 'boss' | 'item' | 'shop' | 'hop'

/** Broad room category (purely descriptive / for authoring convenience). */
export type RoomType = 'normal' | 'hallway' | 'shaft' | 'save' | 'warp' | 'boss' | 'item' | 'secret'

/** A directed link from the room that owns it to another room. For a two-way
 *  door, author the matching connection on both rooms. */
export interface Connection {
  /** Destination room id. */
  to: string
  direction: Direction
  type: ConnectionType
  /** Required ability/key to traverse, if any. */
  requirement?: Requirement
}

/** One room on the map grid. Sizes are in map cells (most rooms are 1x1). */
export interface Room {
  id: string
  /** Area/zone this room belongs to (supports multiple zones later). */
  zone: string
  /** Top-left cell position on the map grid. */
  mapX: number
  mapY: number
  /** Size in map cells (e.g. 2x1 hallway, 1x2 shaft, 2x2 hub). */
  width: number
  height: number
  type: RoomType
  /** Icons to show on the map for this room. */
  icons: RoomIcon[]
  hasSave?: boolean
  hasWarp?: boolean
  hasBoss?: boolean
  hasItem?: boolean
  /** A hidden room — only shown once discovered. */
  secret?: boolean
  /** An ability/key required to be in/reach this room (optional gate marker). */
  lock?: Requirement
  connections: Connection[]
}

/** The static world: every room keyed by id. Multiple zones can coexist here. */
export interface MapData {
  rooms: Record<string, Room>
}

/**
 * Per-room discovery, from least to most known:
 * - `unknown`:   never seen — not drawn (unless debug).
 * - `revealed`:  outline only — e.g. after finding a "castle map" item.
 * - `discovered`: filled room — the player has seen inside it.
 * - `visited`:   discovered AND actually entered.
 */
export type DiscoveryState = 'unknown' | 'revealed' | 'discovered' | 'visited'

/** Ordering so a lower state never overwrites a higher one. */
export const DISCOVERY_RANK: Record<DiscoveryState, number> = {
  unknown: 0,
  revealed: 1,
  discovered: 2,
  visited: 3,
}
