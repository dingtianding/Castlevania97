/**
 * Sample world — a small, original 10-room graph to prove the system.
 *
 * HOW TO ADD ROOMS
 * ----------------
 * 1. Add a `Room` entry to `rooms` with a unique `id`, a `zone`, its grid
 *    position (`mapX`/`mapY`), and size (`width`/`height`) in map cells.
 * 2. Add `connections` describing how it links to neighbours. For a two-way
 *    door, add the matching connection on BOTH rooms.
 * 3. Set flags/icons (`hasSave`, `hasBoss`, `hasItem`, `icons`, `secret`, `lock`).
 * Nothing else needs to change — the renderers and service are data-driven.
 *
 * Grid layout (col = mapX, row = mapY, y grows downward):
 *
 *                         [save 3,1]
 *   [entr 0,2][ hallway 1-2,2 ][shaft 3,2-3][gate 4,2][item 5,2]
 *   [scrt 0,3]
 *   [warp 0,4][ large  1-2,4 ][ boss 3,4 ]
 */
import type { MapData } from './types.ts'

export const SAMPLE_MAP: MapData = {
  rooms: {
    entrance: {
      id: 'entrance',
      zone: 'Entrance',
      mapX: 0,
      mapY: 2,
      width: 1,
      height: 1,
      type: 'normal',
      icons: [],
      connections: [
        { to: 'hallway', direction: 'right', type: 'normal' },
        { to: 'secret', direction: 'down', type: 'secret' }, // false floor
      ],
    },

    // A wide 2x1 hallway (spans cols 1 and 2).
    hallway: {
      id: 'hallway',
      zone: 'Entrance',
      mapX: 1,
      mapY: 2,
      width: 2,
      height: 1,
      type: 'hallway',
      icons: [],
      connections: [
        { to: 'entrance', direction: 'left', type: 'normal' },
        { to: 'shaft', direction: 'right', type: 'normal' },
      ],
    },

    // A tall 1x2 vertical shaft (spans rows 2 and 3).
    shaft: {
      id: 'shaft',
      zone: 'Entrance',
      mapX: 3,
      mapY: 2,
      width: 1,
      height: 2,
      type: 'shaft',
      icons: [],
      connections: [
        { to: 'hallway', direction: 'left', type: 'normal' },
        { to: 'save', direction: 'up', type: 'normal' },
        { to: 'boss', direction: 'down', type: 'boss' },
        { to: 'gate', direction: 'right', type: 'ability', requirement: 'double-jump' },
      ],
    },

    // Save room, above the shaft.
    save: {
      id: 'save',
      zone: 'Entrance',
      mapX: 3,
      mapY: 1,
      width: 1,
      height: 1,
      type: 'save',
      icons: ['save'],
      hasSave: true,
      connections: [{ to: 'shaft', direction: 'down', type: 'normal' }],
    },

    // An ability gate — only passable with a double jump.
    gate: {
      id: 'gate',
      zone: 'Entrance',
      mapX: 4,
      mapY: 2,
      width: 1,
      height: 1,
      type: 'normal',
      icons: [],
      lock: 'double-jump',
      connections: [
        { to: 'shaft', direction: 'left', type: 'ability', requirement: 'double-jump' },
        { to: 'item', direction: 'right', type: 'normal' },
      ],
    },

    // Item room (behind the gate).
    item: {
      id: 'item',
      zone: 'Entrance',
      mapX: 5,
      mapY: 2,
      width: 1,
      height: 1,
      type: 'item',
      icons: ['item'],
      hasItem: true,
      connections: [{ to: 'gate', direction: 'left', type: 'normal' }],
    },

    // Boss room, below the shaft.
    boss: {
      id: 'boss',
      zone: 'Entrance',
      mapX: 3,
      mapY: 4,
      width: 1,
      height: 1,
      type: 'boss',
      icons: ['boss'],
      hasBoss: true,
      connections: [
        { to: 'shaft', direction: 'up', type: 'boss' },
        { to: 'large', direction: 'left', type: 'normal' },
      ],
    },

    // Hidden secret room off the entrance.
    secret: {
      id: 'secret',
      zone: 'Entrance',
      mapX: 0,
      mapY: 3,
      width: 1,
      height: 1,
      type: 'secret',
      icons: [],
      secret: true,
      connections: [
        { to: 'entrance', direction: 'up', type: 'secret' },
        { to: 'warp', direction: 'down', type: 'normal' },
      ],
    },

    // Warp/teleport room.
    warp: {
      id: 'warp',
      zone: 'Entrance',
      mapX: 0,
      mapY: 4,
      width: 1,
      height: 1,
      type: 'warp',
      icons: ['warp'],
      hasWarp: true,
      connections: [
        { to: 'secret', direction: 'up', type: 'normal' },
        { to: 'large', direction: 'right', type: 'normal' },
      ],
    },

    // A large 2x1 room (spans cols 1 and 2).
    large: {
      id: 'large',
      zone: 'Entrance',
      mapX: 1,
      mapY: 4,
      width: 2,
      height: 1,
      type: 'normal',
      icons: [],
      connections: [
        { to: 'warp', direction: 'left', type: 'normal' },
        { to: 'boss', direction: 'right', type: 'normal' },
      ],
    },
  },
}

/** Where a new game starts. */
export const SAMPLE_START_ROOM = 'entrance'
