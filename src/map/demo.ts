/**
 * Standalone demo for the map module — run `npm run dev` and open
 * http://localhost:5173/Castlevania97/map-demo.html
 *
 * Walk between rooms with the arrow keys / WASD (this simulates the player
 * entering rooms and discovering them). Watch the full map + minimap update.
 *
 *   Arrows / WASD : move to the connected room in that direction
 *   R             : toggle debug reveal-all
 *   M             : "found a map item" — reveal room outlines in the zone
 *   E             : collect the item in the current room
 *   C             : clear saved progress and restart
 */
import { MapService, MapRenderer, MinimapRenderer, clearMapState, SAMPLE_MAP, SAMPLE_START_ROOM, type Direction } from './index.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#map')!
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false

const SAVE_KEY = 'castlevania97.map.demo'
let map = MapService.load(SAMPLE_MAP, { saveKey: SAVE_KEY })
if (!map.state.currentRoomId) map.enterRoom(SAMPLE_START_ROOM)

const fullMap = new MapRenderer()
const minimap = new MinimapRenderer()

/** Move to the neighbour connected in `dir` from the current room, if any. */
function move(dir: Direction): void {
  const cur = map.currentRoom()
  if (!cur) return
  const conn = cur.connections.find((c) => c.direction === dir)
  if (conn) map.enterRoom(conn.to)
}

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
}

window.addEventListener('keydown', (e) => {
  if (KEY_DIR[e.code]) { move(KEY_DIR[e.code]!); e.preventDefault(); return }
  if (e.code === 'KeyR') map.debugRevealAll = !map.debugRevealAll
  else if (e.code === 'KeyM') { const z = map.currentRoom()?.zone; if (z) map.reveal({ zone: z }) }
  else if (e.code === 'KeyE') { const c = map.currentRoom(); if (c?.hasItem) map.collectItem(c.id) }
  else if (e.code === 'KeyC') { clearMapState(SAVE_KEY); map = MapService.load(SAMPLE_MAP, { saveKey: SAVE_KEY }); map.enterRoom(SAMPLE_START_ROOM) }
})

function text(s: string, x: number, y: number, color = '#e8d4a0', size = 13): void {
  ctx.fillStyle = color
  ctx.font = `${size}px monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(s, x, y)
}

let frame = 0
function loop(): void {
  frame++
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.08)
  ctx.fillStyle = '#0b0912'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Full pause map.
  fullMap.draw(ctx, map, { x: 40, y: 70, width: 620, height: 460, cellSize: 68 }, { pulse, showConnections: true })

  // Minimap in the corner.
  minimap.draw(ctx, map, { x: 690, y: 70, width: 180, height: 150, cellSize: 22, pulse })

  // HUD text.
  const cur = map.currentRoom()
  text('METROIDVANIA MAP MODULE — DEMO', 40, 40, '#f6b74a', 18)
  text(`ROOM: ${cur?.id ?? '-'}   ZONE: ${cur?.zone ?? '-'}   ${map.debugRevealAll ? '[DEBUG REVEAL ALL]' : ''}`, 40, 560, '#b7c7e6', 12)
  text('ARROWS/WASD move   R reveal-all   M map-item   E collect   C reset', 40, 582, '#5a567a', 11)
  text('MINIMAP', 690, 62, '#8a8aa0', 11)

  requestAnimationFrame(loop)
}
loop()
