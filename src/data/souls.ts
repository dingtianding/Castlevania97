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
  /** Immune to the poison DoT (Poison Worm's canon effect). */
  poisonImmune?: boolean
  /** Canon "stronger while poisoned" — a live conditional bonus, not a flat
   *  one, so it isn't folded into SoulModifiers; see CampaignScene's
   *  zombieSoulPoisonMult and CastleActor.isPoisoned. */
  strongerWhilePoisoned?: boolean
}

export interface SoulModifiers {
  maxHealthBonus: number
  damageMultiplier: number
  moveSpeedMultiplier: number
  meterGainMultiplier: number
}

// Canon check (see docs/ARIA_PARITY.md): zombie-soul, headhunter-soul,
// creaking-skull-soul, skeleton-knight-soul, zombie-officer-soul,
// dead-crusader-soul, golem-soul, arc-demon-soul, iron-golem-soul,
// wooden-golem-soul, succubus-soul, minotaur-soul, ectoplasm-soul, and
// poison-worm-soul all correspond to a real Aria of Sorrow soul-dropper.
// zombie-soul and poison-worm-soul are now EXACT matches (not just
// name/source), since the poison DoT they needed now exists — see
// strongerWhilePoisoned/poisonImmune above and CampaignScene's poison
// check. The "-original" entries are homebrew for enemies with no
// confirmed canon soul — kept as gameplay content but labeled honestly
// instead of faking a source.
export const SOUL_POOL: readonly SoulDef[] = [
  {
    id: 'zombie-soul',
    name: 'Zombie Soul',
    enemyId: 'zombie',
    dropChance: 0.24,
    blurb: 'Canon effect: stronger while poisoned. Now modeled exactly — no bonus while clean, but +25% attack and move speed for as long as poison is ticking on you.',
    strongerWhilePoisoned: true,
  },
  {
    id: 'skeleton-knight-soul',
    name: 'Skeleton Knight Soul',
    enemyId: 'skeletonKnight',
    dropChance: 0.3,
    blurb: 'Canon effect: STR +4. A direct match — a modest, permanent attack boost.',
    damageMultiplier: 1.04,
  },
  {
    id: 'zombie-officer-soul',
    name: 'Zombie Officer Soul',
    enemyId: 'zombieOfficer',
    dropChance: 0.28,
    blurb: 'Canon effect: restore HP if knocked out mid-jump. That conditional trigger is not modeled yet, so it grants +8 max health instead.',
    maxHealthBonus: 8,
  },
  {
    id: 'dead-crusader-soul',
    name: 'Dead Crusader Soul',
    enemyId: 'deadCrusader',
    dropChance: 0.26,
    blurb: 'Canon effect: CON +16. A direct match — a solid, permanent toughness boost.',
    maxHealthBonus: 16,
  },
  {
    id: 'golem-soul',
    name: 'Golem Soul',
    enemyId: 'golem',
    dropChance: 0.24,
    blurb: 'Canon effect: STR +12. A direct match — a sizeable, permanent attack boost.',
    damageMultiplier: 1.12,
  },
  {
    id: 'arc-demon-soul',
    name: 'Arc Demon Soul',
    enemyId: 'arcDemon',
    dropChance: 0.2,
    blurb: 'Canon effect: +40% STR, drains enemy HP on hit. The STR boost is a direct match; the HP-drain-on-hit isn’t modeled yet.',
    damageMultiplier: 1.4,
  },
  {
    id: 'iron-golem-soul',
    name: 'Iron Golem Soul',
    enemyId: 'ironGolem',
    dropChance: 0.22,
    blurb: 'Canon effect: no stun/flinch from weak enemy attacks. That poise mechanic isn’t modeled yet, so it grants +14 max health instead.',
    maxHealthBonus: 14,
  },
  {
    id: 'wooden-golem-soul',
    name: 'Wooden Golem Soul',
    enemyId: 'woodenGolem',
    dropChance: 0.24,
    blurb: 'Canon effect: faster MP regen. This engine has no MP-regen mechanic, so it grants faster super-meter gain instead, the closest resource this engine has.',
    meterGainMultiplier: 1.12,
  },
  {
    id: 'succubus-soul',
    name: 'Succubus Soul',
    enemyId: 'succubus',
    dropChance: 0.2,
    blurb: 'Canon effect: heal on landing a hit. That lifesteal-on-attack mechanic isn’t modeled yet, so it grants +10 max health instead.',
    maxHealthBonus: 10,
  },
  {
    id: 'headhunter-soul',
    name: 'Headhunter Soul',
    enemyId: 'headhunter',
    dropChance: 1,
    blurb: 'Canon effect: every stat scales with total souls collected. Approximated here as a flat all-round boost.',
    damageMultiplier: 1.08,
    maxHealthBonus: 15,
    moveSpeedMultiplier: 1.04,
  },
  {
    id: 'creaking-skull-soul',
    name: 'Creaking Skull Soul',
    enemyId: 'creakingSkull',
    dropChance: 1,
    blurb: 'Canon type is a Guardian soul (a giant bone-arm attack); approximated here as a passive attack boost.',
    damageMultiplier: 1.1,
  },
  {
    id: 'ghoul-soul-original',
    name: 'Feral Soul (original)',
    enemyId: 'ghoul',
    dropChance: 0.2,
    blurb: 'Not from Aria of Sorrow — Ghoul is not a confirmed soul-dropper in any published list. Original content: +6% move speed.',
    moveSpeedMultiplier: 1.06,
  },
  {
    id: 'bone-thrower-soul-original',
    name: 'Marksman Soul (original)',
    enemyId: 'boneThrower',
    dropChance: 0.3,
    blurb: 'Not from Aria of Sorrow — Bone Thrower is not a confirmed soul-dropper. Original content: +8% attack, faster meter.',
    damageMultiplier: 1.08,
    meterGainMultiplier: 1.15,
  },
  {
    id: 'armored-soul-original',
    name: 'Iron Guard Soul (original)',
    enemyId: 'armoredSkeleton',
    dropChance: 0.34,
    blurb: 'Not from Aria of Sorrow — this Armored Skeleton is not a confirmed soul-dropper. Original content: +18 max health.',
    maxHealthBonus: 18,
  },
  {
    id: 'warden-soul-original',
    name: 'Seal Warden Soul (original)',
    enemyId: 'sealGuardian',
    dropChance: 1,
    blurb: 'Not from Aria of Sorrow — Seal Guardian is an original creature made for this project. Original content: +10% attack, +20 max health.',
    damageMultiplier: 1.1,
    maxHealthBonus: 20,
  },
  {
    id: 'dracula-soul-original',
    name: 'Crimson Shadow Soul (original)',
    enemyId: 'dracula1999',
    dropChance: 1,
    blurb: 'Not from Aria of Sorrow — an original antagonist form made for this project, distinct from canon final boss Chaos. Original content: +15% attack, faster meter.',
    damageMultiplier: 1.15,
    meterGainMultiplier: 1.2,
  },
  {
    id: 'minotaur-soul',
    name: 'Minotaur Soul',
    enemyId: 'minotaur',
    dropChance: 0.24,
    blurb: 'Canon effect: STR +8. A direct match — a solid, permanent attack boost.',
    damageMultiplier: 1.08,
  },
  {
    id: 'ectoplasm-soul',
    name: 'Ectoplasm Soul',
    enemyId: 'ectoplasm',
    dropChance: 0.22,
    blurb: 'Canon effect: curse immunity. No curse status exists in this engine yet, so it grants +6 max health instead.',
    maxHealthBonus: 6,
  },
  {
    id: 'poison-worm-soul',
    name: 'Poison Worm Soul',
    enemyId: 'poisonWorm',
    dropChance: 0.22,
    blurb: 'Canon effect: poison immunity. Now modeled exactly — poison never lands on you while this is equipped.',
    poisonImmune: true,
  },
  {
    id: 'drowned-soul',
    name: 'Drowned Soul (original)',
    enemyId: 'bigGolem',
    dropChance: 1,
    blurb: 'Modeled after Skula, the real underwater-breathing Enchant soul in canon, but granted here as a Big Golem drop since no separate Skula enemy exists yet.',
    underwater: true,
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
