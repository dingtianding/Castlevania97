/**
 * Level-up power-ups — a roguelite perk pool. Each level-up offers three of
 * these and the player keeps one; unlike relics they are repeatable and stack,
 * so the counts live on the campaign save as `perks[id] = timesTaken`. The
 * per-stack effects are applied in CampaignScene's stat computations.
 */
import type { Rng } from '../core/rng.ts'

export type PowerUpId = 'vigor' | 'might' | 'ward' | 'swiftness' | 'focus'

export interface PowerUpDef {
  id: PowerUpId
  name: string
  blurb: string
  /** Short "+18 MAX HP" style summary of one stack. */
  tag: string
}

export const POWERUP_POOL: readonly PowerUpDef[] = [
  {
    id: 'vigor',
    name: 'Vigor',
    blurb: 'The hunt hardens your body. More health to spend before the castle spends you.',
    tag: '+18 MAX HP',
  },
  {
    id: 'might',
    name: 'Might',
    blurb: 'Every kill sharpens the whip. Your strikes land heavier.',
    tag: '+7% ATTACK',
  },
  {
    id: 'ward',
    name: 'Ward',
    blurb: 'You learn the castle’s blows before they fall. Take less from every hit.',
    tag: '+5% DEFENSE',
  },
  {
    id: 'swiftness',
    name: 'Swiftness',
    blurb: 'Belmont footwork, earned the hard way. Move a step faster.',
    tag: '+6% MOVE SPD',
  },
  {
    id: 'focus',
    name: 'Focus',
    blurb: 'Discipline in the dark. Build your special meter faster with every hit.',
    tag: '+12% METER',
  },
]

export function getPowerUp(id: string): PowerUpDef | undefined {
  return POWERUP_POOL.find((perk) => perk.id === id)
}

export function powerUpStacks(perks: Readonly<Record<string, number>>, id: string): number {
  return perks[id] ?? 0
}

/** Pick `count` distinct power-ups at random for a level-up choice. Perks stack,
 *  so nothing is excluded by what the player already owns. */
export function draftPowerUps(rng: Rng, count = 3): PowerUpDef[] {
  const pool = [...POWERUP_POOL]
  const picks: PowerUpDef[] = []
  while (picks.length < count && pool.length > 0) {
    const index = rng.int(0, pool.length - 1)
    const [picked] = pool.splice(index, 1)
    if (picked) picks.push(picked)
  }
  return picks
}
