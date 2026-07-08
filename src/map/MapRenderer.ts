/**
 * MapRenderer — draws the full pause map. Rooms are rectangles placed by their
 * grid coordinates; the current room is centred in the view. Purely a view: it
 * reads MapData + MapState through the service and never mutates anything.
 *
 *   screenX = room.mapX * cellSize + offset
 *   screenW = room.width * cellSize
 *
 * Visual states: unknown → hidden, revealed → outline only, discovered → filled,
 * visited → filled (brighter), current → highlighted. Icons (save/warp/boss/
 * item) draw on top; a collected item dims.
 */
import type { MapService } from './MapService.ts'
import type { Room, RoomIcon } from './types.ts'

/** The rectangle on the canvas to render the map into. */
export interface MapView {
  x: number
  y: number
  width: number
  height: number
  /** Pixels per map cell. */
  cellSize: number
}

export interface MapDrawOptions {
  /** 0..1 pulse for the current-room highlight (e.g. from a blink counter). */
  pulse?: number
  /** Draw short connectors between linked rooms. */
  showConnections?: boolean
}

const COLORS = {
  panel: 'rgba(6, 5, 12, 0.92)',
  border: '#5a567a',
  revealedOutline: '#4a4668',
  discoveredFill: '#243a5a',
  discoveredBorder: '#3a5a86',
  visitedFill: '#2f4f7e',
  visitedBorder: '#6a86b8',
  currentFill: '#e8d4a0',
  currentBorder: '#fff2cc',
  connNormal: '#3a3658',
  connLocked: '#c8a24a',
  connAbility: '#a06adc',
  connSecret: '#5a4a7a',
  save: '#5ac8ff',
  warp: '#c86adc',
  boss: '#e0393a',
  item: '#f6b74a',
  itemDim: '#7a6a3a',
}

export class MapRenderer {
  private readonly gap = 3 // px inset so adjacent rooms read as separate cells

  draw(ctx: CanvasRenderingContext2D, service: MapService, view: MapView, opts: MapDrawOptions = {}): void {
    ctx.save()
    // Clip + panel background.
    ctx.beginPath()
    ctx.rect(view.x, view.y, view.width, view.height)
    ctx.clip()
    ctx.fillStyle = COLORS.panel
    ctx.fillRect(view.x, view.y, view.width, view.height)

    const offset = this.computeOffset(service, view)
    const rooms = Object.values(service.data.rooms)

    if (opts.showConnections) {
      for (const room of rooms) this.drawConnections(ctx, service, room, offset, view.cellSize)
    }
    for (const room of rooms) this.drawRoom(ctx, service, room, offset, view.cellSize, opts.pulse ?? 0)
    ctx.restore()
  }

  /** Centre the current room (or the known-room bounds) inside the view. */
  private computeOffset(service: MapService, view: MapView): { x: number; y: number } {
    const cur = service.currentRoom()
    let centerCellX: number
    let centerCellY: number
    if (cur) {
      centerCellX = cur.mapX + cur.width / 2
      centerCellY = cur.mapY + cur.height / 2
    } else {
      const known = Object.values(service.data.rooms).filter((r) => this.isVisible(service, r))
      if (known.length === 0) return { x: view.x, y: view.y }
      const minX = Math.min(...known.map((r) => r.mapX))
      const maxX = Math.max(...known.map((r) => r.mapX + r.width))
      const minY = Math.min(...known.map((r) => r.mapY))
      const maxY = Math.max(...known.map((r) => r.mapY + r.height))
      centerCellX = (minX + maxX) / 2
      centerCellY = (minY + maxY) / 2
    }
    return {
      x: view.x + view.width / 2 - centerCellX * view.cellSize,
      y: view.y + view.height / 2 - centerCellY * view.cellSize,
    }
  }

  private isVisible(service: MapService, room: Room): boolean {
    if (service.debugRevealAll) return true
    const s = service.state.getState(room.id)
    if (s === 'unknown') return false
    // A secret room stays hidden until actually discovered/visited.
    if (room.secret && s === 'revealed') return false
    return true
  }

  private roomRect(room: Room, offset: { x: number; y: number }, cell: number): { x: number; y: number; w: number; h: number } {
    return {
      x: offset.x + room.mapX * cell + this.gap,
      y: offset.y + room.mapY * cell + this.gap,
      w: room.width * cell - this.gap * 2,
      h: room.height * cell - this.gap * 2,
    }
  }

  private drawRoom(ctx: CanvasRenderingContext2D, service: MapService, room: Room, offset: { x: number; y: number }, cell: number, pulse: number): void {
    if (!this.isVisible(service, room)) return
    const state = service.debugRevealAll && service.state.getState(room.id) === 'unknown' ? 'revealed' : service.state.getState(room.id)
    const isCurrent = service.state.currentRoomId === room.id
    const r = this.roomRect(room, offset, cell)

    if (state === 'revealed' && !isCurrent) {
      // Outline only.
      ctx.strokeStyle = COLORS.revealedOutline
      ctx.lineWidth = 2
      ctx.strokeRect(r.x, r.y, r.w, r.h)
      return
    }

    let fill = COLORS.discoveredFill
    let border = COLORS.discoveredBorder
    if (isCurrent) {
      fill = `rgba(232, 212, 160, ${0.5 + 0.4 * pulse})`
      border = COLORS.currentBorder
    } else if (state === 'visited') {
      fill = COLORS.visitedFill
      border = COLORS.visitedBorder
    }
    ctx.fillStyle = fill
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeStyle = border
    ctx.lineWidth = 2
    ctx.strokeRect(r.x, r.y, r.w, r.h)

    for (const icon of room.icons) this.drawIcon(ctx, icon, r.x + r.w / 2, r.y + r.h / 2, room, service)
  }

  /** Short connector stubs between a room and its linked neighbours. */
  private drawConnections(ctx: CanvasRenderingContext2D, service: MapService, room: Room, offset: { x: number; y: number }, cell: number): void {
    if (!this.isVisible(service, room)) return
    const r = this.roomRect(room, offset, cell)
    for (const conn of room.connections) {
      const other = service.getRoom(conn.to)
      if (!other || !this.isVisible(service, other)) continue
      if (conn.type === 'secret' && !service.state.isDiscovered(room.id)) continue
      const color =
        conn.type === 'locked' ? COLORS.connLocked : conn.type === 'ability' ? COLORS.connAbility : conn.type === 'secret' ? COLORS.connSecret : COLORS.connNormal
      ctx.fillStyle = color
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      const t = 5 // stub thickness
      if (conn.direction === 'right') ctx.fillRect(r.x + r.w, cy - t / 2, this.gap * 2, t)
      else if (conn.direction === 'left') ctx.fillRect(r.x - this.gap * 2, cy - t / 2, this.gap * 2, t)
      else if (conn.direction === 'down') ctx.fillRect(cx - t / 2, r.y + r.h, t, this.gap * 2)
      else if (conn.direction === 'up') ctx.fillRect(cx - t / 2, r.y - this.gap * 2, t, this.gap * 2)
    }
  }

  private drawIcon(ctx: CanvasRenderingContext2D, icon: RoomIcon, cx: number, cy: number, room: Room, service: MapService): void {
    ctx.save()
    if (icon === 'save') {
      ctx.fillStyle = COLORS.save
      this.diamond(ctx, cx, cy, 5)
    } else if (icon === 'warp') {
      ctx.fillStyle = COLORS.warp
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill()
    } else if (icon === 'boss') {
      ctx.fillStyle = COLORS.boss
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
    } else if (icon === 'item') {
      const collected = service.state.isItemCollected(room.id)
      ctx.fillStyle = collected ? COLORS.itemDim : COLORS.item
      this.star(ctx, cx, cy, collected ? 4 : 6)
    }
    ctx.restore()
  }

  private diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy)
    ctx.closePath(); ctx.fill()
  }

  private star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const px = cx + Math.cos(a) * rad
      const py = cy + Math.sin(a) * rad
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath(); ctx.fill()
  }
}
