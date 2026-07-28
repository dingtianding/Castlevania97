/**
 * Bullet Souls — the Aria-of-Sorrow "red soul" cast on the magic (U) button.
 * The player always owns the base Soul Bolt; defeating certain enemies can drop
 * alternative souls that change the cast pattern. Owned souls live on the save
 * and are cycled with the swap key; each costs MP per cast.
 */
export type SoulPattern = 'spear' | 'bolt' | 'spread' | 'homing' | 'nova'

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

export const BASE_BULLET_SOUL = 'skeleton-soul'

// Canon check (see docs/ARIA_PARITY.md): skeleton-soul, legion-soul,
// giant-skeleton-soul, zombie-soldier-soul, winged-skeleton-soul,
// beam-skeleton-soul, skull-archer-soul, and waiter-skeleton-soul are all real
// canon Bullet Souls with a matching in-repo enemy source. death-soul is a
// canon reclassification — Death's real soul is a Guardian (hold-to-channel)
// soul in Aria of Sorrow, but "throws multiple scythes around the screen"
// mechanically fits this engine's one-shot nova pattern better than a stat
// buff, so it is modeled here as a Bullet Soul instead. The "-original" entries
// have no confirmed canon soul source among enemies built here.
export const BULLET_SOUL_POOL: readonly BulletSoulDef[] = [
  {
    id: 'skeleton-soul',
    name: 'Skeleton Soul',
    enemyId: 'skeleton',
    dropChance: 0,
    mpCost: 8,
    pattern: 'spear',
    blurb: 'Canon effect: an arced bone toss — the first soul most Belmont-line hunters find.',
    base: true,
  },
  {
    id: 'giant-skeleton-soul',
    name: 'Giant Skeleton Soul',
    enemyId: 'giantSkeleton',
    dropChance: 0.24,
    mpCost: 19,
    pattern: 'bolt',
    blurb: 'Canon effect: a skull projectile. Modeled here as a straight-line bolt.',
  },
  {
    id: 'zombie-soldier-soul',
    name: 'Zombie Soldier Soul',
    enemyId: 'zombieSoldier',
    dropChance: 0.2,
    mpCost: 14,
    pattern: 'bolt',
    blurb: 'Canon effect: a timed grenade toss. Modeled here as a straight throw, without the fuse-delay/explosion timing.',
  },
  {
    id: 'winged-skeleton-soul',
    name: 'Winged Skeleton Soul',
    enemyId: 'wingedSkeleton',
    dropChance: 0.22,
    mpCost: 23,
    pattern: 'spear',
    blurb: 'Canon effect: a low-arc spear throw. Name, source, and MP cost all match canon; the arcing spear pattern is a direct fit.',
  },
  {
    id: 'beam-skeleton-soul',
    name: 'Beam Skeleton Soul',
    enemyId: 'beamSkeleton',
    dropChance: 0.2,
    mpCost: 28,
    pattern: 'bolt',
    blurb: 'Canon effect: a straight beam. Name, source, and MP cost all match canon.',
  },
  {
    id: 'skull-archer-soul',
    name: 'Skull Archer Soul',
    enemyId: 'skullArcher',
    dropChance: 0.26,
    mpCost: 8,
    pattern: 'bolt',
    blurb: 'Canon effect: a summoned bow fires an arrow. Name, source, and MP cost all match canon.',
  },
  {
    id: 'waiter-skeleton-soul',
    name: 'Waiter Skeleton Soul',
    enemyId: 'waiterSkeleton',
    dropChance: 0.18,
    mpCost: 30,
    pattern: 'nova',
    blurb: 'Canon effect: a curry plate that deals continuous damage. Modeled here as a one-shot burst since this engine has no damage-over-time system yet.',
  },
  {
    id: 'legion-soul',
    name: 'Legion Soul',
    enemyId: 'legion',
    dropChance: 1,
    mpCost: 66,
    pattern: 'nova',
    blurb: 'Canon effect: a tentacle laser array. Modeled here as a ring burst.',
  },
  {
    id: 'death-soul',
    name: 'Death Soul',
    enemyId: 'death',
    dropChance: 1,
    mpCost: 40,
    pattern: 'nova',
    blurb: 'Canon effect: throws multiple scythes around the screen (a Guardian soul in canon). Modeled here as a ring burst since it fits this engine as a one-shot Bullet Soul.',
  },
  {
    id: 'feral-volley-original',
    name: 'Feral Volley (original)',
    enemyId: 'ghoul',
    dropChance: 0.16,
    mpCost: 45,
    pattern: 'spread',
    blurb: 'Not from Aria of Sorrow — Ghoul is not a confirmed soul-dropper. Original content: a three-way spread.',
  },
  {
    id: 'seeker-soul-original',
    name: 'Seeker Soul (original)',
    enemyId: 'boneThrower',
    dropChance: 0.18,
    mpCost: 45,
    pattern: 'homing',
    blurb: 'Not from Aria of Sorrow — Bone Thrower is not a confirmed soul-dropper (closest canon analog: Ghost, a homing spirit). Original content: a homing bolt.',
  },
  {
    id: 'iron-nova-original',
    name: 'Iron Nova (original)',
    enemyId: 'armoredSkeleton',
    dropChance: 0.22,
    mpCost: 60,
    pattern: 'nova',
    blurb: 'Not from Aria of Sorrow — this Armored Skeleton is not a confirmed soul-dropper. Original content: a ring of force.',
  },
]

export function getBulletSoul(id: string): BulletSoulDef | undefined {
  return BULLET_SOUL_POOL.find((soul) => soul.id === id)
}

/** The droppable (non-base) bullet soul tied to an enemy, if any. */
export function bulletSoulForEnemy(enemyId: string): BulletSoulDef | undefined {
  return BULLET_SOUL_POOL.find((soul) => !soul.base && soul.enemyId === enemyId)
}
