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
  /** Fit all visible rooms into the view (pause map) instead of centring on the
   *  current room at a fixed cell size (minimap). */
  fit?: boolean
  /** Draw a pulsing gold selection ring around this room (warp-select UI). */
  highlightRoomId?: string | undefined
}

// Aria-of-Sorrow map palette: royal-blue explored rooms on near-black, red save/
// warp cells, bright-blue corridors, a white flash on the current room.
const COLORS = {
  panel: 'rgba(4, 4, 10, 0.96)',
  border: '#3a4a86',
  revealedOutline: '#1c2a66', // seen but not entered — faint blue ghost
  discoveredFill: '#1a2fb0',
  discoveredBorder: '#4a63e6',
  visitedFill: '#2340dc',
  visitedBorder: '#6f8cff',
  currentFill: '#eaf0ff',
  currentBorder: '#ffffff',
  saveFill: '#c81e28', // save/warp rooms read as red squares, as in Aria
  saveBorder: '#ff6a72',
  connNormal: '#2f50e0',
  connLocked: '#c8a24a',
  connAbility: '#a06adc',
  connSecret: '#3a3a72',
  save: '#bfe6ff',
  warp: '#c86adc',
  boss: '#e0393a',
  item: '#f6b74a',
  itemDim: '#7a6a3a',
}

export class MapRenderer {
  private readonly gap = 2 // px inset so adjacent rooms read as separate cells

  draw(ctx: CanvasRenderingContext2D, service: MapService, view: MapView, opts: MapDrawOptions = {}): void {
    ctx.save()
    // Clip + panel background.
    ctx.beginPath()
    ctx.rect(view.x, view.y, view.width, view.height)
    ctx.clip()
    ctx.fillStyle = COLORS.panel
    ctx.fillRect(view.x, view.y, view.width, view.height)

    const { cellSize, offset } = opts.fit ? this.fitView(service, view) : { cellSize: view.cellSize, offset: this.computeOffset(service, view, view.cellSize) }
    const rooms = Object.values(service.data.rooms)

    if (opts.showConnections) {
      for (const room of rooms) this.drawConnections(ctx, service, room, offset, cellSize)
    }
    for (const room of rooms) this.drawRoom(ctx, service, room, offset, cellSize, opts.pulse ?? 0)

    // Selection ring (drawn last so it sits above neighbouring cells).
    if (opts.highlightRoomId) {
      const room = service.data.rooms[opts.highlightRoomId]
      if (room && this.isVisible(service, room)) {
        const r = this.roomRect(room, offset, cellSize)
        const pulse = opts.pulse ?? 0
        ctx.strokeStyle = `rgba(246, 202, 74, ${0.55 + 0.45 * pulse})`
        ctx.lineWidth = 3
        ctx.strokeRect(r.x - 3.5, r.y - 3.5, r.w + 7, r.h + 7)
      }
    }
    ctx.restore()
  }

  /** Scale + position so every visible room fits inside the view. */
  private fitView(service: MapService, view: MapView): { cellSize: number; offset: { x: number; y: number } } {
    const visible = Object.values(service.data.rooms).filter((r) => this.isVisible(service, r))
    if (visible.length === 0) return { cellSize: view.cellSize, offset: { x: view.x, y: view.y } }
    const minX = Math.min(...visible.map((r) => r.mapX))
    const maxX = Math.max(...visible.map((r) => r.mapX + r.width))
    const minY = Math.min(...visible.map((r) => r.mapY))
    const maxY = Math.max(...visible.map((r) => r.mapY + r.height))
    const cols = Math.max(1, maxX - minX)
    const rows = Math.max(1, maxY - minY)
    const pad = 24
    const cellSize = Math.max(8, Math.min((view.width - pad * 2) / cols, (view.height - pad * 2) / rows, 64))
    const gridW = cols * cellSize
    const gridH = rows * cellSize
    return {
      cellSize,
      offset: {
        x: view.x + (view.width - gridW) / 2 - minX * cellSize,
        y: view.y + (view.height - gridH) / 2 - minY * cellSize,
      },
    }
  }

  /** Centre the current room (or the known-room bounds) inside the view. */
  private computeOffset(service: MapService, view: MapView, cellSize: number): { x: number; y: number } {
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
      x: view.x + view.width / 2 - centerCellX * cellSize,
      y: view.y + view.height / 2 - centerCellY * cellSize,
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
      // Seen but not entered — a faint blue ghost outline.
      ctx.fillStyle = 'rgba(20, 34, 110, 0.35)'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeStyle = COLORS.revealedOutline
      ctx.lineWidth = 1.5
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
      return
    }

    // Save/warp rooms are red squares in the Aria map; everything else is blue,
    // brighter once actually visited. The current room flashes white.
    let fill = COLORS.discoveredFill
    let border = COLORS.discoveredBorder
    if (room.hasSave || room.hasWarp) {
      fill = COLORS.saveFill
      border = COLORS.saveBorder
    } else if (state === 'visited') {
      fill = COLORS.visitedFill
      border = COLORS.visitedBorder
    }
    if (isCurrent) {
      // Blend the room's own colour toward white so the pulse still reads red on
      // a save room, blue on a normal one.
      ctx.fillStyle = fill
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + 0.35 * pulse})`
      ctx.fillRect(r.x, r.y, r.w, r.h)
      border = COLORS.currentBorder
    } else {
      ctx.fillStyle = fill
      ctx.fillRect(r.x, r.y, r.w, r.h)
    }
    ctx.strokeStyle = border
    ctx.lineWidth = isCurrent ? 2.5 : 1.5
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)

    // The red cell already signals a save/warp; only draw the non-save icons.
    for (const icon of room.icons) {
      if (icon === 'save' || icon === 'warp') continue
      this.drawIcon(ctx, icon, r.x + r.w / 2, r.y + r.h / 2, room, service)
    }
  }

  /** Corridors bridging the gap between a room and its linked neighbours, drawn
   *  along the shared edge so different-sized rooms still connect cleanly. */
  private drawConnections(ctx: CanvasRenderingContext2D, service: MapService, room: Room, offset: { x: number; y: number }, cell: number): void {
    if (!this.isVisible(service, room)) return
    const r = this.roomRect(room, offset, cell)
    for (const conn of room.connections) {
      const other = service.getRoom(conn.to)
      if (!other || !this.isVisible(service, other)) continue
      if (conn.type === 'secret' && !service.state.isDiscovered(room.id)) continue
      const o = this.roomRect(other, offset, cell)
      ctx.fillStyle =
        conn.type === 'locked' ? COLORS.connLocked : conn.type === 'ability' ? COLORS.connAbility : conn.type === 'secret' ? COLORS.connSecret : COLORS.connNormal
      const t = 5
      if (conn.direction === 'right' || conn.direction === 'left') {
        const overlapTop = Math.max(r.y, o.y)
        const overlapBot = Math.min(r.y + r.h, o.y + o.h)
        const y = (overlapTop < overlapBot ? (overlapTop + overlapBot) / 2 : r.y + r.h / 2) - t / 2
        const x1 = conn.direction === 'right' ? r.x + r.w : o.x + o.w
        const x2 = conn.direction === 'right' ? o.x : r.x
        ctx.fillRect(Math.min(x1, x2), y, Math.abs(x2 - x1), t)
      } else {
        const overlapL = Math.max(r.x, o.x)
        const overlapR = Math.min(r.x + r.w, o.x + o.w)
        const x = (overlapL < overlapR ? (overlapL + overlapR) / 2 : r.x + r.w / 2) - t / 2
        const y1 = conn.direction === 'down' ? r.y + r.h : o.y + o.h
        const y2 = conn.direction === 'down' ? o.y : r.y
        ctx.fillRect(x, Math.min(y1, y2), t, Math.abs(y2 - y1))
      }
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
