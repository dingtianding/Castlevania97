import { ROSTER } from './characters/registry.ts'
import { demon } from './characters/demon.ts'
import type { CharacterDef } from './characters/CharacterDef.ts'
import type { AIDifficulty } from '../input/AISource.ts'
import type { RelicId } from './relics.ts'

/** A run through the arcade ladder: the player's fighter, the ordered gauntlet
 *  of CPU opponents, and how far in they are. */
export interface ArcadeRun {
  player: CharacterDef
  ladder: readonly CharacterDef[]
  stage: number
  relics: readonly RelicId[]
}

export function arcadeDifficulty(stage: number): AIDifficulty {
  if (stage <= 0) return 'easy'
  if (stage === 1) return 'normal'
  return 'hard'
}

/** Build the gauntlet for a chosen fighter: every other roster member first,
 *  then the demon boss as the finale. */
export function startArcadeRun(player: CharacterDef): ArcadeRun {
  const others = ROSTER.filter((c) => c.id !== player.id)
  const ladder: readonly CharacterDef[] = [...others, demon]
  return { player, ladder, stage: 0, relics: [] }
}

export function startBossRush(player: CharacterDef): ArcadeRun {
  return { player, ladder: [demon], stage: 0, relics: [] }
}
