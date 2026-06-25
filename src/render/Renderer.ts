/** Thin wrapper over a 2D canvas context fixed at the engine's logical
 *  resolution. All drawing happens in this logical space; CSS letterbox-scales
 *  the canvas element to the window. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D
  readonly width: number
  readonly height: number

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D rendering context unavailable')

    canvas.width = width
    canvas.height = height
    this.ctx = ctx
    this.width = width
    this.height = height
    ctx.imageSmoothingEnabled = false
  }

  clear(color = '#000'): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(0, 0, this.width, this.height)
  }
}
