import type { Rect, Facing } from '../types.ts'

/** Hitbox placement relative to a fighter's feet point, authored facing-right
 *  (forward = +x). Mirrored automatically when the fighter faces left. */
export interface HitboxSpec {
  /** Distance from the fighter's center to the box's near (forward) edge. */
  forward: number
  /** Height of the box's TOP edge above the feet (larger = higher up). */
  top: number
  width: number
  height: number
}

/**
 * Frame-data definition of an attack. Replaces the original `framesCurrent === 4`
 * magic: an attack is `startup` ticks of wind-up, `active` ticks where the
 * hitbox is live, then `recovery` ticks of cool-down — all refresh-rate-stable.
 */
export interface AttackMove {
  id: string
  animKey: 'attack1' | 'attack2'
  startup: number
  active: number
  recovery: number
  damage: number
  knockbackX: number
  knockbackY: number
  /** Ticks of hitstop applied on connect (consumed in P5). */
  hitstop: number
  hitbox: HitboxSpec
}

export function totalFrames(move: AttackMove): number {
  return move.startup + move.active + move.recovery
}

/** True while the attack's hitbox is live (during the active window). */
export function isActiveAt(move: AttackMove, elapsed: number): boolean {
  return elapsed >= move.startup && elapsed < move.startup + move.active
}

/** Resolve a hitbox spec to a world-space AABB for the given feet point/facing. */
export function computeHitbox(
  spec: HitboxSpec,
  feetX: number,
  feetY: number,
  facing: Facing,
): Rect {
  const x = facing === 1 ? feetX + spec.forward : feetX - spec.forward - spec.width
  return { x, y: feetY - spec.top, width: spec.width, height: spec.height }
}
