import { ROSTER } from './characters/registry.ts'
import type { CharacterDef } from './characters/CharacterDef.ts'
import type { AIDifficulty } from '../input/AISource.ts'

/** A run through the arcade ladder: the player's fighter, the ordered gauntlet
 *  of CPU opponents, and how far in they are. */
export interface ArcadeRun {
  player: CharacterDef
  ladder: readonly CharacterDef[]
  stage: number
}

export function arcadeDifficulty(stage: number): AIDifficulty {
  if (stage <= 0) return 'easy'
  if (stage === 1) return 'normal'
  return 'hard'
}

/** Build the gauntlet for a chosen fighter: every other roster member first,
 *  then a mirror match against the player's own character as the finale. */
export function startArcadeRun(player: CharacterDef): ArcadeRun {
  const others = ROSTER.filter((c) => c.id !== player.id)
  const ladder: readonly CharacterDef[] = others.length > 0 ? [...others, player] : ROSTER
  return { player, ladder, stage: 0 }
}
