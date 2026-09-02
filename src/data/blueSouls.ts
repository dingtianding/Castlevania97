/**
 * Blue (Guardian) Souls — the Aria "guardian" slot, activated with the ; button.
 * Each spends MP to grant a short self-buff on a cooldown; the base Flying Armor
 * is always owned, and stronger guardians drop from certain enemies. Owned blue
 * souls live on the campaign save; only the equipped one is castable.
 */
export type BlueSoulEffect = 'glide' | 'aegis' | 'frenzy' | 'haste' | 'panther' | 'golemslam' | 'flurry'

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

export const BASE_BLUE_SOUL = 'guard-panther'

// Canon check (see docs/ARIA_PARITY.md): guard-panther (Black Panther, "Sonic
// Dash" — real speed boost + real contact damage, see CampaignScene's panther
// hit check) and guard-flight (Flying Armor) are both exact canon matches.
// guard-golem has its own effect ('golemslam' — a periodic ground-slam AoE
// pulse, see CampaignScene's golem-slam check) instead of sharing 'frenzy',
// a closer mechanical match to its canon rock-arm melee attachment than a
// flat stat buff. guard-cagnazzo likewise has its own ('flurry' — a rapid,
// short-range multi-hit tick, see CampaignScene's flurry check): its canon
// effect is an action (a punching flurry), not a number, so it earned its
// own effect rather than sharing 'frenzy' with a soul whose canon effect
// really is a flat stat ("+120% STR"). guard-great-armor keeps 'frenzy' —
// unlike the other two, its canon effect is genuinely a stat multiplier, so
// the shared slot is an accurate match, not a compression. guard-manticore
// approximates Manticore's "charging beast form" as a speed buff, the
// closest available slot. guard-bulwark has no confirmed canon Guardian-soul
// source among enemies built here and is labeled original.
export const BLUE_SOUL_POOL: readonly BlueSoulDef[] = [
  {
    id: 'guard-panther',
    name: 'Black Panther Soul',
    dropChance: 0,
    mpCost: 32,
    cooldown: 140,
    duration: 240,
    effect: 'panther',
    blurb: 'Canon effect: Sonic Dash — run at high speed trailing a damaging shockwave, weak early but able to flatten lesser enemies once you have leveled up.',
    base: true,
  },
  {
    id: 'guard-flight',
    name: 'Flying Armor',
    enemyId: 'bat',
    dropChance: 0.2,
    mpCost: 28,
    cooldown: 120,
    duration: 260,
    effect: 'glide',
    blurb: 'Ride the air — greatly slow your fall for a while.',
  },
  {
    id: 'guard-golem',
    name: 'Big Golem Soul',
    enemyId: 'bigGolem',
    dropChance: 1,
    mpCost: 42,
    cooldown: 200,
    duration: 180,
    effect: 'golemslam',
    blurb: 'Canon effect: a rock-arm melee attachment. A rock arm grafts to your back and periodically slams the ground, hitting everything nearby.',
  },
  {
    id: 'guard-great-armor',
    name: 'Great Armor Soul',
    enemyId: 'greatArmor',
    dropChance: 1,
    mpCost: 50,
    cooldown: 240,
    duration: 210,
    effect: 'frenzy',
    blurb: 'Canon effect: +120% STR wreathed in red lightning. A battle-fury that raises your attack for a while.',
  },
  {
    id: 'guard-manticore',
    name: 'Manticore Soul',
    enemyId: 'manticore',
    dropChance: 1,
    mpCost: 38,
    cooldown: 210,
    duration: 240,
    effect: 'haste',
    blurb: 'Canon effect: a charging beast form. Approximated here as a burst of move speed.',
  },
  {
    id: 'guard-cagnazzo',
    name: 'Cagnazzo Soul',
    enemyId: 'cagnazzo',
    dropChance: 0.2,
    mpCost: 36,
    cooldown: 190,
    duration: 170,
    effect: 'flurry',
    blurb: 'Canon effect: a wild, uncountable flurry of bare-fisted punches. A short-range flurry of rapid punches lands on anything close while held.',
  },
  {
    id: 'guard-bulwark-original',
    name: 'Stone Bulwark (original)',
    enemyId: 'armoredSkeleton',
    dropChance: 0.22,
    mpCost: 40,
    cooldown: 180,
    duration: 150,
    effect: 'aegis',
    blurb: 'Not from Aria of Sorrow — no built enemy here is a confirmed source for a shield-type Guardian soul (canon: Final Guard/Giant Ghost/Witch). Original content: take 60% less damage for a few seconds.',
  },
]

export function getBlueSoul(id: string): BlueSoulDef | undefined {
  return BLUE_SOUL_POOL.find((soul) => soul.id === id)
}

/** The droppable (non-base) blue soul tied to an enemy, if any. */
export function blueSoulForEnemy(enemyId: string): BlueSoulDef | undefined {
  return BLUE_SOUL_POOL.find((soul) => !soul.base && soul.enemyId === enemyId)
}
