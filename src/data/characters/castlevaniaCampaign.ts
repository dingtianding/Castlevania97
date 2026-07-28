import type { CharacterDef } from './CharacterDef.ts'

export const red: CharacterDef = {
  id: 'red',
  name: 'RED',
  color: '#d2483c',
  isHero: true,
  meta: {
    archetype: 'HUNTER',
    bio: 'A veteran hunter. Long reach, precise confirms, and a seal-breaking finisher.',
    stats: { power: 4, speed: 3, range: 5, technique: 4 },
    moveNames: {
      light: 'Whip Crack',
      heavy: 'Cross Arc',
      special: 'Hunter Step',
      super: 'Sacred Cross',
    },
  },
  sprites: {
    idle: { key: 'julius.idle', frames: 6 },
    run: { key: 'julius.run', frames: 7 },
    jump: { key: 'julius.jump', frames: 6 },
    fall: { key: 'julius.fall', frames: 6 },
    attack1: { key: 'julius.whip', frames: 10 },
    attack2: { key: 'julius.whip', frames: 10 },
    takeHit: { key: 'julius.hurt', frames: 4 },
    death: { key: 'julius.death', frames: 6 },
  },
  visual: { anchorX: 64, anchorY: 126, scale: 0.72, hurtbox: { width: 44, height: 96 } },
  moves: {
    light: {
      id: 'julius-whip-crack',
      animKey: 'attack1',
      startup: 6,
      active: 5,
      recovery: 14,
      damage: 7,
      knockbackX: 7,
      knockbackY: -4,
      hitstop: 5,
      hitbox: { forward: 22, top: 152, width: 102, height: 74 },
    },
    heavy: {
      id: 'julius-cross-arc',
      animKey: 'attack1',
      startup: 13,
      active: 7,
      recovery: 20,
      damage: 15,
      knockbackX: 12,
      knockbackY: -13,
      hitstop: 10,
      launch: true,
      jumpCancelableOnHit: true,
      hitbox: { forward: 24, top: 160, width: 126, height: 92 },
    },
    special: {
      id: 'julius-hunter-step',
      animKey: 'attack2',
      startup: 9,
      active: 8,
      recovery: 18,
      damage: 12,
      knockbackX: 13,
      knockbackY: -9,
      hitstop: 9,
      lunge: 7,
      hitbox: { forward: 18, top: 168, width: 132, height: 104 },
    },
    super: {
      id: 'julius-sacred-cross',
      animKey: 'attack2',
      startup: 9,
      active: 14,
      recovery: 28,
      damage: 30,
      knockbackX: 17,
      knockbackY: -13,
      hitstop: 16,
      lunge: 9,
      meterCost: 100,
      hitbox: { forward: 8, top: 176, width: 176, height: 122 },
    },
  },
}

/** The campaign's main character: a soul-wielder. Shares the base moveset for
 *  now (placeholder), distinguished by its own identity and colour. */
export const grey: CharacterDef = {
  ...red,
  id: 'grey',
  name: 'GREY',
  color: '#aab2bd',
  isHero: true,
  meta: {
    ...red.meta,
    archetype: 'SOUL REAVER',
    bio: 'A drifter who binds the souls of the fallen and turns them on the castle.',
  },
}

export const zombie: CharacterDef = {
  id: 'zombie',
  name: 'ZOMBIE',
  meta: {
    archetype: 'RISING CORPSE',
    bio: 'A slow but stubborn deadhead that crowds narrow rooms and punishes careless spacing.',
    stats: { power: 2, speed: 1, range: 1, technique: 1 },
    moveNames: {
      light: 'Bite',
      heavy: 'Shamble',
      special: 'Lunge',
      super: 'Grave Swarm',
    },
  },
  sprites: {
    idle: { key: 'zombie.idle', frames: 5 },
    run: { key: 'zombie.run', frames: 8 },
    jump: { key: 'zombie.roam', frames: 6 },
    fall: { key: 'zombie.roam', frames: 6 },
    attack1: { key: 'zombie.attack', frames: 5 },
    attack2: { key: 'zombie.attack', frames: 5 },
    takeHit: { key: 'zombie.hurt', frames: 4 },
    death: { key: 'zombie.death', frames: 6 },
  },
  visual: { anchorX: 54, anchorY: 124, scale: 0.7, hurtbox: { width: 54, height: 102 } },
  moves: {
    light: {
      id: 'zombie-bite',
      animKey: 'attack1',
      startup: 10,
      active: 5,
      recovery: 14,
      damage: 6,
      knockbackX: 5,
      knockbackY: -4,
      hitstop: 5,
      hitbox: { forward: 16, top: 120, width: 82, height: 66 },
    },
    heavy: {
      id: 'zombie-shamble',
      animKey: 'attack2',
      startup: 14,
      active: 6,
      recovery: 18,
      damage: 8,
      knockbackX: 7,
      knockbackY: -6,
      hitstop: 6,
      hitbox: { forward: 18, top: 118, width: 92, height: 74 },
    },
    special: {
      id: 'zombie-lunge',
      animKey: 'attack2',
      startup: 8,
      active: 7,
      recovery: 20,
      damage: 10,
      knockbackX: 8,
      knockbackY: -7,
      hitstop: 7,
      lunge: 4,
      hitbox: { forward: 18, top: 114, width: 98, height: 78 },
    },
    super: {
      id: 'zombie-grave-swarm',
      animKey: 'attack2',
      startup: 12,
      active: 10,
      recovery: 22,
      damage: 14,
      knockbackX: 9,
      knockbackY: -8,
      hitstop: 9,
      meterCost: 100,
      hitbox: { forward: 10, top: 108, width: 108, height: 88 },
    },
  },
}

export const skeleton: CharacterDef = {
  id: 'skeleton',
  name: 'SKELETON',
  meta: {
    archetype: 'BONE GUARD',
    bio: 'A nimble bone soldier that pressures with reach and awkward rhythm changes.',
    stats: { power: 3, speed: 3, range: 3, technique: 2 },
    moveNames: {
      light: 'Sword Swipe',
      heavy: 'Shield Break',
      special: 'Rattle Step',
      super: 'Bone Storm',
    },
  },
  sprites: {
    idle: { key: 'skeleton.idle', frames: 6 },
    run: { key: 'skeleton.run', frames: 8 },
    jump: { key: 'skeleton.roam', frames: 8 },
    fall: { key: 'skeleton.roam', frames: 8 },
    attack1: { key: 'skeleton.attack', frames: 5 },
    attack2: { key: 'skeleton.attack', frames: 5 },
    takeHit: { key: 'skeleton.hurt', frames: 4 },
    death: { key: 'skeleton.death', frames: 6 },
  },
  visual: { anchorX: 80, anchorY: 126, scale: 0.72, hurtbox: { width: 56, height: 104 } },
  moves: {
    light: {
      id: 'skeleton-swipe',
      animKey: 'attack1',
      startup: 8,
      active: 6,
      recovery: 15,
      damage: 7,
      knockbackX: 6,
      knockbackY: -4,
      hitstop: 6,
      hitbox: { forward: 22, top: 120, width: 104, height: 72 },
    },
    heavy: {
      id: 'skeleton-break',
      animKey: 'attack2',
      startup: 11,
      active: 7,
      recovery: 19,
      damage: 11,
      knockbackX: 8,
      knockbackY: -6,
      hitstop: 8,
      hitbox: { forward: 18, top: 118, width: 118, height: 76 },
    },
    special: {
      id: 'skeleton-rattle-step',
      animKey: 'attack2',
      startup: 9,
      active: 8,
      recovery: 18,
      damage: 10,
      knockbackX: 8,
      knockbackY: -7,
      hitstop: 7,
      lunge: 5,
      hitbox: { forward: 18, top: 116, width: 122, height: 84 },
    },
    super: {
      id: 'skeleton-bone-storm',
      animKey: 'attack2',
      startup: 13,
      active: 12,
      recovery: 24,
      damage: 16,
      knockbackX: 10,
      knockbackY: -8,
      hitstop: 10,
      lunge: 6,
      meterCost: 100,
      hitbox: { forward: 14, top: 110, width: 140, height: 92 },
    },
  },
}

// Armored Skeleton — reuses the skeleton sheets but plays as a slow, heavy
// bruiser: high health, crushing swings, and little jumping. The steel-blue
// glow (see ENEMY_GLOW in CampaignScene) tells it apart from a plain skeleton.
export const armoredSkeleton: CharacterDef = {
  id: 'armoredSkeleton',
  name: 'ARMORED SKELETON',
  meta: {
    archetype: 'IRON GUARD',
    bio: 'A bone soldier sealed in old war plate. It hits like a battering ram and barely flinches.',
    stats: { power: 4, speed: 1, range: 3, technique: 2 },
    moveNames: {
      light: 'Mace Chop',
      heavy: 'Plate Slam',
      special: 'Iron Charge',
      super: 'Siege Break',
    },
  },
  sprites: {
    idle: { key: 'skeleton.idle', frames: 6 },
    run: { key: 'skeleton.run', frames: 8 },
    jump: { key: 'skeleton.roam', frames: 8 },
    fall: { key: 'skeleton.roam', frames: 8 },
    attack1: { key: 'skeleton.attack', frames: 5 },
    attack2: { key: 'skeleton.attack', frames: 5 },
    takeHit: { key: 'skeleton.hurt', frames: 4 },
    death: { key: 'skeleton.death', frames: 6 },
  },
  visual: { anchorX: 80, anchorY: 126, scale: 0.78, hurtbox: { width: 60, height: 108 } },
  moves: {
    light: {
      id: 'armored-mace-chop',
      animKey: 'attack1',
      startup: 12,
      active: 6,
      recovery: 20,
      damage: 12,
      knockbackX: 8,
      knockbackY: -4,
      hitstop: 8,
      hitbox: { forward: 22, top: 122, width: 108, height: 76 },
    },
    heavy: {
      id: 'armored-plate-slam',
      animKey: 'attack2',
      startup: 18,
      active: 8,
      recovery: 26,
      damage: 18,
      knockbackX: 11,
      knockbackY: -8,
      hitstop: 11,
      hitbox: { forward: 18, top: 118, width: 126, height: 84 },
    },
    special: {
      id: 'armored-iron-charge',
      animKey: 'attack2',
      startup: 12,
      active: 9,
      recovery: 22,
      damage: 15,
      knockbackX: 12,
      knockbackY: -7,
      hitstop: 10,
      lunge: 8,
      hitbox: { forward: 16, top: 116, width: 128, height: 88 },
    },
    super: {
      id: 'armored-siege-break',
      animKey: 'attack2',
      startup: 15,
      active: 12,
      recovery: 28,
      damage: 22,
      knockbackX: 13,
      knockbackY: -9,
      hitstop: 12,
      lunge: 7,
      meterCost: 100,
      hitbox: { forward: 14, top: 110, width: 146, height: 96 },
    },
  },
}

// Axe Sentinel — a suit of war-plate that marches in and hurls axes in a high
// arc (spawned procedurally by CampaignScene, like the skeleton's bones). Reuses
// the armored-skeleton frames with a steel-blue tint; up close it chops instead.
export const axeArmor: CharacterDef = {
  ...armoredSkeleton,
  id: 'axeArmor',
  name: 'AXE SENTINEL',
  color: '#8a94a6',
  meta: {
    ...armoredSkeleton.meta,
    archetype: 'PLATED AXE-HURLER',
    bio: 'A walking suit of war-plate that lobs axes in a high arc and chops anyone who closes the distance.',
    moveNames: { light: 'Axe Throw', heavy: 'Axe Chop', special: 'Iron Charge', super: 'Siege Break' },
  },
  moves: {
    light: {
      id: 'axe-throw', animKey: 'attack2',
      startup: 16, active: 6, recovery: 22, damage: 10, knockbackX: 7, knockbackY: -5, hitstop: 7,
      hitbox: { forward: 20, top: 122, width: 92, height: 74 },
    },
    heavy: {
      id: 'axe-chop', animKey: 'attack1',
      startup: 16, active: 7, recovery: 24, damage: 16, knockbackX: 11, knockbackY: -7, hitstop: 10,
      hitbox: { forward: 22, top: 120, width: 122, height: 92 },
    },
    special: armoredSkeleton.moves.special,
    super: armoredSkeleton.moves.super,
  },
}

// Ghoul — a fast, fragile zombie variant that rushes in and swarms. Reuses the
// zombie sheets with a sickly green glow so groups read as a distinct threat.
export const ghoul: CharacterDef = {
  id: 'ghoul',
  name: 'GHOUL',
  meta: {
    archetype: 'FERAL CORPSE',
    bio: 'A quick, starving dead thing. Weak on its own, lethal when it swarms with others.',
    stats: { power: 2, speed: 4, range: 1, technique: 2 },
    moveNames: {
      light: 'Rake',
      heavy: 'Frenzy',
      special: 'Pounce',
      super: 'Feeding Swarm',
    },
  },
  sprites: {
    idle: { key: 'zombie.idle', frames: 5 },
    run: { key: 'zombie.run', frames: 8 },
    jump: { key: 'zombie.roam', frames: 6 },
    fall: { key: 'zombie.roam', frames: 6 },
    attack1: { key: 'zombie.attack', frames: 5 },
    attack2: { key: 'zombie.attack', frames: 5 },
    takeHit: { key: 'zombie.hurt', frames: 4 },
    death: { key: 'zombie.death', frames: 6 },
  },
  visual: { anchorX: 54, anchorY: 124, scale: 0.64, hurtbox: { width: 48, height: 94 } },
  moves: {
    light: {
      id: 'ghoul-rake',
      animKey: 'attack1',
      startup: 7,
      active: 5,
      recovery: 11,
      damage: 5,
      knockbackX: 5,
      knockbackY: -4,
      hitstop: 4,
      hitbox: { forward: 16, top: 118, width: 80, height: 62 },
    },
    heavy: {
      id: 'ghoul-frenzy',
      animKey: 'attack2',
      startup: 9,
      active: 6,
      recovery: 13,
      damage: 8,
      knockbackX: 6,
      knockbackY: -5,
      hitstop: 5,
      hitbox: { forward: 18, top: 116, width: 88, height: 68 },
    },
    special: {
      id: 'ghoul-pounce',
      animKey: 'attack2',
      startup: 6,
      active: 7,
      recovery: 16,
      damage: 9,
      knockbackX: 8,
      knockbackY: -8,
      hitstop: 6,
      lunge: 7,
      hitbox: { forward: 18, top: 112, width: 92, height: 74 },
    },
    super: {
      id: 'ghoul-feeding-swarm',
      animKey: 'attack2',
      startup: 10,
      active: 9,
      recovery: 18,
      damage: 12,
      knockbackX: 8,
      knockbackY: -7,
      hitstop: 8,
      meterCost: 100,
      hitbox: { forward: 12, top: 108, width: 100, height: 82 },
    },
  },
}

// Zombie Officer — a canon Aria of Sorrow enemy: a tougher, more assertive
// zombie variant. Reuses the zombie sheets; the red-glow aura (see ENEMY_GLOW)
// is the only thing marking it apart at a glance.
export const zombieOfficer: CharacterDef = {
  ...zombie,
  id: 'zombieOfficer',
  name: 'ZOMBIE OFFICER',
  meta: {
    ...zombie.meta,
    archetype: 'FALLEN COMMANDER',
    bio: 'A rotted officer that still barks orders at the dead around it. Hits harder than the corpses it commands.',
  },
  moves: {
    ...zombie.moves,
    light: { ...zombie.moves.light, id: 'zombie-officer-strike', damage: 8 },
    heavy: { ...zombie.moves.heavy, id: 'zombie-officer-slam', damage: 11 },
  },
}

// Skeleton Knight — a canon Aria of Sorrow enemy: a disciplined bone soldier,
// sturdier than a plain skeleton. Reuses the skeleton sheets; the gold-glow
// aura is the only visual difference from a plain skeleton.
export const skeletonKnight: CharacterDef = {
  ...skeleton,
  id: 'skeletonKnight',
  name: 'SKELETON KNIGHT',
  meta: {
    ...skeleton.meta,
    archetype: 'DISCIPLINED GUARD',
    bio: 'A bone soldier that never breaks formation. Its guard is tighter than the rank and file it stands with.',
  },
  moves: {
    ...skeleton.moves,
    light: { ...skeleton.moves.light, id: 'skeleton-knight-swipe', damage: 9 },
    heavy: { ...skeleton.moves.heavy, id: 'skeleton-knight-break', damage: 13 },
  },
}

// Giant Skeleton — a canon Aria of Sorrow enemy: an oversized bruiser variant,
// scaled up from the base skeleton sheet. The pale-white glow reads as bone
// bleached bigger, not just brighter.
export const giantSkeleton: CharacterDef = {
  ...skeleton,
  id: 'giantSkeleton',
  name: 'GIANT SKELETON',
  meta: {
    ...skeleton.meta,
    archetype: 'BLOATED BONE HULK',
    bio: 'A skeleton built from more than one grave. Slow, but every swing carries the weight of the extra bone.',
  },
  visual: { ...skeleton.visual, scale: skeleton.visual.scale * 1.3 },
  moves: {
    ...skeleton.moves,
    heavy: { ...skeleton.moves.heavy, id: 'giant-skeleton-break', damage: 16, knockbackX: 10, knockbackY: -7 },
  },
}

// Zombie Soldier — a canon Aria of Sorrow enemy: a drilled, tougher zombie
// variant. The olive-drab glow reads as a fatigue-uniform tint.
export const zombieSoldier: CharacterDef = {
  ...zombie,
  id: 'zombieSoldier',
  name: 'ZOMBIE SOLDIER',
  meta: {
    ...zombie.meta,
    archetype: 'DRILLED DEADHEAD',
    bio: 'Drilled into a shambling rank-and-file even in death. Slower to anger than an officer, but it does not scatter.',
  },
  moves: {
    ...zombie.moves,
    light: { ...zombie.moves.light, id: 'zombie-soldier-strike', damage: 7 },
  },
}

// Winged Skeleton — a canon Aria of Sorrow enemy: a skeleton with wings that
// hops and throws a low-arc spear. Kept ground-based here (no true flight)
// since the visual is a name/flavor difference, not a new movement system.
export const wingedSkeleton: CharacterDef = {
  ...skeleton,
  id: 'wingedSkeleton',
  name: 'WINGED SKELETON',
  meta: {
    ...skeleton.meta,
    archetype: 'HOPPING BONE FLYER',
    bio: 'A skeleton fused to a pair of leathern wings too tattered to truly fly. It hops and hurls a spear in a low arc.',
  },
  moves: {
    ...skeleton.moves,
    light: { ...skeleton.moves.light, id: 'winged-skeleton-spear-toss', damage: 8 },
  },
}

// Beam Skeleton — a canon Aria of Sorrow enemy: a skeleton that channels a
// straight energy beam instead of swinging bone. Reuses the skeleton sheets.
export const beamSkeleton: CharacterDef = {
  ...skeleton,
  id: 'beamSkeleton',
  name: 'BEAM SKELETON',
  meta: {
    ...skeleton.meta,
    archetype: 'CHANNELING BONE GUARD',
    bio: 'A bone soldier fused with a shard of old castle magic. It holds its line and fires a straight beam rather than closing.',
  },
  moves: {
    ...skeleton.moves,
    special: { ...skeleton.moves.special, id: 'beam-skeleton-channel', damage: 10, lunge: 0 },
  },
}

// Skull Archer — a canon Aria of Sorrow enemy: a skeleton that summons a bow
// to fire arrows from range rather than closing to melee.
export const skullArcher: CharacterDef = {
  ...skeleton,
  id: 'skullArcher',
  name: 'SKULL ARCHER',
  meta: {
    ...skeleton.meta,
    archetype: 'SUMMONED BOWMAN',
    bio: 'A skeleton that conjures a bow from nothing and keeps its distance, loosing arrows while the living close the gap.',
  },
  moves: {
    ...skeleton.moves,
    light: { ...skeleton.moves.light, id: 'skull-archer-arrow', damage: 6 },
  },
}

// Waiter Skeleton — a canon Aria of Sorrow enemy, one of the series' odder
// regulars: a skeleton in service dress that serves a lingering curry plate.
// No damage-over-time system exists here, so its hit lands as one bigger
// single strike instead of a lingering burn.
export const waiterSkeleton: CharacterDef = {
  ...skeleton,
  id: 'waiterSkeleton',
  name: 'WAITER SKELETON',
  meta: {
    ...skeleton.meta,
    archetype: 'CASTLE SERVICE STAFF',
    bio: 'A skeleton still in its serving dress, decades after the last living guest. Its curry plate stays scalding hot.',
  },
  moves: {
    ...skeleton.moves,
    heavy: { ...skeleton.moves.heavy, id: 'waiter-skeleton-curry-plate', damage: 14 },
  },
}

// Dead Crusader — a canon Aria of Sorrow enemy: a fully-plated bone knight,
// tougher than the Armored Skeleton it reuses. The crimson-gold glow reads as
// a heraldic sash rather than plain war-plate.
export const deadCrusader: CharacterDef = {
  ...armoredSkeleton,
  id: 'deadCrusader',
  name: 'DEAD CRUSADER',
  meta: {
    ...armoredSkeleton.meta,
    archetype: 'HOLY WAR RELIC',
    bio: 'A knight who marched under a banner no one remembers. It still fights like the cause was worth it.',
  },
  moves: {
    ...armoredSkeleton.moves,
    heavy: { ...armoredSkeleton.moves.heavy, id: 'dead-crusader-plate-slam', damage: 15 },
  },
}

// Golem — a canon Aria of Sorrow enemy: a slow, stone-built bruiser. Reuses
// the Armored Skeleton sheets and timing; the ash-gray glow reads as
// weathered stone rather than iron plate.
export const golem: CharacterDef = {
  ...armoredSkeleton,
  id: 'golem',
  name: 'GOLEM',
  meta: {
    ...armoredSkeleton.meta,
    archetype: 'ANIMATE STONEWORK',
    bio: 'Castle masonry given a grudge. Slower than the iron guard it stands beside, but every hit lands like part of a wall.',
  },
  moves: {
    ...armoredSkeleton.moves,
    light: { ...armoredSkeleton.moves.light, id: 'golem-stone-fist', damage: 13 },
  },
}

// Evil Butcher — a canon Aria of Sorrow enemy: a zombie still clutching its
// trade, flinging a cleaver rather than biting. Reuses the zombie sheets.
export const evilButcher: CharacterDef = {
  ...zombie,
  id: 'evilButcher',
  name: 'EVIL BUTCHER',
  meta: {
    ...zombie.meta,
    archetype: 'ROTTED TRADESMAN',
    bio: 'A butcher who never put the cleaver down, even after the castle took the rest of him. It throws before it shambles closer.',
  },
  moves: {
    ...zombie.moves,
    light: { ...zombie.moves.light, id: 'evil-butcher-cleaver', damage: 6 },
  },
}

// Skull Millone — a canon Aria of Sorrow enemy: a skeleton whose claw carries
// an old venom. No poison status exists here, so the hit lands harder instead.
export const skullMillone: CharacterDef = {
  ...skeleton,
  id: 'skullMillone',
  name: 'SKULL MILLONE',
  meta: {
    ...skeleton.meta,
    archetype: 'VENOMOUS BONE CLAW',
    bio: 'A bone soldier whose claw still carries a poison the castle never let fade. Its swipe lingers longer than it should.',
  },
  moves: {
    ...skeleton.moves,
    special: { ...skeleton.moves.special, id: 'skull-millone-venom-claw', damage: 13 },
  },
}

// Fell Bat — roosts in the air until the player draws near, then dives across
// the room and flaps off the far side. Flies (no gravity); drawn as a custom bat
// shape by CampaignScene. Its only threat is the contact of its dive (moves.light).
export const bat: CharacterDef = {
  id: 'bat',
  name: 'FELL BAT',
  color: '#8a6ab0',
  meta: {
    archetype: 'ROOSTING FLYER',
    bio: 'A leathery castle bat. Still as a stone until something warm passes below, then a single screaming dive.',
    stats: { power: 2, speed: 5, range: 1, technique: 1 },
    moveNames: { light: 'Dive', heavy: 'Dive', special: 'Dive', super: 'Dive' },
  },
  sprites: {
    idle: { key: 'zombie.idle', frames: 5 },
    run: { key: 'zombie.run', frames: 8 },
    jump: { key: 'zombie.roam', frames: 6 },
    fall: { key: 'zombie.roam', frames: 6 },
    attack1: { key: 'zombie.attack', frames: 5 },
    attack2: { key: 'zombie.attack', frames: 5 },
    takeHit: { key: 'zombie.hurt', frames: 4 },
    death: { key: 'zombie.death', frames: 6 },
  },
  visual: { anchorX: 54, anchorY: 124, scale: 0.5, hurtbox: { width: 46, height: 40 } },
  moves: {
    light: { id: 'bat-dive', animKey: 'attack1', startup: 4, active: 4, recovery: 8, damage: 7, knockbackX: 6, knockbackY: -5, hitstop: 5, hitbox: { forward: 8, top: 40, width: 52, height: 46 } },
    heavy: { id: 'bat-dive-h', animKey: 'attack1', startup: 4, active: 4, recovery: 8, damage: 7, knockbackX: 6, knockbackY: -5, hitstop: 5, hitbox: { forward: 8, top: 40, width: 52, height: 46 } },
    special: { id: 'bat-dive-s', animKey: 'attack1', startup: 4, active: 4, recovery: 8, damage: 7, knockbackX: 6, knockbackY: -5, hitstop: 5, hitbox: { forward: 8, top: 40, width: 52, height: 46 } },
    super: { id: 'bat-dive-u', animKey: 'attack1', startup: 4, active: 4, recovery: 8, damage: 7, knockbackX: 6, knockbackY: -5, hitstop: 5, meterCost: 100, hitbox: { forward: 8, top: 40, width: 52, height: 46 } },
  },
}

// Bone Thrower — a ranged skeleton that keeps its distance and lobs bones
// (spawned procedurally by CampaignScene when its light "throw" goes active).
// Reuses the skeleton sheets with a violet aura; its melee is deliberately weak.
export const boneThrower: CharacterDef = {
  id: 'boneThrower',
  name: 'BONE THROWER',
  meta: {
    archetype: 'SKELETAL ARCHER',
    bio: 'A bone soldier that hangs back and hurls its own ribs. Deadly at range, fragile up close.',
    stats: { power: 2, speed: 2, range: 5, technique: 3 },
    moveNames: {
      light: 'Bone Toss',
      heavy: 'Bone Toss',
      special: 'Bone Toss',
      super: 'Rib Volley',
    },
  },
  sprites: {
    idle: { key: 'skeleton.idle', frames: 6 },
    run: { key: 'skeleton.run', frames: 8 },
    jump: { key: 'skeleton.roam', frames: 8 },
    fall: { key: 'skeleton.roam', frames: 8 },
    attack1: { key: 'skeleton.attack', frames: 5 },
    attack2: { key: 'skeleton.attack', frames: 5 },
    takeHit: { key: 'skeleton.hurt', frames: 4 },
    death: { key: 'skeleton.death', frames: 6 },
  },
  visual: { anchorX: 80, anchorY: 126, scale: 0.72, hurtbox: { width: 56, height: 104 } },
  moves: {
    light: {
      id: 'bone-toss',
      animKey: 'attack1',
      startup: 12,
      active: 6,
      recovery: 20,
      damage: 4,
      knockbackX: 4,
      knockbackY: -3,
      hitstop: 4,
      hitbox: { forward: 20, top: 120, width: 60, height: 60 },
    },
    heavy: {
      id: 'bone-toss-h',
      animKey: 'attack1',
      startup: 12,
      active: 6,
      recovery: 20,
      damage: 4,
      knockbackX: 4,
      knockbackY: -3,
      hitstop: 4,
      hitbox: { forward: 20, top: 120, width: 60, height: 60 },
    },
    special: {
      id: 'bone-toss-s',
      animKey: 'attack1',
      startup: 12,
      active: 6,
      recovery: 20,
      damage: 4,
      knockbackX: 4,
      knockbackY: -3,
      hitstop: 4,
      hitbox: { forward: 20, top: 120, width: 60, height: 60 },
    },
    super: {
      id: 'bone-toss-super',
      animKey: 'attack2',
      startup: 14,
      active: 8,
      recovery: 24,
      damage: 6,
      knockbackX: 6,
      knockbackY: -5,
      hitstop: 6,
      meterCost: 100,
      hitbox: { forward: 20, top: 118, width: 70, height: 66 },
    },
  },
}

export const sealGuardian: CharacterDef = {
  id: 'sealGuardian',
  name: 'SEAL WARDEN',
  meta: {
    archetype: 'RITUAL SENTINEL',
    bio: 'A winged guardian bound to the cracked seal. It closes distance fast and punishes panic.',
    stats: { power: 4, speed: 2, range: 4, technique: 3 },
    moveNames: {
      light: 'Claw Rake',
      heavy: 'Wing Sweep',
      special: 'Vault Break',
      super: 'Seal Breath',
    },
  },
  sprites: {
    idle: { key: 'demon.idle', frames: 6 },
    run: { key: 'demon.idle', frames: 6 },
    jump: { key: 'demon.idle', frames: 6 },
    fall: { key: 'demon.idle', frames: 6 },
    attack1: { key: 'demon.attack', frames: 11 },
    attack2: { key: 'demon.attackFull', frames: 11 },
    takeHit: { key: 'demon.idle', frames: 6 },
    death: { key: 'demon.idle', frames: 6 },
  },
  visual: { anchorX: 78, anchorY: 134, scale: 1.55, hurtbox: { width: 118, height: 182 } },
  moves: {
    light: {
      id: 'seal-warden-claw',
      animKey: 'attack1',
      startup: 11,
      active: 7,
      recovery: 18,
      damage: 10,
      knockbackX: 8,
      knockbackY: -4,
      hitstop: 7,
      hitbox: { forward: 18, top: 142, width: 122, height: 108 },
    },
    heavy: {
      id: 'seal-warden-wing-sweep',
      animKey: 'attack2',
      startup: 16,
      active: 8,
      recovery: 24,
      damage: 16,
      knockbackX: 12,
      knockbackY: -8,
      hitstop: 10,
      hitbox: { forward: 14, top: 150, width: 160, height: 122 },
    },
    special: {
      id: 'seal-warden-vault-break',
      animKey: 'attack2',
      startup: 12,
      active: 9,
      recovery: 20,
      damage: 14,
      knockbackX: 13,
      knockbackY: -8,
      hitstop: 9,
      lunge: 6,
      hitbox: { forward: 12, top: 146, width: 148, height: 118 },
    },
    super: {
      id: 'seal-warden-seal-breath',
      animKey: 'attack2',
      startup: 16,
      active: 14,
      recovery: 34,
      damage: 24,
      knockbackX: 15,
      knockbackY: -9,
      hitstop: 14,
      meterCost: 100,
      hitbox: { forward: 18, top: 144, width: 132, height: 118 },
      projectile: {
        sprite: 'demon.breathFire',
        frames: 5,
        scale: 1.65,
        hold: 5,
        spawnTick: 16,
        offsetX: 72,
        offsetY: -74,
        speedX: 9,
        lifetime: 58,
        hitbox: { offsetX: 28, offsetY: -72, width: 168, height: 72 },
      },
    },
  },
}

// Tiny Devil — a canon Aria of Sorrow enemy: a small, quick imp-demon. Reuses
// the demon-Files sheet already used by Seal Guardian and its boss clones, but
// scaled down sharply so it reads as a lesser threat, not a mini-boss.
export const tinyDevil: CharacterDef = {
  ...sealGuardian,
  id: 'tinyDevil',
  name: 'TINY DEVIL',
  meta: {
    ...sealGuardian.meta,
    archetype: 'LESSER IMP',
    bio: 'A small, cackling demon too minor for the castle to bother naming twice. Quick, but its hits are as small as it is.',
  },
  visual: { ...sealGuardian.visual, scale: sealGuardian.visual.scale * 0.36 },
  moves: {
    ...sealGuardian.moves,
    light: { ...sealGuardian.moves.light, id: 'tiny-devil-claw', damage: 6 },
    heavy: { ...sealGuardian.moves.heavy, id: 'tiny-devil-flit', damage: 8 },
  },
}

// Demon Lord — a canon Aria of Sorrow enemy: a lesser demon commander, smaller
// than the winged guardians it takes orders from. Reuses the demon-Files sheet.
export const demonLord: CharacterDef = {
  ...sealGuardian,
  id: 'demonLord',
  name: 'DEMON LORD',
  meta: {
    ...sealGuardian.meta,
    archetype: 'LESSER COMMANDER',
    bio: 'A demon of middling rank, sent ahead of whatever the castle keeps in reserve. It hits harder than it needs to, to prove the point.',
  },
  visual: { ...sealGuardian.visual, scale: sealGuardian.visual.scale * 0.68 },
  moves: {
    ...sealGuardian.moves,
    heavy: { ...sealGuardian.moves.heavy, id: 'demon-lord-crush', damage: 20 },
  },
}

// Flame Demon — a canon Aria of Sorrow enemy: a fire-wreathed demon variant.
// Reuses the demon-Files sheet with a fire-orange glow instead of a boss scale.
export const flameDemon: CharacterDef = {
  ...sealGuardian,
  id: 'flameDemon',
  name: 'FLAME DEMON',
  meta: {
    ...sealGuardian.meta,
    archetype: 'ASH-WING DEMON',
    bio: 'A demon that trails cinders wherever it lands. Its wings never fully stop smoking.',
  },
  visual: { ...sealGuardian.visual, scale: sealGuardian.visual.scale * 0.6 },
  moves: {
    ...sealGuardian.moves,
    special: { ...sealGuardian.moves.special, id: 'flame-demon-cinder-lunge', damage: 15 },
  },
}

// Arc Demon — a canon Aria of Sorrow enemy: a lean, fast demon variant. Reuses
// the demon-Files sheet; no HP-drain-on-hit system exists here (see its soul).
export const arcDemon: CharacterDef = {
  ...sealGuardian,
  id: 'arcDemon',
  name: 'ARC DEMON',
  meta: {
    ...sealGuardian.meta,
    archetype: 'LEAN VOLTAIC DEMON',
    bio: 'A wiry demon that crackles faintly at the joints. It closes distance faster than its bulkier kin.',
  },
  visual: { ...sealGuardian.visual, scale: sealGuardian.visual.scale * 0.55 },
  moves: {
    ...sealGuardian.moves,
    light: { ...sealGuardian.moves.light, id: 'arc-demon-jolt-claw', damage: 9 },
  },
}

export const dracula1999: CharacterDef = {
  id: 'dracula1999',
  name: 'DRACULA SHADOW',
  meta: {
    archetype: 'FINAL BOSS',
    bio: 'A prophecy given form. Heavy reach, crushing damage, and a room-filling super.',
    stats: { power: 5, speed: 1, range: 5, technique: 2 },
    moveNames: {
      light: 'Night Claw',
      heavy: 'Abyss Crush',
      special: 'Ruin Step',
      super: 'Blood Eclipse',
    },
  },
  sprites: {
    idle: { key: 'demon.idle', frames: 6 },
    run: { key: 'demon.idle', frames: 6 },
    jump: { key: 'demon.idle', frames: 6 },
    fall: { key: 'demon.idle', frames: 6 },
    attack1: { key: 'demon.attack', frames: 8 },
    attack2: { key: 'demon.attack', frames: 8 },
    takeHit: { key: 'demon.idle', frames: 6 },
    death: { key: 'demon.idle', frames: 6 },
  },
  visual: { anchorX: 78, anchorY: 134, scale: 2.25, hurtbox: { width: 150, height: 255 } },
  moves: {
    light: {
      id: 'dracula-claw',
      animKey: 'attack1',
      startup: 13,
      active: 8,
      recovery: 24,
      damage: 12,
      knockbackX: 10,
      knockbackY: -5,
      hitstop: 8,
      hitbox: { forward: 18, top: 210, width: 128, height: 118 },
    },
    heavy: {
      id: 'dracula-crush',
      animKey: 'attack2',
      startup: 18,
      active: 9,
      recovery: 30,
      damage: 21,
      knockbackX: 15,
      knockbackY: -10,
      hitstop: 12,
      hitbox: { forward: 10, top: 228, width: 166, height: 148 },
    },
    special: {
      id: 'dracula-ruin',
      animKey: 'attack2',
      startup: 16,
      active: 10,
      recovery: 28,
      damage: 18,
      knockbackX: 14,
      knockbackY: -9,
      hitstop: 11,
      lunge: 4,
      hitbox: { forward: 10, top: 220, width: 178, height: 138 },
    },
    super: {
      id: 'dracula-blood-eclipse',
      animKey: 'attack2',
      startup: 20,
      active: 16,
      recovery: 42,
      damage: 34,
      knockbackX: 18,
      knockbackY: -8,
      hitstop: 16,
      meterCost: 100,
      hitbox: { forward: 24, top: 210, width: 90, height: 105 },
      projectile: {
        sprite: 'demon.breathFire',
        frames: 5,
        scale: 2.25,
        hold: 5,
        spawnTick: 20,
        offsetX: 82,
        offsetY: -108,
        speedX: 10,
        lifetime: 54,
        hitbox: { offsetX: 34, offsetY: -130, width: 210, height: 92 },
      },
    },
  },
}

// Aria-of-Sorrow area bosses. Each reuses an existing sprite set and moveset
// (the demon defs are large and carry supers; the armored knight is a bruiser)
// but carries its own name, archetype, and bio so the boss bar and name-reveal
// read as the authentic Aria encounter. Boss HP is tuned per node in
// CampaignScene's campaignBossHealth.
function cloneBoss(
  base: CharacterDef,
  id: string,
  name: string,
  archetype: string,
  bio: string,
): CharacterDef {
  return { ...base, id, name, meta: { ...base.meta, archetype, bio } }
}

// Creaking Skull — a lumbering colossus of stacked bone. It shuffles in slowly
// and attacks on a long cadence, but its signature swing is an enormous bone
// sweep with huge reach. Custom (not a plain clone) so its moves are its own.
export const creakingSkull: CharacterDef = {
  ...armoredSkeleton,
  id: 'creakingSkull',
  name: 'CREAKING SKULL',
  meta: {
    ...armoredSkeleton.meta,
    archetype: 'CORRIDOR SENTINEL',
    bio: 'A giant of stacked bone that guards the first corridor. Slow, but its sweeping arm is a wall you cannot walk around.',
  },
  visual: { anchorX: 80, anchorY: 126, scale: 0.95, hurtbox: { width: 132, height: 118 } },
  moves: {
    // A long charge, then a horizontal fireball is released (spawned by the scene
    // at startup+1). The melee hitbox is small — the fireball is the real threat.
    light: {
      id: 'skull-fireball', animKey: 'attack1',
      startup: 40, active: 10, recovery: 34, damage: 12, knockbackX: 8, knockbackY: -5, hitstop: 8,
      hitbox: { forward: 20, top: 150, width: 96, height: 96 },
    },
    // The sweep: a slow, telegraphed bone arm raised high then smashed down in
    // front — the hitbox matches the smash column so the visual fits it.
    heavy: {
      id: 'skull-sweep', animKey: 'attack2',
      startup: 32, active: 16, recovery: 42, damage: 22, knockbackX: 15, knockbackY: -9, hitstop: 13,
      hitbox: { forward: 14, top: 168, width: 252, height: 188 },
    },
    special: {
      id: 'skull-sweep-s', animKey: 'attack2',
      startup: 32, active: 16, recovery: 42, damage: 22, knockbackX: 15, knockbackY: -9, hitstop: 13,
      hitbox: { forward: 14, top: 168, width: 252, height: 188 },
    },
    super: {
      id: 'skull-sweep-u', animKey: 'attack2',
      startup: 34, active: 18, recovery: 44, damage: 26, knockbackX: 16, knockbackY: -10, hitstop: 14,
      meterCost: 100,
      hitbox: { forward: 14, top: 172, width: 272, height: 196 },
    },
  },
}

export const bigGolem = cloneBoss(
  sealGuardian,
  'bigGolem',
  'BIG GOLEM',
  'RESERVOIR GUARDIAN',
  'A flooded colossus that rose from the reservoir. It closes fast and hits like a tide.',
)

export const manticore = cloneBoss(
  sealGuardian,
  'manticore',
  'MANTICORE',
  'CHAPEL BEAST',
  'A winged horror nesting in the chapel rafters. It punishes anyone who stands still.',
)

export const greatArmor = cloneBoss(
  armoredSkeleton,
  'greatArmor',
  'GREAT ARMOR',
  'DANCE HALL KNIGHT',
  'Empty ceremonial plate that still keeps the guard. Relentless with its heavy blade.',
)

export const headhunter = cloneBoss(
  armoredSkeleton,
  'headhunter',
  'HEADHUNTER',
  'INNER QUARTERS STALKER',
  'A trophy-taker that hunts the inner quarters. Trades blows and takes heads.',
)

export const death = cloneBoss(
  dracula1999,
  'death',
  'DEATH',
  'THE REAPER',
  'The castle’s oldest servant, waiting at the top of the clock. Reach, damage, and no mercy.',
)

export const legion = cloneBoss(
  sealGuardian,
  'legion',
  'LEGION',
  'GARDEN HORDE',
  'A single body woven from many, adrift in the floating garden. It never stops coming.',
)

export const chaos = cloneBoss(
  dracula1999,
  'chaos',
  'CHAOS',
  'FORBIDDEN ONE',
  'The shape the castle keeps in its forbidden heart — the war itself, two years too soon.',
)

const CAMPAIGN_BOSSES: readonly CharacterDef[] = [creakingSkull, bigGolem, manticore, greatArmor, headhunter, death, legion, chaos]

/** Every campaign mob and boss, in castle encounter order — the roster the
 *  Archive's Loot Table scene cycles through. */
export const CAMPAIGN_ENEMIES: readonly CharacterDef[] = [
  zombie,
  skeleton,
  ghoul,
  bat,
  axeArmor,
  armoredSkeleton,
  boneThrower,
  zombieOfficer,
  skeletonKnight,
  giantSkeleton,
  zombieSoldier,
  wingedSkeleton,
  beamSkeleton,
  skullArcher,
  waiterSkeleton,
  deadCrusader,
  golem,
  evilButcher,
  skullMillone,
  tinyDevil,
  demonLord,
  flameDemon,
  arcDemon,
  ...CAMPAIGN_BOSSES,
]

/** Ids of the bosses in CAMPAIGN_ENEMIES — bosses use a fixed reward bounty
 *  (see rewardForEnemy) rather than the per-mob ENEMY_REWARD table. */
export const CAMPAIGN_BOSS_IDS: ReadonlySet<string> = new Set(CAMPAIGN_BOSSES.map((b) => b.id))
