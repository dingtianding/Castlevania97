/**
 * Enemy Souls — the signature Aria/Dawn of Sorrow system, pared to passive
 * "guardian" style bonuses. Defeating an enemy has a chance to drop its soul;
 * collecting one permanently boosts Julius for the run. Souls are stored on the
 * campaign save by id and their effects are summed in `buildSoulModifiers`.
 */
export interface SoulDef {
  id: string
  name: string
  /** Which enemy id can drop this soul. */
  enemyId: string
  /** Drop probability in [0,1]; bosses use 1 (guaranteed). */
  dropChance: number
  blurb: string
  maxHealthBonus?: number
  damageMultiplier?: number
  moveSpeedMultiplier?: number
  meterGainMultiplier?: number
  /** Passive traversal: lets you breathe and sink underwater instead of floating. */
  underwater?: boolean
}

export interface SoulModifiers {
  maxHealthBonus: number
  damageMultiplier: number
  moveSpeedMultiplier: number
  meterGainMultiplier: number
}

export const SOUL_POOL: readonly SoulDef[] = [
  {
    id: 'skeleton-soul',
    name: 'Bone Soldier Soul',
    enemyId: 'skeleton',
    dropChance: 0.24,
    blurb: 'The discipline of the bone guard sharpens your strikes. +6% attack.',
    damageMultiplier: 1.06,
  },
  {
    id: 'zombie-soul',
    name: 'Deadflesh Soul',
    enemyId: 'zombie',
    dropChance: 0.24,
    blurb: 'Undead stubbornness toughens your body. +12 max health.',
    maxHealthBonus: 12,
  },
  {
    id: 'ghoul-soul',
    name: 'Feral Soul',
    enemyId: 'ghoul',
    dropChance: 0.2,
    blurb: 'The ghoul lends its hunger and speed. +6% move speed.',
    moveSpeedMultiplier: 1.06,
  },
  {
    id: 'armored-soul',
    name: 'Iron Guard Soul',
    enemyId: 'armoredSkeleton',
    dropChance: 0.34,
    blurb: 'War-plate endurance settles into your bones. +18 max health.',
    maxHealthBonus: 18,
  },
  {
    id: 'drowned-soul',
    name: 'Drowned Soul',
    enemyId: 'bigGolem',
    dropChance: 1,
    blurb: 'The lungs of the drowned. Breathe underwater and sink to the depths instead of floating.',
    underwater: true,
  },
  {
    id: 'bone-thrower-soul',
    name: 'Marksman Soul',
    enemyId: 'boneThrower',
    dropChance: 0.3,
    blurb: 'A hunter’s eye and steady hand. +8% attack and faster meter.',
    damageMultiplier: 1.08,
    meterGainMultiplier: 1.15,
  },
  {
    id: 'warden-soul',
    name: 'Seal Warden Soul',
    enemyId: 'sealGuardian',
    dropChance: 1,
    blurb: 'Ritual might. +10% attack and +20 max health.',
    damageMultiplier: 1.1,
    maxHealthBonus: 20,
  },
  {
    id: 'dracula-soul',
    name: 'Crimson Shadow Soul',
    enemyId: 'dracula1999',
    dropChance: 1,
    blurb: 'A shard of the prophecy itself. +15% attack and faster meter.',
    damageMultiplier: 1.15,
    meterGainMultiplier: 1.2,
  },
]

export function soulForEnemy(enemyId: string): SoulDef | undefined {
  return SOUL_POOL.find((soul) => soul.enemyId === enemyId)
}

export function getSoul(id: string): SoulDef | undefined {
  return SOUL_POOL.find((soul) => soul.id === id)
}

export function buildSoulModifiers(soulIds: readonly string[]): SoulModifiers {
  return soulIds.reduce<SoulModifiers>(
    (mods, id) => {
      const soul = getSoul(id)
      if (!soul) return mods
      return {
        maxHealthBonus: mods.maxHealthBonus + (soul.maxHealthBonus ?? 0),
        damageMultiplier: mods.damageMultiplier * (soul.damageMultiplier ?? 1),
        moveSpeedMultiplier: mods.moveSpeedMultiplier * (soul.moveSpeedMultiplier ?? 1),
        meterGainMultiplier: mods.meterGainMultiplier * (soul.meterGainMultiplier ?? 1),
      }
    },
    { maxHealthBonus: 0, damageMultiplier: 1, moveSpeedMultiplier: 1, meterGainMultiplier: 1 },
  )
}
