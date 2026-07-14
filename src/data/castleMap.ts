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
  // Castle Corridor — the entrance spine along the base (row 6). The grand
  // corridor is the hub: a store alcove and a watch-post branch up off it (the
  // watch loops back down to the sentinel gate), and an undercroft with a
  // flooded drain hang below.
  'cor-entrance': { col: 0, row: 6 },
  'cor-grand': { col: 1, row: 6 },
  'cor-alcove': { col: 1, row: 5 },
  'cor-larder': { col: 0, row: 5 },
  'cor-watch': { col: 2, row: 5 },
  'cor-skull': { col: 2, row: 6 },
  'cor-undercroft': { col: 1, row: 7 },
  'cor-drain': { col: 2, row: 7 },
  // Underground Reservoir — continues along the base then drops a sunken cistern.
  'res-descent': { col: 3, row: 6 },
  'res-cistern': { col: 3, row: 5 },
  'res-golem': { col: 4, row: 6 },
  // Chapel — climbs the right side with a bell loft off the nave.
  'chp-nave': { col: 4, row: 5 },
  'chp-loft': { col: 5, row: 5 },
  'chp-manticore': { col: 4, row: 4 },
  // Study — runs left across the mid floor.
  'std-reading': { col: 3, row: 4 },
  'std-archive': { col: 2, row: 4 },
  // Dance Hall — turns up on the left.
  'dnc-ballroom': { col: 1, row: 4 },
  'dnc-greatarmor': { col: 1, row: 3 },
  // Inner Quarters — cuts back right.
  'inr-servants': { col: 2, row: 3 },
  'inr-headhunter': { col: 3, row: 3 },
  // Clock Tower — a vertical climb up the middle.
  'clk-ascent': { col: 3, row: 2 },
  'clk-death': { col: 3, row: 1 },
  // Floating Garden — spreads right up top with a sky bridge dead-end.
  'grd-hanging': { col: 4, row: 1 },
  'grd-skybridge': { col: 5, row: 1 },
  'grd-legion': { col: 4, row: 0 },
  // Top Floor — runs left along the summit.
  'top-keep': { col: 3, row: 0 },
  'top-antechamber': { col: 2, row: 0 },
  // Forbidden Area — the final rooms at the top-left.
  'fbd-gate': { col: 1, row: 0 },
  'fbd-chaos': { col: 0, row: 0 },
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
