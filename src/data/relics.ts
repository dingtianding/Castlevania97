import type { Rng } from '../core/rng.ts'

export type RelicId = 'vitality' | 'fury' | 'focus' | 'quickstep' | 'catalyst'

export interface RelicDef {
  id: RelicId
  name: string
  blurb: string
  maxHealthBonus: number
  damageMultiplier: number
  meterGainMultiplier: number
  moveSpeedMultiplier: number
  startMeterBonus: number
}

export interface RunModifiers {
  maxHealthBonus: number
  damageMultiplier: number
  meterGainMultiplier: number
  moveSpeedMultiplier: number
  startMeterBonus: number
}

export const RELIC_POOL: readonly RelicDef[] = [
  {
    id: 'vitality',
    name: 'Vitality Charm',
    blurb: 'Gain 20 max health. The run gets harder, but you have more room to breathe.',
    maxHealthBonus: 20,
    damageMultiplier: 1,
    meterGainMultiplier: 1,
    moveSpeedMultiplier: 1,
    startMeterBonus: 0,
  },
  {
    id: 'fury',
    name: 'Fury Sigil',
    blurb: 'Deal 15% more damage. Fast routes become much more valuable.',
    maxHealthBonus: 0,
    damageMultiplier: 1.15,
    meterGainMultiplier: 1,
    moveSpeedMultiplier: 1,
    startMeterBonus: 0,
  },
  {
    id: 'focus',
    name: 'Focus Locket',
    blurb: 'Gain 25% more meter from every hit. Supers come online faster.',
    maxHealthBonus: 0,
    damageMultiplier: 1,
    meterGainMultiplier: 1.25,
    moveSpeedMultiplier: 1,
    startMeterBonus: 0,
  },
  {
    id: 'quickstep',
    name: 'Quickstep Ring',
    blurb: 'Move 10% faster. Positioning becomes easier and punish windows shrink.',
    maxHealthBonus: 0,
    damageMultiplier: 1,
    meterGainMultiplier: 1,
    moveSpeedMultiplier: 1.1,
    startMeterBonus: 0,
  },
  {
    id: 'catalyst',
    name: 'Catalyst Ember',
    blurb: 'Start each stage with 30 meter. You can threaten supers immediately.',
    maxHealthBonus: 0,
    damageMultiplier: 1,
    meterGainMultiplier: 1,
    moveSpeedMultiplier: 1,
    startMeterBonus: 30,
  },
]

export function buildRunModifiers(relics: readonly RelicDef[]): RunModifiers {
  return relics.reduce<RunModifiers>(
    (mods, relic) => ({
      maxHealthBonus: mods.maxHealthBonus + relic.maxHealthBonus,
      damageMultiplier: mods.damageMultiplier * relic.damageMultiplier,
      meterGainMultiplier: mods.meterGainMultiplier * relic.meterGainMultiplier,
      moveSpeedMultiplier: mods.moveSpeedMultiplier * relic.moveSpeedMultiplier,
      startMeterBonus: Math.max(mods.startMeterBonus, relic.startMeterBonus),
    }),
    {
      maxHealthBonus: 0,
      damageMultiplier: 1,
      meterGainMultiplier: 1,
      moveSpeedMultiplier: 1,
      startMeterBonus: 0,
    },
  )
}

export function draftRelics(rng: Rng, takenIds: readonly RelicId[] = [], count = 3): RelicDef[] {
  const pool = RELIC_POOL.filter((relic) => !takenIds.includes(relic.id))
  const picks: RelicDef[] = []
  while (picks.length < count && pool.length > 0) {
    const index = rng.int(0, pool.length - 1)
    const [picked] = pool.splice(index, 1)
    if (picked) picks.push(picked)
  }
  return picks
}
