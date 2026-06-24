import type { Renderer } from './Renderer.ts'
import type { Facing } from '../types.ts'

/** A horizontal strip of equal-size frames in one image. */
export interface SpriteSheet {
  readonly image: HTMLImageElement
  readonly frameWidth: number
  readonly frameHeight: number
  readonly frameCount: number
}

/** Build a sheet from a single-row image, inferring frame size from the count.
 *  Frame height is the full image height; width is `image.width / frameCount`. */
export function makeSheet(image: HTMLImageElement, frameCount: number): SpriteSheet {
  return {
    image,
    frameCount,
    frameWidth: image.width / frameCount,
    frameHeight: image.height,
  }
}

/**
 * Playback state for one sheet. Advanced once per logical tick (never per
 * render frame), so animation speed is frame-rate-independent like physics.
 */
export class Animator {
  private frame = 0
  private counter = 0

  constructor(
    private sheet: SpriteSheet,
    /** Logical ticks each frame is held. */
    private framesHold: number,
    private loop = true,
  ) {}

  /** Swap the active sheet, e.g. when a Fighter changes state. No-op if same. */
  play(sheet: SpriteSheet, framesHold: number, loop = true): void {
    if (this.sheet === sheet) return
    this.sheet = sheet
    this.framesHold = framesHold
    this.loop = loop
    this.frame = 0
    this.counter = 0
  }

  update(): void {
    this.counter += 1
    if (this.counter < this.framesHold) return
    this.counter = 0
    if (this.frame < this.sheet.frameCount - 1) {
      this.frame += 1
    } else if (this.loop) {
      this.frame = 0
    }
  }

  reset(): void {
    this.frame = 0
    this.counter = 0
  }

  get currentFrame(): number {
    return this.frame
  }

  /** True once a non-looping animation has shown its last frame. */
  get finished(): boolean {
    return !this.loop && this.frame >= this.sheet.frameCount - 1
  }

  get activeSheet(): SpriteSheet {
    return this.sheet
  }
}

/** Draw one frame of a sheet. `x`,`y` is the top-left of the destination box;
 *  `facing === -1` mirrors horizontally about that box. */
export function drawSprite(
  renderer: Renderer,
  sheet: SpriteSheet,
  frame: number,
  x: number,
  y: number,
  scale: number,
  facing: Facing = 1,
): void {
  const { ctx } = renderer
  const { image, frameWidth, frameHeight } = sheet
  const sx = frame * frameWidth
  const w = frameWidth * scale
  const h = frameHeight * scale

  if (facing === -1) {
    ctx.save()
    ctx.translate(Math.round(x + w), Math.round(y))
    ctx.scale(-1, 1)
    ctx.drawImage(image, sx, 0, frameWidth, frameHeight, 0, 0, w, h)
    ctx.restore()
  } else {
    ctx.drawImage(image, sx, 0, frameWidth, frameHeight, Math.round(x), Math.round(y), w, h)
  }
}
