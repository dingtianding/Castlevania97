import type { Renderer } from './Renderer.ts'
import type { Vec2 } from '../types.ts'

/** World-to-screen transform. P1 keeps it at the origin; shake and midpoint
 *  tracking get wired in P5. Drawing is bracketed by begin()/end() so the
 *  transform is pushed and popped cleanly each frame. */
export class Camera {
  readonly position: Vec2 = { x: 0, y: 0 }
  readonly shake: Vec2 = { x: 0, y: 0 }

  begin(renderer: Renderer): void {
    renderer.ctx.save()
    renderer.ctx.translate(
      Math.round(-this.position.x + this.shake.x),
      Math.round(-this.position.y + this.shake.y),
    )
  }

  end(renderer: Renderer): void {
    renderer.ctx.restore()
  }
}
