import type { Fighter } from '../entities/Fighter.ts'
import { rectsOverlap } from '../core/math.ts'

export interface HitEvent {
  attacker: Fighter
  defender: Fighter
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
    if (!rectsOverlap(move.box, defender.hurtbox())) return

    defender.applyHit(move.spec, attacker.position.x)
    attacker.markAttackConnected()
    out.push({ attacker, defender })
  }
}
