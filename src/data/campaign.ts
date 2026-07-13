import type { CharacterDef } from './characters/CharacterDef.ts'
import { armoredSkeleton, bigGolem, boneThrower, chaos, creakingSkull, death, ghoul, greatArmor, headhunter, grey, legion, manticore, skeleton, zombie } from './characters/castlevaniaCampaign.ts'
import type { StageId } from './stages.ts'
import { RELIC_POOL, type RelicId } from './relics.ts'
import { SOUL_POOL } from './souls.ts'
import { POWERUP_POOL, type PowerUpId } from './powerups.ts'
import { BASE_BULLET_SOUL, BULLET_SOUL_POOL } from './bulletSouls.ts'
import { EQUIP_SLOTS, EQUIPMENT_POOL, getEquipment, type EquipmentDef, type EquipmentId, type EquipSlot } from './equipment.ts'

const STORAGE_KEY = 'castlevania97.campaign.v1'

export interface CampaignNodeDef {
  id: string
  chapterId: string
  title: string
  year: number
  blurb: string
  story: string
  stage: StageId
  enemy: CharacterDef
  /** Optional second-wave enemy types mixed into the room for variety. */
  extraEnemies?: readonly { def: CharacterDef; count: number }[]
  difficulty: 'easy' | 'normal' | 'hard'
  nextIds: readonly string[]
  position: { x: number; y: number }
  isBoss?: boolean
}

export interface CampaignChapterDef {
  id: string
  year: number
  title: string
  intro: string
  outro: string
  nodeIds: readonly string[]
}

export interface CampaignSave {
  chapterId: string
  currentNodeId: string | null
  completedNodeIds: readonly string[]
  unlockedNodeIds: readonly string[]
  /** Rooms the player has entered — drives fog-of-war on the castle map. */
  visitedNodeIds: readonly string[]
  relicIds: readonly RelicId[]
  souls: readonly string[]
  /** Collected Bullet Souls (castable magic); the base soul is always owned. */
  bulletSouls: readonly string[]
  /** Currently equipped Bullet Soul id (defaults to the base soul). */
  equippedBulletSoul: string
  /** Owned equipment (SOTN-style inventory). */
  equipment: readonly EquipmentId[]
  /** Currently equipped piece per slot; an absent slot is empty. */
  equipped: Partial<Record<EquipSlot, EquipmentId>>
  /** Level-up power-ups, stackable: perkId -> times chosen (see powerups.ts). */
  perks: Readonly<Record<string, number>>
  /** Metroidvania traversal abilities collected (e.g. 'double-jump'). */
  abilities: readonly string[]
  /** Persistent world state keyed by stable feature id — opened chests, taken
   *  pickups, found-the-map, sprung switches, etc. A new persistent object adds
   *  a key here, never a new save field. See hasWorldFlag / setWorldFlag. */
  worldFlags: Readonly<Record<string, boolean>>
  level: number
  xp: number
  gold: number
  /** Permanent shop upgrades: each stacks a flat bonus (see CampaignScene). */
  hpUpgrades: number
  atkUpgrades: number
  armorTier: number
  finished: boolean
}

export const MAX_LEVEL = 50

/** XP required to advance from `level` to `level + 1` — a gentle linear curve. */
export function xpForNextLevel(level: number): number {
  return 24 + (level - 1) * 18
}

/** Award XP and gold to a run, applying any level-ups. Returns the new save
 *  plus how many levels were gained so the scene can celebrate + heal. */
export function grantCampaignRewards(
  save: CampaignSave,
  xpGain: number,
  goldGain: number,
): { save: CampaignSave; levelsGained: number } {
  let level = save.level
  let xp = save.xp + Math.max(0, Math.round(xpGain))
  let levelsGained = 0
  while (level < MAX_LEVEL && xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level)
    level += 1
    levelsGained += 1
  }
  if (level >= MAX_LEVEL) xp = 0
  const next: CampaignSave = { ...save, level, xp, gold: save.gold + Math.max(0, Math.round(goldGain)) }
  saveCampaignSave(next)
  return { save: next, levelsGained }
}

export interface CampaignBattleSeed {
  chapterId: string
  nodeId: string
}

export const CAMPAIGN_HERO = grey

export const CAMPAIGN_CHAPTERS: readonly CampaignChapterDef[] = [
  {
    id: 'castle-corridor',
    year: 1997,
    title: 'Castle Corridor',
    intro:
      'The gate opens onto the long corridor that runs like a spine through the castle. Young Red steps inside, and the doors seal behind him.',
    outro:
      'The corridor is his. Red reads the castle now: it is not a ruin, but a machine, and every hall feeds toward its heart.',
    nodeIds: ['cor-entrance', 'cor-grand', 'cor-alcove', 'cor-skull'],
  },
  {
    id: 'underground-reservoir',
    year: 1997,
    title: 'Underground Reservoir',
    intro:
      'Below the corridor the stone gives way to black water. The reservoir drinks the light and hides whatever the castle wants kept.',
    outro:
      'Red drains the reservoir of its keepers and climbs back toward air, colder than when he went down.',
    nodeIds: ['res-descent', 'res-cistern', 'res-golem'],
  },
  {
    id: 'chapel',
    year: 1997,
    title: 'Chapel',
    intro:
      'A chapel the castle built to mock the ones it burned. Its candles light for no god Red would name.',
    outro:
      'The chapel falls silent. Whatever prayed here is dead, and the thing in the rafters with it.',
    nodeIds: ['chp-nave', 'chp-loft', 'chp-manticore'],
  },
  {
    id: 'study',
    year: 1997,
    title: 'Study',
    intro:
      'Shelves of black glass and stolen scripture. The castle keeps a library of everyone it plans to become.',
    outro:
      'Red takes what the study will not miss and moves deeper, one more secret ahead of the war.',
    nodeIds: ['std-reading', 'std-archive'],
  },
  {
    id: 'dance-hall',
    year: 1997,
    title: 'Dance Hall',
    intro:
      'A ballroom for a court that never arrives. The music plays anyway, and the armor along the walls remembers how to move.',
    outro:
      'The last dancer is broken plate on the marble. Red crosses the empty floor to the far door.',
    nodeIds: ['dnc-ballroom', 'dnc-greatarmor'],
  },
  {
    id: 'inner-quarters',
    year: 1997,
    title: 'Inner Quarters',
    intro:
      'Past the public halls the castle keeps its private rooms — narrow, watchful, and hungry for anyone who wanders in.',
    outro:
      'The quarters give up their stalker and their secrets. Red is nearer the top than the castle would like.',
    nodeIds: ['inr-servants', 'inr-headhunter'],
  },
  {
    id: 'clock-tower',
    year: 1997,
    title: 'Clock Tower',
    intro:
      'The great clock keeps a time that is not this year. Its gears count down to a war two years away, and something patient waits at the top.',
    outro:
      'The clock stops. At its summit Red meets Death and walks away — the only answer that has ever mattered.',
    nodeIds: ['clk-ascent', 'clk-death'],
  },
  {
    id: 'floating-garden',
    year: 1997,
    title: 'Floating Garden',
    intro:
      'Above the clock the castle hangs a garden in a sky the wrong colour. Bridges of light cross a drop that has no bottom.',
    outro:
      'The garden’s horde is scattered on the wind. Only the top of the castle remains above him now.',
    nodeIds: ['grd-hanging', 'grd-skybridge', 'grd-legion'],
  },
  {
    id: 'top-floor',
    year: 1997,
    title: 'Top Floor',
    intro:
      'The highest halls, where the castle stops pretending to be a place and starts being a threat. The air itself leans on him.',
    outro:
      'Red crosses the last of the keep. Beyond the final door there is only the forbidden heart, and the thing that made all of this.',
    nodeIds: ['top-keep', 'top-antechamber'],
  },
  {
    id: 'forbidden-area',
    year: 1997,
    title: 'Forbidden Area',
    intro:
      'The room the castle keeps for itself. Young Red steps through, two years early, to look the coming war in the face.',
    outro:
      'Red walks back out of a castle that was never there, alive and marked by it. He is not ready for Dracula. But now he knows exactly what he will have to become.',
    nodeIds: ['fbd-gate', 'fbd-chaos'],
  },
]

export const CAMPAIGN_NODES: readonly CampaignNodeDef[] = [
  // ---------- Castle Corridor ----------
  {
    id: 'cor-entrance',
    chapterId: 'castle-corridor',
    year: 1997,
    title: 'Entrance Hall',
    blurb: 'The mouth of the corridor, where the castle first shows its teeth.',
    story:
      'The doors seal behind Red and the corridor stretches away into torchlight. The first defenders test him before he has taken ten steps.',
    stage: 'outer_wall',
    enemy: skeleton,
    difficulty: 'easy',
    nextIds: ['cor-grand'],
    position: { x: 100, y: 220 },
  },
  {
    id: 'cor-grand',
    chapterId: 'castle-corridor',
    year: 1997,
    title: 'Grand Corridor',
    blurb: 'A vaulted run of the spine hall, long enough to see trouble coming.',
    story:
      'The grand corridor opens up, all pillars and long sightlines. Red uses the space the way a Belmont should — and finds a stair climbing off into the dark.',
    stage: 'outer_wall',
    enemy: skeleton,
    extraEnemies: [{ def: zombie, count: 1 }],
    difficulty: 'normal',
    nextIds: ['cor-alcove', 'cor-skull'],
    position: { x: 220, y: 200 },
  },
  {
    id: 'cor-alcove',
    chapterId: 'castle-corridor',
    year: 1997,
    title: 'Corridor Alcove',
    blurb: 'A side alcove off the corridor, stacked with the castle’s spare dead.',
    story:
      'A dead-end alcove hides a knot of the risen. Red clears it so nothing follows him up the spine, then returns to the hall.',
    stage: 'outer_wall',
    enemy: zombie,
    extraEnemies: [{ def: ghoul, count: 1 }],
    difficulty: 'easy',
    nextIds: [],
    position: { x: 220, y: 110 },
  },
  {
    id: 'cor-skull',
    chapterId: 'castle-corridor',
    year: 1997,
    title: 'Sentinel Gate',
    blurb: 'The corridor’s far gate, held by a giant of stacked bone.',
    story:
      'At the end of the corridor a colossus of bone unfolds to block the way. Red breaks the Creaking Skull apart and the spine of the castle is his.',
    stage: 'outer_wall',
    enemy: creakingSkull,
    difficulty: 'hard',
    nextIds: ['res-descent'],
    position: { x: 340, y: 210 },
    isBoss: true,
  },
  // ---------- Underground Reservoir ----------
  {
    id: 'res-descent',
    chapterId: 'underground-reservoir',
    year: 1997,
    title: 'Flooded Descent',
    blurb: 'Wet stairs dropping into the reservoir, loud with dripping and worse.',
    story:
      'The stair descends into standing water. Things that drowned here long ago wake at the sound of a living step.',
    stage: 'catacombs',
    enemy: zombie,
    extraEnemies: [{ def: ghoul, count: 2 }],
    difficulty: 'normal',
    nextIds: ['res-cistern', 'res-golem'],
    position: { x: 440, y: 220 },
  },
  {
    id: 'res-cistern',
    chapterId: 'underground-reservoir',
    year: 1997,
    title: 'Sunken Cistern',
    blurb: 'A drowned cistern off the main pool, where the water never quite stills.',
    story:
      'A flooded side chamber hoards the castle’s overflow. Red wades it and cuts down the iron thing left to guard the dark.',
    stage: 'catacombs',
    enemy: zombie,
    extraEnemies: [{ def: armoredSkeleton, count: 1 }],
    difficulty: 'normal',
    nextIds: [],
    position: { x: 440, y: 120 },
  },
  {
    id: 'res-golem',
    chapterId: 'underground-reservoir',
    year: 1997,
    title: 'Reservoir Heart',
    blurb: 'The deepest pool, where a flooded colossus stands watch.',
    story:
      'At the reservoir’s heart a Big Golem rises streaming water. Red fights it in the shallows until the giant comes apart like wet clay.',
    stage: 'catacombs',
    enemy: bigGolem,
    difficulty: 'hard',
    nextIds: ['chp-nave'],
    position: { x: 560, y: 210 },
    isBoss: true,
  },
  // ---------- Chapel ----------
  {
    id: 'chp-nave',
    chapterId: 'chapel',
    year: 1997,
    title: 'Chapel Nave',
    blurb: 'A false sanctuary of black candles and long, cold pews.',
    story:
      'The chapel apes a holy place and gets every detail wrong. Red walks its nave and the congregation of the dead rises to meet him.',
    stage: 'cathedral',
    enemy: skeleton,
    extraEnemies: [{ def: ghoul, count: 1 }, { def: boneThrower, count: 1 }],
    difficulty: 'normal',
    nextIds: ['chp-loft', 'chp-manticore'],
    position: { x: 660, y: 220 },
  },
  {
    id: 'chp-loft',
    chapterId: 'chapel',
    year: 1997,
    title: 'Bell Loft',
    blurb: 'The choir loft above the nave, hung with bells that toll on their own.',
    story:
      'Up a narrow stair the bell loft rings without hands. Red silences its marksmen and the toll dies in the rafters.',
    stage: 'cathedral',
    enemy: skeleton,
    extraEnemies: [{ def: boneThrower, count: 1 }],
    difficulty: 'normal',
    nextIds: [],
    position: { x: 660, y: 120 },
  },
  {
    id: 'chp-manticore',
    chapterId: 'chapel',
    year: 1997,
    title: 'Rafter Nest',
    blurb: 'The high vault of the chapel, where a winged horror has made its nest.',
    story:
      'In the chapel’s highest vault the Manticore drops from the dark on leathered wings. Red answers it with the whip and does not look away.',
    stage: 'cathedral',
    enemy: manticore,
    difficulty: 'hard',
    nextIds: ['std-reading'],
    position: { x: 660, y: 60 },
    isBoss: true,
  },
  // ---------- Study ----------
  {
    id: 'std-reading',
    chapterId: 'study',
    year: 1997,
    title: 'Reading Room',
    blurb: 'A hall of shelves where the castle keeps its stolen books.',
    story:
      'The study hoards scripture the castle plans to unwrite. Red reads enough to know the war’s shape and cuts down its keepers.',
    stage: 'library',
    enemy: zombie,
    extraEnemies: [{ def: ghoul, count: 1 }, { def: boneThrower, count: 1 }],
    difficulty: 'normal',
    nextIds: ['std-archive'],
    position: { x: 560, y: 200 },
  },
  {
    id: 'std-archive',
    chapterId: 'study',
    year: 1997,
    title: 'Hidden Archive',
    blurb: 'A sealed record room where the final name in the war is written down.',
    story:
      'Behind the study lies the archive, and in it the name the cult has been circling for years. Red commits it to memory and burns the rest.',
    stage: 'library',
    enemy: skeleton,
    extraEnemies: [{ def: armoredSkeleton, count: 1 }],
    difficulty: 'hard',
    nextIds: ['dnc-ballroom'],
    position: { x: 460, y: 200 },
  },
  // ---------- Dance Hall ----------
  {
    id: 'dnc-ballroom',
    chapterId: 'dance-hall',
    year: 1997,
    title: 'Ballroom',
    blurb: 'A mirrored floor for a dance that never happened, and never stops.',
    story:
      'The ballroom’s music swells for no one. Red crosses the mirrored floor while the castle’s idea of guests circles him.',
    stage: 'throne_room',
    enemy: skeleton,
    extraEnemies: [{ def: ghoul, count: 2 }],
    difficulty: 'hard',
    nextIds: ['dnc-greatarmor'],
    position: { x: 360, y: 200 },
  },
  {
    id: 'dnc-greatarmor',
    chapterId: 'dance-hall',
    year: 1997,
    title: 'Hall of Plate',
    blurb: 'The far end of the ballroom, lined with armor that remembers the guard.',
    story:
      'At the ballroom’s end the ceremonial Great Armor steps off its dais, empty and exact. Red breaks the plate one heavy blow at a time.',
    stage: 'throne_room',
    enemy: greatArmor,
    difficulty: 'hard',
    nextIds: ['inr-servants'],
    position: { x: 360, y: 110 },
    isBoss: true,
  },
  // ---------- Inner Quarters ----------
  {
    id: 'inr-servants',
    chapterId: 'inner-quarters',
    year: 1997,
    title: 'Servants’ Passage',
    blurb: 'Cramped back-halls the castle uses to move its dead unseen.',
    story:
      'The servants’ passages twist behind the walls, narrow and watchful. Red fights through them with no room to run.',
    stage: 'cathedral',
    enemy: zombie,
    extraEnemies: [{ def: ghoul, count: 1 }, { def: boneThrower, count: 1 }],
    difficulty: 'hard',
    nextIds: ['inr-headhunter'],
    position: { x: 460, y: 110 },
  },
  {
    id: 'inr-headhunter',
    chapterId: 'inner-quarters',
    year: 1997,
    title: 'Private Chambers',
    blurb: 'The heart of the quarters, where a trophy-taker keeps its collection.',
    story:
      'In the deepest chamber the Headhunter turns, its wall of stolen heads watching. Red refuses to become another and cuts it down.',
    stage: 'cathedral',
    enemy: headhunter,
    difficulty: 'hard',
    nextIds: ['clk-ascent'],
    position: { x: 560, y: 110 },
    isBoss: true,
  },
  // ---------- Clock Tower ----------
  {
    id: 'clk-ascent',
    chapterId: 'clock-tower',
    year: 1997,
    title: 'Gear Ascent',
    blurb: 'A vertical climb through turning gears and timed iron bridges.',
    story:
      'The clock tower is a gauntlet of moving iron over a long drop. Red times the gears and climbs while the castle tries to grind him off them.',
    stage: 'clock_tower',
    enemy: skeleton,
    extraEnemies: [{ def: boneThrower, count: 1 }, { def: ghoul, count: 1 }],
    difficulty: 'hard',
    nextIds: ['clk-death'],
    position: { x: 560, y: 200 },
  },
  {
    id: 'clk-death',
    chapterId: 'clock-tower',
    year: 1997,
    title: 'Clock Summit',
    blurb: 'The top of the clock, where the castle’s oldest servant waits.',
    story:
      'At the summit Death is already waiting, scythe idle, patient as the gears below. Red meets the reaper two years early and lives to keep climbing.',
    stage: 'clock_tower',
    enemy: death,
    difficulty: 'hard',
    nextIds: ['grd-hanging'],
    position: { x: 560, y: 90 },
    isBoss: true,
  },
  // ---------- Floating Garden ----------
  {
    id: 'grd-hanging',
    chapterId: 'floating-garden',
    year: 1997,
    title: 'Hanging Garden',
    blurb: 'A garden strung in the open air, its paths hung over nothing.',
    story:
      'The garden floats on nothing, its beds spilling over a bottomless drop. Red fights across it while the wind pulls at every step.',
    stage: 'outer_wall',
    enemy: skeleton,
    extraEnemies: [{ def: boneThrower, count: 2 }],
    difficulty: 'hard',
    nextIds: ['grd-skybridge', 'grd-legion'],
    position: { x: 660, y: 90 },
  },
  {
    id: 'grd-skybridge',
    chapterId: 'floating-garden',
    year: 1997,
    title: 'Sky Bridge',
    blurb: 'A span of pale light crossing the drop to a dead-end terrace.',
    story:
      'A bridge of light arcs off to a lonely terrace. Red crosses it to break the archers picking at the garden from afar.',
    stage: 'outer_wall',
    enemy: skeleton,
    extraEnemies: [{ def: armoredSkeleton, count: 1 }],
    difficulty: 'hard',
    nextIds: [],
    position: { x: 760, y: 90 },
  },
  {
    id: 'grd-legion',
    chapterId: 'floating-garden',
    year: 1997,
    title: 'Garden Height',
    blurb: 'The garden’s summit, where a single body of many holds the sky.',
    story:
      'At the garden’s height Legion drifts into view, a knot of the dead woven into one. Red carves it down until nothing is left to rise.',
    stage: 'outer_wall',
    enemy: legion,
    difficulty: 'hard',
    nextIds: ['top-keep'],
    position: { x: 660, y: 20 },
    isBoss: true,
  },
  // ---------- Top Floor ----------
  {
    id: 'top-keep',
    chapterId: 'top-floor',
    year: 1997,
    title: 'Upper Keep',
    blurb: 'The castle’s highest halls, where the air itself pushes back.',
    story:
      'The upper keep barely pretends to be a building now. Red holds his ground against everything the castle can still spare.',
    stage: 'throne_room',
    enemy: skeleton,
    extraEnemies: [{ def: armoredSkeleton, count: 1 }, { def: boneThrower, count: 1 }],
    difficulty: 'hard',
    nextIds: ['top-antechamber'],
    position: { x: 560, y: 20 },
  },
  {
    id: 'top-antechamber',
    chapterId: 'top-floor',
    year: 1997,
    title: 'Antechamber',
    blurb: 'The last room before the forbidden door, thick with the castle’s dead.',
    story:
      'The antechamber is the castle’s final held breath. Red clears the last of its defenders and faces the door it never meant to open.',
    stage: 'throne_room',
    enemy: zombie,
    extraEnemies: [{ def: ghoul, count: 2 }, { def: boneThrower, count: 1 }],
    difficulty: 'hard',
    nextIds: ['fbd-gate'],
    position: { x: 460, y: 20 },
  },
  // ---------- Forbidden Area ----------
  {
    id: 'fbd-gate',
    chapterId: 'forbidden-area',
    year: 1997,
    title: 'Forbidden Gate',
    blurb: 'The threshold of the room the castle keeps only for itself.',
    story:
      'The forbidden gate stands open for the first time in a hundred years. Red steps to the threshold and the guardians of the heart close ranks.',
    stage: 'throne_room',
    enemy: skeleton,
    extraEnemies: [{ def: armoredSkeleton, count: 1 }, { def: ghoul, count: 1 }],
    difficulty: 'hard',
    nextIds: ['fbd-chaos'],
    position: { x: 360, y: 20 },
  },
  {
    id: 'fbd-chaos',
    chapterId: 'forbidden-area',
    year: 1997,
    title: 'Chaotic Realm',
    blurb: 'The forbidden heart, where the castle keeps the shape of the war to come.',
    story:
      'In the forbidden heart the war itself gathers a shape and calls itself Chaos. Red fights the thing Dracula will one day be, two years too soon, and refuses to fall.',
    stage: 'throne_room',
    enemy: chaos,
    difficulty: 'hard',
    nextIds: [],
    position: { x: 260, y: 20 },
    isBoss: true,
  },
]

export function getCampaignChapter(id: string): CampaignChapterDef {
  return CAMPAIGN_CHAPTERS.find((chapter) => chapter.id === id) ?? CAMPAIGN_CHAPTERS[0]!
}

export function getCampaignNode(id: string): CampaignNodeDef {
  const node = CAMPAIGN_NODES.find((entry) => entry.id === id)
  if (!node) throw new Error(`Unknown campaign node: ${id}`)
  return node
}

export function getCampaignNodesForChapter(chapterId: string): readonly CampaignNodeDef[] {
  return CAMPAIGN_NODES.filter((node) => node.chapterId === chapterId)
}

export function initialCampaignSave(): CampaignSave {
  const firstChapter = CAMPAIGN_CHAPTERS[0]!
  return {
    chapterId: firstChapter.id,
    currentNodeId: firstChapter.nodeIds[0] ?? null,
    completedNodeIds: [],
    unlockedNodeIds: firstChapter.nodeIds.slice(0, 1),
    visitedNodeIds: firstChapter.nodeIds.slice(0, 1),
    relicIds: [],
    souls: [],
    bulletSouls: [],
    equippedBulletSoul: BASE_BULLET_SOUL,
    equipment: [],
    equipped: {},
    perks: {},
    abilities: [],
    worldFlags: {},
    level: 1,
    xp: 0,
    gold: 300,
    hpUpgrades: 0,
    atkUpgrades: 0,
    armorTier: 0,
    finished: false,
  }
}

/** Record that the player has entered a room, revealing it on the castle map. */
export function markCampaignVisited(save: CampaignSave, nodeId: string): CampaignSave {
  if (save.visitedNodeIds.includes(nodeId)) return save
  const next: CampaignSave = { ...save, visitedNodeIds: [...save.visitedNodeIds, nodeId] }
  saveCampaignSave(next)
  return next
}

/** Take a level-up power-up, stacking it on top of any prior copies. */
/** Collect a traversal ability (double-jump, etc.). */
export function addCampaignAbility(save: CampaignSave, id: string): CampaignSave {
  if (save.abilities.includes(id)) return save
  const next: CampaignSave = { ...save, abilities: [...save.abilities, id] }
  saveCampaignSave(next)
  return next
}

/** Read a persistent world-state flag (defaults to false for unknown ids). */
export function hasWorldFlag(save: CampaignSave, id: string): boolean {
  return save.worldFlags[id] === true
}

/** Set a persistent world-state flag and persist. Keyed by a stable feature id
 *  (e.g. 'item:chp-loft', 'map:castle', 'chest:library-03') so any new persistent
 *  object rides the same store without a bespoke save field. */
export function setWorldFlag(save: CampaignSave, id: string, value = true): CampaignSave {
  if ((save.worldFlags[id] === true) === value) return save
  const next: CampaignSave = { ...save, worldFlags: { ...save.worldFlags, [id]: value } }
  saveCampaignSave(next)
  return next
}

export function addCampaignPerk(save: CampaignSave, perkId: PowerUpId): CampaignSave {
  const next: CampaignSave = {
    ...save,
    perks: { ...save.perks, [perkId]: (save.perks[perkId] ?? 0) + 1 },
  }
  saveCampaignSave(next)
  return next
}

export function addCampaignRelic(save: CampaignSave, relicId: RelicId): CampaignSave {
  if (save.relicIds.includes(relicId)) return save
  const next: CampaignSave = { ...save, relicIds: [...save.relicIds, relicId] }
  saveCampaignSave(next)
  return next
}

/** Collect a Bullet Soul, adding it to the castable set. */
export function addCampaignBulletSoul(save: CampaignSave, id: string): CampaignSave {
  if (id === BASE_BULLET_SOUL || save.bulletSouls.includes(id)) return save
  const next: CampaignSave = { ...save, bulletSouls: [...save.bulletSouls, id] }
  saveCampaignSave(next)
  return next
}

/** Equip an owned (or the base) Bullet Soul as the active cast. */
export function equipCampaignBulletSoul(save: CampaignSave, id: string): CampaignSave {
  if (id !== BASE_BULLET_SOUL && !save.bulletSouls.includes(id)) return save
  if (save.equippedBulletSoul === id) return save
  const next: CampaignSave = { ...save, equippedBulletSoul: id }
  saveCampaignSave(next)
  return next
}

export function addCampaignSoul(save: CampaignSave, soulId: string): CampaignSave {
  if (save.souls.includes(soulId)) return save
  const next: CampaignSave = { ...save, souls: [...save.souls, soulId] }
  saveCampaignSave(next)
  return next
}

/** Add a piece to the inventory and auto-equip it if its slot is empty. */
export function addCampaignEquipment(save: CampaignSave, id: EquipmentId): CampaignSave {
  const def = getEquipment(id)
  if (!def || save.equipment.includes(id)) return save
  const equipped = save.equipped[def.slot] ? save.equipped : { ...save.equipped, [def.slot]: id }
  const next: CampaignSave = { ...save, equipment: [...save.equipment, id], equipped }
  saveCampaignSave(next)
  return next
}

/** Equip an owned piece into its slot (replacing whatever occupied it). */
export function equipCampaignItem(save: CampaignSave, id: EquipmentId): CampaignSave {
  const def = getEquipment(id)
  if (!def || !save.equipment.includes(id)) return save
  if (save.equipped[def.slot] === id) return save
  const next: CampaignSave = { ...save, equipped: { ...save.equipped, [def.slot]: id } }
  saveCampaignSave(next)
  return next
}

/** Clear a slot so nothing is equipped there. */
export function unequipCampaignSlot(save: CampaignSave, slot: EquipSlot): CampaignSave {
  if (!save.equipped[slot]) return save
  const equipped = { ...save.equipped }
  delete equipped[slot]
  const next: CampaignSave = { ...save, equipped }
  saveCampaignSave(next)
  return next
}

/** Resolve the equipped loadout into concrete defs for stat aggregation. */
export function equippedDefs(save: CampaignSave): EquipmentDef[] {
  return EQUIP_SLOTS.map((slot) => save.equipped[slot])
    .map((id) => (id ? getEquipment(id) : undefined))
    .filter((def): def is EquipmentDef => Boolean(def))
}

export function loadCampaignSave(): CampaignSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialCampaignSave()
    const parsed = JSON.parse(raw) as Partial<CampaignSave>
    return sanitizeCampaignSave(parsed)
  } catch {
    return initialCampaignSave()
  }
}

export function saveCampaignSave(save: CampaignSave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch {
    // Campaign progress is a convenience; keep playing if storage is blocked.
  }
}

export function resetCampaignSave(): CampaignSave {
  const next = initialCampaignSave()
  saveCampaignSave(next)
  return next
}

export function beginCampaignBattle(save: CampaignSave, nodeId: string): CampaignSave {
  const node = getCampaignNode(nodeId)
  const unlocked = new Set(save.unlockedNodeIds)
  unlocked.add(node.id)
  const next: CampaignSave = {
    ...save,
    chapterId: node.chapterId,
    currentNodeId: node.id,
    unlockedNodeIds: Array.from(unlocked),
    finished: false,
  }
  saveCampaignSave(next)
  return next
}

export function completeCampaignBattle(save: CampaignSave): CampaignSave {
  if (!save.currentNodeId) return save
  const node = getCampaignNode(save.currentNodeId)
  const completed = new Set(save.completedNodeIds)
  completed.add(node.id)
  const unlocked = new Set(save.unlockedNodeIds)
  node.nextIds.forEach((nextId) => unlocked.add(nextId))

  const chapter = getCampaignChapter(node.chapterId)
  const chapterNodes = getCampaignNodesForChapter(chapter.id)
  const chapterComplete = chapterNodes.every((entry) => completed.has(entry.id))
  let nextChapterId = chapter.id
  let currentNodeId: string | null = null
  let finished = false

  if (chapterComplete) {
    const chapterIndex = CAMPAIGN_CHAPTERS.findIndex((entry) => entry.id === chapter.id)
    const nextChapter = CAMPAIGN_CHAPTERS[chapterIndex + 1]
    if (nextChapter) {
      nextChapterId = nextChapter.id
      currentNodeId = nextChapter.nodeIds[0] ?? null
      if (currentNodeId) unlocked.add(currentNodeId)
    } else {
      finished = true
    }
  } else {
    currentNodeId = pickNextNode(chapter.id, completed, unlocked)
  }

  const next: CampaignSave = {
    chapterId: nextChapterId,
    currentNodeId,
    completedNodeIds: Array.from(completed),
    unlockedNodeIds: Array.from(unlocked),
    visitedNodeIds: save.visitedNodeIds,
    relicIds: save.relicIds,
    souls: save.souls,
    bulletSouls: save.bulletSouls,
    equippedBulletSoul: save.equippedBulletSoul,
    equipment: save.equipment,
    equipped: save.equipped,
    perks: save.perks,
    abilities: save.abilities,
    worldFlags: save.worldFlags,
    level: save.level,
    xp: save.xp,
    gold: save.gold,
    hpUpgrades: save.hpUpgrades,
    atkUpgrades: save.atkUpgrades,
    armorTier: save.armorTier,
    finished,
  }
  saveCampaignSave(next)
  return next
}

export function campaignIsComplete(save: CampaignSave): boolean {
  return save.finished
}

export function campaignHasProgress(save: CampaignSave): boolean {
  return save.completedNodeIds.length > 0 || save.finished
}

export function currentCampaignChapter(save: CampaignSave): CampaignChapterDef {
  return getCampaignChapter(save.chapterId)
}

export function availableCampaignNodes(save: CampaignSave): CampaignNodeDef[] {
  const chapter = getCampaignChapter(save.chapterId)
  const completed = new Set(save.completedNodeIds)
  const unlocked = new Set(save.unlockedNodeIds)
  return chapter.nodeIds
    .map((id) => getCampaignNode(id))
    .filter((node) => unlocked.has(node.id) && !completed.has(node.id))
}

function pickNextNode(
  chapterId: string,
  completed: Set<string>,
  unlocked: Set<string>,
): string | null {
  const chapter = getCampaignChapter(chapterId)
  const next = chapter.nodeIds
    .map((id) => getCampaignNode(id))
    .find((node) => unlocked.has(node.id) && !completed.has(node.id))
  return next?.id ?? null
}

/** Read the world-flag store, backfilling from the pre-store save fields
 *  (hasCastleMap, collectedItemIds) so older saves migrate without losing
 *  the map or any Life Max Up already taken. */
function parseWorldFlags(value: Partial<CampaignSave>): Record<string, boolean> {
  const raw = value as { worldFlags?: unknown; hasCastleMap?: unknown; collectedItemIds?: unknown }
  const flags: Record<string, boolean> = {}
  if (raw.worldFlags && typeof raw.worldFlags === 'object') {
    for (const [key, on] of Object.entries(raw.worldFlags as Record<string, unknown>)) {
      if (on === true) flags[key] = true
    }
  }
  if (raw.hasCastleMap) flags['map:castle'] = true
  if (Array.isArray(raw.collectedItemIds)) {
    for (const id of raw.collectedItemIds) if (typeof id === 'string') flags[`item:${id}`] = true
  }
  return flags
}

function sanitizeCampaignSave(value: Partial<CampaignSave>): CampaignSave {
  const fallback = initialCampaignSave()
  const chapterId =
    CAMPAIGN_CHAPTERS.find((entry) => entry.id === value.chapterId)?.id ?? fallback.chapterId
  const chapterDef = getCampaignChapter(chapterId)
  const completed = filterExisting(value.completedNodeIds)
  const unlocked = filterExisting(value.unlockedNodeIds)
  if (unlocked.length === 0 && chapterDef.nodeIds[0]) unlocked.push(chapterDef.nodeIds[0])
  const currentNodeId =
    value.finished && value.currentNodeId === null
      ? null
      : typeof value.currentNodeId === 'string' && CAMPAIGN_NODES.some((node) => node.id === value.currentNodeId)
        ? value.currentNodeId
        : chapterDef.nodeIds[0] ?? null

  // Reveal at least everything cleared plus the current room, so saves made
  // before the map existed still show sensible fog-of-war.
  const visited = new Set(filterExisting(value.visitedNodeIds))
  completed.forEach((id) => visited.add(id))
  if (currentNodeId) visited.add(currentNodeId)

  const bulletSouls = filterBulletSouls(value.bulletSouls)
  const equippedBulletSoul =
    typeof value.equippedBulletSoul === 'string' &&
    (value.equippedBulletSoul === BASE_BULLET_SOUL || bulletSouls.includes(value.equippedBulletSoul))
      ? value.equippedBulletSoul
      : BASE_BULLET_SOUL

  return {
    chapterId: chapterDef.id,
    currentNodeId,
    completedNodeIds: completed,
    unlockedNodeIds: unlocked,
    visitedNodeIds: Array.from(visited),
    relicIds: filterRelics(value.relicIds),
    souls: filterSouls(value.souls),
    bulletSouls,
    equippedBulletSoul,
    equipment: filterEquipment(value.equipment),
    equipped: filterEquipped(value.equipped, filterEquipment(value.equipment)),
    perks: filterPerks(value.perks),
    abilities: Array.isArray(value.abilities) ? value.abilities.filter((a): a is string => typeof a === 'string') : [],
    worldFlags: parseWorldFlags(value),
    level: clampNumber(value.level, 1, MAX_LEVEL, 1),
    xp: clampNumber(value.xp, 0, Number.MAX_SAFE_INTEGER, 0),
    gold: clampNumber(value.gold, 0, Number.MAX_SAFE_INTEGER, 0),
    hpUpgrades: clampNumber(value.hpUpgrades, 0, 99, 0),
    atkUpgrades: clampNumber(value.atkUpgrades, 0, 99, 0),
    armorTier: clampNumber(value.armorTier, 0, 99, 0),
    finished: Boolean(value.finished),
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function filterRelics(value: readonly RelicId[] | undefined): RelicId[] {
  if (!Array.isArray(value)) return []
  const valid = new Set(RELIC_POOL.map((relic) => relic.id))
  return value.filter((entry): entry is RelicId => valid.has(entry))
}

function filterPerks(value: Readonly<Record<string, number>> | undefined): Record<string, number> {
  const result: Record<string, number> = {}
  if (!value || typeof value !== 'object') return result
  const valid = new Set(POWERUP_POOL.map((perk) => perk.id))
  for (const [id, count] of Object.entries(value)) {
    if (valid.has(id as PowerUpId) && typeof count === 'number' && Number.isFinite(count) && count > 0) {
      result[id] = Math.min(99, Math.floor(count))
    }
  }
  return result
}

function filterBulletSouls(value: readonly string[] | undefined): string[] {
  if (!Array.isArray(value)) return []
  const valid = new Set(BULLET_SOUL_POOL.filter((soul) => !soul.base).map((soul) => soul.id))
  return value.filter((entry): entry is string => typeof entry === 'string' && valid.has(entry))
}

function filterSouls(value: readonly string[] | undefined): string[] {
  if (!Array.isArray(value)) return []
  const valid = new Set(SOUL_POOL.map((soul) => soul.id))
  return value.filter((entry): entry is string => typeof entry === 'string' && valid.has(entry))
}

function filterEquipment(value: readonly EquipmentId[] | undefined): EquipmentId[] {
  if (!Array.isArray(value)) return []
  const valid = new Set(EQUIPMENT_POOL.map((item) => item.id))
  return value.filter((entry): entry is EquipmentId => valid.has(entry))
}

/** Keep only equipped ids that are owned and whose slot matches their def. */
function filterEquipped(
  value: Partial<Record<EquipSlot, EquipmentId>> | undefined,
  owned: readonly EquipmentId[],
): Partial<Record<EquipSlot, EquipmentId>> {
  const result: Partial<Record<EquipSlot, EquipmentId>> = {}
  if (!value || typeof value !== 'object') return result
  const ownedSet = new Set(owned)
  for (const slot of EQUIP_SLOTS) {
    const id = value[slot]
    if (!id || !ownedSet.has(id)) continue
    const def = getEquipment(id)
    if (def && def.slot === slot) result[slot] = id
  }
  return result
}

function filterExisting(value: readonly string[] | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => CAMPAIGN_NODES.some((node) => node.id === entry))
}
