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

/** Rooms holding an ability relic: x-position + the ability it grants. */
export const CASTLE_ITEM_ROOMS = [
  { id: 'cor-entrance', x: 320, ability: 'double-jump' },
  { id: 'std-archive', x: 320, ability: 'silver-key' },
] as const

/** Rooms holding a permanent Life Max Up pickup, keyed to its x-position. */
export const CASTLE_LIFEUP_ROOMS = [{ id: 'chp-loft', x: 840 }] as const

const DIR_OF: Record<MapDir, Direction> = { n: 'up', s: 'down', e: 'right', w: 'left' }

const saveIds = new Set<string>(CASTLE_SAVE_ROOMS.map((r) => r.id))
const shopIds = new Set<string>(CASTLE_MERCHANT_ROOMS.map((r) => r.id))
const itemIds = new Set<string>([...CASTLE_ITEM_ROOMS.map((r) => r.id), ...CASTLE_LIFEUP_ROOMS.map((r) => r.id)])

function buildRoom(node: (typeof CAMPAIGN_NODES)[number]): Room | null {
  const cell = CASTLE_CELLS[node.id]
  if (!cell) return null
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
  if (shopIds.has(node.id)) icons.push('shop')
  if (itemIds.has(node.id)) icons.push('item')
  return {
    id: node.id,
    zone: getCampaignChapter(node.chapterId).title,
    mapX: cell.col,
    mapY: cell.row,
    width: 1,
    height: 1,
    type: node.isBoss ? 'boss' : saveIds.has(node.id) ? 'save' : 'normal',
    icons,
    hasBoss: node.isBoss ?? false,
    hasSave: saveIds.has(node.id),
    hasItem: itemIds.has(node.id),
    hasWarp: shopIds.has(node.id),
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
