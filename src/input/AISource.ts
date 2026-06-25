import { neutralIntent, type InputSource, type IntentState } from './InputSource.ts'
import type { Fighter } from '../entities/Fighter.ts'
import type { Rng } from '../core/rng.ts'

export type AIDifficulty = 'easy' | 'normal' | 'hard'

interface AIConfig {
  /** Horizontal distance at which the AI commits to attacking. */
  range: number
  /** Ticks between attack attempts (gates aggression). */
  attackCooldown: number
  heavyChance: number
  specialChance: number
  retreatChance: number
  jumpChance: number
}

const CONFIGS: Record<AIDifficulty, AIConfig> = {
  easy: { range: 150, attackCooldown: 55, heavyChance: 0.1, specialChance: 0.05, retreatChance: 0.3, jumpChance: 0.02 },
  normal: { range: 160, attackCooldown: 40, heavyChance: 0.2, specialChance: 0.12, retreatChance: 0.18, jumpChance: 0.04 },
  hard: { range: 170, attackCooldown: 30, heavyChance: 0.3, specialChance: 0.2, retreatChance: 0.1, jumpChance: 0.06 },
}

/**
 * A computer controller. It implements the same InputSource contract as the
 * keyboard, reading the world (its own fighter + the opponent) and emitting an
 * IntentState each tick — so the combat code can't tell it apart from a human.
 * Swapping a player slot to AI is the whole of "1P vs CPU".
 */
export class AISource implements InputSource {
  private self: Fighter | null = null
  private opponent: Fighter | null = null
  private cooldown = 0
  private readonly cfg: AIConfig

  constructor(
    difficulty: AIDifficulty,
    private readonly rng: Rng,
  ) {
    this.cfg = CONFIGS[difficulty]
  }

  /** Give the AI its body and its target. Called once the fighters exist. */
  bind(self: Fighter, opponent: Fighter): void {
    this.self = self
    this.opponent = opponent
  }

  poll(): IntentState {
    const intent = neutralIntent()
    const self = this.self
    const opponent = this.opponent
    if (!self || !opponent || self.isDead || opponent.isDead) return intent

    if (this.cooldown > 0) this.cooldown -= 1

    const delta = opponent.position.x - self.position.x
    const dist = Math.abs(delta)
    const dir: -1 | 1 = delta >= 0 ? 1 : -1

    if (dist < this.cfg.range) {
      if (this.cooldown === 0) {
        const roll = this.rng.next()
        if (roll < this.cfg.heavyChance) intent.heavyPressed = true
        else if (roll < this.cfg.heavyChance + this.cfg.specialChance) intent.specialPressed = true
        else intent.lightPressed = true
        this.cooldown = this.cfg.attackCooldown
      } else if (this.rng.next() < this.cfg.retreatChance) {
        intent.moveX = dir === 1 ? -1 : 1
      }
    } else {
      intent.moveX = dir
      if (this.cooldown === 0 && this.rng.next() < this.cfg.jumpChance) {
        intent.jumpPressed = true
        this.cooldown = 24
      }
    }

    return intent
  }
}
