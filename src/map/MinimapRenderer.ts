/**
 * MinimapRenderer — a small always-on map for gameplay. It reuses MapRenderer
 * with a compact view centred on the current room, so you only see the current
 * room plus nearby discovered rooms (everything else is clipped away).
 */
import { MapRenderer, type MapView } from './MapRenderer.ts'
import type { MapService } from './MapService.ts'

export interface MinimapOptions {
  /** Corner box position + size on the canvas. */
  x: number
  y: number
  width: number
  height: number
  /** Pixels per map cell (smaller than the full map). */
  cellSize?: number
  pulse?: number
}

export class MinimapRenderer {
  private readonly renderer = new MapRenderer()

  draw(ctx: CanvasRenderingContext2D, service: MapService, opts: MinimapOptions): void {
    const view: MapView = {
      x: opts.x,
      y: opts.y,
      width: opts.width,
      height: opts.height,
      cellSize: opts.cellSize ?? 18,
    }
    // Frame.
    ctx.save()
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(view.x, view.y, view.width, view.height)
    ctx.restore()
    // The map itself (clipped to the box, no connectors to keep it tidy).
    this.renderer.draw(ctx, service, view, { pulse: opts.pulse ?? 0, showConnections: false })
  }
}
