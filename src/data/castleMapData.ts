/**
 * Bridges the campaign's castle (nodes + grid cells + doors) into the reusable
 * map module's `MapData`. Also the single source of truth for which rooms have
 * a save point, merchant, or ability relic (with their in-room x-positions) —
 * CampaignScene reads these to place the actual gameplay objects, and the map
 * uses them for icons, so the two never drift.
 */
import { CAMPAIGN_NODES, getCampaignChapter } from './campaign.ts'
import { CASTLE_CELLS, castleDoors, castleNeighbor, type MapDir } from './castleMap.ts'
import type { Connection, Direction, MapData, Room, RoomIcon } from '../map/types.ts'

/** Save rooms (safe, save crystal) keyed to the crystal's x-position. */
export const CASTLE_SAVE_ROOMS = [
  { id: 'cor-entrance', x: 520 },
  { id: 'std-reading', x: 840 },
  { id: 'top-antechamber', x: 840 },
] as const

/** Rooms with a wandering merchant, and the merchant's x-position. */
export const CASTLE_MERCHANT_ROOMS = [{ id: 'cor-entrance', x: 1180 }] as const

/** Warp rooms (Aria-style teleport network) keyed to the warp pad's x-position.
 *  Entering one discovers it; any discovered warp can teleport to any other.
 *  Spread across the castle: entrance cluster, chapel (east), gardens (top). */
export const CASTLE_WARP_ROOMS = [
  // x stays clear of the room-centre vertical-passage column (VERT_PASSAGE_X),
  // where Up means "climb", and of the door edges.
  { id: 'cor-alcove', x: 520 },
  { id: 'chp-nave', x: 520 },
  { id: 'grd-hanging', x: 520 },
] as const

/** Rooms holding an ability relic: x-position + the ability it grants. */
export const CASTLE_ITEM_ROOMS = [
  { id: 'cor-entrance', x: 320, ability: 'double-jump' },
  { id: 'std-archive', x: 320, ability: 'silver-key' },
  { id: 'clk-ascent', x: 320, ability: 'high-jump' },
  { id: 'dnc-ballroom', x: 320, ability: 'slide' },
] as const

/** Rooms holding a permanent Life Max Up. `high` ones sit on a raised ledge only
 *  the high-jump relic can reach (a height gate rather than a keyed door). */
export const CASTLE_LIFEUP_ROOMS = [
  { id: 'chp-loft', x: 840, high: false },
  { id: 'grd-skybridge', x: 840, high: true },
  { id: 'res-cistern', x: 1400, high: false },
] as const

const DIR_OF: Record<MapDir, Direction> = { n: 'up', s: 'down', e: 'right', w: 'left' }

const saveIds = new Set<string>(CASTLE_SAVE_ROOMS.map((r) => r.id))
const shopIds = new Set<string>(CASTLE_MERCHANT_ROOMS.map((r) => r.id))
const warpIds = new Set<string>(CASTLE_WARP_ROOMS.map((r) => r.id))
const itemIds = new Set<string>([...CASTLE_ITEM_ROOMS.map((r) => r.id), ...CASTLE_LIFEUP_ROOMS.map((r) => r.id)])

/** Room footprint in standard cells. A standard room is 1x1; a bigger room spans
 *  more boxes on the map (and is correspondingly larger in-game). This is the
 *  single source of truth — the gameplay pixel size is derived from it. */
export const ROOM_CELLS: Record<string, { w: number; h: number }> = {
  'cor-grand': { w: 2, h: 2 },
  'std-reading': { w: 2, h: 1 },
  'inr-servants': { w: 2, h: 1 },
}
/** Grid positions are scaled by this so multi-cell rooms have room to expand
 *  without overlapping neighbours (footprints are <= this). */
export const MAP_CELL_SCALE = 2

function roomCells(id: string): { w: number; h: number } {
  return ROOM_CELLS[id] ?? { w: 1, h: 1 }
}

function buildRoom(node: (typeof CAMPAIGN_NODES)[number]): Room | null {
  const cell = CASTLE_CELLS[node.id]
  if (!cell) return null
  const fp = roomCells(node.id)
  const doors = castleDoors(node.id)
  const connections: Connection[] = []
  for (const dir of ['n', 's', 'e', 'w'] as MapDir[]) {
    if (!doors[dir]) continue
    const to = castleNeighbor(node.id, dir)
    if (to) connections.push({ to, direction: DIR_OF[dir], type: node.isBoss && dir === 's' ? 'normal' : 'normal' })
  }
  const icons: RoomIcon[] = []
  if (node.isBoss) icons.push('boss')
  if (saveIds.has(node.id)) icons.push('save')
  if (warpIds.has(node.id)) icons.push('warp')
  if (shopIds.has(node.id)) icons.push('shop')
  if (itemIds.has(node.id)) icons.push('item')
  return {
    id: node.id,
    zone: getCampaignChapter(node.chapterId).title,
    mapX: cell.col * MAP_CELL_SCALE,
    mapY: cell.row * MAP_CELL_SCALE - (fp.h - 1),
    width: fp.w,
    height: fp.h,
    type: node.isBoss ? 'boss' : saveIds.has(node.id) ? 'save' : warpIds.has(node.id) ? 'warp' : 'normal',
    icons,
    hasBoss: node.isBoss ?? false,
    hasSave: saveIds.has(node.id),
    hasItem: itemIds.has(node.id),
    hasWarp: warpIds.has(node.id),
    connections,
  }
}

const rooms: Record<string, Room> = {}
for (const node of CAMPAIGN_NODES) {
  const room = buildRoom(node)
  if (room) rooms[room.id] = room
}

export const CASTLE_MAP_DATA: MapData = { rooms }
export const CASTLE_MAP_START = 'cor-entrance'
