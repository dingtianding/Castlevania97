import type { Renderer } from './Renderer.ts'
import type { Rng } from '../core/rng.ts'
import type { Vec2 } from '../types.ts'

const MAX_SHAKE = 16
const TRAUMA_DECAY = 0.05

/** World-to-screen transform with trauma-based screen shake. Drawing is
 *  bracketed by begin()/end() so the transform is pushed and popped each frame.
 *  Shake offset scales with trauma² for a punchy falloff and is suppressed when
 *  the user prefers reduced motion. */
export class Camera {
  readonly position: Vec2 = { x: 0, y: 0 }
  readonly shake: Vec2 = { x: 0, y: 0 }
  reduceMotion = false

  private trauma = 0

  /** Add a shake impulse in [0,1]; stacks up to a full-strength shake. */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** Advance shake one tick; call once per logical update for determinism. */
  tick(rng: Rng): void {
    if (this.trauma <= 0) {
      this.shake.x = 0
      this.shake.y = 0
      return
    }
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY)
    if (this.reduceMotion) {
      this.shake.x = 0
      this.shake.y = 0
      return
    }
    const magnitude = this.trauma * this.trauma * MAX_SHAKE
    this.shake.x = (rng.next() * 2 - 1) * magnitude
    this.shake.y = (rng.next() * 2 - 1) * magnitude
  }

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
