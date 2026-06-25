import type { ParticleSystem } from './ParticleSystem.ts'
import type { Rng } from '../core/rng.ts'

const SPARK_COLORS = ['#ffe08a', '#ffae3b', '#ffffff', '#e64b3c']

/** Spray impact sparks at a hit point, biased in the knockback direction. */
export function emitHitSparks(
  particles: ParticleSystem,
  x: number,
  y: number,
  dir: number,
  rng: Rng,
): void {
  const base = dir >= 0 ? 0 : Math.PI
  particles.emit(
    x,
    y,
    {
      count: 16,
      speed: [2.5, 8],
      angle: [base - 1.2, base + 1.2],
      life: [14, 30],
      size: [4, 9],
      gravity: 0.25,
      colors: SPARK_COLORS,
    },
    rng,
  )
}
