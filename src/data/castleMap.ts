/**
 * Castle map layout — the Castlevania-style minimap. The campaign plays out as a
 * linear chain of rooms, but the map presents them as a 2D castle you ascend:
 * chapter 1 runs left→right along the base, climbs up into chapter 2 running
 * right→left, then up again into chapter 3 left→right to Dracula's gate at the
 * top. Door directions are derived from grid adjacency, so the map reads as a
 * branching castle with up/down/left/right corridors rather than a straight line.
 */
import { CAMPAIGN_NODES, getCampaignNode } from './campaign.ts'

export type MapDir = 'n' | 's' | 'e' | 'w'

export interface CastleCell {
  col: number
  row: number
}

/** Grid coordinates per node id. Row 0 is the top of the castle. Every linked
 *  pair is exactly one orthogonal step apart so doors derive cleanly. */
export const CASTLE_CELLS: Readonly<Record<string, CastleCell>> = {
  // Chapter 1 — base of the castle (row 3), running left to right, with a
  // reliquary tucked up off the library.
  '1997-chapel': { col: 0, row: 3 },
  '1997-nave': { col: 1, row: 3 },
  '1997-library': { col: 2, row: 3 },
  '1997-reliquary': { col: 2, row: 2 },
  '1997-seal': { col: 3, row: 3 },
  // Chapter 2 — climbs the right side (up off the seal) then runs left, with a
  // flooded cistern pocket beside the catacombs.
  '1998-catacombs': { col: 3, row: 2 },
  '1998-cistern': { col: 4, row: 2 },
  '1998-clock': { col: 3, row: 1 },
  '1998-belfry': { col: 2, row: 1 },
  '1998-archive': { col: 1, row: 1 },
  // Chapter 3 — top floor (up off the archive), running to Dracula's gate, with
  // a broken rampart branching off to the left.
  '1999-wall': { col: 1, row: 0 },
  '1999-rampart': { col: 0, row: 0 },
  '1999-throne': { col: 2, row: 0 },
  '1999-dracula': { col: 3, row: 0 },
  // Chapter 4 — beyond the gate, sprawling right into the castle interior with
  // a broken spire and a sunken vault dropping off the main hall.
  'gate-ascent': { col: 4, row: 0 },
  'gate-spire': { col: 4, row: 1 },
  'gate-hall': { col: 5, row: 0 },
  'gate-vault': { col: 5, row: 1 },
  'gate-keep': { col: 6, row: 0 },
}

/** Undirected adjacency built from every node's `nextIds`. */
const ADJACENCY: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>()
  const link = (a: string, b: string): void => {
    if (!map.has(a)) map.set(a, new Set())
    map.get(a)!.add(b)
  }
  for (const node of CAMPAIGN_NODES) {
    for (const next of node.nextIds) {
      if (!CASTLE_CELLS[node.id] || !CASTLE_CELLS[next]) continue
      link(node.id, next)
      link(next, node.id)
    }
  }
  return map
})()

function dirBetween(from: CastleCell, to: CastleCell): MapDir | null {
  const dCol = to.col - from.col
  const dRow = to.row - from.row
  if (dCol === 0 && dRow === -1) return 'n'
  if (dCol === 0 && dRow === 1) return 's'
  if (dCol === 1 && dRow === 0) return 'e'
  if (dCol === -1 && dRow === 0) return 'w'
  return null
}

/** Which edges of a room have doors, for drawing corridor stubs. */
export function castleDoors(nodeId: string): Record<MapDir, boolean> {
  const cell = CASTLE_CELLS[nodeId]
  const doors: Record<MapDir, boolean> = { n: false, s: false, e: false, w: false }
  if (!cell) return doors
  for (const other of ADJACENCY.get(nodeId) ?? []) {
    const dir = dirBetween(cell, CASTLE_CELLS[other]!)
    if (dir) doors[dir] = true
  }
  return doors
}

/** The room reachable by a door in `dir`, or null if there's no door that way. */
export function castleNeighbor(nodeId: string, dir: MapDir): string | null {
  const cell = CASTLE_CELLS[nodeId]
  if (!cell) return null
  for (const other of ADJACENCY.get(nodeId) ?? []) {
    if (dirBetween(cell, CASTLE_CELLS[other]!) === dir) return other
  }
  return null
}

export interface CastleGridBounds {
  minCol: number
  maxCol: number
  minRow: number
  maxRow: number
  cols: number
  rows: number
}

export function castleGridBounds(): CastleGridBounds {
  const cells = Object.values(CASTLE_CELLS)
  const cols = cells.map((c) => c.col)
  const rows = cells.map((c) => c.row)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  return { minCol, maxCol, minRow, maxRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1 }
}

export function isBossRoom(nodeId: string): boolean {
  return Boolean(getCampaignNode(nodeId).isBoss)
}

/** All node ids that have a cell on the castle grid, in a stable order. */
export const CASTLE_ROOM_IDS: readonly string[] = Object.keys(CASTLE_CELLS)
