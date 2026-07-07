/**
 * Bullet Souls — the Aria-of-Sorrow "red soul" cast on the magic (U) button.
 * The player always owns the base Soul Bolt; defeating certain enemies can drop
 * alternative souls that change the cast pattern. Owned souls live on the save
 * and are cycled with the swap key; each costs MP per cast.
 */
export type SoulPattern = 'bolt' | 'spread' | 'homing' | 'nova'

export interface BulletSoulDef {
  id: string
  name: string
  /** Which enemy id can drop this soul; the base soul has none. */
  enemyId?: string
  dropChance: number
  mpCost: number
  pattern: SoulPattern
  blurb: string
  /** The base soul is always owned and cannot be dropped. */
  base?: boolean
}

export const BASE_BULLET_SOUL = 'soul-bolt'

export const BULLET_SOUL_POOL: readonly BulletSoulDef[] = [
  {
    id: 'soul-bolt',
    name: 'Soul Bolt',
    dropChance: 0,
    mpCost: 35,
    pattern: 'bolt',
    blurb: 'A single piercing bolt of spirit energy.',
    base: true,
  },
  {
    id: 'feral-volley',
    name: 'Feral Volley',
    enemyId: 'ghoul',
    dropChance: 0.16,
    mpCost: 45,
    pattern: 'spread',
    blurb: 'A three-way spread of ghoul-fury.',
  },
  {
    id: 'seeker-soul',
    name: 'Seeker Soul',
    enemyId: 'boneThrower',
    dropChance: 0.18,
    mpCost: 45,
    pattern: 'homing',
    blurb: 'A hunting bolt that curves toward the nearest prey.',
  },
  {
    id: 'iron-nova',
    name: 'Iron Nova',
    enemyId: 'armoredSkeleton',
    dropChance: 0.22,
    mpCost: 60,
    pattern: 'nova',
    blurb: 'A ring of force that erupts around you.',
  },
]

export function getBulletSoul(id: string): BulletSoulDef | undefined {
  return BULLET_SOUL_POOL.find((soul) => soul.id === id)
}

/** The droppable (non-base) bullet soul tied to an enemy, if any. */
export function bulletSoulForEnemy(enemyId: string): BulletSoulDef | undefined {
  return BULLET_SOUL_POOL.find((soul) => !soul.base && soul.enemyId === enemyId)
}
