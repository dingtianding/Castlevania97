import type { Renderer } from '../render/Renderer.ts'
import type { Rng } from '../core/rng.ts'

interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  gravity: number
  color: string
}

export interface EmitOptions {
  count: number
  /** [min, max] initial speed (px/tick). */
  speed: [number, number]
  /** [min, max] emission angle in radians. */
  angle: [number, number]
  /** [min, max] lifetime in ticks. */
  life: [number, number]
  /** [min, max] particle size in px. */
  size: [number, number]
  gravity: number
  colors: string[]
}

/**
 * Fixed-capacity particle pool — no per-hit allocation, so spark bursts don't
 * cause GC hitches. Advanced on the logical tick (deterministic with the
 * seeded RNG); drawn each render frame from current state.
 */
export class ParticleSystem {
  private readonly pool: Particle[] = []

  constructor(capacity: number) {
    for (let i = 0; i < capacity; i += 1) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        gravity: 0,
        color: '#fff',
      })
    }
  }

  emit(x: number, y: number, opts: EmitOptions, rng: Rng): void {
    for (let i = 0; i < opts.count; i += 1) {
      const p = this.acquire()
      if (!p) return
      const angle = rng.range(opts.angle[0], opts.angle[1])
      const speed = rng.range(opts.speed[0], opts.speed[1])
      p.active = true
      p.x = x
      p.y = y
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.maxLife = rng.range(opts.life[0], opts.life[1])
      p.life = p.maxLife
      p.size = rng.range(opts.size[0], opts.size[1])
      p.gravity = opts.gravity
      p.color = opts.colors[rng.int(0, opts.colors.length - 1)] ?? '#fff'
    }
  }

  update(): void {
    for (const p of this.pool) {
      if (!p.active) continue
      p.vy += p.gravity
      p.x += p.vx
      p.y += p.vy
      p.life -= 1
      if (p.life <= 0) p.active = false
    }
  }

  render(renderer: Renderer): void {
    const { ctx } = renderer
    for (const p of this.pool) {
      if (!p.active) continue
      const a = Math.max(0, p.life / p.maxLife)
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      const s = Math.max(1, p.size * a)
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s))
    }
    ctx.globalAlpha = 1
  }

  private acquire(): Particle | null {
    for (const p of this.pool) if (!p.active) return p
    return null
  }
}
