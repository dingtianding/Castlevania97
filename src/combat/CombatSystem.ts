import type { Fighter } from '../entities/Fighter.ts'
import type { Vec2, Rect } from '../types.ts'
import { rectsOverlap } from '../core/math.ts'

export interface HitEvent {
  attacker: Fighter
  defender: Fighter
  /** Center of the hitbox/hurtbox overlap, for spawning impact FX. */
  point: Vec2
  /** Direction the defender is knocked (1 right, -1 left). */
  dir: number
  /** Ticks of hitstop the connecting move requests. */
  hitstop: number
  damage: number
}

/**
 * Resolves attacks each tick by testing the attacker's live hitbox against the
 * defender's hurtbox in world space (AABB). This replaces the original
 * `rectangularCollision` + magic-frame check; an attack lands when geometry and
 * frame data agree, and each swing connects at most once.
 */
export class CombatSystem {
  /** Resolve both directions for a pair of fighters; returns any hits landed. */
  resolve(a: Fighter, b: Fighter): HitEvent[] {
    const hits: HitEvent[] = []
    this.tryHit(a, b, hits)
    this.tryHit(b, a, hits)
    return hits
  }

  private tryHit(attacker: Fighter, defender: Fighter, out: HitEvent[]): void {
    const move = attacker.activeAttack()
    if (!move) return
    if (!defender.canBeHit()) return
    const hurt = defender.hurtbox()
    if (!rectsOverlap(move.box, hurt)) return

    const dir = defender.position.x >= attacker.position.x ? 1 : -1
    defender.applyHit(move.spec, attacker.position.x)
    attacker.markAttackConnected()
    out.push({
      attacker,
      defender,
      point: overlapCenter(move.box, hurt),
      dir,
      hitstop: move.spec.hitstop,
      damage: move.spec.damage,
    })
  }
}

function overlapCenter(a: Rect, b: Rect): Vec2 {
  const x1 = Math.max(a.x, b.x)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y1 = Math.max(a.y, b.y)
  const y2 = Math.min(a.y + a.height, b.y + b.height)
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
}
