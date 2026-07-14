/**
 * Blue (Guardian) Souls — the Aria "guardian" slot, activated with the ; button.
 * Each spends MP to grant a short self-buff on a cooldown; the base Stone Bulwark
 * is always owned, and stronger guardians drop from certain enemies. Owned blue
 * souls live on the campaign save; only the equipped one is castable.
 */
export type BlueSoulEffect = 'aegis' | 'frenzy' | 'haste'

export interface BlueSoulDef {
  id: string
  name: string
  /** Which enemy id can drop this soul; the base soul has none. */
  enemyId?: string
  dropChance: number
  mpCost: number
  /** Ticks before it can be cast again. */
  cooldown: number
  /** Ticks the buff stays active. */
  duration: number
  effect: BlueSoulEffect
  blurb: string
  /** The base soul is always owned and cannot be dropped. */
  base?: boolean
}

export const BASE_BLUE_SOUL = 'guard-bulwark'

export const BLUE_SOUL_POOL: readonly BlueSoulDef[] = [
  {
    id: 'guard-bulwark',
    name: 'Stone Bulwark',
    dropChance: 0,
    mpCost: 40,
    cooldown: 180,
    duration: 150,
    effect: 'aegis',
    blurb: 'Raise a stone ward — take 60% less damage for a few seconds.',
    base: true,
  },
  {
    id: 'guard-frenzy',
    name: 'Berserker Spirit',
    enemyId: 'skeleton',
    dropChance: 0.18,
    mpCost: 45,
    cooldown: 240,
    duration: 210,
    effect: 'frenzy',
    blurb: 'A battle-fury that raises your attack by 45% for a while.',
  },
  {
    id: 'guard-gale',
    name: 'Gale Familiar',
    enemyId: 'ghoul',
    dropChance: 0.2,
    mpCost: 35,
    cooldown: 210,
    duration: 240,
    effect: 'haste',
    blurb: 'Wind at your heels — +40% move speed for a while.',
  },
]

export function getBlueSoul(id: string): BlueSoulDef | undefined {
  return BLUE_SOUL_POOL.find((soul) => soul.id === id)
}

/** The droppable (non-base) blue soul tied to an enemy, if any. */
export function blueSoulForEnemy(enemyId: string): BlueSoulDef | undefined {
  return BLUE_SOUL_POOL.find((soul) => !soul.base && soul.enemyId === enemyId)
}
