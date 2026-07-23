import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { PauseScene } from './PauseScene.ts'
import { AssetManager } from '../assets/AssetManager.ts'
import { AUDIO_MANIFEST } from '../assets/manifest.ts'
import { addCampaignAbility, addCampaignBlueSoul, addCampaignBulletSoul, addCampaignConsumable, addCampaignEquipment, addCampaignPerk, addCampaignRelic, addCampaignSoul, equipCampaignBlueSoul, equipCampaignBulletSoul, equipCampaignItem, equipCampaignYellowSoul, equippedDefs, getCampaignChapter, getCampaignNode, grantCampaignRewards, hasWorldFlag, loadCampaignSave, markCampaignVisited, MAX_LEVEL, saveCampaignSave, setWorldFlag, unequipCampaignSlot, useCampaignConsumable, xpForNextLevel } from '../data/campaign.ts'
import { draftPowerUps, powerUpStacks, type PowerUpDef } from '../data/powerups.ts'
import { BASE_BULLET_SOUL, bulletSoulForEnemy, getBulletSoul, type BulletSoulDef } from '../data/bulletSouls.ts'
import { BASE_BLUE_SOUL, blueSoulForEnemy, getBlueSoul, type BlueSoulEffect } from '../data/blueSouls.ts'
import { CASTLE_ITEM_ROOMS, CASTLE_LIFEUP_ROOMS, CASTLE_MAP_DATA, CASTLE_MERCHANT_ROOMS, CASTLE_SAVE_ROOMS, CASTLE_WARP_ROOMS, ROOM_CELLS } from '../data/castleMapData.ts'
import { MapService, MapRenderer, MinimapRenderer } from '../map/index.ts'
import { castleDoors, castleNeighbor, type MapDir } from '../data/castleMap.ts'
import { buildEquipmentModifiers, EQUIP_SLOT_LABELS, EQUIP_SLOTS, equipmentForSlot, EQUIPMENT_POOL, getEquipment, type EquipmentDef, type EquipmentModifiers, type EquipSlot, type WeaponProfile } from '../data/equipment.ts'
import { buildRunModifiers, RELIC_POOL, type RelicDef, type RunModifiers } from '../data/relics.ts'
import { buildSoulModifiers, getSoul, soulForEnemy, type SoulDef, type SoulModifiers } from '../data/souls.ts'
import { grey as CAMPAIGN_HERO, zombie } from '../data/characters/castlevaniaCampaign.ts'
import { CONSUMABLE_POOL, getConsumable } from '../data/consumables.ts'
import { getStage } from '../data/stages.ts'
import type { CharacterDef } from '../data/characters/CharacterDef.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { GamepadSource } from '../input/GamepadSource.ts'
import { CompositeSource } from '../input/CompositeSource.ts'
import { TouchSource, createTouchControlState } from '../input/TouchSource.ts'
import { TouchControls } from '../ui/TouchControls.ts'
import { PLAYER1_KEYS } from '../input/bindings.ts'
import { isMenuCancel, isMenuConfirm } from '../input/menuButtons.ts'
import { neutralIntent, type InputSource, type IntentState } from '../input/InputSource.ts'
import { clamp, rectsOverlap } from '../core/math.ts'
import type { Rng } from '../core/rng.ts'
import type { Facing, Rect, Vec2 } from '../types.ts'
import type { Renderer } from '../render/Renderer.ts'
import { Animator, makeSheet, type SpriteSheet } from '../render/SpriteRenderer.ts'
import { computeHitbox, isActiveAt, totalFrames, type AttackMove } from '../combat/AttackMove.ts'

const ROOM_WIDTH = 1680
const ROOM_HEIGHT = 576
const FLOOR_Y = 492
// How close to a room edge counts as "walking through the doorway".
const EDGE_ZONE = 14
// Vertical passage is centered on the room. You climb (stairs + ledges) up to
// the doorway and cross beyond the top edge to leave; you descend at the floor.
const VERT_PASSAGE_X = ROOM_WIDTH / 2
// The top/bottom passage is a narrow column centred on the room.
const DOORWAY_HALF = 74
// Crossing this height moving UP, inside the doorway column, exits through the top
// door — a directional edge-crossing, so no key press and a top spawn can't retrigger it.
const TOP_EDGE_Y = 162
// Crossing this depth moving DOWN, inside the column, drops through to the room below.
const BOTTOM_EDGE_Y = FLOOR_Y + 76
// Half-width of the drop-through gap opened in the floor of a room with a south door.
const FLOOR_GAP_HALF = 56
// Frames the drop-through window stays open after pressing Down on the shaft platform.
const DROP_WINDOW = 8
// Save/merchant/relic placement is defined once in castleMapData (so the map
// icons and the gameplay objects can't drift). Here we index them by x-position.
const SAVE_POINTS: Record<string, number> = Object.fromEntries(CASTLE_SAVE_ROOMS.map((r) => [r.id, r.x]))
const SAVE_RANGE = 72
const MERCHANT_ROOMS: Record<string, number> = Object.fromEntries(CASTLE_MERCHANT_ROOMS.map((r) => [r.id, r.x]))
const MERCHANT_RANGE = 80
const WARP_POINTS: Record<string, number> = Object.fromEntries(CASTLE_WARP_ROOMS.map((r) => [r.id, r.x]))
const WARP_RANGE = 72
// Beating this room's boss completes the campaign.
const FINAL_BOSS_NODE = 'fbd-chaos'
// Navigable pause menu entries (GBA-style).
const MENU_ITEMS = ['STATUS', 'EQUIP', 'SOULS', 'ITEMS', 'MAP', 'TITLE', 'RESUME'] as const
// One-line help shown in the menu's description box for the highlighted entry.
const MENU_DESC: Record<(typeof MENU_ITEMS)[number], string> = {
  STATUS: 'View your full stats and loadout.',
  EQUIP: "Change your weapon and armor.",
  SOULS: 'Set your Red, Blue and Yellow souls.',
  ITEMS: 'Use a potion or an elixir.',
  MAP: 'Open the castle map.',
  TITLE: 'Save and return to the title screen.',
  RESUME: 'Close the menu and keep playing.',
}
// The soul-reaver hero (Grey) casts souls with the sub button and activates a
// guardian on ;; a hunter (Red) uses subweapons instead. Sub-weapons are Red's.
const HERO_USES_SOULS = CAMPAIGN_HERO.meta.archetype !== 'HUNTER'
// The three soul slots shown in the SOULS menu, top to bottom.
const SOUL_SLOTS = ['RED', 'BLUE', 'YELLOW'] as const
type SoulSlot = (typeof SOUL_SLOTS)[number]
// Metroidvania traversal abilities.
const ABILITIES: Record<string, { name: string; blurb: string; getSub: string }> = {
  'double-jump': { name: 'Leap Stone', blurb: 'Jump a second time in mid-air.', getSub: 'DOUBLE JUMP UNLOCKED' },
  'silver-key': { name: 'Silver Key', blurb: 'Opens the silver-barred door in the Chapel.', getSub: 'A SILVER-BARRED DOOR WILL NOW OPEN' },
  'high-jump': { name: 'Griffon Wing', blurb: 'Spring to great heights — hold up and jump.', getSub: 'HIGH JUMP — HOLD UP + JUMP' },
  'slide': { name: 'Fleet Greaves', blurb: 'Slide under low tunnels — hold down and dash.', getSub: 'SLIDE — HOLD DOWN + DASH' },
}
// Rooms that hold an ability relic, keyed to its x-position and the ability id.
const ABILITY_PICKUPS: Record<string, { x: number; ability: string }> = Object.fromEntries(
  CASTLE_ITEM_ROOMS.map((r) => [r.id, { x: r.x, ability: r.ability }]),
)
// Rooms that hold the Castle Map item, keyed to its x-position. Collecting it
// reveals every room's outline on the map.
const MAP_ITEM_ROOMS: Record<string, number> = { 'cor-alcove': 840 }
const MAP_ITEM_RANGE = 48
// Stable world-flag ids (see campaign.ts worldFlags). One key per persistent
// object — no new save field when we add more.
const MAP_FLAG = 'map:castle'
const lifeUpFlag = (nodeId: string): string => `item:${nodeId}`
const chestFlag = (nodeId: string): string => `chest:${nodeId}`
// Treasure chests: a persistent world object riding entirely on worldFlags —
// once opened it stays open on return, with no new save field. Room -> x + gold.
const CHEST_ROOMS: Record<string, { x: number; gold: number }> = {
  'cor-grand': { x: 1300, gold: 120 },
  'cor-larder': { x: 520, gold: 90 },
  'cor-drain': { x: 520, gold: 110 },
  'dnc-ballroom': { x: 1300, gold: 220 },
  'inr-servants': { x: 1300, gold: 320 },
}
const CHEST_RANGE = 46
// Rooms with a body of water: [x, x+width] filled down from surfaceY to the floor.
// You float on the surface unless the Drowned Soul lets you sink and breathe.
const WATER_ROOMS: Record<string, { x: number; width: number; surfaceY: number }> = {
  'res-descent': { x: 360, width: 1160, surfaceY: FLOOR_Y - 150 },
  'res-cistern': { x: 300, width: 1300, surfaceY: FLOOR_Y - 170 },
}
// A permanent Life Max Up's position in its room. `high` ones perch on a raised
// ledge only the high-jump relic reaches — grabbing it needs matching height.
const HIGH_LEDGE_Y = 150
const LIFE_UP_ROOMS: Record<string, { x: number; y: number; high: boolean }> = Object.fromEntries(
  CASTLE_LIFEUP_ROOMS.map((r) => [r.id, { x: r.x, y: r.high ? HIGH_LEDGE_Y : FLOOR_Y, high: r.high }]),
)
// The West Tower's Life Max Up sits on the TOPMOST ladder ledge of the 3-tall
// shaft: enlargeRoom's height ladder for h=3 (top = -2*ROOM_HEIGHT) ends at
// {x: 1080, y: -958, width: 220}, so the pickup centres on it.
LIFE_UP_ROOMS['dnc-tower'] = { x: 1190, y: -958, high: false }
const LIFE_UP_RANGE = 48
// Low tunnels per room (only a slide passes). Gates the cistern's Life Max Up.
const SLIDE_BARRIERS: Record<string, { x: number; width: number }> = {
  'res-cistern': { x: 1120, width: 72 },
}
// Rooms bigger than one screen scroll in 2D. Their pixel size is derived from
// the map footprint (ROOM_CELLS): a w-cell-wide room is w screens wide, a
// h-cell-tall room grows h-1 screens upward. So map boxes and in-game size match.
const BIG_ROOMS: Record<string, { width: number; top: number }> = Object.fromEntries(
  Object.entries(ROOM_CELLS)
    .filter(([, c]) => c.w > 1 || c.h > 1)
    .map(([id, c]) => [id, { width: c.w * ROOM_WIDTH, top: (1 - c.h) * ROOM_HEIGHT }]),
)
// Doors sealed until an ability/key is owned: nodeId -> direction -> required id.
// The Chapel's bell-loft branch is barred until you find the Silver Key; the
// West Tower (both approaches) opens only to the high jump.
const SEALED_DOORS: Record<string, Partial<Record<MapDir, string>>> = {
  'chp-nave': { e: 'silver-key' },
  'dnc-ballroom': { w: 'high-jump' },
  'cor-larder': { n: 'high-jump' },
}
const GRAVITY = 0.78
const WALK_SPEED = 3.4
// Fell Bat: how close (horizontally) the player must get before it drops, the
// height above the player's feet it settles at (their standing-attack level), its
// slow horizontal cruise speed, and the gentle up/down wave it flies in.
const BAT_AGGRO_X = 230
const BAT_ATTACK_HEIGHT = 96
const BAT_CRUISE_SPEED = 3.2
const BAT_WAVE_AMP = 22
const BAT_WAVE_FREQ = 0.13
// Continuous zombie spawner (zombie rooms): interval between spawns, live cap, and
// how long a spawned zombie lingers before it sinks away.
const ZOMBIE_SPAWN_INTERVAL = 130
const ZOMBIE_ROOM_CAP = 6
const ZOMBIE_LIFETIME = 780
const AIR_SPEED = 3.0
const ATTACK_DRIFT_SPEED = 1.6
const DASH_SPEED = 12
const DASH_TICKS = 10
const DASH_COOLDOWN_TICKS = 28
// Slide (down + dash with the slide relic): a fast, low crawl under low tunnels.
const SLIDE_SPEED = 11
const SLIDE_TICKS = 22
const SLIDE_COOLDOWN_TICKS = 20
// Dive attack: a fast downward plunge (Down+jump after your jumps are spent) that
// damages anything it drops onto.
const DIVE_SPEED = 15
// A 45° air slide (Down + a direction while airborne): equal x/y speed.
const DIVE_DIAG_SPEED = 9.5
const DIVE_DAMAGE = 16
// A low tunnel's floor gap — a standing player is blocked, a sliding one fits.
const CRAWL_GAP = 46
const JUMP_VELOCITY = -15.5
// Releasing jump caps the rising speed to this, giving variable jump height
// (a light tap is a mini-hop; holding through the ascent is the full jump).
const JUMP_CUTOFF = -8.5
// Griffon Wing high-jump strength, relative to a normal jump.
const HIGH_JUMP_MULT = 1.7
const FAST_FALL_SPEED = 12
// Fall speed cap while the Flying Armor guardian (glide) is active.
const GLIDE_FALL_SPEED = 2.4
// Water: buoyancy that floats a non-diver up to the surface, the slow sink speed
// for a diver, and the horizontal drag applied to anyone in the water.
const WATER_BUOYANCY = 1.35
const WATER_RISE_CAP = 3.2
const WATER_SINK_SPEED = 1.8
const WATER_DRAG = 0.82
const WALL_MARGIN = 48
// Vertical reach for snapping onto a staircase surface while walking it.
const STAIR_GRAB = 22
const HURT_TICKS = 20
const INVULNERABLE_TICKS = 72
const DEBUG_HITBOXES = new URLSearchParams(location.search).has('hitbox')
// Optional GBA-style downscale of the game world — OFF by default so the source
// art stays crisp. Opt in with ?pixel; PIXELATE_FACTOR tunes the chunkiness.
const GBA_PIXELATE = new URLSearchParams(location.search).has('pixel')
const PIXELATE_FACTOR = 3
const CONTACT_HIT_COOLDOWN = 24
const BIG_HIT_FLASH_TICKS = 10
const SPIKE_DAMAGE = 14
const CRUMBLE_DELAY = 40
const CRUMBLE_RESPAWN = 150
const DEATH_HOLD_TICKS = 4 // brief crumple, then a quick fade so kills despawn fast
const DEATH_FADE_TICKS = 10
const DEFEAT_RETRY_TICKS = 120
const BOSS_INTRO_TICKS = 120 // cinematic name-reveal pause when a boss room starts
const ZONE_INTRO_TICKS = 150 // ~2.5s title card shown on entering a new zone
// Display name for each chapter/zone, shown on the zone title card (falls back to
// the chapter title for any not listed here).
const ZONE_NAMES: Record<string, string> = {
  'castle-corridor': 'ENTRANCE',
  'underground-reservoir': 'UNDERGROUND',
}
// Global shrink applied uniformly to every campaign actor's on-screen size and
// hit target (Julius, enemies, and bosses) for a tighter classic-Castlevania read.
// Feet stay planted because anchorY is scaled at draw time; attack reach is data
// (absolute px) so it is intentionally left untouched.
const ACTOR_SCALE = 0.8
const SUBWEAPON_ORDER = ['dagger', 'axe', 'cross', 'holyWater', 'stopwatch'] as const
type SubweaponKind = (typeof SUBWEAPON_ORDER)[number]
const SUBWEAPON_LABELS: Record<SubweaponKind, string> = {
  dagger: 'DAGGER',
  axe: 'AXE',
  cross: 'CROSS',
  holyWater: 'HOLY WATER',
  stopwatch: 'STOPWATCH',
}
// Subweapons now spend MP (the blue bar), which regenerates over time and is
// topped up by hearts — no separate heart-ammo count.
const SUBWEAPON_COSTS: Record<SubweaponKind, number> = {
  dagger: 6,
  axe: 10,
  cross: 12,
  holyWater: 12,
  stopwatch: 28,
}
// MP restored by collecting a heart (candles, drops).
const HEART_MP = 18
const SUBWEAPON_DAMAGE: Record<SubweaponKind, number> = {
  dagger: 5,
  axe: 9,
  cross: 8,
  holyWater: 5,
  stopwatch: 0,
}
const SUBWEAPON_SPEED_X: Record<SubweaponKind, number> = {
  dagger: 14,
  axe: 8,
  cross: 11,
  holyWater: 7,
  stopwatch: 0,
}
const SUBWEAPON_SPEED_Y: Record<SubweaponKind, number> = {
  dagger: 0,
  axe: -11,
  cross: 0,
  holyWater: -12,
  stopwatch: 0,
}
const SUBWEAPON_GRAVITY: Record<SubweaponKind, number> = {
  dagger: 0,
  axe: 0.5,
  cross: 0,
  holyWater: 0.72,
  stopwatch: 0,
}
const SUBWEAPON_LIFETIME: Record<SubweaponKind, number> = {
  dagger: 80,
  axe: 96,
  cross: 140,
  holyWater: 52,
  stopwatch: 1,
}
const SUBWEAPON_BOX: Record<SubweaponKind, Rect> = {
  dagger: { x: 0, y: 0, width: 20, height: 8 },
  axe: { x: 0, y: 0, width: 18, height: 18 },
  cross: { x: 0, y: 0, width: 18, height: 10 },
  holyWater: { x: 0, y: 0, width: 18, height: 18 },
  stopwatch: { x: 0, y: 0, width: 20, height: 20 },
}

// Variant enemies reuse base sprite sheets, so a soft aura (RGB triple) is what
// visually separates, e.g., an armored skeleton from a plain one at a glance.
const ENEMY_GLOW: Record<string, string> = {
  armoredSkeleton: '126,168,255',
  ghoul: '124,214,124',
  boneThrower: '178,132,224',
}


interface Platform {
  x: number
  y: number
  width: number
  height: number
  /** Crumbling platforms drop away shortly after being stood on, then respawn. */
  crumble?: boolean
  crumbleTimer?: number
  fallen?: boolean
  respawnTimer?: number
  /** A one-way platform you can fall through by holding Down (drop-through shaft). */
  dropThrough?: boolean
}

interface Hazard {
  x: number
  y: number
  width: number
  height: number
}

/** A walkable diagonal staircase (Castlevania-style). Collision uses a smooth
 *  ramp along its span; you walk up/down it without jumping. */
interface Stair {
  /** x of the lower end (bottom step). */
  x: number
  /** surface y of the lower end (bottom step). */
  y: number
  /** 1 ascends toward +x, -1 ascends toward -x. */
  dir: 1 | -1
  steps: number
  /** horizontal run per step. */
  run: number
  /** vertical rise per step. */
  rise: number
}

/** A low overhang you can only pass by sliding (blocks a standing/jumping player
 *  across its whole x-span; a sliding player fits through the floor gap). */
interface Barrier {
  x: number
  width: number
}

interface RoomLayout {
  platforms: Platform[]
  stairs: Stair[]
  barriers: Barrier[]
  hazards: Hazard[]
  /** Room extent. It spans x=[0,width] and y=[top,ROOM_HEIGHT]; the floor stays at
   *  FLOOR_Y, so bigger rooms grow rightward (width) and upward (a negative top). */
  width: number
  top: number
  /** Open shaft in the floor (drop-through passage down), or null for a solid floor. */
  floorGap: { x: number; width: number } | null
  /** A body of water: fills [x, x+width] from surfaceY down to the floor. You float
   *  on the surface unless a "breathe underwater" soul lets you sink. */
  water: { x: number; width: number; surfaceY: number } | null
  doorX: number
  doorY: number
  checkpointX: number
  checkpointY: number
  backdrop: string
}

interface SpriteSet {
  idle: SpriteSheet
  run: SpriteSheet
  jump: SpriteSheet
  fall: SpriteSheet
  attack1: SpriteSheet
  attack2: SpriteSheet
  takeHit: SpriteSheet
  death: SpriteSheet
}

interface ProjectileSpawn {
  move: AttackMove
  x: number
  y: number
  facing: Facing
}

interface ProjectileRuntime {
  spawn: ProjectileSpawn
  sheet: SpriteSheet
  animator: Animator
  position: Vec2
  ticksLeft: number
  hasHit: boolean
}

interface SubweaponRuntime {
  kind: SubweaponKind
  position: Vec2
  velocity: Vec2
  facing: Facing
  ticksLeft: number
  hasHit: boolean
  phase?: 'outbound' | 'returning' | 'flame'
  hitTargets?: Set<CastleActor>
}

interface Candle {
  x: number
  y: number
  broken: boolean
}

interface FloatingText {
  x: number
  y: number
  text: string
  color: string
  ticksLeft: number
}

/** Short-lived debris bit — e.g. wax shards and sparks from a shattered candle. */
interface Particle {
  position: Vec2
  velocity: Vec2
  ticksLeft: number
  life: number
  size: number
  color: string
  gravity: number
}

interface EnemyBone {
  position: Vec2
  velocity: Vec2
  spin: number
  ticksLeft: number
  hasHit: boolean
  /** Which projectile this is (drives the drawing and damage). */
  kind: 'bone' | 'axe' | 'fire'
  damage: number
}

// Aria-of-Sorrow-style magic: the special meter doubles as MP, spent to cast a
// piercing "soul" bolt. MP regenerates passively so magic is always coming back.
interface SoulBolt {
  position: Vec2
  velocity: Vec2
  facing: Facing
  ticksLeft: number
  spin: number
  damage: number
  homing: boolean
  /** Arcing spear: pulled down by gravity and drawn as a spear along its heading. */
  arc: boolean
  hitTargets: Set<CastleActor>
}

const MP_REGEN = 0.18
const SOUL_SPEED = 13
const SOUL_LIFETIME = 66
// Downward pull on the arcing spear cast (the default soul's curved shot), and
// how long the spear stays in flight before it fades.
const SOUL_ARC_GRAVITY = 0.4
const SOUL_ARC_LIFETIME = 96
const SOUL_HOMING_LIFETIME = 100
const SOUL_HIT_LIMIT = 3
const SOUL_CAST_COOLDOWN = 22

const BONE_DAMAGE = 8
const AXE_DAMAGE = 12
const FIRE_DAMAGE = 16
const FIRE_SPEED = 6.4
const BONE_SPEED = 8
const BONE_GRAVITY = 0.2
// Skeletons throw sparingly — ~one bone every 5s (300 ticks) plus a little jitter.
const SKELETON_THROW_COOLDOWN = 300
// Creaking Skull: a long pause between its big sweeps (~2.5s on top of the swing).
const CREAKING_SKULL_ATTACK_CD = 150
// Axe Sentinel: pause between axe throws (~1.6s + the throw animation).
const AXE_THROW_COOLDOWN = 96

// XP and gold granted when each enemy type is defeated. Bosses use a fixed
// bounty (see campaignEnemyReward) rather than this table.
const ENEMY_REWARD: Record<string, { xp: number; gold: number }> = {
  skeleton: { xp: 6, gold: 4 },
  zombie: { xp: 5, gold: 3 },
  ghoul: { xp: 4, gold: 2 },
  bat: { xp: 4, gold: 3 },
  axeArmor: { xp: 13, gold: 9 },
  armoredSkeleton: { xp: 14, gold: 10 },
  boneThrower: { xp: 10, gold: 7 },
}

type PickupKind = 'heart' | 'gold' | 'mp'

interface Pickup {
  position: Vec2
  velocity: Vec2
  kind: PickupKind
  value: number
  ticksLeft: number
}

class CastleActor {
  readonly position: Vec2
  readonly prevPosition: Vec2
  readonly velocity: Vec2 = { x: 0, y: 0 }
  maxHealth = 100
  health = 100
  meter = 0
  meterGainMultiplier = 1
  isBoss = false
  rangedAttacker = false
  /** Equipped weapon's swing profile (players only); null uses the base attack. */
  weaponProfile: WeaponProfile | null = null
  /** Ground-spawn emerge: counts down while the enemy rises out of the floor. */
  riseTicks = 0
  riseMax = 1
  /** Wander AI state (shambling enemies): current move (-1/0/1) and its timer. */
  wanderMove: -1 | 0 | 1 = 0
  wanderTicks = 0
  /** Cooldown (ticks) between ranged throws, so the skeleton lobs slowly. */
  throwCooldown = 0
  /** Flying enemies (bats) ignore gravity and floor collision. */
  flying = false
  /** Bat behaviour: roosting until aggroed, then a committed dive off-screen. */
  batPhase: 'roost' | 'dive' = 'roost'
  private batBob = 0
  /** The eased baseline height the diving bat undulates around. */
  private batCenterY = 0
  /** Ticks alive — drives the timed despawn of ambient spawned zombies. */
  ageTicks = 0
  /** Force removal next filter pass (flew off-screen / timed out), no reward. */
  forceGone = false
  private pendingRangedShot: { x: number; y: number; facing: Facing } | null = null
  grounded = true
  facing: Facing
  state: 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'dash' | 'hurt' | 'death' | 'crouch' | 'dive' = 'idle'
  /** Enemies already struck by the current dive attack (so each is hit once). */
  readonly diveHits = new Set<CastleActor>()
  /** Horizontal direction of the current dive (0 straight down, ±1 for a 45° slide). */
  private diveDirX: -1 | 0 | 1 = 0
  private glowPhase = 0
  private deathTicks = 0
  private readonly sheets: SpriteSet
  private readonly animator: Animator
  private moveSpeedMultiplier: number
  private attackMove: AttackMove | null = null
  private attackTick = 0
  private attackConnected = false
  private projectileSpawned = false
  private pendingProjectileSpawn: ProjectileSpawn | null = null
  private hurtTick = 0
  private invulnerableTicks = 0
  private jumpCount = 0
  maxJumps = 2
  lastDamageTaken = 0
  /** Whether the high-jump relic (Griffon Wing) is owned. */
  hasHighJump = false
  /** Flying Armor guardian active: caps fall speed for a gentle descent. */
  gliding = false
  /** Whether the slide relic (Fleet Greaves) is owned. */
  hasSlide = false
  private slideTicks = 0
  private slideCooldown = 0
  get isSliding(): boolean {
    return this.slideTicks > 0
  }
  /** Walkable staircases in the current room (empty for enemies). */
  stairs: Stair[] = []
  /** Low tunnels that only a slide passes (empty for enemies). */
  barriers: Barrier[] = []
  /** Open shaft in the floor at this x-span — no floor there (drop-through down). */
  floorGap: { x: number; width: number } | null = null
  /** Water body in the room (player only); null elsewhere. */
  water: { x: number; width: number; surfaceY: number } | null = null
  /** Can breathe/sink underwater (has the Drowned Soul); otherwise floats. */
  canDive = false
  /** Current room bounds (for clamps). The floor stays at FLOOR_Y. */
  roomWidth = ROOM_WIDTH
  roomTop = 0
  /** Counts down while a Down-press lets the player fall through drop-through platforms. */
  private dropTicks = 0
  private dashTicks = 0
  private dashCooldown = 0
  /** Movement direction of the current dash (a backdash moves opposite facing). */
  private dashDir: Facing = 1

  constructor(
    readonly def: CharacterDef,
    assets: AssetManager,
    x: number,
    y: number,
    facing: Facing,
    moveSpeedMultiplier = 1,
  ) {
    this.position = { x, y }
    this.prevPosition = { x, y }
    this.facing = facing
    this.moveSpeedMultiplier = moveSpeedMultiplier
    this.sheets = buildSpriteSet(def, assets)
    this.animator = new Animator(this.sheets.idle, 8, true)
  }

  get isDead(): boolean {
    return this.state === 'death' || this.health <= 0
  }

  /** True once the death animation and fade have fully played out, or forced. */
  get isGone(): boolean {
    return this.forceGone || (this.state === 'death' && this.deathTicks >= DEATH_HOLD_TICKS + DEATH_FADE_TICKS)
  }

  get currentMove(): AttackMove | null {
    return this.attackMove
  }

  get isAttacking(): boolean {
    return this.state === 'attack'
  }

  get canBeHit(): boolean {
    return this.state !== 'death' && this.invulnerableTicks <= 0 && this.riseTicks <= 0
  }

  get isEnraged(): boolean {
    return this.isBoss && this.state !== 'death' && this.health / this.maxHealth < 0.35
  }

  reset(x: number, y: number, facing: Facing): void {
    this.position.x = x
    this.position.y = y
    this.prevPosition.x = x
    this.prevPosition.y = y
    this.velocity.x = 0
    this.velocity.y = 0
    this.health = this.maxHealth
    this.meter = 0
    this.grounded = true
    this.facing = facing
    this.state = 'idle'
    this.attackMove = null
    this.attackTick = 0
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.hurtTick = 0
    this.invulnerableTicks = 0
    this.jumpCount = 0
    this.dashTicks = 0
    this.dashCooldown = 0
    this.deathTicks = 0
    this.pendingRangedShot = null
    this.animator.play(this.sheets.idle, 8, true)
    this.animator.reset()
  }

  update(intent: IntentState, opponentX: number, platforms: Platform[]): void {
    this.prevPosition.x = this.position.x
    this.prevPosition.y = this.position.y
    if (this.invulnerableTicks > 0) this.invulnerableTicks -= 1
    if (this.dashCooldown > 0) this.dashCooldown -= 1
    if (this.slideCooldown > 0) this.slideCooldown -= 1
    if (this.dropTicks > 0) this.dropTicks -= 1

    if (this.state === 'death') {
      this.deathTicks += 1
      this.updateAnimator()
      return
    }

    if (this.state === 'hurt') {
      this.updateHurt(platforms)
      this.updateAnimator()
      return
    }

    if (this.state === 'attack') {
      this.updateAttack(intent, platforms)
      this.updateAnimator()
      return
    }

    if (this.state === 'dive') {
      this.updateDive(platforms)
      this.updateAnimator()
      return
    }

    if (this.tryStartAttack(intent)) {
      this.updateAttack(intent, platforms)
      this.updateAnimator()
      return
    }

    this.updateLocomotion(intent, opponentX, platforms)
    this.updateAnimator()
  }

  /** Flight update for the Fell Bat: hover in place until the player draws near,
   *  then commit to a single dive toward them that carries on off the far side. */
  updateBat(px: number, py: number): void {
    this.prevPosition.x = this.position.x
    this.prevPosition.y = this.position.y
    if (this.invulnerableTicks > 0) this.invulnerableTicks -= 1
    if (this.state === 'death') { this.deathTicks += 1; this.updateAnimator(); return }
    if (this.state === 'hurt') {
      this.hurtTick += 1
      this.position.x += this.velocity.x * 0.5
      this.position.y += this.velocity.y * 0.5
      this.velocity.x *= 0.86
      this.velocity.y *= 0.86
      if (this.hurtTick >= HURT_TICKS) this.state = 'idle'
      this.updateAnimator()
      return
    }
    this.batBob += 1
    if (this.batPhase === 'roost') {
      // Hover with a gentle bob, facing the player; drop once it comes near.
      this.velocity.x = 0
      this.velocity.y = Math.sin(this.batBob * 0.12) * 0.6
      this.position.y += this.velocity.y
      this.facing = px >= this.position.x ? 1 : -1
      if (Math.abs(px - this.position.x) < BAT_AGGRO_X) {
        this.batPhase = 'dive'
        this.batCenterY = this.position.y // ease down from where it roosted
      }
    } else {
      // Drop to the player's standing-attack height, then cruise slowly toward
      // them, flying in a gentle up/down wave.
      const targetY = py - BAT_ATTACK_HEIGHT
      this.batCenterY += (targetY - this.batCenterY) * 0.05
      const dir: Facing = px >= this.position.x ? 1 : -1
      this.position.x += dir * BAT_CRUISE_SPEED
      this.position.y = this.batCenterY + Math.sin(this.batBob * BAT_WAVE_FREQ) * BAT_WAVE_AMP
      this.facing = dir
    }
    this.state = 'idle'
    this.updateAnimator()
  }

  /** Advance the death crumble/fade for a dead enemy so it disappears (the main
   *  update loop skips dead actors, so their fade must be ticked here). */
  advanceDeath(): void {
    if (this.state !== 'death') { this.state = 'death'; this.deathTicks = 0 }
    else this.deathTicks += 1
    this.updateAnimator()
  }

  /** Remove without a death (no reward): used for timed-out ambient spawns. Plays
   *  the crumble/fade so it doesn't just blink out. */
  despawnQuietly(): void {
    if (this.state === 'death') return
    this.state = 'death'
    this.deathTicks = 0
    this.velocity.x = 0
    this.velocity.y = 0
  }

  activeAttack(): { box: Rect; spec: AttackMove } | null {
    if (this.state !== 'attack' || !this.attackMove) return null
    if (this.attackConnected) return null
    if (!isActiveAt(this.attackMove, this.attackTick)) return null
    return { box: computeHitbox(this.attackMove.hitbox, this.position.x, this.position.y, this.facing), spec: this.attackMove }
  }

  markAttackConnected(): void {
    this.attackConnected = true
    if (this.attackMove) this.meter = clamp(this.meter + this.attackMove.damage * 0.8 * this.meterGainMultiplier, 0, 100)
  }

  applyHit(move: AttackMove, fromX: number, damageMultiplier = 1): boolean {
    if (!this.canBeHit) return false
    this.lastDamageTaken = Math.max(1, Math.round(move.damage * damageMultiplier))
    this.health = Math.max(0, this.health - this.lastDamageTaken)
    // Bosses take the damage but shrug off the knockback and stagger (super armour),
    // keeping their footing and their attack. Death still plays out normally.
    if (this.isBoss && this.health > 0) return true
    this.velocity.x = this.position.x >= fromX ? 6 : -6
    this.velocity.y = move.knockbackY
    this.grounded = false
    this.hurtTick = 0
    this.attackMove = null
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.state = this.health <= 0 ? 'death' : 'hurt'
    this.invulnerableTicks = this.shouldUseHitInvulnerability() && this.state !== 'death' ? INVULNERABLE_TICKS : 0
    const sheet = this.sheets
    if (this.state === 'death') this.animator.play(sheet.death, 6, false)
    else this.animator.play(sheet.takeHit, 4, false)
    return true
  }

  applyFlatDamage(damage: number, fromX: number, knockbackY: number, damageMultiplier = 1): boolean {
    if (!this.canBeHit) return false
    this.lastDamageTaken = Math.max(1, Math.round(damage * damageMultiplier))
    this.health = Math.max(0, this.health - this.lastDamageTaken)
    if (this.isBoss && this.health > 0) return true
    this.velocity.x = this.position.x >= fromX ? 5 : -5
    this.velocity.y = knockbackY
    this.grounded = false
    this.hurtTick = 0
    this.attackMove = null
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.state = this.health <= 0 ? 'death' : 'hurt'
    this.invulnerableTicks = this.shouldUseHitInvulnerability() && this.state !== 'death' ? INVULNERABLE_TICKS : 0
    if (this.state === 'death') this.animator.play(this.sheets.death, 6, false)
    else this.animator.play(this.sheets.takeHit, 4, false)
    return true
  }

  consumeProjectileSpawn(): ProjectileSpawn | null {
    const spawn = this.pendingProjectileSpawn
    this.pendingProjectileSpawn = null
    return spawn
  }

  consumeRangedShot(): { x: number; y: number; facing: Facing } | null {
    const shot = this.pendingRangedShot
    this.pendingRangedShot = null
    return shot
  }

  tryJump(): void {
    if (!this.grounded && this.jumpCount >= this.maxJumps) return
    this.velocity.y = JUMP_VELOCITY
    this.grounded = false
    // Jumping is a clear "go up" intent: cancel any pending drop-through window so
    // a Down-then-jump near a floor shaft launches instead of falling through.
    this.dropTicks = 0
    this.jumpCount += 1
    this.state = 'jump'
    this.attackMove = null
    this.attackConnected = false
    this.animator.play(this.sheets.jump, 8, true)
  }

  /** Griffon Wing high jump: a much stronger leap off the ground. Still counts
   *  as the first jump, so a double jump remains available at the apex. */
  private highJump(): void {
    this.velocity.y = JUMP_VELOCITY * HIGH_JUMP_MULT
    this.grounded = false
    this.dropTicks = 0
    this.jumpCount = 1
    this.state = 'jump'
    this.attackMove = null
    this.attackConnected = false
    this.animator.play(this.sheets.jump, 8, true)
  }

  tryDash(direction: Facing): void {
    if (this.state === 'death' || this.state === 'hurt' || this.dashCooldown > 0) return
    this.facing = direction
    this.dashDir = direction
    this.dashTicks = DASH_TICKS
    this.dashCooldown = DASH_COOLDOWN_TICKS
    this.attackMove = null
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.state = 'dash'
    this.animator.play(this.sheets.run, 3, true)
  }

  /** A backdash: dash backward (opposite the way you're facing) without turning. */
  tryBackdash(): void {
    if (this.state === 'death' || this.state === 'hurt' || this.dashCooldown > 0 || !this.grounded) return
    this.dashDir = (this.facing === 1 ? -1 : 1) as Facing
    this.dashTicks = DASH_TICKS
    this.dashCooldown = DASH_COOLDOWN_TICKS
    this.attackMove = null
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.state = 'dash'
    this.animator.play(this.sheets.run, 3, true)
  }

  /** Slide: a fast low crawl that fits under low tunnels. Ground-only. */
  trySlide(direction: Facing): void {
    if (this.state === 'death' || this.state === 'hurt' || this.slideCooldown > 0 || !this.grounded) return
    this.facing = direction
    this.slideTicks = SLIDE_TICKS
    this.slideCooldown = SLIDE_TICKS + SLIDE_COOLDOWN_TICKS
    this.attackMove = null
    this.attackConnected = false
    this.state = 'dash'
    this.animator.play(this.sheets.run, 3, true)
  }

  /** Diving slam: plunge straight down fast; the scene damages whatever it hits. */
  private tryDiveAttack(dir: -1 | 0 | 1 = 0): void {
    if (this.state === 'death' || this.state === 'hurt') return
    this.state = 'dive'
    this.diveDirX = dir
    if (dir !== 0) this.facing = dir
    this.velocity.x = dir * DIVE_DIAG_SPEED
    this.velocity.y = dir !== 0 ? DIVE_DIAG_SPEED : DIVE_SPEED
    this.attackMove = null
    this.attackConnected = false
    this.diveHits.clear()
    this.animator.play(this.sheets.jump, 4, true)
  }

  private updateDive(platforms: Platform[]): void {
    // Straight plunge, or a 45° slide toward the ground when a direction was held.
    this.velocity.x = this.diveDirX * DIVE_DIAG_SPEED
    this.velocity.y = this.diveDirX !== 0 ? DIVE_DIAG_SPEED : DIVE_SPEED
    this.integrate(platforms)
    if (this.grounded) this.setMotion('idle') // landed — dive ends
  }

  get isDiving(): boolean {
    return this.state === 'dive'
  }

  /** The damaging box around a diving fighter (body + a bit below the feet). */
  diveHitbox(): Rect {
    const w = this.def.visual.hurtbox.width * ACTOR_SCALE
    const h = this.def.visual.hurtbox.height * ACTOR_SCALE
    return { x: this.position.x - w / 2 - 6, y: this.position.y - h, width: w + 12, height: h + 20 }
  }

  private tryStartAttack(intent: IntentState): boolean {
    if (this.state === 'death' || this.state === 'hurt' || this.state === 'attack') return false
    let move = intent.specialPressed && this.meter >= (this.def.moves.super.meterCost ?? Number.POSITIVE_INFINITY)
      ? this.def.moves.super
      : intent.specialPressed
        ? this.def.moves.special
        : intent.heavyPressed
          ? this.def.moves.heavy
          : intent.lightPressed
            ? this.def.moves.light
            : null
    if (!move) return false
    // A light attack while crouching is a low crouch slash near the ground.
    if (move === this.def.moves.light && this.grounded && intent.downHeld && intent.moveX === 0) move = this.crouchMove()
    // The light attack is the weapon swing — take its reach/speed/damage from
    // the equipped weapon so each weapon type plays differently.
    else if (move === this.def.moves.light && this.weaponProfile) move = this.weaponMove(this.weaponProfile)
    if (move.meterCost) this.meter = Math.max(0, this.meter - move.meterCost)
    this.attackMove = move
    this.attackTick = 0
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.velocity.x = 0
    this.state = 'attack'
    this.animator.play(move.animKey === 'attack2' ? this.sheets.attack2 : this.sheets.attack1, 4, false)
    this.animator.reset()
    return true
  }

  /** The base light attack retimed and re-sized to the equipped weapon. */
  private weaponMove(w: WeaponProfile): AttackMove {
    return {
      ...this.def.moves.light,
      startup: w.startup,
      active: w.active,
      recovery: w.recovery,
      damage: w.damage,
      knockbackX: w.knockbackX,
      knockbackY: w.knockbackY,
      planted: w.planted === true,
      // Extend the swing down to near the floor so short grounded enemies (the
      // zombie is only ~82px tall) still get hit, not just the chest-high band.
      hitbox: { forward: w.reach, top: w.top, width: w.width, height: Math.max(w.height, w.top - 8) },
    }
  }

  /** A quick low sweep along the ground, used when attacking from a crouch. */
  private crouchMove(): AttackMove {
    const w = this.weaponProfile
    const reach = w ? w.reach : 16
    const width = w ? Math.max(88, w.width * 0.78) : 96
    return {
      ...this.def.moves.light,
      id: 'crouch-slash',
      startup: 5,
      active: 5,
      recovery: 13,
      damage: w ? w.damage : this.def.moves.light.damage,
      knockbackX: 6,
      knockbackY: -2,
      hitbox: { forward: reach, top: 58, width, height: 48 },
    }
  }

  private updateLocomotion(intent: IntentState, opponentX: number, platforms: Platform[]): void {
    const moveSpeed = (this.grounded ? WALK_SPEED : AIR_SPEED) * this.moveSpeedMultiplier
    const sliding = this.slideTicks > 0
    const dashing = this.dashTicks > 0 || sliding
    if (this.slideTicks > 0) {
      this.slideTicks -= 1
      this.velocity.x = this.facing * SLIDE_SPEED
    } else if (this.dashTicks > 0) {
      this.dashTicks -= 1
      this.velocity.x = this.dashDir * DASH_SPEED
    } else {
      this.velocity.x = intent.moveX * moveSpeed
    }
    // Keep facing locked through a slide so you can't reverse into the tunnel.
    if (!sliding) {
      if (intent.moveX > 0) this.facing = 1
      else if (intent.moveX < 0) this.facing = -1
      else this.facing = opponentX >= this.position.x ? 1 : -1
    }

    if (intent.jumpPressed && !sliding) {
      if (this.grounded && intent.downHeld && this.onDroppablePlatform(platforms)) {
        // Down + jump on a one-way platform drops through it instead of jumping.
        this.dropTicks = DROP_WINDOW
        this.grounded = false
      } else if (this.grounded && intent.downHeld) {
        this.trySlide(this.facing) // Down + jump on solid ground is a slide.
      } else if (!this.grounded && intent.downHeld && this.jumpCount >= this.maxJumps) {
        this.tryDiveAttack() // Down + jump in the air (jumps spent) is a diving slam.
      } else if (this.grounded && intent.upHeld && this.hasHighJump) this.highJump()
      else this.tryJump()
    }
    // In the air, holding Down + a direction slides down toward the ground at 45°.
    if (!this.grounded && intent.downHeld && intent.moveX !== 0) this.tryDiveAttack(intent.moveX)
    if (this.state === 'dive') return // the dive takes over from here
    // Variable jump height: releasing jump while still rising cuts the ascent
    // short, so a light tap is a mini-hop and holding gives the full jump.
    if (this.state === 'jump' && !intent.jumpHeld && this.velocity.y < JUMP_CUTOFF) {
      this.velocity.y = JUMP_CUTOFF
    }
    if (!this.grounded && intent.downHeld && this.velocity.y > 0 && this.velocity.y < FAST_FALL_SPEED) {
      this.velocity.y = FAST_FALL_SPEED
    }

    this.integrate(platforms)

    if (dashing) {
      this.state = 'dash'
      return
    }
    // Holding Down while standing still on the ground is a crouch (duck low).
    const crouching = this.grounded && intent.downHeld && intent.moveX === 0
    const next = !this.grounded ? (this.velocity.y < 0 ? 'jump' : 'fall') : crouching ? 'crouch' : intent.moveX === 0 ? 'idle' : 'run'
    this.setMotion(next)
  }

  private updateAttack(intent: IntentState, platforms: Platform[]): void {
    this.attackTick += 1
    // A "planted" swing (e.g. the broadsword) roots the fighter for the swing;
    // otherwise the attacker keeps a little drift.
    this.velocity.x = this.attackMove?.planted ? 0 : intent.moveX * ATTACK_DRIFT_SPEED
    if (intent.moveX > 0) this.facing = 1
    else if (intent.moveX < 0) this.facing = -1
    // Ranged enemies release a projectile once as their light (throw/charge) move
    // goes active — not on melee moves like a heavy chop or sweep.
    if (this.rangedAttacker && this.attackMove === this.def.moves.light && this.attackTick === this.attackMove.startup + 1) {
      this.pendingRangedShot = { x: this.position.x + this.facing * 30, y: this.position.y - 66, facing: this.facing }
    }
    if (this.attackMove?.projectile && !this.projectileSpawned) {
      const spawnTick = this.attackMove.projectile.spawnTick ?? this.attackMove.startup
      if (this.attackTick >= spawnTick) {
        this.projectileSpawned = true
        this.pendingProjectileSpawn = {
          move: this.attackMove,
          x: this.position.x + this.facing * this.attackMove.projectile.offsetX,
          y: this.position.y + this.attackMove.projectile.offsetY,
          facing: this.facing,
        }
      }
    }

    if (this.attackMove?.lunge !== undefined && this.attackTick <= this.attackMove.startup + this.attackMove.active) {
      this.velocity.x = this.facing * this.attackMove.lunge
    }
    this.integrate(platforms)
    if (intent.jumpPressed && this.attackMove?.jumpCancelableOnHit && this.attackConnected) {
      this.attackMove = null
      this.attackConnected = false
      this.tryJump()
      return
    }
    if (this.attackMove && this.attackTick >= totalFrames(this.attackMove)) {
      this.attackMove = null
      this.attackConnected = false
      this.state = this.grounded ? 'idle' : 'fall'
      this.animator.play(this.grounded ? this.sheets.idle : this.sheets.fall, 8, true)
    }
  }

  private updateHurt(platforms: Platform[]): void {
    this.hurtTick += 1
    this.velocity.x *= 0.9
    this.integrate(platforms)
    if (this.hurtTick >= HURT_TICKS && this.grounded) {
      this.state = 'idle'
      this.animator.play(this.sheets.idle, 8, true)
    }
  }

  /** True when standing on a one-way platform you can drop through (the shaft
   *  cover, or any raised ledge) — used to gate the Down+jump drop. */
  private onDroppablePlatform(platforms: Platform[]): boolean {
    for (const p of platforms) {
      if (p.fallen || !(p.dropThrough || p.y < FLOOR_Y)) continue
      if (this.position.x < p.x - 2 || this.position.x > p.x + p.width + 2) continue
      if (Math.abs(this.position.y - p.y) <= 2) return true
    }
    return false
  }

  private integrate(platforms: Platform[]): void {
    const wasGrounded = this.grounded
    this.position.x += this.velocity.x
    this.position.x = clamp(this.position.x, WALL_MARGIN, this.roomWidth - WALL_MARGIN)
    // Low tunnels block a standing/jumping player across their whole span; only a
    // slide fits through the floor gap.
    if (!this.isSliding) {
      for (const bar of this.barriers) {
        const left = bar.x
        const right = bar.x + bar.width
        const px = this.prevPosition.x
        if (px <= left && this.position.x > left) { this.position.x = left; this.velocity.x = 0 }
        else if (px >= right && this.position.x < right) { this.position.x = right; this.velocity.x = 0 }
        else if (this.position.x > left && this.position.x < right) { this.position.x = px <= (left + right) / 2 ? left : right }
      }
    }
    this.velocity.y += GRAVITY
    // Flying Armor: cap the descent to a gentle glide (but never during a dive).
    if (this.gliding && this.state !== 'dive' && this.velocity.y > GLIDE_FALL_SPEED) this.velocity.y = GLIDE_FALL_SPEED
    // Water: buoyancy floats a non-diver up to the surface; a diver sinks slowly.
    // Both get horizontal drag while submerged.
    const wtr = this.water
    if (wtr && this.position.x > wtr.x && this.position.x < wtr.x + wtr.width && this.position.y > wtr.surfaceY) {
      this.velocity.x *= WATER_DRAG
      if (this.canDive) {
        if (this.velocity.y > WATER_SINK_SPEED) this.velocity.y = WATER_SINK_SPEED
      } else {
        this.velocity.y = Math.max(this.velocity.y - WATER_BUOYANCY, -WATER_RISE_CAP)
      }
    }
    this.position.y += this.velocity.y
    if (this.position.y < this.roomTop) { this.position.y = this.roomTop; if (this.velocity.y < 0) this.velocity.y = 0 }

    let landed = false
    let landingY = FLOOR_Y
    for (const platform of platforms) {
      if (platform.fallen) continue
      // While a drop-through is active, fall straight through one-way platforms —
      // the shaft cover and any raised (above-floor) ledge.
      if (this.dropTicks > 0 && (platform.dropThrough || platform.y < FLOOR_Y)) continue
      if (this.position.x < platform.x - 2 || this.position.x > platform.x + platform.width + 2) continue
      if (this.prevPosition.y <= platform.y && this.position.y >= platform.y && this.velocity.y >= 0) {
        landed = true
        landingY = Math.min(landingY, platform.y)
      }
    }
    // Staircases: walk up/down the ramp without jumping. Grab the surface when
    // moving downward/level and within reach of it (or crossing it while falling).
    for (const stair of this.stairs) {
      const sy = stairSurfaceY(stair, this.position.x)
      if (sy === null) continue
      const nearSurface = this.position.y >= sy - STAIR_GRAB && this.position.y <= sy + STAIR_GRAB
      const crossed = this.prevPosition.y <= sy + 1 && this.position.y >= sy
      if (this.velocity.y >= 0 && (nearSurface || crossed)) {
        landed = true
        landingY = Math.min(landingY, sy)
      }
    }

    // Without a diving soul, the water surface is solid footing — you float on it.
    if (wtr && !this.canDive && this.position.x > wtr.x && this.position.x < wtr.x + wtr.width && this.position.y >= wtr.surfaceY) {
      landed = true
      landingY = Math.min(landingY, wtr.surfaceY)
    }
    // The room's base floor catches everyone, except over an open shaft, where the
    // only footing is the drop-through platform handled above.
    const overGap = this.floorGap !== null && this.position.x > this.floorGap.x && this.position.x < this.floorGap.x + this.floorGap.width
    if (!overGap && this.position.y >= FLOOR_Y) {
      landed = true
      landingY = Math.min(landingY, FLOOR_Y)
    }
    if (landed) {
      this.position.y = landingY
      this.velocity.y = 0
      this.grounded = true
      this.jumpCount = 0
      if (this.state === 'jump' || this.state === 'fall') this.setMotion(Math.abs(this.velocity.x) > 0 ? 'run' : 'idle')
    } else {
      this.grounded = false
      if (wasGrounded) this.jumpCount = Math.max(this.jumpCount, 1)
    }
  }

  private setMotion(next: CastleActor['state']): void {
    if (this.state === 'death' || this.state === 'hurt' || this.state === 'attack') return
    this.state = next
    const s = this.sheets
    switch (next) {
      case 'idle':
        this.animator.play(s.idle, 8, true)
        break
      case 'run':
        this.animator.play(s.run, 6, true)
        break
      case 'jump':
        this.animator.play(s.jump, 8, true)
        break
      case 'fall':
        this.animator.play(s.fall, 8, true)
        break
      case 'crouch':
        this.animator.play(s.idle, 8, true)
        break
      case 'attack':
      case 'dash':
      case 'hurt':
      case 'death':
        break
    }
  }

  private updateAnimator(): void {
    if (this.def.isHero === true && this.state === 'idle') return
    this.animator.update()
  }

  render(renderer: Renderer, cameraX: number): void {
    this.drawGlow(renderer, cameraX)
    if (this.invulnerableTicks > 0 && Math.floor(this.invulnerableTicks / 4) % 2 === 0) return
    const { ctx } = renderer
    const fx = this.position.x - cameraX
    const fy = this.position.y
    if (this.riseTicks > 0) {
      // Emerge from the floor: the figure rises out of the ground, clipped at it.
      const prog = 1 - this.riseTicks / this.riseMax
      const H = this.def.visual.hurtbox.height * ACTOR_SCALE * 1.3
      ctx.save()
      ctx.beginPath(); ctx.rect(fx - 130, FLOOR_Y - 4000, 260, 4000); ctx.clip()
      this.drawStick(ctx, fx, fy + (1 - prog) * H)
      ctx.restore()
      return
    }
    let alpha = 1
    if (this.state === 'death') {
      if (this.deathTicks >= DEATH_HOLD_TICKS + DEATH_FADE_TICKS) return
      alpha = clamp(1 - (this.deathTicks - DEATH_HOLD_TICKS) / DEATH_FADE_TICKS, 0, 1)
    }
    ctx.save()
    ctx.globalAlpha = alpha
    if (this.state === 'dash') {
      ctx.globalAlpha = alpha * 0.22
      this.drawStick(ctx, fx - this.dashDir * 26, fy)
      ctx.globalAlpha = alpha * 0.44
      this.drawStick(ctx, fx - this.dashDir * 13, fy)
      ctx.globalAlpha = alpha
    }
    if (this.isSliding) {
      // Squash around the feet so the slide reads as a low crawl.
      ctx.translate(0, fy)
      ctx.scale(1, 0.5)
      ctx.translate(0, -fy)
    }
    if (this.def.id === 'bat') this.drawBat(ctx, fx, fy)
    else if (this.def.id === 'creakingSkull') this.drawCreakingSkull(ctx, fx, fy)
    else this.drawStick(ctx, fx, fy)
    ctx.restore()
  }

  /** A small flapping bat: body, ears, and two wings whose spread animates. */
  private drawBat(ctx: CanvasRenderingContext2D, fx: number, fy: number): void {
    const col = this.def.color ?? '#8a6ab0'
    const cy = fy - this.def.visual.hurtbox.height * 0.5
    const bodyR = 8
    // Wing flap: fast during a dive, slow gentle beat while roosting.
    const speed = this.batPhase === 'dive' ? 0.5 : 0.14
    const flap = Math.sin(this.batBob * speed)
    const span = 22
    const rise = flap * 12
    ctx.save()
    ctx.fillStyle = col
    ctx.strokeStyle = col
    ctx.lineJoin = 'round'
    // Wings — a swept membrane each side that rises/falls with the flap.
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(fx, cy)
      ctx.quadraticCurveTo(fx + s * span * 0.6, cy - 10 - rise, fx + s * span, cy - rise)
      ctx.quadraticCurveTo(fx + s * span * 0.7, cy + 4 - rise * 0.4, fx + s * span * 0.5, cy + 8)
      ctx.quadraticCurveTo(fx + s * span * 0.3, cy + 3, fx, cy)
      ctx.closePath()
      ctx.fill()
    }
    // Body.
    ctx.beginPath()
    ctx.ellipse(fx, cy, bodyR, bodyR * 1.1, 0, 0, Math.PI * 2)
    ctx.fill()
    // Ears.
    ctx.beginPath()
    ctx.moveTo(fx - 4, cy - bodyR + 1); ctx.lineTo(fx - 6, cy - bodyR - 6); ctx.lineTo(fx - 1, cy - bodyR)
    ctx.moveTo(fx + 4, cy - bodyR + 1); ctx.lineTo(fx + 6, cy - bodyR - 6); ctx.lineTo(fx + 1, cy - bodyR)
    ctx.fill()
    // Eyes — a faint glow so the roost reads as "watching".
    ctx.fillStyle = '#ffd24a'
    ctx.beginPath(); ctx.arc(fx - 3, cy - 1, 1.4, 0, Math.PI * 2); ctx.arc(fx + 3, cy - 1, 1.4, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  /** The Creaking Skull: a huge reclining figure that raises a bone sword high on
   *  the wind-up and smashes it down in front — so the visual fills its wide sweep
   *  hitbox. Faces `this.facing`; the sword angle tracks the attack timing. */
  private drawCreakingSkull(ctx: CanvasRenderingContext2D, fx: number, fy: number): void {
    const f = this.facing
    const col = this.bodyColor()
    ctx.save()
    ctx.strokeStyle = col
    ctx.fillStyle = col
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Reclining body, sprawled behind the shoulder (away from the facing side).
    ctx.beginPath()
    ctx.ellipse(fx - f * 34, fy - 22, 50, 24, 0, 0, Math.PI * 2)
    ctx.fill()
    // Legs sprawled out behind.
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(fx - f * 60, fy - 20); ctx.lineTo(fx - f * 96, fy - 2)
    ctx.moveTo(fx - f * 58, fy - 26); ctx.lineTo(fx - f * 84, fy - 2)
    ctx.stroke()
    // Skull head at the far back.
    ctx.beginPath(); ctx.arc(fx - f * 88, fy - 34, 22, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2a1414'
    ctx.beginPath()
    ctx.arc(fx - f * 95, fy - 36, 4.5, 0, Math.PI * 2)
    ctx.arc(fx - f * 82, fy - 36, 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = col

    // Sword arm from the front shoulder: raised on the wind-up, smashed down on
    // the active frames (matches the sweep hitbox in front).
    const shoulder = { x: fx + f * 6, y: fy - 46 }
    let ang = -0.5 // rest: held slightly up
    const mv = this.attackMove
    if (this.state === 'attack' && mv) {
      if (this.attackTick <= mv.startup) {
        const p = clamp(this.attackTick / Math.max(1, mv.startup), 0, 1)
        ang = -0.5 - p * (Math.PI / 2 - 0.5) // raise to straight up
      } else {
        const p = clamp((this.attackTick - mv.startup) / Math.max(1, mv.active), 0, 1)
        ang = -Math.PI / 2 + p * (Math.PI / 2 + 0.4) // smash down and forward
      }
    }
    const reach = 210
    const tip = { x: shoulder.x + f * Math.cos(ang) * reach, y: shoulder.y + Math.sin(ang) * reach }
    const grip = { x: shoulder.x + f * Math.cos(ang) * 44, y: shoulder.y + Math.sin(ang) * 44 }
    // Arm.
    ctx.lineWidth = 10
    ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(grip.x, grip.y); ctx.stroke()
    // Bone blade — thick and pale.
    ctx.strokeStyle = '#e8dcc0'
    ctx.lineWidth = 13
    ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.lineTo(tip.x, tip.y); ctx.stroke()
    ctx.restore()
  }

  private bodyColor(): string {
    return this.def.color ?? (this.isBoss ? '#d0846a' : '#cdc6b2')
  }

  /** Placeholder stick-figure art, posed by state, sized to the hurtbox. */
  private drawStick(ctx: CanvasRenderingContext2D, fx: number, fy: number): void {
    const H = this.def.visual.hurtbox.height * ACTOR_SCALE * 1.3
    const f = this.facing
    const col = this.bodyColor()
    const lw = Math.max(2, H * 0.06)
    const headR = H * 0.12
    ctx.save()
    ctx.strokeStyle = col
    ctx.fillStyle = col
    ctx.lineWidth = lw
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (this.state === 'death') {
      // A crumpled heap on the floor.
      const hy = fy - H * 0.16
      ctx.beginPath(); ctx.arc(fx - f * H * 0.22, hy, headR, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.moveTo(fx - f * H * 0.14, hy); ctx.lineTo(fx + f * H * 0.24, fy - H * 0.03); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(fx + f * H * 0.02, fy - H * 0.12); ctx.lineTo(fx + f * H * 0.3, fy); ctx.stroke()
      ctx.restore()
      return
    }

    const st = this.state
    // Crouching (and the crouch slash) compresses the figure toward the floor.
    const crouched = st === 'crouch' || this.attackMove?.id === 'crouch-slash'
    const headCy = crouched ? fy - H * 0.52 : fy - H + headR
    const shoulderY = crouched ? fy - H * 0.44 : fy - H * 0.70
    const hipY = crouched ? fy - H * 0.26 : fy - H * 0.42
    let legL = { x: fx - H * 0.12, y: fy }
    let legR = { x: fx + H * 0.12, y: fy }
    let armL = { x: fx - H * 0.17, y: hipY - H * 0.02 }
    let armR = { x: fx + H * 0.17, y: hipY - H * 0.02 }
    let weapon: { x: number; y: number } | null = null
    let lean = 0

    if (st === 'run' || st === 'dash') {
      const ph = Math.sin(this.position.x * 0.09)
      legL = { x: fx - ph * H * 0.24, y: fy }
      legR = { x: fx + ph * H * 0.24, y: fy }
      armL = { x: fx + ph * H * 0.2, y: shoulderY + H * 0.16 }
      armR = { x: fx - ph * H * 0.2, y: shoulderY + H * 0.16 }
      lean = f * (st === 'dash' ? H * 0.16 : H * 0.07)
    } else if (st === 'jump' || st === 'fall') {
      legL = { x: fx - H * 0.15, y: fy - H * 0.05 }
      legR = { x: fx + H * 0.15, y: fy - H * 0.05 }
      const up = st === 'jump' ? -H * 0.12 : H * 0.04
      armL = { x: fx - H * 0.2, y: shoulderY + up }
      armR = { x: fx + H * 0.2, y: shoulderY + up }
    } else if (st === 'dive') {
      // A plunge: legs snapped together downward, arms swept up overhead.
      legL = { x: fx - H * 0.05, y: fy }
      legR = { x: fx + H * 0.05, y: fy }
      armL = { x: fx - H * 0.16, y: shoulderY - H * 0.16 }
      armR = { x: fx + H * 0.16, y: shoulderY - H * 0.16 }
    } else if (st === 'crouch') {
      // Ducked low, arms drawn in over bent legs.
      legL = { x: fx - H * 0.22, y: fy }
      legR = { x: fx + H * 0.22, y: fy }
      armL = { x: fx - H * 0.14, y: hipY + H * 0.03 }
      armR = { x: fx + H * 0.14, y: hipY + H * 0.03 }
    } else if (st === 'attack') {
      const crouchSlash = this.attackMove?.id === 'crouch-slash'
      lean = f * H * 0.05
      armL = { x: fx - f * H * 0.1, y: hipY }
      const wp = this.weaponProfile
      const wlen = wp ? (wp.reach + wp.width) * 0.5 : H * 0.36
      if (crouchSlash) {
        // A low sweep skimming the ground.
        legL = { x: fx - H * 0.22, y: fy }
        legR = { x: fx + H * 0.22, y: fy }
        armR = { x: fx + f * H * 0.16, y: hipY + H * 0.04 }
        weapon = { x: armR.x + f * wlen, y: fy - H * 0.06 }
      } else if (wp?.swing === 'chop') {
        // Overhead cleave: the blade sweeps from raised-up-front down to in front,
        // animated across the swing so it reads as a real up-to-down chop.
        legL = { x: fx - f * H * 0.16, y: fy }
        legR = { x: fx + f * H * 0.08, y: fy }
        const total = this.attackMove ? totalFrames(this.attackMove) : 24
        const p = clamp(this.attackTick / total, 0, 1)
        const a = ((-82 + 128 * p) * Math.PI) / 180 // -82° (up) → +46° (down/front)
        armR = { x: fx + f * H * 0.14, y: shoulderY - H * 0.04 }
        weapon = { x: armR.x + f * Math.cos(a) * wlen, y: armR.y + Math.sin(a) * wlen }
      } else {
        legL = { x: fx - f * H * 0.16, y: fy }
        legR = { x: fx + f * H * 0.08, y: fy }
        armR = { x: fx + f * H * 0.3, y: shoulderY + H * 0.06 }
        weapon = { x: armR.x + f * wlen, y: shoulderY + H * 0.1 }
      }
    } else if (st === 'hurt') {
      lean = -f * H * 0.11
      armL = { x: fx - H * 0.23, y: shoulderY }
      armR = { x: fx + H * 0.23, y: shoulderY }
    }

    const topX = fx + lean
    const shoulderX = (topX + fx) / 2
    ctx.beginPath(); ctx.arc(topX, headCy, headR, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(topX, headCy + headR); ctx.lineTo(fx, hipY); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(shoulderX, shoulderY); ctx.lineTo(armL.x, armL.y)
    ctx.moveTo(shoulderX, shoulderY); ctx.lineTo(armR.x, armR.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(fx, hipY); ctx.lineTo(legL.x, legL.y)
    ctx.moveTo(fx, hipY); ctx.lineTo(legR.x, legR.y)
    ctx.stroke()
    if (weapon) {
      ctx.strokeStyle = this.weaponProfile?.color ?? '#e8e2d0'
      ctx.lineWidth = lw * 0.9
      ctx.beginPath(); ctx.moveTo(armR.x, armR.y); ctx.lineTo(weapon.x, weapon.y); ctx.stroke()
    }
    ctx.restore()
  }

  private drawGlow(renderer: Renderer, cameraX: number): void {
    const enraged = this.isEnraged
    const rgb = enraged ? '224,48,52' : ENEMY_GLOW[this.def.id]
    if (!rgb || this.state === 'death') return
    this.glowPhase += 1
    const alpha = enraged ? 0.34 + 0.18 * Math.sin(this.glowPhase * 0.18) : 0.42
    const { ctx } = renderer
    const gx = this.position.x - cameraX
    const gy = this.position.y - this.def.visual.hurtbox.height * ACTOR_SCALE * 0.5
    const radius = this.def.visual.hurtbox.width * ACTOR_SCALE * (enraged ? 1.1 : 0.95)
    const gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius)
    gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`)
    gradient.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.save()
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(gx, gy, radius, radius * 1.15, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private shouldUseHitInvulnerability(): boolean {
    return this.def.isHero === true
  }

  hurtbox(): Rect {
    const width = this.def.visual.hurtbox.width * ACTOR_SCALE
    let height = this.def.visual.hurtbox.height * ACTOR_SCALE
    // Crouching shrinks the body so it can duck under high attacks.
    if (this.state === 'crouch' || this.attackMove?.id === 'crouch-slash') height *= 0.55
    return { x: this.position.x - width / 2, y: this.position.y - height, width, height }
  }

  setMaxHealth(value: number): void {
    this.maxHealth = value
    this.health = value
  }

  setMoveSpeedMultiplier(value: number): void {
    this.moveSpeedMultiplier = value
  }

}

function buildSpriteSet(def: CharacterDef, assets: AssetManager): SpriteSet {
  const s = def.sprites
  return {
    idle: makeSheet(assets.image(s.idle.key), s.idle.frames),
    run: makeSheet(assets.image(s.run.key), s.run.frames),
    jump: makeSheet(assets.image(s.jump.key), s.jump.frames),
    fall: makeSheet(assets.image(s.fall.key), s.fall.frames),
    attack1: makeSheet(assets.image(s.attack1.key), s.attack1.frames),
    attack2: makeSheet(assets.image(s.attack2.key), s.attack2.frames),
    takeHit: makeSheet(assets.image(s.takeHit.key), s.takeHit.frames),
    death: makeSheet(assets.image(s.death.key), s.death.frames),
  }
}

export class CampaignScene extends Scene {
  private save = loadCampaignSave()
  private node = getCampaignNode(this.save.currentNodeId ?? this.save.unlockedNodeIds[0] ?? '1997-chapel')
  private chapter = getCampaignChapter(this.node.chapterId)
  private layout = buildLayout(this.node.stage)
  private player!: CastleActor
  private enemies: CastleActor[] = []
  private projectiles: ProjectileRuntime[] = []
  private subweapons: SubweaponRuntime[] = []
  private enemyBones: EnemyBone[] = []
  private candles: Candle[] = []
  private pickups: Pickup[] = []
  private soulBolts: SoulBolt[] = []
  private soulCooldown = 0
  private input!: InputSource
  private cameraX = 0
  private cameraY = 0
  private blink = 0
  private ending = false
  private transitionTicks = 0
  private hitstop = 0
  private flashTicks = 0
  private contactHitCooldown = 0
  private defeatTicks = 0
  private bossIntroTicks = 0
  // Zone title card: freeze timer + name for the "first time entering a zone" banner.
  private zoneIntroTicks = 0
  private zoneName = ''
  private savedFlashTicks = 0
  private roomCooldown = 0
  private victoryTicks = 0
  private sealMessageTicks = 0
  private sealMessageText = ''
  private abilityGetTicks = 0
  private abilityGetName = ''
  private abilityGetSub = ''
  private selectedSubweaponIndex = 0
  private enemyFreezeTicks = 0
  // Continuous zombie spawner (active only in zombie rooms).
  private zombieSpawner = false
  private zombieSpawnTimer = ZOMBIE_SPAWN_INTERVAL
  private runMods: RunModifiers = buildRunModifiers([])
  private soulMods: SoulModifiers = buildSoulModifiers([])
  // Blue (Guardian) soul: the effect active while the ; button is held (it drains
  // MP each tick), or null when not held / out of MP.
  private blueBuffEffect: BlueSoulEffect | null = null
  private equipMods: EquipmentModifiers = buildEquipmentModifiers([])
  private playerDamageMult = 1
  private playerDamageTakenMult = 1
  private levelUpTicks = 0
  private levelUpScreen = false
  private levelUpFrom = 1
  private levelUpHpBefore = 0
  private levelUpHpAfter = 0
  private readonly rewardedDeaths = new Set<CastleActor>()
  private floatingTexts: FloatingText[] = []
  private particles: Particle[] = []
  private drafting = false
  private draftOptions: RelicDef[] = []
  private draftIndex = 0
  private perkChoosing = false
  private perkOptions: PowerUpDef[] = []
  private perkIndex = 0
  private pendingLevelUps = 0
  private shopping = false
  private shopIndex = 0
  private showStatus = false
  private showEquipment = false
  private showSouls = false
  private soulSlotIndex = 0
  private showItems = false
  private itemIndex = 0
  private showMap = false
  // Warp-select overlay (opened at a warp pad): pick a discovered warp room.
  private showWarp = false
  private warpTargets: string[] = []
  private warpIndex = 0
  private warpNoticeTicks = 0
  private showMenu = false
  private menuIndex = 0
  private menuReturn = false
  // "Return to title" confirmation popup (over the pause menu). YES defaults off.
  private confirmTitle = false
  private confirmTitleYes = false
  private equipSlotIndex = 0
  // Item-picker sub-screen: selecting a slot opens the list of pieces you own.
  private equipPicking = false
  private equipPickIndex = 0
  private pendingNodeId: string | null = null
  private readonly attackingLastTick = new Set<CastleActor>()
  private touchControls: TouchControls | null = null
  // Reusable map module: the castle map + a live minimap, driven off the same
  // save data. currentRoom/visited are synced in reloadNode.
  private readonly mapService = new MapService(CASTLE_MAP_DATA)
  private readonly mapRenderer = new MapRenderer()
  private readonly minimap = new MinimapRenderer()
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.ctx.scenes.current !== this) return
    // Any confirm/jump key skips the rest of the zone title card (keep a short
    // fade-out).
    if (this.zoneIntroTicks > 18 && (isMenuConfirm(e.code) || e.code === 'Enter')) {
      e.preventDefault()
      this.zoneIntroTicks = 18
      return
    }
    if (this.drafting) {
      if (this.draftOptions.length === 0) return
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault()
        this.draftIndex = (this.draftIndex - 1 + this.draftOptions.length) % this.draftOptions.length
        return
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault()
        this.draftIndex = (this.draftIndex + 1) % this.draftOptions.length
        return
      }
      if (isMenuConfirm(e.code)) {
        e.preventDefault()
        this.pickDraft()
      }
      return
    }
    if (this.levelUpScreen) {
      if (this.levelUpTicks > 0) return // let the entrance settle before it can be dismissed
      if (isMenuConfirm(e.code) || isMenuCancel(e.code)) {
        e.preventDefault()
        this.dismissLevelUp()
      }
      return
    }
    if (this.perkChoosing) {
      if (this.perkOptions.length === 0) return
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault()
        this.perkIndex = (this.perkIndex - 1 + this.perkOptions.length) % this.perkOptions.length
        return
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault()
        this.perkIndex = (this.perkIndex + 1) % this.perkOptions.length
        return
      }
      if (isMenuConfirm(e.code)) {
        e.preventDefault()
        this.pickPerk()
      }
      return
    }
    if (this.shopping) {
      const count = this.shopItems().length
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault()
        this.shopIndex = (this.shopIndex - 1 + count) % count
        return
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault()
        this.shopIndex = (this.shopIndex + 1) % count
        return
      }
      if (isMenuConfirm(e.code)) {
        e.preventDefault()
        this.buyShopItem()
        return
      }
      if (isMenuCancel(e.code) || e.code === 'Escape') {
        e.preventDefault()
        this.leaveShop()
      }
      return
    }
    if (this.showEquipment) {
      // Picking from the owned-items list for the selected slot.
      if (this.equipPicking) {
        const options = this.equipOptions(EQUIP_SLOTS[this.equipSlotIndex]!)
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          e.preventDefault()
          this.equipPickIndex = (this.equipPickIndex - 1 + options.length) % options.length
          this.ctx.audio.swing()
          return
        }
        if (e.code === 'KeyS' || e.code === 'ArrowDown') {
          e.preventDefault()
          this.equipPickIndex = (this.equipPickIndex + 1) % options.length
          this.ctx.audio.swing()
          return
        }
        if (isMenuConfirm(e.code) || e.code === 'KeyD' || e.code === 'ArrowRight') {
          e.preventDefault()
          this.applyEquipOption(options[this.equipPickIndex] ?? null)
          this.equipPicking = false
          this.ctx.audio.hit()
          return
        }
        if (isMenuCancel(e.code) || e.code === 'Escape' || e.code === 'KeyA' || e.code === 'ArrowLeft') {
          e.preventDefault()
          this.equipPicking = false
          this.ctx.audio.swing()
        }
        return
      }
      // Slot list.
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault()
        this.equipSlotIndex = (this.equipSlotIndex - 1 + EQUIP_SLOTS.length) % EQUIP_SLOTS.length
        return
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault()
        this.equipSlotIndex = (this.equipSlotIndex + 1) % EQUIP_SLOTS.length
        return
      }
      if (isMenuConfirm(e.code) || e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault()
        this.openEquipPicker()
        return
      }
      if (isMenuCancel(e.code) || e.code === 'Escape' || e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault()
        this.showEquipment = false
        if (this.menuReturn) this.showMenu = true
      }
      return
    }
    if (this.showSouls) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault()
        this.soulSlotIndex = (this.soulSlotIndex - 1 + SOUL_SLOTS.length) % SOUL_SLOTS.length
        this.ctx.audio.swing()
        return
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault()
        this.soulSlotIndex = (this.soulSlotIndex + 1) % SOUL_SLOTS.length
        this.ctx.audio.swing()
        return
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault()
        this.cycleSoulSlot(SOUL_SLOTS[this.soulSlotIndex]!, -1)
        return
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight' || isMenuConfirm(e.code)) {
        e.preventDefault()
        this.cycleSoulSlot(SOUL_SLOTS[this.soulSlotIndex]!, 1)
        return
      }
      if (isMenuCancel(e.code) || e.code === 'Escape' || e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault()
        this.showSouls = false
        if (this.menuReturn) this.showMenu = true
      }
      return
    }
    if (this.showItems) {
      const items = CONSUMABLE_POOL
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault()
        this.itemIndex = (this.itemIndex - 1 + items.length) % items.length
        this.ctx.audio.swing()
        return
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault()
        this.itemIndex = (this.itemIndex + 1) % items.length
        this.ctx.audio.swing()
        return
      }
      if (isMenuConfirm(e.code)) {
        e.preventDefault()
        this.useConsumable(items[this.itemIndex]?.id ?? '')
        return
      }
      if (isMenuCancel(e.code) || e.code === 'Escape' || e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault()
        this.showItems = false
        if (this.menuReturn) this.showMenu = true
      }
      return
    }
    if (this.showStatus) {
      if (isMenuConfirm(e.code) && this.save.equipment.length > 0) {
        e.preventDefault()
        this.showStatus = false
        this.showEquipment = true
        this.equipSlotIndex = 0
        this.equipPicking = false
        this.ctx.audio.swing()
        return
      }
      if (e.code === 'KeyI' || e.code === 'Tab' || e.code === 'Escape' || isMenuCancel(e.code)) {
        e.preventDefault()
        this.showStatus = false
        if (this.menuReturn) this.showMenu = true
      }
      return
    }
    if (this.showMap) {
      if (e.code === 'Space' || e.code === 'Escape' || isMenuCancel(e.code) || isMenuConfirm(e.code)) {
        e.preventDefault()
        this.showMap = false
        if (this.menuReturn) this.showMenu = true
      }
      return
    }
    if (this.showWarp) {
      const n = this.warpTargets.length
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault()
        if (n > 0) { this.warpIndex = (this.warpIndex - 1 + n) % n; this.ctx.audio.swing() }
        return
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight' || e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault()
        if (n > 0) { this.warpIndex = (this.warpIndex + 1) % n; this.ctx.audio.swing() }
        return
      }
      // Space closes (it toggles the map elsewhere, so it must not warp);
      // check cancel/close BEFORE the confirm set, which includes Space.
      if (e.code === 'Space' || e.code === 'Escape' || isMenuCancel(e.code)) {
        e.preventDefault()
        this.showWarp = false
        this.warpNoticeTicks = 20
        return
      }
      if (isMenuConfirm(e.code)) {
        e.preventDefault()
        const target = this.warpTargets[this.warpIndex]
        this.showWarp = false
        this.warpNoticeTicks = 20
        if (target) this.warpTo(target)
      }
      return
    }
    if (this.confirmTitle) {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault()
        this.confirmTitleYes = !this.confirmTitleYes
        this.ctx.audio.swing()
        return
      }
      if (isMenuConfirm(e.code)) {
        e.preventDefault()
        if (this.confirmTitleYes) {
          saveCampaignSave(this.save)
          this.ctx.audio.hit()
          this.ctx.scenes.replace(new TitleScene(this.ctx))
        } else {
          this.confirmTitle = false // back to the menu
        }
        return
      }
      if (isMenuCancel(e.code) || e.code === 'Escape') {
        e.preventDefault()
        this.confirmTitle = false
      }
      return
    }
    if (this.showMenu) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault()
        this.menuIndex = (this.menuIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length
        this.ctx.audio.swing()
        return
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault()
        this.menuIndex = (this.menuIndex + 1) % MENU_ITEMS.length
        this.ctx.audio.swing()
        return
      }
      if (isMenuConfirm(e.code)) {
        e.preventDefault()
        this.selectMenu()
        return
      }
      if (isMenuCancel(e.code) || e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault()
        this.showMenu = false
        this.menuReturn = false
      }
      return
    }
    // Start (Enter) opens the character menu; Select (Space) opens the castle map.
    if (this.canOpenOverlay) {
      if (e.code === 'Space') {
        e.preventDefault()
        this.menuReturn = false
        this.openMap()
        return
      }
      if (e.code === 'Enter') {
        e.preventDefault()
        this.openMenu()
        return
      }
      if (e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault()
        this.menuReturn = false
        this.showStatus = true // quick shortcut straight to status
        return
      }
    }
    if (this.ending && (isMenuConfirm(e.code) || isMenuCancel(e.code))) {
      e.preventDefault()
      this.ctx.scenes.replace(new TitleScene(this.ctx))
      return
    }
    if (this.defeatTicks > 0) {
      if (isMenuConfirm(e.code)) {
        e.preventDefault()
        this.reloadNode(this.node.id, true)
        return
      }
      if (isMenuCancel(e.code)) {
        e.preventDefault()
        this.ctx.scenes.replace(new TitleScene(this.ctx))
        return
      }
    }
    if (e.code === 'KeyU' && !e.repeat && this.canOpenOverlay && !this.showMap) {
      e.preventDefault()
      this.castSoul()
      return
    }
    if (e.code === 'KeyO' && !e.repeat && this.canOpenOverlay && !this.showMap) {
      e.preventDefault()
      this.cycleBulletSoul()
      return
    }
    if (e.code === 'Escape') {
      e.preventDefault()
      this.ctx.scenes.push(new PauseScene(this.ctx))
    }
    if (e.code === 'KeyM') this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * this.ctx.width
    const py = ((e.clientY - rect.top) / rect.height) * this.ctx.height
    if (this.shopping) {
      const items = this.shopItems()
      const hit = items.findIndex((_item, i) => {
        const r = this.shopRowRect(i)
        return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
      })
      if (hit >= 0) {
        this.shopIndex = hit
        this.buyShopItem()
      }
      return
    }
    if (this.perkChoosing && this.perkOptions.length > 0) {
      const layout = this.perkLayout()
      const hit = this.perkOptions.findIndex((_opt, i) => {
        const x = layout.startX + i * (layout.cardW + layout.gap)
        return px >= x && px <= x + layout.cardW && py >= layout.y && py <= layout.y + layout.cardH
      })
      if (hit >= 0) {
        this.perkIndex = hit
        this.pickPerk()
      }
      return
    }
    if (this.drafting && this.draftOptions.length > 0) {
      const layout = this.draftLayout()
      const hit = this.draftOptions.findIndex((_opt, i) => {
        const x = layout.startX + i * (layout.cardW + layout.gap)
        return px >= x && px <= x + layout.cardW && py >= layout.y && py <= layout.y + layout.cardH
      })
      if (hit >= 0) {
        this.draftIndex = hit
        this.pickDraft()
      }
    }
  }

  override enter(): void {
    this.ctx.audio.startBgm(AUDIO_MANIFEST['bgm.heartOfFire'])
    this.bindInput()
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('blur', this.onFocusLost)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.ctx.renderer.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.reloadFromSave()
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('blur', this.onFocusLost)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.ctx.renderer.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.input.dispose?.()
    this.touchControls?.dispose()
    this.touchControls = null
    this.ctx.audio.stopBgm()
  }

  /** Auto-pause when the tab/window loses focus, but only while this scene is on
   *  top (not already paused) and gameplay is actually live. */
  private readonly onFocusLost = (): void => {
    if (this.ctx.scenes.current !== this) return
    if (this.ending || this.player.isDead) return
    this.ctx.scenes.push(new PauseScene(this.ctx))
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.onFocusLost()
  }

  update(): void {
    this.blink += 1
    if (this.flashTicks > 0) this.flashTicks -= 1
    if (this.contactHitCooldown > 0) this.contactHitCooldown -= 1
    if (this.levelUpTicks > 0) this.levelUpTicks -= 1
    if (this.ending || this.drafting || this.perkChoosing || this.levelUpScreen || this.shopping || this.showStatus || this.showEquipment || this.showSouls || this.showItems || this.showMap || this.showWarp || this.showMenu) return
    if (this.defeatTicks > 0) {
      this.defeatTicks += 1
      if (this.defeatTicks > DEFEAT_RETRY_TICKS) this.reloadNode(this.node.id, true)
      return
    }
    if (this.hitstop > 0) {
      this.hitstop -= 1
      return
    }
    if (this.transitionTicks > 0) {
      this.transitionTicks -= 1
      return
    }
    if (this.zoneIntroTicks > 0) {
      // Freeze on the zone title card until it plays out (or a key skips it).
      this.zoneIntroTicks -= 1
      return
    }
    if (this.bossIntroTicks > 0) {
      this.bossIntroTicks -= 1
      return
    }
    if (this.enemyFreezeTicks > 0) this.enemyFreezeTicks -= 1

    const intent = this.input.poll()
    if (intent.heavyPressed) {
      // L is a backdash: a quick hop backward without turning around.
      this.player.tryBackdash()
      intent.heavyPressed = false
    }
    // The sub button (Up + attack): a soul-reaver hero casts the Red soul here;
    // a hunter throws a sub-weapon. Sub-weapons belong to the hunter (Red).
    if (intent.upHeld && intent.lightPressed) {
      const used = HERO_USES_SOULS ? this.castSoul() : this.tryUseSubweapon()
      if (used) intent.lightPressed = false
    }
    // Blue guardian soul: active (draining MP) for as long as ; is held.
    this.updateBlueGuardian(intent.dashHeld)
    this.player.update(intent, this.player.position.x + this.player.facing * 80, this.layout.platforms)
    // MP passively refills so soul magic is always coming back (Aria-style).
    this.player.meter = clamp(this.player.meter + MP_REGEN, 0, 100)
    if (this.soulCooldown > 0) this.soulCooldown -= 1

    this.updateZombieSpawner()
    for (const enemy of this.enemies) {
      if (enemy.isDead) { enemy.advanceDeath(); continue } // tick the fade so corpses vanish
      if (enemy.riseTicks > 0) { enemy.riseTicks -= 1; continue } // still emerging from the floor
      if (this.enemyFreezeTicks > 0) continue
      if (enemy.flying) {
        enemy.updateBat(this.player.position.x, this.player.position.y)
        // Once it has dived clear off the visible screen, it's gone for good.
        if (enemy.batPhase === 'dive' && this.isOffScreen(enemy)) enemy.forceGone = true
        continue
      }
      const ai = enemyIntent(enemy, this.player, this.node, this.ctx.rng)
      enemy.update(ai, this.player.position.x, this.layout.platforms)
      const shot = enemy.consumeRangedShot()
      if (shot) this.spawnBone(shot, enemy.def.id === 'creakingSkull' ? 'fire' : enemy.def.id === 'axeArmor' ? 'axe' : 'bone')
    }
    this.playSwingSfx()
    this.updateCrumblePlatforms()
    this.resolveHazards()

    for (const actor of [this.player, ...this.enemies]) {
      const spawn = actor.consumeProjectileSpawn()
      if (!spawn) continue
      this.projectiles.push(createProjectile(spawn, this.ctx.assets))
    }

    for (const projectile of this.projectiles) {
      projectile.position.x += projectile.spawn.facing * (projectile.spawn.move.projectile?.speedX ?? 0)
      projectile.ticksLeft -= 1
      projectile.animator.update()
    }
    for (const subweapon of this.subweapons) {
      updateSubweapon(subweapon)
      subweapon.ticksLeft -= 1
    }
    for (const bone of this.enemyBones) {
      if (bone.kind !== 'fire') bone.velocity.y += BONE_GRAVITY // the fireball flies level
      bone.position.x += bone.velocity.x
      bone.position.y += bone.velocity.y
      bone.spin += bone.kind === 'fire' ? 0.28 : 0.5
      bone.ticksLeft -= 1
    }
    for (const bolt of this.soulBolts) {
      if (bolt.homing) this.steerHomingBolt(bolt)
      if (bolt.arc) bolt.velocity.y += SOUL_ARC_GRAVITY // curved spear falls as it flies
      bolt.position.x += bolt.velocity.x
      bolt.position.y += bolt.velocity.y
      bolt.spin += 0.4
      bolt.ticksLeft -= 1
    }
    for (const pickup of this.pickups) {
      pickup.velocity.y += 0.34
      pickup.velocity.x *= 0.96
      pickup.position.x += pickup.velocity.x
      pickup.position.y += pickup.velocity.y
      if (pickup.position.y >= FLOOR_Y - 18) {
        pickup.position.y = FLOOR_Y - 18
        pickup.velocity.y = 0
      }
      pickup.ticksLeft -= 1
    }

    this.resolveCombat()
    this.resolveEnemyBones()
    this.resolveSoulBolts()
    this.projectiles = this.projectiles.filter((p) => p.ticksLeft > 0 && !p.hasHit)
    this.subweapons = this.subweapons.filter((p) => p.ticksLeft > 0 && !p.hasHit)
    this.enemyBones = this.enemyBones.filter((b) => b.ticksLeft > 0 && !b.hasHit && b.position.y < FLOOR_Y + 30)
    this.soulBolts = this.soulBolts.filter((b) => b.ticksLeft > 0 && b.hitTargets.size < SOUL_HIT_LIMIT)
    this.resolveCandles()
    this.resolvePickups()
    this.pickups = this.pickups.filter((pickup) => pickup.ticksLeft > 0)
    this.grantEnemyRewards()
    this.enemies = this.enemies.filter((enemy) => !enemy.isGone) // despawn defeated enemies
    this.updateFloatingTexts()
    this.updateParticles()

    if (this.player.isDead && this.player.hurtbox().y > 0) {
      this.defeatTicks = 1
      this.hitstop = 0
      this.contactHitCooldown = CONTACT_HIT_COOLDOWN
      this.projectiles = []
      return
    }

    // Beating the final boss completes the campaign (after the death plays out).
    if (this.node.id === FINAL_BOSS_NODE && this.enemies.length > 0 && this.enemies.every((e) => e.isDead)) {
      this.victoryTicks += 1
      if (this.victoryTicks > 100) {
        this.save = { ...this.save, finished: true }
        saveCampaignSave(this.save)
        this.ending = true
        return
      }
    }

    // Metroidvania traversal: walk off a room's edge into the adjacent room.
    this.tryRoomTransition(intent)
    this.tryUseSavePoint(intent)
    this.tryUseMerchant(intent)
    this.tryUseWarpPoint(intent)
    this.tryPickupAbility()
    this.tryPickupMapItem()
    this.tryPickupLifeUp()
    this.tryOpenChest()
    if (this.sealMessageTicks > 0) this.sealMessageTicks -= 1
    if (this.abilityGetTicks > 0) this.abilityGetTicks -= 1

    this.updateCamera(this.player.position.x, this.player.position.y)
  }

  /** Follow the player in both axes, clamped to the current room's bounds. */
  private updateCamera(x: number, y: number): void {
    this.cameraX = clamp(x - this.ctx.width / 2, 0, Math.max(0, this.layout.width - this.ctx.width))
    this.cameraY = clamp(y - this.ctx.height * 0.58, this.layout.top, ROOM_HEIGHT - this.ctx.height)
  }

  render(): void {
    const { renderer, assets, width, height } = this.ctx
    const { ctx } = renderer
    const stage = getStage(this.node.stage)
    renderer.clear('#05040a')
    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.restore()
    ctx.fillStyle = stage.overlay
    ctx.fillRect(0, 0, width, height)
    drawBackdrop(ctx, this.node.stage, this.layout.width, this.layout.top, this.isCastleGateNode)
    this.drawWorld()
    // Crush the rendered world down to a GBA-style resolution + 15-bit palette,
    // then draw the crisp HUD/menus on top (so text stays readable).
    if (GBA_PIXELATE) pixelateWorld(renderer)
    this.drawHud()
    if (this.ending) this.drawEnding()
    else if (this.perkChoosing) this.drawPerkChoice()
    else if (this.levelUpScreen) this.drawLevelUpScreen()
    else if (this.drafting) this.drawDraft()
    else if (this.shopping) this.drawShop()
    else if (this.showMenu) { this.drawMenu(); if (this.confirmTitle) this.drawTitleConfirm() }
    else if (this.showMap) this.drawMap()
    else if (this.showWarp) this.drawWarpSelect()
    else if (this.showEquipment) this.drawEquipment()
    else if (this.showSouls) this.drawSouls()
    else if (this.showItems) this.drawItems()
    else if (this.showStatus) this.drawStatus()
    else if (this.defeatTicks > 0) this.drawDefeat()
    else {
      this.drawBossBar()
      this.drawMinimap()
      if (Math.floor(this.blink / 30) % 2 === 0) this.drawPrompt()
    }
    if (this.bossIntroTicks > 0) this.drawBossIntro()
    if (this.zoneIntroTicks > 0) this.drawZoneIntro()
    if (this.sealMessageTicks > 0) this.drawSealMessage()
    if (this.abilityGetTicks > 0) this.drawAbilityGet()
    this.drawFlash()
  }

  /** Full-screen zone title card shown (frozen) on entering a new zone. */
  private drawZoneIntro(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    // Ease the card in and back out at the edges of its lifetime.
    const t = ZONE_INTRO_TICKS - this.zoneIntroTicks
    const fadeIn = clamp(t / 18, 0, 1)
    const fadeOut = clamp(this.zoneIntroTicks / 18, 0, 1)
    const a = Math.min(fadeIn, fadeOut)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = 'rgba(4, 4, 10, 0.86)'
    ctx.fillRect(0, 0, width, height)
    // Framing rules above and below the name.
    ctx.strokeStyle = '#8a7a4a'
    ctx.lineWidth = 2
    const cy = height / 2
    ctx.beginPath(); ctx.moveTo(width / 2 - 230, cy - 34); ctx.lineTo(width / 2 + 230, cy - 34); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(width / 2 - 230, cy + 34); ctx.lineTo(width / 2 + 230, cy + 34); ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '28px "Press Start 2P", monospace'
    ctx.fillText(this.zoneName, width / 2, cy + 2)
    ctx.restore()
  }

  private get bossActor(): CastleActor | null {
    if (!this.node.isBoss) return null
    return this.enemies.find((enemy) => enemy.isBoss) ?? null
  }

  /** True when the room is in normal play, i.e. no blocking overlay is up. */
  private get canOpenOverlay(): boolean {
    return !this.ending && !this.drafting && !this.shopping && !this.showStatus && !this.showEquipment && !this.showSouls && !this.showItems && !this.showMenu && this.defeatTicks === 0
  }


  private openMap(): void {
    this.showMap = true
    this.ctx.audio.swing()
  }

  /** Mirror the campaign save's room progress into the map module (the campaign
   *  save is the single source of truth; the map is a view of it). */
  private syncMapState(): void {
    // The Castle Map item reveals every room's outline.
    if (hasWorldFlag(this.save, MAP_FLAG)) {
      for (const id of Object.keys(CASTLE_MAP_DATA.rooms)) this.mapService.state.setState(id, 'revealed')
    }
    for (const id of this.save.visitedNodeIds) this.mapService.state.setState(id, 'visited')
    for (const item of CASTLE_ITEM_ROOMS) {
      if (this.save.abilities.includes(item.ability)) this.mapService.state.collectItem(item.id)
    }
    for (const room of CASTLE_LIFEUP_ROOMS) {
      if (hasWorldFlag(this.save, lifeUpFlag(room.id))) this.mapService.state.collectItem(room.id)
    }
    this.mapService.state.currentRoomId = this.node.id
  }

  private openMenu(): void {
    this.showMenu = true
    this.menuIndex = 0
    this.ctx.audio.swing()
  }

  private selectMenu(): void {
    const item = MENU_ITEMS[this.menuIndex]
    this.ctx.audio.hit()
    if (item === 'TITLE') {
      // Open the confirmation popup over the menu; don't leave the menu yet.
      this.confirmTitle = true
      this.confirmTitleYes = false
      return
    }
    this.showMenu = false
    if (item === 'RESUME') { this.menuReturn = false; return }
    this.menuReturn = true
    if (item === 'STATUS') this.showStatus = true
    else if (item === 'EQUIP') { this.showEquipment = true; this.equipSlotIndex = 0; this.equipPicking = false }
    else if (item === 'SOULS') { this.showSouls = true; this.soulSlotIndex = 0 }
    else if (item === 'ITEMS') { this.showItems = true; this.itemIndex = 0 }
    else if (item === 'MAP') this.openMap()
  }

  private get isCastleGateNode(): boolean {
    return this.node.id === 'fbd-gate'
  }

  private bindInput(): void {
    const sources: InputSource[] = [new KeyboardSource(PLAYER1_KEYS), new GamepadSource(0)]
    if (window.matchMedia('(pointer: coarse)').matches) {
      const state = createTouchControlState()
      sources.push(new TouchSource(state))
      const overlay = document.querySelector<HTMLElement>('#overlay')
      if (overlay) this.touchControls = new TouchControls(overlay, state)
    }
    this.input = new CompositeSource(sources)
    // Dev-only inspection hook for debugging scene state from the console.
    if (import.meta.env.DEV) (window as unknown as { __cv?: unknown }).__cv = this
  }

  private reloadFromSave(): void {
    this.save = loadCampaignSave()
    if (this.save.finished) {
      this.ending = true
      return
    }
    const first = this.save.currentNodeId ?? this.save.unlockedNodeIds[0] ?? this.chapter.nodeIds[0]
    if (!first) {
      this.ending = true
      return
    }
    this.reloadNode(first)
  }

  private reloadNode(nodeId: string, fromReset = false): void {
    this.node = getCampaignNode(nodeId)
    this.chapter = getCampaignChapter(this.node.chapterId)
    // The first time the player ever enters a zone (chapter), freeze and show its
    // name. Persisted via a world flag, so it never repeats. Not on death-retries.
    const zf = `zone:${this.node.chapterId}`
    if (!fromReset && !hasWorldFlag(this.save, zf)) {
      this.save = setWorldFlag(this.save, zf)
      this.zoneName = ZONE_NAMES[this.node.chapterId] ?? this.chapter.title.toUpperCase()
      this.zoneIntroTicks = ZONE_INTRO_TICKS
    }
    this.layout = buildLayout(this.node.stage)
    enlargeRoom(this.layout, BIG_ROOMS[this.node.id])
    addVerticalPassages(this.layout, castleDoors(this.node.id))
    this.layout.water = WATER_ROOMS[this.node.id] ?? null
    // A high-jump-gated Life Max Up perches on a ledge above double-jump range.
    // The room becomes a clean column (floor + ledge) so it can't be cheesed by
    // double-jumping off a decorative platform.
    const lifeUp = LIFE_UP_ROOMS[this.node.id]
    if (lifeUp?.high) {
      this.layout.platforms = [
        { x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 },
        { x: lifeUp.x - 70, y: HIGH_LEDGE_Y, width: 140, height: 12 },
      ]
    }
    const barrier = SLIDE_BARRIERS[this.node.id]
    if (barrier) this.layout.barriers.push(barrier)
    this.runMods = buildRunModifiers(this.save.relicIds.map((id) => RELIC_POOL.find((relic) => relic.id === id)).filter((relic): relic is RelicDef => Boolean(relic)))
    this.soulMods = this.yellowSoulMods()
    this.equipMods = buildEquipmentModifiers(equippedDefs(this.save))
    this.playerDamageMult = this.computeDamageMult()
    this.playerDamageTakenMult = this.computeDamageTakenMult()
    const moveSpeed = this.computeMoveSpeedMult()
    this.player = new CastleActor(CAMPAIGN_HERO, this.ctx.assets, this.layout.checkpointX, this.layout.checkpointY, 1, moveSpeed)
    this.player.stairs = this.layout.stairs
    this.player.barriers = this.layout.barriers
    this.player.floorGap = this.layout.floorGap
    this.player.water = this.layout.water
    this.player.canDive = this.hasUnderwaterSoul()
    this.player.roomWidth = this.layout.width
    this.player.roomTop = this.layout.top
    this.player.weaponProfile = this.equippedWeaponProfile()
    this.player.setMaxHealth(this.computeMaxHealth())
    this.player.reset(this.layout.checkpointX, this.layout.checkpointY, 1)
    this.player.meterGainMultiplier = this.computeMeterGainMult()
    this.player.meter = this.runMods.startMeterBonus + this.equipMods.startMeterBonus
    this.applyAbilities()
    this.enemies = buildEnemies(this.node, this.ctx.assets, this.layout)
    for (const enemy of this.enemies) { enemy.roomWidth = this.layout.width; enemy.roomTop = this.layout.top }
    // Zombie rooms (non-boss) breed an endless capped trickle of shamblers.
    // Save and warp rooms are safe: no initial enemies and no trickle either.
    this.zombieSpawner =
      !this.node.isBoss &&
      this.node.enemy.id === 'zombie' &&
      SAVE_POINTS[this.node.id] === undefined &&
      WARP_POINTS[this.node.id] === undefined
    this.zombieSpawnTimer = ZOMBIE_SPAWN_INTERVAL
    this.projectiles = []
    this.subweapons = []
    this.enemyBones = []
    this.soulBolts = []
    this.soulCooldown = 0
    this.candles = buildCandles(this.layout)
    this.pickups = []
    this.transitionTicks = fromReset ? 0 : 12
    this.hitstop = 0
    this.flashTicks = 0
    this.contactHitCooldown = 0
    this.defeatTicks = 0
    this.bossIntroTicks = this.node.isBoss ? BOSS_INTRO_TICKS : 0
    this.enemyFreezeTicks = 0
    this.levelUpTicks = 0
    this.levelUpScreen = false
    this.showStatus = false
    this.showEquipment = false
    this.equipPicking = false
    this.showSouls = false
    this.showItems = false
    this.perkChoosing = false
    this.perkOptions = []
    this.pendingLevelUps = 0
    this.victoryTicks = 0
    this.rewardedDeaths.clear()
    this.floatingTexts = []
    this.particles = []
    this.attackingLastTick.clear()
    this.showMap = false
    this.showMenu = false
    this.confirmTitle = false
    this.menuReturn = false
    this.ending = false
    this.save = { ...this.save, currentNodeId: nodeId, finished: false }
    this.save = markCampaignVisited(this.save, nodeId)
    this.syncMapState()
  }

  private resolveCombat(): void {
    // A diving slam damages every enemy it drops onto (each once per dive).
    if (this.player.isDiving) {
      const dbox = this.player.diveHitbox()
      for (const enemy of this.enemies) {
        if (enemy.isDead || this.player.diveHits.has(enemy)) continue
        if (!rectsOverlap(dbox, enemy.hurtbox())) continue
        if (enemy.applyFlatDamage(DIVE_DAMAGE, this.player.position.x, -7, this.playerDamageMult)) {
          this.player.diveHits.add(enemy)
          this.spawnDamageNumber(enemy, '#ffe08a')
          this.hitstop = Math.max(this.hitstop, 4)
        }
      }
    }
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      const playerAtk = this.player.activeAttack()
      const enemyAtk = enemy.activeAttack()
      if (playerAtk && rectsOverlap(playerAtk.box, enemy.hurtbox())) {
        if (enemy.applyHit(playerAtk.spec, this.player.position.x, this.playerDamageMult)) {
          this.player.markAttackConnected()
          this.spawnDamageNumber(enemy, '#ffe08a')
          this.onHit(playerAtk.spec, enemy.isDead)
        }
      }
      if (enemyAtk && rectsOverlap(enemyAtk.box, this.player.hurtbox())) {
        if (this.player.applyHit(enemyAtk.spec, enemy.position.x, this.playerDamageTakenMult)) {
          enemy.markAttackConnected()
          this.spawnDamageNumber(this.player, '#ff7a6a')
          this.onHit(enemyAtk.spec, this.player.isDead)
        }
      }
      if (this.contactHitCooldown <= 0 && rectsOverlap(this.player.hurtbox(), enemy.hurtbox())) {
        if (this.player.applyHit(enemy.def.moves.light, enemy.position.x, this.playerDamageTakenMult)) {
          this.contactHitCooldown = CONTACT_HIT_COOLDOWN
          this.spawnDamageNumber(this.player, '#ff7a6a')
          this.onHit(enemy.def.moves.light, this.player.isDead)
        }
      }
    }
    for (const projectile of this.projectiles) {
      if (projectile.hasHit) continue
      if (!rectsOverlap(projectileBox(projectile), this.player.hurtbox())) continue
      if (!this.player.applyHit(projectile.spawn.move, projectile.spawn.x, this.playerDamageTakenMult)) continue
      projectile.hasHit = true
      this.spawnDamageNumber(this.player, '#ff7a6a')
      this.onHit(projectile.spawn.move, this.player.isDead)
    }
    for (const subweapon of this.subweapons) {
      const box = subweaponBox(subweapon)
      // Holy water flame and the cross both pierce — they hit every enemy in
      // range once (tracked in hitTargets) and keep going.
      if ((subweapon.kind === 'holyWater' && subweapon.phase === 'flame') || subweapon.kind === 'cross') {
        const dmg = SUBWEAPON_DAMAGE[subweapon.kind]
        for (const enemy of this.enemies) {
          if (enemy.isDead || subweapon.hitTargets?.has(enemy)) continue
          if (!rectsOverlap(box, enemy.hurtbox())) continue
          if (!enemy.applyFlatDamage(dmg, subweapon.position.x, -5, this.playerDamageMult)) continue
          subweapon.hitTargets?.add(enemy)
          this.spawnDamageNumber(enemy, '#ffe08a')
          this.ctx.audio.hit()
          this.hitstop = Math.max(this.hitstop, 4)
          if (enemy.isDead) this.flashTicks = BIG_HIT_FLASH_TICKS
        }
        continue
      }
      if (subweapon.hasHit) continue
      for (const enemy of this.enemies) {
        if (enemy.isDead || !rectsOverlap(box, enemy.hurtbox())) continue
        if (!enemy.applyFlatDamage(SUBWEAPON_DAMAGE[subweapon.kind], subweapon.position.x, -6, this.playerDamageMult)) continue
        subweapon.hasHit = true
        this.spawnDamageNumber(enemy, '#ffe08a')
        this.ctx.audio.hit()
        this.hitstop = Math.max(this.hitstop, 6)
        if (enemy.isDead) this.flashTicks = BIG_HIT_FLASH_TICKS
        break
      }
    }
  }

  private spawnDamageNumber(actor: CastleActor, color: string): void {
    const hb = actor.hurtbox()
    this.spawnFloatingText(hb.x + hb.width / 2 + (this.ctx.rng.next() - 0.5) * 18, hb.y + 10, String(actor.lastDamageTaken), color)
  }

  /** The currently equipped Bullet Soul definition (falls back to the base). */
  private equippedSoulDef(): BulletSoulDef {
    return getBulletSoul(this.save.equippedBulletSoul) ?? getBulletSoul(BASE_BULLET_SOUL)!
  }

  /** The swing profile of the equipped weapon, if any (drives the light attack). */
  private equippedWeaponProfile(): WeaponProfile | null {
    const id = this.save.equipped.weapon
    return id ? getEquipment(id)?.weapon ?? null : null
  }

  /** Owned castable souls in a stable order: base first, then collected. */
  private ownedBulletSoulIds(): string[] {
    return [BASE_BULLET_SOUL, ...this.save.bulletSouls]
  }

  private ownedBlueSoulIds(): string[] {
    return [BASE_BLUE_SOUL, ...this.save.blueSouls]
  }

  /** Change the equipped soul in a slot (dir ±1), from the souls you own. */
  private cycleSoulSlot(slot: SoulSlot, dir: number): void {
    if (slot === 'RED') {
      const owned = this.ownedBulletSoulIds()
      const i = Math.max(0, owned.indexOf(this.save.equippedBulletSoul))
      this.save = equipCampaignBulletSoul(this.save, owned[(i + dir + owned.length) % owned.length]!)
    } else if (slot === 'BLUE') {
      const owned = this.ownedBlueSoulIds()
      const i = Math.max(0, owned.indexOf(this.save.equippedBlueSoul))
      this.save = equipCampaignBlueSoul(this.save, owned[(i + dir + owned.length) % owned.length]!)
    } else {
      // YELLOW: your owned enchant souls plus a "none" (unequipped) option.
      const opts: (string | null)[] = [null, ...this.save.souls]
      const i = Math.max(0, opts.indexOf(this.save.equippedYellowSoul))
      this.save = equipCampaignYellowSoul(this.save, opts[(i + dir + opts.length) % opts.length] ?? null)
      this.applySoulMods()
    }
    this.ctx.audio.swing()
  }

  /** Spend a consumable to restore HP (potion) or MP (elixir). */
  private useConsumable(id: string): void {
    const def = getConsumable(id)
    if (!def) return
    if ((this.save.consumables[id] ?? 0) <= 0) { this.ctx.audio.swing(); return }
    // Don't waste one when the relevant bar is already full.
    if (def.effect === 'heal' && this.player.health >= this.player.maxHealth) { this.ctx.audio.swing(); return }
    if (def.effect === 'mana' && this.player.meter >= 100) { this.ctx.audio.swing(); return }
    this.save = useCampaignConsumable(this.save, id)
    if (def.effect === 'heal') {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + def.amount)
      this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, `+${def.amount} HP`, '#7ad67a')
    } else {
      this.player.meter = clamp(this.player.meter + def.amount, 0, 100)
      this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, `+${def.amount} MP`, '#7aa8ff')
    }
    this.ctx.audio.hit()
  }

  private cycleBulletSoul(): void {
    const owned = this.ownedBulletSoulIds()
    if (owned.length <= 1) return
    const i = owned.indexOf(this.save.equippedBulletSoul)
    const next = owned[(i + 1) % owned.length] ?? BASE_BULLET_SOUL
    this.save = equipCampaignBulletSoul(this.save, next)
    this.ctx.audio.swing()
  }

  private spawnSoulBolt(vx: number, vy: number, damage: number, homing: boolean, x: number, y: number, arc = false): void {
    this.soulBolts.push({
      position: { x, y },
      velocity: { x: vx, y: vy },
      facing: this.player.facing,
      ticksLeft: arc ? SOUL_ARC_LIFETIME : homing ? SOUL_HOMING_LIFETIME : SOUL_LIFETIME,
      spin: 0,
      damage,
      homing,
      arc,
      hitTargets: new Set<CastleActor>(),
    })
  }

  /** Spend MP to cast the equipped Red (Bullet) Soul, whose pattern shapes the
   *  volley. Returns true if it actually fired. */
  private castSoul(): boolean {
    if (this.player.isDead || this.soulCooldown > 0 || this.bossIntroTicks > 0) return false
    const soul = this.equippedSoulDef()
    if (this.player.meter < soul.mpCost) return false
    this.player.meter -= soul.mpCost
    this.soulCooldown = SOUL_CAST_COOLDOWN
    const f = this.player.facing
    const ox = this.player.position.x + f * 36
    const oy = this.player.position.y - 62
    const cx = this.player.position.x
    const cy = this.player.position.y - 46
    switch (soul.pattern) {
      case 'spear':
        // A curved spear-cast: launched forward and up, it arcs down as it flies.
        this.spawnSoulBolt(f * SOUL_SPEED * 0.82, -5.4, 22, false, ox, oy - 6, true)
        break
      case 'bolt':
        this.spawnSoulBolt(f * SOUL_SPEED, 0, 24, false, ox, oy)
        break
      case 'spread':
        for (const a of [-0.34, 0, 0.34]) this.spawnSoulBolt(f * SOUL_SPEED * Math.cos(a), SOUL_SPEED * Math.sin(a), 16, false, ox, oy)
        break
      case 'homing':
        this.spawnSoulBolt(f * SOUL_SPEED * 0.8, 0, 22, true, ox, oy)
        break
      case 'nova':
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2
          this.spawnSoulBolt(Math.cos(a) * SOUL_SPEED, Math.sin(a) * SOUL_SPEED, 14, false, cx, cy)
        }
        break
    }
    this.ctx.audio.swing()
    return true
  }

  /** Hold-to-sustain Blue (Guardian) soul: while ; is held it drains MP and keeps
   *  its effect active (Glide slows falls, Aegis softens hits, Frenzy/Haste boost
   *  attack/speed); releasing ; or running out of MP ends it. */
  private updateBlueGuardian(held: boolean): void {
    const soul = getBlueSoul(this.save.equippedBlueSoul)
    const active = held && soul !== undefined && !this.player.isDead && this.bossIntroTicks <= 0 && this.player.meter > 0
    if (active && soul) this.player.meter = Math.max(0, this.player.meter - soul.mpCost / 60)
    const effect: BlueSoulEffect | null = active && soul ? soul.effect : null
    if (effect !== this.blueBuffEffect) {
      this.blueBuffEffect = effect
      this.refreshLivePlayerStats() // frenzy/haste/aegis stat mults toggled
    }
    this.player.gliding = this.blueBuffEffect === 'glide'
  }

  /** Multiplier a live Blue buff applies to the given stat (1 = no effect). */
  private blueBuffMult(effect: BlueSoulEffect): number {
    if (this.blueBuffEffect !== effect) return 1
    return effect === 'aegis' ? 0.4 : effect === 'frenzy' ? 1.45 : 1.4
  }

  /** Curve a homing soul bolt toward the nearest live enemy it has not hit. */
  private steerHomingBolt(bolt: SoulBolt): void {
    let best: CastleActor | null = null
    let bestD = Infinity
    for (const enemy of this.enemies) {
      if (enemy.isDead || bolt.hitTargets.has(enemy)) continue
      const hb = enemy.hurtbox()
      const d = Math.hypot(hb.x + hb.width / 2 - bolt.position.x, hb.y + hb.height / 2 - bolt.position.y)
      if (d < bestD) { bestD = d; best = enemy }
    }
    if (!best) return
    const hb = best.hurtbox()
    const dx = hb.x + hb.width / 2 - bolt.position.x
    const dy = hb.y + hb.height / 2 - bolt.position.y
    const d = Math.hypot(dx, dy) || 1
    const speed = SOUL_SPEED * 0.85
    bolt.velocity.x += (dx / d * speed - bolt.velocity.x) * 0.14
    bolt.velocity.y += (dy / d * speed - bolt.velocity.y) * 0.14
  }

  private resolveSoulBolts(): void {
    for (const bolt of this.soulBolts) {
      if (bolt.hitTargets.size >= SOUL_HIT_LIMIT) continue
      const box = soulBoltBox(bolt)
      for (const enemy of this.enemies) {
        if (enemy.isDead || bolt.hitTargets.has(enemy)) continue
        if (!rectsOverlap(box, enemy.hurtbox())) continue
        if (!enemy.applyFlatDamage(bolt.damage, bolt.position.x, -5, this.playerDamageMult)) continue
        bolt.hitTargets.add(enemy)
        this.spawnDamageNumber(enemy, '#ffe08a')
        this.ctx.audio.hit()
        this.hitstop = Math.max(this.hitstop, 5)
        if (enemy.isDead) this.flashTicks = BIG_HIT_FLASH_TICKS
        if (bolt.hitTargets.size >= SOUL_HIT_LIMIT) break
      }
    }
  }

  private tryUseSubweapon(): boolean {
    if (this.player.isDead) return false
    const kind = this.currentSubweapon()
    const cost = SUBWEAPON_COSTS[kind]
    if (this.player.meter < cost) return false
    this.player.meter = Math.max(0, this.player.meter - cost)
    if (kind === 'stopwatch') {
      this.enemyFreezeTicks = Math.max(this.enemyFreezeTicks, 150)
      this.ctx.audio.hit()
      return true
    }

    const spawnY = this.player.position.y - (kind === 'holyWater' ? 66 : 70)
    const spawn: SubweaponRuntime = {
      kind,
      position: {
        x: this.player.position.x + this.player.facing * 36,
        y: spawnY,
      },
      velocity: {
        x: this.player.facing * SUBWEAPON_SPEED_X[kind],
        y: SUBWEAPON_SPEED_Y[kind],
      },
      facing: this.player.facing,
      ticksLeft: SUBWEAPON_LIFETIME[kind],
      hasHit: false,
    }
    if (kind === 'holyWater') {
      spawn.phase = 'outbound'
      spawn.hitTargets = new Set<CastleActor>()
    } else if (kind === 'cross') {
      spawn.hitTargets = new Set<CastleActor>() // the cross pierces every enemy it crosses
    }
    this.subweapons.push(spawn)
    this.ctx.audio.swing()
    return true
  }

  private currentSubweapon(): SubweaponKind {
    return SUBWEAPON_ORDER[this.selectedSubweaponIndex] ?? SUBWEAPON_ORDER[0]!
  }

  private resolveCandles(): void {
    const attack = this.player.activeAttack()
    for (const candle of this.candles) {
      if (candle.broken) continue
      const box = candleBox(candle)
      const hitByWhip = attack && rectsOverlap(attack.box, box)
      const hitBySubweapon = this.subweapons.some((subweapon) => !subweapon.hasHit && rectsOverlap(subweaponBox(subweapon), box))
      const hitBySoul = this.soulBolts.some((bolt) => rectsOverlap(soulBoltBox(bolt), box))
      if (!hitByWhip && !hitBySubweapon && !hitBySoul) continue
      candle.broken = true
      this.spawnCandleBreak(candle.x, candle.y)
      this.spawnCandleDrop(candle.x, candle.y)
      this.ctx.audio.hit()
    }
  }

  private updateCrumblePlatforms(): void {
    for (const platform of this.layout.platforms) {
      if (!platform.crumble) continue
      if (platform.fallen) {
        platform.respawnTimer = (platform.respawnTimer ?? CRUMBLE_RESPAWN) - 1
        if (platform.respawnTimer <= 0) {
          platform.fallen = false
          platform.crumbleTimer = CRUMBLE_DELAY
        }
        continue
      }
      const standing =
        this.player.grounded &&
        Math.abs(this.player.position.y - platform.y) < 6 &&
        this.player.position.x > platform.x - 4 &&
        this.player.position.x < platform.x + platform.width + 4
      if (standing) {
        platform.crumbleTimer = (platform.crumbleTimer ?? CRUMBLE_DELAY) - 1
        if (platform.crumbleTimer <= 0) {
          platform.fallen = true
          platform.respawnTimer = CRUMBLE_RESPAWN
          this.ctx.audio.hit()
        }
      } else if (platform.crumbleTimer !== undefined && platform.crumbleTimer < CRUMBLE_DELAY) {
        platform.crumbleTimer = Math.min(CRUMBLE_DELAY, platform.crumbleTimer + 1)
      }
    }
  }

  private spawnBone(shot: { x: number; y: number; facing: Facing }, kind: 'bone' | 'axe' | 'fire' = 'bone'): void {
    const axe = kind === 'axe'
    const fire = kind === 'fire'
    this.enemyBones.push({
      position: { x: shot.x, y: shot.y },
      // Bones and axes are lobbed in an arc; the fireball flies dead level.
      velocity: fire ? { x: shot.facing * FIRE_SPEED, y: 0 } : { x: shot.facing * BONE_SPEED * (axe ? 0.85 : 0.55), y: axe ? -7.2 : -8.6 },
      spin: 0,
      ticksLeft: fire ? 220 : 150,
      hasHit: false,
      kind,
      damage: fire ? FIRE_DAMAGE : axe ? AXE_DAMAGE : BONE_DAMAGE,
    })
    this.ctx.audio.swing()
  }

  private resolveEnemyBones(): void {
    if (this.player.isDead) return
    const box = this.player.hurtbox()
    for (const bone of this.enemyBones) {
      if (bone.hasHit || !rectsOverlap(boneBox(bone), box)) continue
      if (this.player.applyFlatDamage(bone.damage, bone.position.x, -6, this.playerDamageTakenMult)) {
        bone.hasHit = true
        this.ctx.audio.hit()
        this.hitstop = Math.max(this.hitstop, 5)
      }
    }
  }

  private resolveHazards(): void {
    if (this.player.isDead || !this.player.canBeHit) return
    const box = this.player.hurtbox()
    for (const hazard of this.layout.hazards) {
      if (!rectsOverlap(box, hazardBox(hazard))) continue
      if (this.player.applyFlatDamage(SPIKE_DAMAGE, hazard.x + hazard.width / 2, -12, this.playerDamageTakenMult)) {
        this.ctx.audio.hit()
        this.hitstop = Math.max(this.hitstop, 6)
        this.flashTicks = BIG_HIT_FLASH_TICKS
      }
      break
    }
  }

  private computeMaxHealth(): number {
    return 100 + (this.save.level - 1) * 8 + this.runMods.maxHealthBonus + this.soulMods.maxHealthBonus + this.equipMods.maxHealthBonus + this.save.hpUpgrades * 20 + this.perkStacks('vigor') * 18
  }

  private computeDamageMult(): number {
    return this.runMods.damageMultiplier * this.soulMods.damageMultiplier * this.equipMods.damageMultiplier * (1 + (this.save.level - 1) * 0.04) * (1 + this.save.atkUpgrades * 0.06) * (1 + this.perkStacks('might') * 0.07) * this.blueBuffMult('frenzy')
  }

  private computeDamageTakenMult(): number {
    return Math.max(0.4, (1 - this.save.armorTier * 0.06) * (1 - this.perkStacks('ward') * 0.05) * this.equipMods.damageTakenMultiplier) * this.blueBuffMult('aegis')
  }

  private computeMoveSpeedMult(): number {
    return this.runMods.moveSpeedMultiplier * this.soulMods.moveSpeedMultiplier * this.equipMods.moveSpeedMultiplier * (1 + this.perkStacks('swiftness') * 0.06) * this.blueBuffMult('haste')
  }

  private computeMeterGainMult(): number {
    return this.runMods.meterGainMultiplier * this.soulMods.meterGainMultiplier * this.equipMods.meterGainMultiplier * (1 + this.perkStacks('focus') * 0.12)
  }

  private grantEnemyRewards(): void {
    for (const enemy of this.enemies) {
      if (!enemy.isDead || this.rewardedDeaths.has(enemy)) continue
      this.rewardedDeaths.add(enemy)
      const reward = campaignEnemyReward(enemy)
      const result = grantCampaignRewards(this.save, reward.xp, reward.gold)
      this.save = result.save
      const hurt = enemy.hurtbox()
      this.spawnDeathPoof(hurt.x + hurt.width / 2, hurt.y + hurt.height * 0.5)
      this.spawnFloatingText(hurt.x + hurt.width / 2, hurt.y - 6, `+${reward.xp} XP`, '#b7c7e6')
      if (result.levelsGained > 0) this.onLevelUp(result.levelsGained)
      this.tryDropSoul(enemy, hurt)
      this.tryDropBulletSoul(enemy, hurt)
      this.tryDropBlueSoul(enemy, hurt)
      this.spawnEnemyDrops(enemy)
    }
  }

  private tryDropBulletSoul(enemy: CastleActor, hurt: Rect): void {
    const soul = bulletSoulForEnemy(enemy.def.id)
    if (!soul || this.save.bulletSouls.includes(soul.id)) return
    if (this.ctx.rng.next() >= soul.dropChance) return
    this.save = addCampaignBulletSoul(this.save, soul.id)
    const cx = hurt.x + hurt.width / 2
    this.spawnFloatingText(cx, hurt.y - 40, 'BULLET SOUL!', '#ff9ad6')
    this.spawnFloatingText(cx, hurt.y - 22, soul.name.toUpperCase(), '#ff9ad6')
    this.ctx.audio.hit()
  }

  /** True when an actor has moved well outside the visible viewport. */
  private isOffScreen(actor: CastleActor): boolean {
    const sx = actor.position.x - this.cameraX
    const sy = actor.position.y - this.cameraY
    return sx < -120 || sx > this.ctx.width + 120 || sy < -120 || sy > this.ctx.height + 120
  }

  /** Zombie rooms breed an endless trickle of shamblers, capped so the room never
   *  clogs: each spawned zombie sinks away after a while, and fresh ones rise to
   *  replace them up to a live cap. */
  private updateZombieSpawner(): void {
    if (!this.zombieSpawner) return
    let live = 0
    for (const e of this.enemies) {
      if (e.def.id !== 'zombie' || e.isDead) continue
      live += 1
      e.ageTicks += 1
      if (e.ageTicks > ZOMBIE_LIFETIME && !this.rewardedDeaths.has(e)) {
        this.rewardedDeaths.add(e) // no reward for a timed-out spawn
        e.despawnQuietly()
        live -= 1
      }
    }
    this.zombieSpawnTimer -= 1
    if (this.zombieSpawnTimer <= 0) {
      this.zombieSpawnTimer = ZOMBIE_SPAWN_INTERVAL
      if (live < ZOMBIE_ROOM_CAP) this.spawnWanderingZombie()
    }
  }

  private spawnWanderingZombie(): void {
    const min = WALL_MARGIN + 140
    const max = this.layout.width - WALL_MARGIN - 140
    const x = min + this.ctx.rng.next() * Math.max(1, max - min)
    const facing: Facing = this.ctx.rng.next() < 0.5 ? -1 : 1
    const z = new CastleActor(zombie, this.ctx.assets, x, this.layout.checkpointY, facing, campaignEnemySpeed('zombie'))
    z.setMaxHealth(campaignEnemyHealth('zombie', this.node.difficulty))
    z.roomWidth = this.layout.width
    z.roomTop = this.layout.top
    z.riseTicks = 26
    z.riseMax = 26
    this.enemies.push(z)
  }

  private tryDropBlueSoul(enemy: CastleActor, hurt: Rect): void {
    const soul = blueSoulForEnemy(enemy.def.id)
    if (!soul || this.save.blueSouls.includes(soul.id)) return
    if (this.ctx.rng.next() >= soul.dropChance) return
    this.save = addCampaignBlueSoul(this.save, soul.id)
    const cx = hurt.x + hurt.width / 2
    this.spawnFloatingText(cx, hurt.y - 52, 'GUARDIAN SOUL!', '#7ad6ff')
    this.spawnFloatingText(cx, hurt.y - 34, soul.name.toUpperCase(), '#7ad6ff')
    this.ctx.audio.hit()
  }

  private tryDropSoul(enemy: CastleActor, hurt: Rect): void {
    const soul = soulForEnemy(enemy.def.id)
    if (!soul || this.save.souls.includes(soul.id)) return
    if (this.ctx.rng.next() >= soul.dropChance) return
    this.save = addCampaignSoul(this.save, soul.id)
    this.applySoulMods()
    const cx = hurt.x + hurt.width / 2
    this.spawnFloatingText(cx, hurt.y - 28, 'SOUL!', '#7ad6ff')
    this.spawnFloatingText(cx, hurt.y - 10, soul.name.toUpperCase(), '#7ad6ff')
    this.ctx.audio.hit()
  }

  /** Only the equipped Yellow (Enchanted) soul's passive applies (Aria-style). */
  private yellowSoulMods(): SoulModifiers {
    return buildSoulModifiers(this.save.equippedYellowSoul ? [this.save.equippedYellowSoul] : [])
  }

  /** Whether the equipped Yellow soul grants underwater breathing (sink, not float). */
  private hasUnderwaterSoul(): boolean {
    const soul = this.save.equippedYellowSoul ? getSoul(this.save.equippedYellowSoul) : undefined
    return soul?.underwater === true
  }

  /** Re-apply soul bonuses to the live player when the passive soul changes. */
  private applySoulMods(): void {
    this.soulMods = this.yellowSoulMods()
    this.player.canDive = this.hasUnderwaterSoul()
    this.refreshLivePlayerStats()
  }

  /** Push every current modifier source onto the live player: bump max health by
   *  the delta (without a full heal) and refresh damage/defense/speed/meter. Used
   *  when a soul drops or the loadout changes mid-room. */
  private refreshLivePlayerStats(): void {
    const oldMax = this.player.maxHealth
    this.playerDamageMult = this.computeDamageMult()
    this.playerDamageTakenMult = this.computeDamageTakenMult()
    const newMax = this.computeMaxHealth()
    this.player.maxHealth = newMax
    this.player.health = Math.min(newMax, this.player.health + Math.max(0, newMax - oldMax))
    this.player.setMoveSpeedMultiplier(this.computeMoveSpeedMult())
    this.player.meterGainMultiplier = this.computeMeterGainMult()
  }

  private onLevelUp(levelsGained: number): void {
    // Every level auto-boosts stats (max HP + attack scale with level in the
    // compute* methods) and restores health. Freeze the game and show a
    // level-up screen the player dismisses with a key.
    const hpBefore = this.player.maxHealth
    this.playerDamageMult = this.computeDamageMult()
    this.player.setMaxHealth(this.computeMaxHealth())
    this.levelUpFrom = Math.max(1, this.save.level - levelsGained)
    this.levelUpHpBefore = hpBefore
    this.levelUpHpAfter = this.player.maxHealth
    this.levelUpScreen = true
    this.levelUpTicks = 18 // entrance fade
    this.ctx.audio.hit()
    // A power-up pick is earned only on every 5th level. Count how many level-5
    // milestones the gain crossed and queue a choice for each — offered after
    // the player dismisses the level-up screen.
    const top = this.save.level
    let milestones = 0
    for (let lvl = top - levelsGained + 1; lvl <= top; lvl += 1) {
      if (lvl % 5 === 0) milestones += 1
    }
    this.pendingLevelUps += milestones
  }

  /** Dismiss the level-up screen. If milestone perk picks are queued, roll into
   *  the perk-choice screen; otherwise resume play. */
  private dismissLevelUp(): void {
    this.levelUpScreen = false
    if (this.pendingLevelUps > 0 && !this.perkChoosing) this.openPerkChoice()
  }

  private openPerkChoice(): void {
    this.perkOptions = draftPowerUps(this.ctx.rng, 3)
    this.perkIndex = 0
    this.perkChoosing = true
    this.ctx.audio.swing()
  }

  private pickPerk(): void {
    const perk = this.perkOptions[this.perkIndex]
    if (perk) {
      this.save = addCampaignPerk(this.save, perk.id)
      this.refreshLivePlayerStats()
      this.ctx.audio.hit()
      this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, perk.name.toUpperCase(), '#f6b74a')
    }
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)
    if (this.pendingLevelUps > 0) {
      this.openPerkChoice()
    } else {
      this.perkChoosing = false
      this.perkOptions = []
    }
  }

  /** Rebuild the current room's enemies so the player can re-fight them for XP —
   *  triggered by walking back to the entrance of a cleared room. */
  /** Walk off an edge (L/R) or take the central stairwell (up/down) into the
   *  adjacent room, following the castle door graph. */
  private tryRoomTransition(intent: IntentState): void {
    if (this.roomCooldown > 0) this.roomCooldown -= 1
    if (this.player.isDead || this.transitionTicks > 0 || this.bossIntroTicks > 0 || this.roomCooldown > 0) return
    const x = this.player.position.x
    // Horizontal: walk into a side edge that has a door.
    if (intent.moveX < 0 && x <= WALL_MARGIN + EDGE_ZONE) {
      const west = castleNeighbor(this.node.id, 'w')
      if (west && this.canPassDoor('w')) { this.enterRoom(west, 'east'); return }
    } else if (intent.moveX > 0 && x >= this.layout.width - WALL_MARGIN - EDGE_ZONE) {
      const east = castleNeighbor(this.node.id, 'e')
      if (east && this.canPassDoor('e')) { this.enterRoom(east, 'west'); return }
    }
    // Vertical: cross the room's edge through the central door column — climb up
    // and out the top door, or drop down through the floor shaft. Directional
    // crossings (not a height zone), so a spawn at either edge can't retrigger.
    const doors = castleDoors(this.node.id)
    const prevY = this.player.prevPosition.y
    const curY = this.player.position.y
    const topEdge = this.layout.top + TOP_EDGE_Y
    const inColumn = Math.abs(x - VERT_PASSAGE_X) <= DOORWAY_HALF
    if (doors.n && inColumn && prevY > topEdge && curY <= topEdge) {
      const north = castleNeighbor(this.node.id, 'n')
      if (north && this.canPassDoor('n')) { this.enterRoom(north, 'bottom'); return }
    }
    if (doors.s && inColumn && prevY < BOTTOM_EDGE_Y && curY >= BOTTOM_EDGE_Y) {
      const south = castleNeighbor(this.node.id, 's')
      if (south && this.canPassDoor('s')) this.enterRoom(south, 'top')
    }
  }

  /** A sealed door blocks until you own its ability; flashes a hint otherwise. */
  private canPassDoor(dir: MapDir): boolean {
    const req = SEALED_DOORS[this.node.id]?.[dir]
    if (!req || this.save.abilities.includes(req)) return true
    if (this.sealMessageTicks <= 0) this.ctx.audio.swing()
    this.sealMessageTicks = 40
    this.sealMessageText = `SEALED — NEEDS ${(ABILITIES[req]?.name ?? req).toUpperCase()}`
    return false
  }

  private isDoorSealed(dir: MapDir): boolean {
    const req = SEALED_DOORS[this.node.id]?.[dir]
    return Boolean(req) && !this.save.abilities.includes(req!)
  }

  /** Reflect owned abilities on the live player (double jump, ...). */
  private applyAbilities(): void {
    this.player.maxJumps = this.save.abilities.includes('double-jump') ? 2 : 1
    this.player.hasHighJump = this.save.abilities.includes('high-jump')
    this.player.hasSlide = this.save.abilities.includes('slide')
  }

  private tryPickupAbility(): void {
    const pk = ABILITY_PICKUPS[this.node.id]
    if (!pk || this.save.abilities.includes(pk.ability) || this.player.isDead) return
    if (Math.abs(this.player.position.x - pk.x) > 48) return
    this.save = addCampaignAbility(this.save, pk.ability)
    this.mapService.state.collectItem(this.node.id)
    this.applyAbilities()
    this.abilityGetTicks = 200
    this.abilityGetName = ABILITIES[pk.ability]?.name ?? pk.ability
    this.abilityGetSub = ABILITIES[pk.ability]?.getSub ?? ''
    this.ctx.audio.hit()
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, 'ABILITY GET', '#f6b74a')
  }

  /** A permanent Life Max Up hidden in the castle — raises max HP for good.
   *  `high` ones need matching height (the high-jump relic) to actually reach. */
  private tryPickupLifeUp(): void {
    const lu = LIFE_UP_ROOMS[this.node.id]
    if (lu === undefined || hasWorldFlag(this.save, lifeUpFlag(this.node.id)) || this.player.isDead) return
    if (Math.abs(this.player.position.x - lu.x) > LIFE_UP_RANGE) return
    if (Math.abs(this.player.position.y - lu.y) > 44) return
    this.save = setWorldFlag(this.save, lifeUpFlag(this.node.id))
    this.save = { ...this.save, hpUpgrades: Math.min(99, this.save.hpUpgrades + 1) }
    saveCampaignSave(this.save)
    this.mapService.state.collectItem(this.node.id)
    this.refreshLivePlayerStats()
    this.player.health = this.player.maxHealth
    this.abilityGetTicks = 200
    this.abilityGetName = 'LIFE MAX UP'
    this.abilityGetSub = 'MAXIMUM HP PERMANENTLY INCREASED'
    this.ctx.audio.hit()
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, 'LIFE UP', '#ff7a9a')
  }

  /** Open a treasure chest on contact. State lives entirely in worldFlags, so it
   *  stays open when you leave and return — no bespoke save field. */
  private tryOpenChest(): void {
    const chest = CHEST_ROOMS[this.node.id]
    if (chest === undefined || hasWorldFlag(this.save, chestFlag(this.node.id)) || this.player.isDead) return
    if (Math.abs(this.player.position.x - chest.x) > CHEST_RANGE) return
    this.save = setWorldFlag(this.save, chestFlag(this.node.id))
    this.save = { ...this.save, gold: this.save.gold + chest.gold }
    saveCampaignSave(this.save)
    this.ctx.audio.hit()
    this.spawnFloatingText(chest.x, this.layout.doorY - 96, `+${chest.gold} GOLD`, '#f6b74a')
  }

  private tryPickupMapItem(): void {
    const mx = MAP_ITEM_ROOMS[this.node.id]
    if (mx === undefined || hasWorldFlag(this.save, MAP_FLAG) || this.player.isDead) return
    if (Math.abs(this.player.position.x - mx) > MAP_ITEM_RANGE) return
    this.save = setWorldFlag(this.save, MAP_FLAG)
    for (const id of Object.keys(CASTLE_MAP_DATA.rooms)) this.mapService.state.setState(id, 'revealed')
    this.abilityGetTicks = 200
    this.abilityGetName = 'CASTLE MAP'
    this.abilityGetSub = 'THE WHOLE CASTLE FILLS IN ON YOUR MAP'
    this.ctx.audio.hit()
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, 'MAP GET', '#7ad67a')
  }

  /** Load `nodeId` and drop the player at the entry side, facing inward. Health
   *  and MP carry across the threshold — no free heal by room-hopping. */
  private enterRoom(nodeId: string, entrySide: 'west' | 'east' | 'top' | 'bottom'): void {
    const carryHealth = this.player.health
    const carryMeter = this.player.meter
    this.reloadNode(nodeId)
    let x = VERT_PASSAGE_X
    let y = this.layout.checkpointY
    let facing: Facing = this.player.facing
    if (entrySide === 'west') { x = WALL_MARGIN + 90; facing = 1 }
    else if (entrySide === 'east') { x = this.layout.width - WALL_MARGIN - 90; facing = -1 }
    // Coming down through the passage: arrive on the top doorway ledge and descend.
    else if (entrySide === 'top') { y = this.layout.top + 150 }
    // Coming up through the passage: arrive at the floor of the room above.
    this.player.reset(x, y, facing)
    this.player.health = Math.min(this.player.maxHealth, Math.max(1, carryHealth))
    this.player.meter = clamp(carryMeter, 0, 100)
    this.updateCamera(x, y)
    this.roomCooldown = 22
    this.ctx.audio.swing()
  }

  private tryUseSavePoint(intent: IntentState): void {
    if (this.savedFlashTicks > 0) this.savedFlashTicks -= 1
    const sx = SAVE_POINTS[this.node.id]
    if (sx === undefined || this.player.isDead) return
    if (!intent.upHeld || this.savedFlashTicks > 0) return
    if (Math.abs(this.player.position.x - sx) > SAVE_RANGE) return
    // Resting at a save point fully restores HP and MP.
    this.player.health = this.player.maxHealth
    this.player.meter = 100
    saveCampaignSave(this.save)
    this.savedFlashTicks = 90
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, 'GAME SAVED', '#8fd4ff')
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 100, 'HP / MP RESTORED', '#7ad67a')
    this.ctx.audio.hit()
  }

  private tryUseMerchant(intent: IntentState): void {
    const mx = MERCHANT_ROOMS[this.node.id]
    if (mx === undefined || this.player.isDead || !this.player.grounded) return
    if (!intent.upHeld || this.roomCooldown > 0) return
    if (Math.abs(this.player.position.x - mx) > MERCHANT_RANGE) return
    this.shopping = true
    this.shopIndex = 0
    this.pendingNodeId = null
    this.ctx.audio.swing()
  }

  /** Standing at a warp pad + Up opens the warp-select overlay (Aria-style:
   *  any discovered warp room teleports to any other). */
  private tryUseWarpPoint(intent: IntentState): void {
    if (this.warpNoticeTicks > 0) this.warpNoticeTicks -= 1
    const wx = WARP_POINTS[this.node.id]
    if (wx === undefined || this.player.isDead || !this.player.grounded) return
    if (!intent.upHeld || this.roomCooldown > 0 || this.warpNoticeTicks > 0) return
    if (Math.abs(this.player.position.x - wx) > WARP_RANGE) return
    const visited = new Set(this.save.visitedNodeIds)
    const targets = CASTLE_WARP_ROOMS.map((r) => r.id).filter((id) => id !== this.node.id && visited.has(id))
    if (targets.length === 0) {
      this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, 'NO OTHER WARP POINTS FOUND', '#c86adc')
      this.warpNoticeTicks = 90
      this.ctx.audio.swing()
      return
    }
    this.warpTargets = targets
    this.warpIndex = 0
    this.showWarp = true
    this.ctx.audio.swing()
  }

  /** Teleport to another warp room, spawning on its warp pad. Mirrors
   *  enterRoom's health/meter carry-over. */
  private warpTo(nodeId: string): void {
    const carryHealth = this.player.health
    const carryMeter = this.player.meter
    this.reloadNode(nodeId)
    const x = WARP_POINTS[nodeId] ?? VERT_PASSAGE_X
    const y = this.layout.checkpointY
    this.player.reset(x, y, 1)
    this.player.health = Math.min(this.player.maxHealth, Math.max(1, carryHealth))
    this.player.meter = clamp(carryMeter, 0, 100)
    this.updateCamera(x, y)
    this.roomCooldown = 22
    this.spawnFloatingText(x, y - 118, 'WARPED', '#c86adc')
    this.ctx.audio.hit()
  }

  private perkStacks(id: string): number {
    return powerUpStacks(this.save.perks, id)
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({ x, y, text, color, ticksLeft: 60 })
  }

  private updateFloatingTexts(): void {
    for (const entry of this.floatingTexts) {
      entry.y -= 0.6
      entry.ticksLeft -= 1
    }
    this.floatingTexts = this.floatingTexts.filter((entry) => entry.ticksLeft > 0)
  }

  private updateParticles(): void {
    for (const p of this.particles) {
      p.velocity.y += p.gravity
      p.position.x += p.velocity.x
      p.position.y += p.velocity.y
      if (p.position.y > FLOOR_Y) { p.position.y = FLOOR_Y; p.velocity.y *= -0.4; p.velocity.x *= 0.6 }
      p.ticksLeft -= 1
    }
    this.particles = this.particles.filter((p) => p.ticksLeft > 0)
  }

  /** A candle bursting apart: pale wax shards flung outward plus a couple of
   *  guttering flame sparks. Purely cosmetic feedback for the break. */
  /** A puff of dust when a defeated enemy despawns. */
  private spawnDeathPoof(x: number, y: number): void {
    const rng = this.ctx.rng
    for (let i = 0; i < 9; i += 1) {
      const life = 14 + Math.floor(rng.next() * 12)
      this.particles.push({
        position: { x: x + (rng.next() - 0.5) * 24, y: y + (rng.next() - 0.5) * 30 },
        velocity: { x: (rng.next() - 0.5) * 3.4, y: -1 - rng.next() * 2.4 },
        ticksLeft: life, life, size: 2 + Math.floor(rng.next() * 2),
        color: rng.next() < 0.5 ? '#8a8496' : '#b0aaa0',
        gravity: 0.12,
      })
    }
  }

  private spawnCandleBreak(x: number, y: number): void {
    const rng = this.ctx.rng
    for (let i = 0; i < 7; i += 1) {
      const life = 20 + Math.floor(rng.next() * 14)
      this.particles.push({
        position: { x: x + (rng.next() - 0.5) * 8, y: y - 14 + (rng.next() - 0.5) * 20 },
        velocity: { x: (rng.next() - 0.5) * 5.2, y: -2.4 - rng.next() * 3.2 },
        ticksLeft: life, life, size: 2 + Math.floor(rng.next() * 2),
        color: rng.next() < 0.7 ? '#e6dcc0' : '#b7a988',
        gravity: 0.42,
      })
    }
    for (let i = 0; i < 3; i += 1) {
      const life = 12 + Math.floor(rng.next() * 8)
      this.particles.push({
        position: { x: x + (rng.next() - 0.5) * 5, y: y - 34 },
        velocity: { x: (rng.next() - 0.5) * 3, y: -1.6 - rng.next() * 2 },
        ticksLeft: life, life, size: 2,
        color: rng.next() < 0.5 ? '#ffb64a' : '#ff7a3a',
        gravity: 0.16,
      })
    }
  }

  private resolvePickups(): void {
    if (this.player.isDead) return
    const playerBox = this.player.hurtbox()
    for (const pickup of this.pickups) {
      if (pickup.ticksLeft <= 0) continue
      if (!rectsOverlap(pickupBox(pickup), playerBox)) continue
      pickup.ticksLeft = 0
      if (pickup.kind === 'heart') {
        this.player.meter = clamp(this.player.meter + HEART_MP * pickup.value, 0, 100)
      } else if (pickup.kind === 'gold') {
        this.save = grantCampaignRewards(this.save, 0, pickup.value).save
      } else {
        this.player.meter = clamp(this.player.meter + pickup.value, 0, 100)
      }
      this.ctx.audio.hit()
    }
  }

  private spawnPickup(x: number, y: number, kind: PickupKind, value: number, vx = 0): void {
    this.pickups.push({
      position: { x, y },
      velocity: { x: vx, y: -4.5 },
      kind,
      value,
      ticksLeft: 420,
    })
  }

  /** Classic candle loot: mostly hearts, sometimes coins or a splash of MP. */
  private spawnCandleDrop(x: number, y: number): void {
    // Candles drop a heart or a coin when struck (classic Castlevania).
    if (this.ctx.rng.next() < 0.6) this.spawnPickup(x, y, 'heart', 1)
    else this.spawnPickup(x, y, 'gold', 5)
  }

  /** Defeated enemies burst into loot — a few hearts/MP, more from bosses. */
  private spawnEnemyDrops(enemy: CastleActor): void {
    const hurt = enemy.hurtbox()
    const cx = hurt.x + hurt.width / 2
    const cy = hurt.y + hurt.height * 0.4
    if (enemy.isBoss) {
      for (let i = 0; i < 4; i += 1) this.spawnPickup(cx, cy, 'heart', 1, (i - 1.5) * 2.4)
      this.spawnPickup(cx, cy, 'mp', 40, -1.5)
      this.spawnPickup(cx, cy, 'mp', 40, 1.5)
      return
    }
    if (this.ctx.rng.next() < 0.5) this.spawnPickup(cx, cy, 'heart', 1, (this.ctx.rng.next() - 0.5) * 4)
    if (this.ctx.rng.next() < 0.22) this.spawnPickup(cx, cy, 'mp', 15, (this.ctx.rng.next() - 0.5) * 4)
  }

  private onHit(move: AttackMove, defenderDead: boolean): void {
    this.ctx.audio.hit()
    this.hitstop = Math.max(this.hitstop, move.hitstop)
    if (move.hitstop >= 10 || defenderDead) this.flashTicks = BIG_HIT_FLASH_TICKS
  }

  private playSwingSfx(): void {
    for (const actor of [this.player, ...this.enemies]) {
      if (actor.isAttacking) {
        if (!this.attackingLastTick.has(actor)) this.ctx.audio.swing()
        this.attackingLastTick.add(actor)
      } else {
        this.attackingLastTick.delete(actor)
      }
    }
  }


  private pickDraft(): void {
    const relic = this.draftOptions[this.draftIndex]
    const nodeId = this.pendingNodeId
    this.drafting = false
    this.draftOptions = []
    this.pendingNodeId = null
    if (relic) {
      this.save = addCampaignRelic(this.save, relic.id)
      this.ctx.audio.hit()
    }
    if (nodeId) this.proceedToNode(nodeId)
    else this.ending = true
  }

  /** Between rooms: open the wandering merchant's shop when crossing into a new
   *  chapter, otherwise load the next room directly. */
  private proceedToNode(nodeId: string): void {
    if (getCampaignNode(nodeId).chapterId !== this.node.chapterId) {
      this.shopping = true
      this.shopIndex = 0
      this.pendingNodeId = nodeId
      this.ctx.audio.swing()
      return
    }
    this.reloadNode(nodeId)
  }

  private leaveShop(): void {
    const nodeId = this.pendingNodeId
    this.shopping = false
    this.pendingNodeId = null
    if (nodeId) this.reloadNode(nodeId) // legacy between-area path; merchant rooms just close
  }

  private shopItems(): { id: string; name: string; desc: string; price: number; available: boolean }[] {
    // Equippable gear you don't own yet (weapons + armor + gear), cheapest first.
    const gear = EQUIPMENT_POOL.filter((item) => !this.save.equipment.includes(item.id))
      .slice()
      .sort((a, b) => a.price - b.price)
      .slice(0, 5)
      .map((item) => ({
        id: `equip:${item.id}`,
        name: item.name.toUpperCase(),
        desc: `${EQUIP_SLOT_LABELS[item.slot]} · ${item.blurb}`,
        price: item.price,
        available: true,
      }))
    // Usable consumables (potion / elixir).
    const consumables = CONSUMABLE_POOL.map((item) => ({
      id: `item:${item.id}`,
      name: item.name.toUpperCase(),
      desc: `${item.blurb}  (held ${this.save.consumables[item.id] ?? 0})`,
      price: item.price,
      available: true,
    }))
    return [
      ...gear,
      ...consumables,
      { id: 'leave', name: 'LEAVE SHOP', desc: 'Continue the hunt', price: 0, available: true },
    ]
  }

  private buyShopItem(): void {
    const item = this.shopItems()[this.shopIndex]
    if (!item) return
    if (item.id === 'leave') {
      this.leaveShop()
      return
    }
    if (!item.available || this.save.gold < item.price) {
      this.ctx.audio.swing()
      return
    }
    this.save = { ...this.save, gold: this.save.gold - item.price }
    if (item.id.startsWith('item:')) {
      this.save = addCampaignConsumable(this.save, item.id.slice('item:'.length), 1)
    } else if (item.id.startsWith('equip:')) {
      // Purchased gear lands in the inventory and auto-equips if the slot is open;
      // the loadout screen (from Status) lets the player swap it afterward.
      this.save = addCampaignEquipment(this.save, item.id.slice('equip:'.length) as EquipmentDef['id'])
      // Keep the pointer from landing past the end after the row disappears.
      this.shopIndex = Math.min(this.shopIndex, this.shopItems().length - 1)
    }
    saveCampaignSave(this.save)
    this.ctx.audio.hit()
  }

  /** The pickable options for a slot: [unequip, ...pieces you own for that slot]. */
  private equipOptions(slot: EquipSlot): (EquipmentDef | null)[] {
    const owned = equipmentForSlot(slot).filter((item) => this.save.equipment.includes(item.id))
    return [null, ...owned]
  }

  /** Open the owned-items list for the selected slot, starting on what's equipped. */
  private openEquipPicker(): void {
    const slot = EQUIP_SLOTS[this.equipSlotIndex]
    if (!slot) return
    const options = this.equipOptions(slot)
    const currentId = this.save.equipped[slot]
    this.equipPickIndex = Math.max(0, options.findIndex((opt) => (opt?.id ?? null) === (currentId ?? null)))
    this.equipPicking = true
    this.ctx.audio.swing()
  }

  /** Equip the chosen piece (or unequip if None) and apply it to the live player. */
  private applyEquipOption(option: EquipmentDef | null): void {
    const slot = EQUIP_SLOTS[this.equipSlotIndex]
    if (!slot) return
    this.save = option ? equipCampaignItem(this.save, option.id) : unequipCampaignSlot(this.save, slot)
    this.equipMods = buildEquipmentModifiers(equippedDefs(this.save))
    this.player.weaponProfile = this.equippedWeaponProfile()
    this.refreshLivePlayerStats()
  }

  /** Translucent water body drawn over the actors so submerged parts read as
   *  underwater, with a rippling surface line. */
  private drawWater(): void {
    const w = this.layout.water
    if (!w) return
    const { ctx } = this.ctx.renderer
    const x = w.x - this.cameraX
    const top = w.surfaceY
    ctx.save()
    ctx.fillStyle = 'rgba(38, 108, 186, 0.34)'
    ctx.fillRect(x, top, w.width, FLOOR_Y - top)
    ctx.fillStyle = 'rgba(120, 190, 240, 0.45)'
    ctx.fillRect(x, top, w.width, 4)
    ctx.strokeStyle = 'rgba(190, 235, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i <= w.width; i += 16) {
      const yy = top + Math.sin((i + this.blink * 2.5) * 0.05) * 3
      if (i === 0) ctx.moveTo(x + i, yy)
      else ctx.lineTo(x + i, yy)
    }
    ctx.stroke()
    ctx.restore()
  }

  private drawWorld(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.translate(-this.cameraX, -this.cameraY)
    for (const platform of this.layout.platforms) {
      if (platform.fallen) continue
      const crumbling = platform.crumble && platform.crumbleTimer !== undefined && platform.crumbleTimer < CRUMBLE_DELAY
      const shake = crumbling ? Math.sin(this.blink * 0.9) * 2 : 0
      const px = platform.x + shake
      ctx.fillStyle = crumbling ? '#4a2a2a' : '#2a2238'
      ctx.fillRect(px, platform.y, platform.width, platform.height)
      ctx.fillStyle = crumbling ? '#a5675a' : platform.crumble ? '#7a6a4a' : '#5a567a'
      ctx.fillRect(px, platform.y - 4, platform.width, 4)
    }
    for (const stair of this.layout.stairs) drawStair(ctx, stair)
    for (const barrier of this.layout.barriers) drawLowBarrier(ctx, barrier)
    for (const hazard of this.layout.hazards) drawSpikes(ctx, hazard)
    for (const candle of this.candles) drawCandle(ctx, candle)
    for (const pickup of this.pickups) drawPickup(ctx, pickup)
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.ticksLeft / p.life) * 1.4)
      ctx.fillStyle = p.color
      ctx.fillRect(p.position.x - p.size / 2, p.position.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1
    // Exit passages on whichever edges have a door in the castle graph.
    const doors = castleDoors(this.node.id)
    if (doors.w) drawExit(ctx, 0, this.layout.doorY, 'w', this.isDoorSealed('w'))
    if (doors.e) drawExit(ctx, this.layout.width, this.layout.doorY, 'e', this.isDoorSealed('e'))
    if (doors.n || doors.s) drawVertPassage(ctx, VERT_PASSAGE_X, this.layout.doorY, this.layout.top, this.layout.width, doors.n, doors.s, this.blink)
    // Ability relic, if this room has an uncollected one.
    const orb = ABILITY_PICKUPS[this.node.id]
    if (orb && !this.save.abilities.includes(orb.ability)) drawAbilityOrb(ctx, orb.x, this.layout.doorY, this.blink)
    const mapItem = MAP_ITEM_ROOMS[this.node.id]
    if (mapItem !== undefined && !hasWorldFlag(this.save, MAP_FLAG)) drawMapItemPickup(ctx, mapItem, this.layout.doorY, this.blink)
    const lifeUp = LIFE_UP_ROOMS[this.node.id]
    if (lifeUp !== undefined && !hasWorldFlag(this.save, lifeUpFlag(this.node.id))) {
      drawLifeUpPickup(ctx, lifeUp.x, lifeUp.high ? lifeUp.y - 30 : this.layout.doorY - 66, this.blink)
    }
    // Treasure chest — drawn open once looted (state persists via worldFlags).
    const chest = CHEST_ROOMS[this.node.id]
    if (chest !== undefined) drawChest(ctx, chest.x, this.layout.doorY, hasWorldFlag(this.save, chestFlag(this.node.id)), this.blink)
    // Save point, if this room has one.
    const sx = SAVE_POINTS[this.node.id]
    if (sx !== undefined) drawSavePoint(ctx, sx, this.layout.doorY, this.blink)
    // Warp pad, if this room has one.
    const wpx = WARP_POINTS[this.node.id]
    if (wpx !== undefined) drawWarpPad(ctx, wpx, this.layout.doorY, this.blink)
    // Wandering merchant, if this room has one.
    const mx = MERCHANT_ROOMS[this.node.id]
    if (mx !== undefined) drawMerchant(ctx, mx, this.layout.doorY, this.blink)
    ctx.restore()

    // Actors/projectiles offset x by cameraX internally; apply the vertical camera
    // offset here so everything scrolls together in 2D.
    ctx.save()
    ctx.translate(0, -this.cameraY)
    this.player.render(this.ctx.renderer, this.cameraX)
    for (const enemy of this.enemies) enemy.render(this.ctx.renderer, this.cameraX)
    for (const projectile of this.projectiles) renderProjectile(projectile, this.ctx.renderer, this.cameraX)
    for (const subweapon of this.subweapons) renderSubweapon(subweapon, this.ctx.renderer, this.cameraX)
    for (const bolt of this.soulBolts) drawSoulBolt(bolt, this.ctx.renderer, this.cameraX)
    for (const bone of this.enemyBones) drawBone(bone, this.ctx.renderer, this.cameraX)
    this.drawWater()
    this.drawEnemyHealthBars()
    this.drawFloatingTexts()
    if (DEBUG_HITBOXES) this.drawDebugBoxes()
    ctx.restore()
  }

  private drawFloatingTexts(): void {
    if (this.floatingTexts.length === 0) return
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '9px "Press Start 2P", monospace'
    for (const entry of this.floatingTexts) {
      ctx.globalAlpha = Math.min(1, entry.ticksLeft / 20)
      const x = entry.x - this.cameraX
      ctx.fillStyle = '#0b0912'
      ctx.fillText(entry.text, x + 1, entry.y + 1)
      ctx.fillStyle = entry.color
      ctx.fillText(entry.text, x, entry.y)
    }
    ctx.restore()
  }

  private drawEnemyHealthBars(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      const hurtbox = enemy.hurtbox()
      const width = Math.max(48, Math.min(96, hurtbox.width * 1.3))
      const x = hurtbox.x + hurtbox.width / 2 - width / 2 - this.cameraX
      const y = Math.max(124, hurtbox.y - 16)
      const ratio = clamp(enemy.health / enemy.maxHealth, 0, 1)

      ctx.fillStyle = 'rgba(8, 6, 14, 0.78)'
      ctx.fillRect(x, y, width, 7)
      ctx.fillStyle = enemy.maxHealth > 120 ? '#b91d2d' : '#d68f32'
      ctx.fillRect(x, y, width * ratio, 7)
      ctx.strokeStyle = '#e8d4a0'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, width, 7)
    }
    ctx.restore()
  }

  private drawDebugBoxes(): void {
    const { ctx } = this.ctx.renderer
    const stroke = (box: Rect, color: string): void => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(box.x - this.cameraX, box.y, box.width, box.height)
    }

    ctx.save()
    stroke(this.player.hurtbox(), '#55d66b')
    const playerAttack = this.player.activeAttack()
    if (playerAttack) stroke(playerAttack.box, '#ffd166')
    for (const enemy of this.enemies) {
      stroke(enemy.hurtbox(), '#ff5a7a')
      const attack = enemy.activeAttack()
      if (attack) stroke(attack.box, '#ff9f1c')
    }
    for (const projectile of this.projectiles) {
      if (!projectile.hasHit) stroke(projectileBox(projectile), '#5ad0ff')
    }
    for (const subweapon of this.subweapons) {
      if (!subweapon.hasHit) stroke(subweaponBox(subweapon), '#f3f06a')
    }
    for (const bone of this.enemyBones) {
      if (!bone.hasHit) stroke(boneBox(bone), '#b284e0')
    }
    for (const candle of this.candles) {
      if (!candle.broken) stroke(candleBox(candle), '#e8d4a0')
    }
    ctx.restore()
  }

  /** Aria-style HUD: the HP value to the left of a red HP bar, a blue MP bar
   *  below it, and one small line for the essentials. */
  private drawHud(): void {
    const { ctx } = this.ctx.renderer
    const p = this.player
    const barX = 108
    const barW = 268
    const hpY = 38
    const mpY = 56
    const hpFill = clamp(p.health / p.maxHealth, 0, 1)
    const mpFill = clamp(p.meter / 100, 0, 1)

    ctx.save()
    // Soft backing for legibility over the world (no hard-bordered panel).
    ctx.fillStyle = 'rgba(6, 5, 12, 0.5)'
    ctx.fillRect(20, 20, barX + barW - 4, 62)

    // Tiny HP / MP labels at the far left.
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillStyle = '#d68a8a'
    ctx.fillText('HP', 30, hpY)
    ctx.fillStyle = '#7aa8d6'
    ctx.fillText('MP', 30, mpY)

    // HP number, right-aligned just left of the HP bar.
    ctx.textAlign = 'right'
    ctx.font = '14px "Press Start 2P", monospace'
    ctx.fillStyle = '#f4ece0'
    ctx.fillText(String(Math.max(0, Math.ceil(p.health))), barX - 10, hpY)

    // HP bar (red).
    ctx.fillStyle = '#2a1014'
    ctx.fillRect(barX, hpY - 7, barW, 14)
    ctx.fillStyle = '#c8323a'
    ctx.fillRect(barX, hpY - 7, barW * hpFill, 14)
    ctx.fillStyle = 'rgba(255, 210, 200, 0.28)'
    ctx.fillRect(barX, hpY - 7, barW * hpFill, 3)
    ctx.strokeStyle = '#e8d4a0'
    ctx.lineWidth = 1
    ctx.strokeRect(barX + 0.5, hpY - 6.5, barW - 1, 13)

    // MP bar (blue).
    ctx.fillStyle = '#0e1a2a'
    ctx.fillRect(barX, mpY - 5, barW, 10)
    ctx.fillStyle = '#3a86d0'
    ctx.fillRect(barX, mpY - 5, barW * mpFill, 10)
    ctx.fillStyle = 'rgba(200, 230, 255, 0.28)'
    ctx.fillRect(barX, mpY - 5, barW * mpFill, 2)
    ctx.strokeStyle = '#5a86b0'
    ctx.strokeRect(barX + 0.5, mpY - 4.5, barW - 1, 9)

    // One small essentials line beneath the bars.
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = '7px "Press Start 2P", monospace'
    ctx.fillStyle = '#8a8aa0'
    ctx.fillText(`LV ${this.save.level}`, 30, 70)
    if (HERO_USES_SOULS) {
      // Soul-reaver: show the two active-button souls (Red cast / Blue guardian).
      ctx.fillStyle = '#ff9ad6'
      ctx.fillText(`R:${this.equippedSoulDef().name.toUpperCase()}`, 84, 70)
      ctx.fillStyle = '#7ad6ff'
      ctx.fillText(`B:${(getBlueSoul(this.save.equippedBlueSoul)?.name ?? '').toUpperCase()}`, 230, 70)
    } else {
      ctx.fillText(`SUB ${SUBWEAPON_LABELS[this.currentSubweapon()]}`, 92, 70)
      ctx.fillStyle = '#7ad6ff'
      ctx.fillText(`◈${this.equippedSoulDef().name.toUpperCase()}`, 214, 70)
    }
    ctx.textAlign = 'right'
    ctx.fillStyle = '#f6b74a'
    ctx.fillText(`${this.save.gold}G`, barX + barW - 2, 70)

    // Active guardian buff: its label pulses to the right of the meters while the
    // ; button is held (MP itself is the draining resource, shown by the MP bar).
    if (this.blueBuffEffect !== null) {
      const label = this.blueBuffEffect === 'glide' ? 'GLIDE' : this.blueBuffEffect === 'aegis' ? 'WARD' : this.blueBuffEffect === 'frenzy' ? 'FRENZY' : 'HASTE'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillStyle = Math.floor(this.blink / 12) % 2 === 0 ? '#7ad6ff' : '#bfe6ff'
      ctx.fillText(`◈ ${label}`, barX + barW + 14, mpY - 1)
    }
    ctx.restore()
  }

  private drawLevelUpScreen(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    // Brief entrance: the panel slides/fades in over the first frames.
    const t = 1 - Math.min(1, this.levelUpTicks / 18)
    const ease = t * (2 - t)
    ctx.save()
    ctx.fillStyle = `rgba(8, 6, 14, ${0.82 * ease})`
    ctx.fillRect(0, 0, width, height)

    const panelW = 420
    const panelH = 236
    const px = (width - panelW) / 2
    const py = (height - panelH) / 2 + (1 - ease) * 16
    ctx.globalAlpha = ease
    ctx.fillStyle = 'rgba(20, 16, 28, 0.96)'
    ctx.fillRect(px, py, panelW, panelH)
    ctx.strokeStyle = '#f6b74a'
    ctx.lineWidth = 3
    ctx.strokeRect(px, py, panelW, panelH)

    const cx = width / 2
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f6b74a'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText('LEVEL UP!', cx, py + 40)

    ctx.fillStyle = '#ffffff'
    ctx.font = '16px "Press Start 2P", monospace'
    ctx.fillText(`LV ${this.levelUpFrom}  →  ${this.save.level}`, cx, py + 82)

    // Stat rows.
    const hpDelta = Math.round(this.levelUpHpAfter - this.levelUpHpBefore)
    const atkPct = Math.round((this.playerDamageMult - 1) * 100)
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillStyle = '#b7c7e6'
    ctx.fillText(`MAX HP  ${Math.round(this.levelUpHpAfter)}${hpDelta > 0 ? `  (+${hpDelta})` : ''}`, cx, py + 120)
    ctx.fillStyle = '#b7c7e6'
    ctx.fillText(`ATTACK  +${atkPct}%`, cx, py + 142)
    ctx.fillStyle = '#7ad07a'
    ctx.fillText('HP FULLY RESTORED', cx, py + 164)

    if (this.pendingLevelUps > 0) {
      ctx.fillStyle = '#c86adc'
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText('◈ POWER-UP READY', cx, py + 190)
    }

    if (this.levelUpTicks <= 0 && Math.floor(this.blink / 30) % 2 === 0) {
      ctx.fillStyle = '#e8d4a0'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText('J CONTINUE', cx, py + panelH - 18)
    }
    ctx.restore()
  }

  private drawPrompt(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    if (HERO_USES_SOULS) {
      ctx.fillText('A/D MOVE   J JUMP   K ATTACK   W+K RED SOUL   ; BLUE SOUL', this.ctx.width / 2, this.ctx.height - 38)
      ctx.fillText('O SWAP RED SOUL   ENTER MENU   SPACE MAP   ESC PAUSE', this.ctx.width / 2, this.ctx.height - 22)
    } else {
      ctx.fillText('A/D MOVE   J JUMP   ; DASH   K ATTACK   W+K SUB   U SOUL', this.ctx.width / 2, this.ctx.height - 38)
      ctx.fillText('L SWITCH SUB   O SWAP SOUL   ENTER MENU   SPACE MAP   ESC PAUSE', this.ctx.width / 2, this.ctx.height - 22)
    }
    ctx.restore()
  }

  private drawBossBar(): void {
    const boss = this.bossActor
    if (!boss || boss.isDead) return
    const { ctx } = this.ctx.renderer
    const w = 560
    const x = this.ctx.width / 2 - w / 2
    const y = this.ctx.height - 92
    const ratio = clamp(boss.health / boss.maxHealth, 0, 1)
    const enraged = ratio < 0.35
    ctx.save()
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'center'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillStyle = enraged ? '#ff5658' : '#e8d4a0'
    ctx.fillText(boss.def.name, this.ctx.width / 2, y - 8)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.82)'
    ctx.fillRect(x - 4, y - 4, w + 8, 20)
    ctx.fillStyle = '#2a1014'
    ctx.fillRect(x, y, w, 12)
    ctx.fillStyle = enraged ? '#ff3b3d' : '#b91d2d'
    ctx.fillRect(x, y, w * ratio, 12)
    ctx.strokeStyle = enraged ? '#ffd05a' : '#e8d4a0'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, 12)
    ctx.restore()
  }

  private drawBossIntro(): void {
    const boss = this.bossActor
    if (!boss) return
    const { ctx } = this.ctx.renderer
    const t = this.bossIntroTicks
    const alpha = Math.min(clamp((BOSS_INTRO_TICKS - t) / 18, 0, 1), clamp(t / 18, 0, 1))
    const cy = this.ctx.height / 2
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(6, 4, 10, 0.72)'
    ctx.fillRect(0, cy - 54, this.ctx.width, 108)
    ctx.fillStyle = '#8a1418'
    ctx.fillRect(0, cy - 54, this.ctx.width, 3)
    ctx.fillRect(0, cy + 51, this.ctx.width, 3)
    ctx.fillStyle = '#f6b74a'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('— BOSS —', this.ctx.width / 2, cy - 30)
    ctx.fillStyle = '#f4e6c0'
    ctx.font = '22px "Press Start 2P", monospace'
    ctx.fillText(boss.def.name, this.ctx.width / 2, cy)
    ctx.fillStyle = '#b7a6d6'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(boss.def.meta.archetype, this.ctx.width / 2, cy + 30)
    ctx.restore()
  }

  private drawSealMessage(): void {
    const { ctx } = this.ctx.renderer
    const alpha = Math.min(1, this.sealMessageTicks / 12)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(8, 6, 14, 0.7)'
    ctx.fillRect(this.ctx.width / 2 - 230, this.ctx.height - 118, 460, 30)
    ctx.strokeStyle = '#c86adc'
    ctx.lineWidth = 2
    ctx.strokeRect(this.ctx.width / 2 - 230, this.ctx.height - 118, 460, 30)
    ctx.fillStyle = '#e0a0ff'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(this.sealMessageText, this.ctx.width / 2, this.ctx.height - 102)
    ctx.restore()
  }

  private drawAbilityGet(): void {
    const { ctx } = this.ctx.renderer
    const t = this.abilityGetTicks
    const alpha = Math.min(1, t / 24, (200 - t) / 20)
    const cy = this.ctx.height / 2 - 40
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(6, 4, 10, 0.8)'
    ctx.fillRect(0, cy - 44, this.ctx.width, 88)
    ctx.fillStyle = '#f6b74a'
    ctx.fillRect(0, cy - 44, this.ctx.width, 3)
    ctx.fillRect(0, cy + 41, this.ctx.width, 3)
    ctx.fillStyle = '#8fd4ff'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('— ABILITY GAINED —', this.ctx.width / 2, cy - 22)
    ctx.fillStyle = '#f4e6c0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText(this.abilityGetName.toUpperCase(), this.ctx.width / 2, cy + 4)
    ctx.fillStyle = '#b7a6d6'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(this.abilityGetSub, this.ctx.width / 2, cy + 28)
    ctx.restore()
  }

  private drawDefeat(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.78)'
    ctx.fillRect(this.ctx.width / 2 - 270, this.ctx.height / 2 - 78, 540, 132)
    ctx.strokeStyle = '#b91d2d'
    ctx.lineWidth = 3
    ctx.strokeRect(this.ctx.width / 2 - 270, this.ctx.height / 2 - 78, 540, 132)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText(`${CAMPAIGN_HERO.name} FALLS`, this.ctx.width / 2, this.ctx.height / 2 - 32)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('J RETRY     K TITLE', this.ctx.width / 2, this.ctx.height / 2 + 18)
    ctx.restore()
  }

  private drawFlash(): void {
    if (this.flashTicks <= 0) return
    const strength = this.ctx.camera.reduceMotion ? 0.12 : 0.22
    const alpha = (this.flashTicks / BIG_HIT_FLASH_TICKS) * strength
    const { ctx } = this.ctx.renderer
    ctx.fillStyle = `rgba(255, 235, 185, ${alpha})`
    ctx.fillRect(0, 0, this.ctx.width, this.ctx.height)
  }

  private drawEnding(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.86)'
    ctx.fillRect(110, 130, this.ctx.width - 220, this.ctx.height - 260)
    ctx.strokeStyle = '#e8d4a0'
    ctx.lineWidth = 3
    ctx.strokeRect(110, 130, this.ctx.width - 220, this.ctx.height - 260)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '22px "Press Start 2P", monospace'
    ctx.fillText('CASTLEVANIA97 COMPLETE', this.ctx.width / 2, 190)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '10px "Press Start 2P", monospace'
    wrapText(ctx, 'The 1997 hunt ends with Julius alive, warned, and changed. The war is still ahead, but the young Belmont now knows where the final road leads.', this.ctx.width / 2 - 260, 234, 520, 16, 6)
    ctx.fillStyle = '#5a567a'
    ctx.fillText('J / K RETURN TO TITLE', this.ctx.width / 2, this.ctx.height - 164)
    ctx.restore()
  }

  private draftLayout(): { startX: number; y: number; cardW: number; cardH: number; gap: number } {
    const cardW = 250
    const cardH = 220
    const gap = this.draftOptions.length > 1 ? 32 : 0
    const total = this.draftOptions.length * cardW + Math.max(0, this.draftOptions.length - 1) * gap
    return { startX: (this.ctx.width - total) / 2, y: 168, cardW, cardH, gap }
  }

  private drawDraft(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    const layout = this.draftLayout()
    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.86)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText('RELIC FOUND', width / 2, 92)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('CHOOSE ONE BLESSING FOR THE HUNT AHEAD', width / 2, 122)

    this.draftOptions.forEach((relic, i) => {
      const x = layout.startX + i * (layout.cardW + layout.gap)
      const selected = i === this.draftIndex
      ctx.fillStyle = selected ? 'rgba(40, 33, 56, 0.96)' : 'rgba(16, 24, 43, 0.84)'
      ctx.fillRect(x, layout.y, layout.cardW, layout.cardH)
      ctx.strokeStyle = selected ? '#e8d4a0' : '#5a567a'
      ctx.lineWidth = selected ? 3 : 2
      ctx.strokeRect(x, layout.y, layout.cardW, layout.cardH)

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#e8d4a0'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(relic.name.toUpperCase(), x + 16, layout.y + 20)
      ctx.fillStyle = '#b7c7e6'
      ctx.font = '9px "Press Start 2P", monospace'
      wrapText(ctx, relic.blurb, x + 16, layout.y + 58, layout.cardW - 32, 16)
      ctx.fillStyle = '#f6b74a'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText(relicSummary(relic), x + 16, layout.y + layout.cardH - 26)
    })

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#5a567a'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('A/D MOVE     J TAKE', width / 2, height - 44)
    ctx.restore()
  }

  private perkLayout(): { startX: number; y: number; cardW: number; cardH: number; gap: number } {
    const cardW = 250
    const cardH = 220
    const gap = this.perkOptions.length > 1 ? 32 : 0
    const total = this.perkOptions.length * cardW + Math.max(0, this.perkOptions.length - 1) * gap
    return { startX: (this.ctx.width - total) / 2, y: 168, cardW, cardH, gap }
  }

  private drawPerkChoice(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    const layout = this.perkLayout()
    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.86)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f6b74a'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText(`LEVEL ${this.save.level}`, width / 2, 82)
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '12px "Press Start 2P", monospace'
    ctx.fillText('CHOOSE A POWER-UP', width / 2, 116)
    if (this.pendingLevelUps > 1) {
      ctx.fillStyle = '#8a8aa0'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText(`${this.pendingLevelUps - 1} MORE TO CHOOSE`, width / 2, 138)
    }

    this.perkOptions.forEach((perk, i) => {
      const x = layout.startX + i * (layout.cardW + layout.gap)
      const selected = i === this.perkIndex
      const stacks = this.perkStacks(perk.id)
      ctx.fillStyle = selected ? 'rgba(48, 38, 26, 0.96)' : 'rgba(24, 20, 14, 0.84)'
      ctx.fillRect(x, layout.y, layout.cardW, layout.cardH)
      ctx.strokeStyle = selected ? '#f6b74a' : '#5a567a'
      ctx.lineWidth = selected ? 3 : 2
      ctx.strokeRect(x, layout.y, layout.cardW, layout.cardH)

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#f6b74a'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(perk.name.toUpperCase() + (stacks > 0 ? `  LV${stacks + 1}` : ''), x + 16, layout.y + 20)
      ctx.fillStyle = '#e8d4a0'
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText(perk.tag, x + 16, layout.y + 46)
      ctx.fillStyle = '#b7c7e6'
      ctx.font = '9px "Press Start 2P", monospace'
      wrapText(ctx, perk.blurb, x + 16, layout.y + 76, layout.cardW - 32, 16)
      if (stacks > 0) {
        ctx.fillStyle = '#8a8aa0'
        ctx.font = '8px "Press Start 2P", monospace'
        ctx.fillText(`OWNED x${stacks}`, x + 16, layout.y + layout.cardH - 24)
      }
    })

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#5a567a'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('A/D MOVE     J TAKE', width / 2, height - 44)
    ctx.restore()
  }

  private shopRowRect(index: number): { x: number; y: number; w: number; h: number } {
    // Compact enough that the full list (base wares + up to 3 gear + LEAVE) fits
    // on screen above the control hint.
    const w = 600
    const h = 44
    const x = (this.ctx.width - w) / 2
    const y = 132 + index * (h + 6)
    return { x, y, w, h }
  }

  private drawShop(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    const items = this.shopItems()
    ctx.save()
    // Backdrop: shop art dimmed under a dark wash.
    ctx.fillStyle = '#0a0710'
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 0.28
    ctx.drawImage(this.ctx.assets.image('stage.shop'), width / 2 - 220, 40, 440, 300)
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(8, 6, 14, 0.72)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText('WANDERING MERCHANT', width / 2, 68)
    ctx.fillStyle = '#f6b74a'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText(`GOLD ${this.save.gold}`, width / 2, 104)

    items.forEach((item, i) => {
      const rect = this.shopRowRect(i)
      const selected = i === this.shopIndex
      const affordable = item.id === 'leave' || (item.available && this.save.gold >= item.price)
      ctx.fillStyle = selected ? 'rgba(40, 33, 56, 0.96)' : 'rgba(16, 24, 43, 0.82)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.strokeStyle = selected ? '#e8d4a0' : '#5a567a'
      ctx.lineWidth = selected ? 3 : 2
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = affordable ? '#e8d4a0' : '#6a6480'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(item.name, rect.x + 18, rect.y + 8)
      ctx.fillStyle = affordable ? '#b7c7e6' : '#5a567a'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText(item.desc, rect.x + 18, rect.y + 27)
      if (item.id !== 'leave') {
        ctx.textAlign = 'right'
        ctx.fillStyle = affordable ? '#f6b74a' : '#7a5a2a'
        ctx.font = '11px "Press Start 2P", monospace'
        ctx.fillText(`${item.price}G`, rect.x + rect.w - 18, rect.y + 20)
      }
    })

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#5a567a'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('W/S MOVE     J BUY     K LEAVE', width / 2, height - 40)
    ctx.restore()
  }

  private drawMap(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    ctx.fillStyle = 'rgba(6, 5, 12, 0.94)'
    ctx.fillRect(0, 0, width, height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('CASTLE MAP', width / 2, 56)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(this.chapter.title.toUpperCase(), width / 2, 84)

    // The reusable map module renders the discovered castle, fit to the panel.
    const pulse = 0.5 + 0.5 * Math.sin(this.blink * 0.12)
    this.mapRenderer.draw(
      ctx,
      this.mapService,
      { x: 100, y: 112, width: width - 200, height: height - 240, cellSize: 48 },
      { pulse, showConnections: true, fit: true },
    )

    // Current-room caption.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText(this.node.title.toUpperCase(), width / 2, height - 92)
    ctx.fillStyle = this.node.isBoss ? '#e0393a' : '#7a8ab0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('YOU ARE HERE' + (this.node.isBoss ? '   • BOSS' : ''), width / 2, height - 74)

    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('SPACE / K  CLOSE', width / 2, height - 40)
  }

  /** The warp-select overlay: the castle map with a gold ring on the currently
   *  selected destination warp room. */
  private drawWarpSelect(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    ctx.fillStyle = 'rgba(6, 5, 12, 0.94)'
    ctx.fillRect(0, 0, width, height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#c86adc'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('WARP', width / 2, 56)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('CHOOSE A DESTINATION', width / 2, 84)

    const pulse = 0.5 + 0.5 * Math.sin(this.blink * 0.12)
    const target = this.warpTargets[this.warpIndex]
    this.mapRenderer.draw(
      ctx,
      this.mapService,
      { x: 100, y: 112, width: width - 200, height: height - 240, cellSize: 48 },
      { pulse, showConnections: true, fit: true, highlightRoomId: target },
    )

    if (target) {
      const node = getCampaignNode(target)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#e8d4a0'
      ctx.font = '11px "Press Start 2P", monospace'
      ctx.fillText(node.title.toUpperCase(), width / 2, height - 92)
      ctx.fillStyle = '#7a8ab0'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText(`${this.warpIndex + 1} / ${this.warpTargets.length}`, width / 2, height - 74)
    }
    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('← →  SELECT    J  WARP    SPACE  CLOSE', width / 2, height - 40)
  }

  /** Small live map in the top-right corner during gameplay. */
  private drawMinimap(): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.blink * 0.12)
    this.minimap.draw(this.ctx.renderer.ctx, this.mapService, {
      x: this.ctx.width - 182,
      y: 20,
      width: 160,
      height: 108,
      cellSize: 12,
      pulse,
    })
  }

  private drawMenu(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    const p = this.player
    ctx.save()
    ctx.fillStyle = 'rgba(5, 5, 11, 0.92)'
    ctx.fillRect(0, 0, width, height)

    const panel = (x: number, y: number, w: number, h: number, fill = 'rgba(14, 20, 36, 0.97)', border = '#4a5a86'): void => {
      ctx.fillStyle = fill
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = border
      ctx.lineWidth = 2
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
    }

    // ---- Portrait (top-left) ----
    const pX = 28, pY = 28, pW = 196, pH = 150
    panel(pX, pY, pW, pH, 'rgba(9, 12, 22, 0.98)')
    const cx = pX + pW / 2
    const col = CAMPAIGN_HERO.color ?? '#aab2bd'
    ctx.save()
    ctx.beginPath(); ctx.rect(pX + 3, pY + 3, pW - 6, pH - 6); ctx.clip()
    ctx.fillStyle = col
    ctx.beginPath(); ctx.arc(cx, pY + 66, 40, 0, Math.PI * 2); ctx.fill() // head
    ctx.beginPath() // shoulders
    ctx.moveTo(cx - 80, pY + pH)
    ctx.quadraticCurveTo(cx - 64, pY + 116, cx, pY + 116)
    ctx.quadraticCurveTo(cx + 64, pY + 116, cx + 80, pY + pH)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(18, 18, 28, 0.5)' // eyes
    ctx.beginPath(); ctx.arc(cx - 14, pY + 62, 5, 0, Math.PI * 2); ctx.arc(cx + 14, pY + 62, 5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    // Name + level banner under the portrait.
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'; ctx.font = '16px "Press Start 2P", monospace'
    ctx.fillText(CAMPAIGN_HERO.name, cx, pY + pH + 22)
    const lvY = pY + pH + 52
    ctx.fillStyle = '#b91d2b'; ctx.fillRect(pX + 16, lvY - 16, pW - 32, 32)
    ctx.strokeStyle = '#ff6a72'; ctx.lineWidth = 2; ctx.strokeRect(pX + 16.5, lvY - 15.5, pW - 33, 31)
    ctx.fillStyle = '#ffe0b0'; ctx.font = '14px "Press Start 2P", monospace'
    ctx.fillText(`LV ${this.save.level}`, cx, lvY)

    // ---- Stats panel (top-right) ----
    const sX = 244, sY = 28, sW = width - sX - 28, sH = 224
    panel(sX, sY, sW, sH)
    const barX = sX + 250, barW = sW - 250 - 24
    ctx.textBaseline = 'middle'
    ctx.font = '11px "Press Start 2P", monospace'
    // HP
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8963a'; ctx.fillText('HP', sX + 22, sY + 34)
    ctx.fillStyle = '#f4ece0'; ctx.fillText(`${Math.ceil(p.health)} / ${p.maxHealth}`, sX + 64, sY + 34)
    const hpF = clamp(p.health / p.maxHealth, 0, 1)
    ctx.fillStyle = '#2a1810'; ctx.fillRect(barX, sY + 28, barW, 13)
    ctx.fillStyle = '#e8963a'; ctx.fillRect(barX, sY + 28, barW * hpF, 13)
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 1; ctx.strokeRect(barX + 0.5, sY + 28.5, barW - 1, 12)
    // MP
    ctx.textAlign = 'left'; ctx.fillStyle = '#7aa8d6'; ctx.fillText('MP', sX + 22, sY + 66)
    ctx.fillStyle = '#f4ece0'; ctx.fillText(`${Math.floor(p.meter)} / 100`, sX + 64, sY + 66)
    const mpF = clamp(p.meter / 100, 0, 1)
    ctx.fillStyle = '#12203a'; ctx.fillRect(barX, sY + 60, barW, 11)
    ctx.fillStyle = '#5aa8e0'; ctx.fillRect(barX, sY + 60, barW * mpF, 11)
    ctx.strokeStyle = '#3a6a9a'; ctx.strokeRect(barX + 0.5, sY + 60.5, barW - 1, 10)
    // Stat grid (two columns).
    ctx.font = '10px "Press Start 2P", monospace'
    const stat = (label: string, val: string, valCol: string, x: number, y: number): void => {
      ctx.textAlign = 'left'; ctx.fillStyle = '#8a8aa0'; ctx.fillText(label, x, y)
      ctx.textAlign = 'right'; ctx.fillStyle = valCol; ctx.fillText(val, x + 168, y)
    }
    const gY = sY + 110, rx = sX + sW / 2 + 8
    stat('ATK', `x${this.computeDamageMult().toFixed(2)}`, '#f6b74a', sX + 22, gY)
    stat('DEF', `-${Math.round((1 - this.computeDamageTakenMult()) * 100)}%`, '#7ad6ff', sX + 22, gY + 30)
    stat('SPD', `x${this.computeMoveSpeedMult().toFixed(2)}`, '#b7c7e6', sX + 22, gY + 60)
    stat('MAX HP', `${this.computeMaxHealth()}`, '#f4ece0', rx, gY)
    stat('GOLD', `${this.save.gold}`, '#f6b74a', rx, gY + 30)
    stat('STATUS', 'GOOD', '#7ad67a', rx, gY + 60)

    // ---- Menu list (lower-left, red rail) ----
    const mX = 28, mY = 262, mW = 196, mH = height - mY - 28
    const grad = ctx.createLinearGradient(mX, 0, mX + mW, 0)
    grad.addColorStop(0, 'rgba(122, 22, 30, 0.97)')
    grad.addColorStop(1, 'rgba(40, 10, 14, 0.97)')
    ctx.fillStyle = grad; ctx.fillRect(mX, mY, mW, mH)
    ctx.strokeStyle = '#c8323a'; ctx.lineWidth = 2; ctx.strokeRect(mX + 1, mY + 1, mW - 2, mH - 2)
    ctx.textBaseline = 'middle'; ctx.font = '13px "Press Start 2P", monospace'
    MENU_ITEMS.forEach((item, i) => {
      const iy = mY + 32 + i * 34
      const sel = i === this.menuIndex
      if (sel) {
        ctx.fillStyle = 'rgba(255, 220, 120, 0.16)'
        ctx.fillRect(mX + 6, iy - 15, mW - 12, 30)
        ctx.textAlign = 'left'; ctx.fillStyle = '#ffd24a'; ctx.fillText('▶', mX + 10, iy)
      }
      ctx.textAlign = 'left'; ctx.fillStyle = sel ? '#ffe6b0' : '#dfa0a4'
      ctx.fillText(item, mX + 36, iy)
    })

    // ---- EXP strip + description (lower-right) ----
    const rX = 244, rW = width - rX - 28
    const eY = 262, eH = 52
    panel(rX, eY, rW, eH, 'rgba(20, 28, 60, 0.97)', '#4a5a9a')
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.textAlign = 'left'; ctx.fillStyle = '#8a9ad0'; ctx.fillText('EXP', rX + 22, eY + eH / 2)
    ctx.textAlign = 'right'; ctx.fillStyle = '#f4ece0'; ctx.fillText(`${this.save.xp}`, rX + rW / 2 - 24, eY + eH / 2)
    ctx.textAlign = 'left'; ctx.fillStyle = '#8a9ad0'; ctx.fillText('NEXT', rX + rW / 2 + 24, eY + eH / 2)
    const next = Math.max(0, xpForNextLevel(this.save.level) - this.save.xp)
    ctx.textAlign = 'right'; ctx.fillStyle = '#f4ece0'; ctx.fillText(`${next}`, rX + rW - 22, eY + eH / 2)

    const dY = eY + eH + 12, dH = height - 28 - dY
    panel(rX, dY, rW, dH)
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#e8d4a0'; ctx.font = '11px "Press Start 2P", monospace'
    wrapText(ctx, MENU_DESC[MENU_ITEMS[this.menuIndex]!], rX + 22, dY + 24, rW - 44, 22)
    ctx.fillStyle = '#5a567a'; ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('W/S MOVE   J SELECT   ESC CLOSE', rX + 22, dY + dH - 26)

    ctx.restore()
  }

  /** Confirmation popup for "Return to Title", drawn over the pause menu. */
  private drawTitleConfirm(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(4, 4, 10, 0.78)'
    ctx.fillRect(0, 0, width, height)
    const pw = 400, ph = 176
    const px = (width - pw) / 2
    const py = (height - ph) / 2
    ctx.fillStyle = 'rgba(20, 16, 28, 0.98)'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = '#e0393a'
    ctx.lineWidth = 3
    ctx.strokeRect(px, py, pw, ph)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '14px "Press Start 2P", monospace'
    ctx.fillText('RETURN TO TITLE?', width / 2, py + 42)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('YOUR PROGRESS IS SAVED', width / 2, py + 72)

    const opts = ['NO', 'YES'] as const
    const oy = py + 118
    opts.forEach((label, i) => {
      const isYes = i === 1
      const sel = isYes === this.confirmTitleYes
      const ox = width / 2 + (isYes ? 70 : -70)
      if (sel) {
        ctx.fillStyle = isYes ? 'rgba(224, 57, 58, 0.28)' : 'rgba(246, 183, 74, 0.2)'
        ctx.fillRect(ox - 52, oy - 16, 104, 32)
        ctx.strokeStyle = isYes ? '#e0393a' : '#f6b74a'
        ctx.lineWidth = 2
        ctx.strokeRect(ox - 52, oy - 16, 104, 32)
      }
      ctx.fillStyle = sel ? (isYes ? '#ff7a6a' : '#f6b74a') : '#7a7a92'
      ctx.font = '13px "Press Start 2P", monospace'
      ctx.fillText(label, ox, oy)
    })
    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('A/D CHOOSE   J OK   ESC CANCEL', width / 2, py + ph - 18)
    ctx.restore()
  }

  private drawStatus(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(6, 5, 12, 0.92)'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(56, 36, width - 112, height - 84)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText(`${CAMPAIGN_HERO.name}  —  STATUS`, width / 2, 56)

    // Left column: computed stats.
    ctx.textAlign = 'left'
    const statLabelX = 96
    const statValueX = 270
    let sy = 108
    const stat = (label: string, value: string, color = '#b7c7e6'): void => {
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillStyle = '#8a8aa0'
      ctx.fillText(label, statLabelX, sy)
      ctx.fillStyle = color
      ctx.fillText(value, statValueX, sy)
      sy += 24
    }
    stat('LEVEL', String(this.save.level), '#f6b74a')
    stat('XP', this.save.level >= MAX_LEVEL ? 'MAX' : `${this.save.xp}/${xpForNextLevel(this.save.level)}`)
    stat('MAX HP', String(this.computeMaxHealth()))
    stat('ATTACK', `${this.computeDamageMult().toFixed(2)}x`)
    stat('DEFENSE', `-${Math.round((1 - this.computeDamageTakenMult()) * 100)}%`)
    stat('MOVE SPD', `${this.computeMoveSpeedMult().toFixed(2)}x`)
    stat('GOLD', String(this.save.gold), '#f6b74a')
    stat('MP', `${Math.round(this.player.meter)} / 100`, '#8fd0ff')

    // Right column: relics and souls with names + effects.
    const colX = width / 2 + 8
    let ry = 108
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('RELICS', colX, ry)
    ry += 22
    const ownedRelics = this.save.relicIds.map((id) => RELIC_POOL.find((relic) => relic.id === id)).filter((relic): relic is RelicDef => Boolean(relic))
    if (ownedRelics.length === 0) {
      ctx.fillStyle = '#5a567a'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText('NONE YET', colX, ry)
      ry += 20
    } else {
      for (const relic of ownedRelics) {
        ctx.fillStyle = '#b7c7e6'
        ctx.font = '8px "Press Start 2P", monospace'
        ctx.fillText(relic.name.toUpperCase(), colX, ry)
        ctx.fillStyle = '#8a8aa0'
        ctx.fillText(relicSummary(relic), colX + 12, ry + 11)
        ry += 26
      }
    }
    ry += 12
    ctx.fillStyle = '#7ad6ff'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('SOULS', colX, ry)
    ry += 22
    const ownedSouls = this.save.souls.map((id) => getSoul(id)).filter((soul): soul is SoulDef => Boolean(soul))
    if (ownedSouls.length === 0) {
      ctx.fillStyle = '#5a567a'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText('NONE YET', colX, ry)
    } else {
      for (const soul of ownedSouls) {
        ctx.fillStyle = '#b7c7e6'
        ctx.font = '8px "Press Start 2P", monospace'
        ctx.fillText(soul.name.toUpperCase(), colX, ry)
        ctx.fillStyle = '#8a8aa0'
        ctx.fillText(soulSummary(soul), colX + 12, ry + 11)
        ry += 26
      }
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = '#5a567a'
    ctx.font = '9px "Press Start 2P", monospace'
    const hint = this.save.equipment.length > 0 ? 'J EQUIPMENT     I / K CLOSE' : 'I / K CLOSE'
    ctx.fillText(hint, width / 2, height - 58)
    ctx.restore()
  }

  private equipRowRect(index: number): { x: number; y: number; w: number; h: number } {
    const w = 620
    const h = 56
    const x = (this.ctx.width - w) / 2
    const y = 150 + index * (h + 12)
    return { x, y, w, h }
  }

  private drawEquipment(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(6, 5, 12, 0.94)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('EQUIPMENT', width / 2, 84)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('W/S SLOT     J SELECT     K CLOSE', width / 2, 116)

    EQUIP_SLOTS.forEach((slot, i) => {
      const rect = this.equipRowRect(i)
      const selected = i === this.equipSlotIndex
      const equipped = this.save.equipped[slot]
      const def = equipped ? getEquipment(equipped) : undefined
      const ownedCount = equipmentForSlot(slot).filter((item) => this.save.equipment.includes(item.id)).length

      ctx.fillStyle = selected ? 'rgba(40, 33, 56, 0.96)' : 'rgba(16, 24, 43, 0.82)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.strokeStyle = selected ? '#e8d4a0' : '#5a567a'
      ctx.lineWidth = selected ? 3 : 2
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#8a8aa0'
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText(EQUIP_SLOT_LABELS[slot], rect.x + 18, rect.y + 12)
      ctx.fillStyle = def ? '#e8d4a0' : '#6a6480'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(def ? def.name.toUpperCase() : '— EMPTY —', rect.x + 18, rect.y + 32)
      if (def) {
        ctx.textAlign = 'right'
        ctx.fillStyle = '#b7c7e6'
        ctx.font = '8px "Press Start 2P", monospace'
        ctx.fillText(def.blurb, rect.x + rect.w - 18, rect.y + 12)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = '#5a567a'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText(`${ownedCount} OWNED`, rect.x + rect.w - 18, rect.y + 36)
    })

    // Live totals so the player sees the loadout's net effect while swapping.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f6b74a'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(
      `HP ${this.computeMaxHealth()}    ATK ${this.computeDamageMult().toFixed(2)}x    DEF -${Math.round((1 - this.computeDamageTakenMult()) * 100)}%    SPD ${this.computeMoveSpeedMult().toFixed(2)}x`,
      width / 2,
      height - 54,
    )
    ctx.restore()
    if (this.equipPicking) this.drawEquipPicker()
  }

  /** The owned-items list for the selected slot — pick which piece to equip. */
  private drawEquipPicker(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    const slot = EQUIP_SLOTS[this.equipSlotIndex]
    if (!slot) return
    const options = this.equipOptions(slot)
    const equippedId = this.save.equipped[slot] ?? null
    const rowH = 42
    const pw = Math.min(600, width - 100)
    const ph = 60 + options.length * rowH + 12
    const px = (width - pw) / 2
    const py = Math.max(70, (height - ph) / 2)
    ctx.save()
    ctx.fillStyle = 'rgba(4, 4, 10, 0.82)'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(18, 15, 28, 0.99)'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = '#e8d4a0'
    ctx.lineWidth = 3
    ctx.strokeRect(px, py, pw, ph)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#f6b74a'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText(EQUIP_SLOT_LABELS[slot].toUpperCase(), px + 20, py + 18)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('W/S MOVE    J EQUIP    K BACK', px + pw - 20, py + 20)

    const startY = py + 50
    options.forEach((opt, i) => {
      const ry = startY + i * rowH
      const selected = i === this.equipPickIndex
      const isEquipped = (opt?.id ?? null) === equippedId
      ctx.fillStyle = selected ? 'rgba(44, 36, 62, 0.98)' : 'rgba(16, 24, 43, 0.55)'
      ctx.fillRect(px + 12, ry, pw - 24, rowH - 6)
      if (selected) {
        ctx.strokeStyle = '#e8d4a0'
        ctx.lineWidth = 2
        ctx.strokeRect(px + 12, ry, pw - 24, rowH - 6)
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = opt ? (selected ? '#e8d4a0' : '#c7c1de') : '#6a6480'
      ctx.font = '11px "Press Start 2P", monospace'
      ctx.fillText(opt ? opt.name.toUpperCase() : '— NONE —', px + 22, ry + 8)
      if (opt) {
        ctx.fillStyle = '#9aa8c8'
        ctx.font = '8px "Press Start 2P", monospace'
        ctx.fillText(opt.blurb, px + 22, ry + 24)
      }
      if (isEquipped) {
        ctx.textAlign = 'right'
        ctx.fillStyle = '#7ad67a'
        ctx.font = '8px "Press Start 2P", monospace'
        ctx.fillText('EQUIPPED', px + pw - 26, ry + 14)
      }
    })
    ctx.restore()
  }

  private soulRowRect(index: number): { x: number; y: number; w: number; h: number } {
    const w = 640
    const h = 76
    const x = (this.ctx.width - w) / 2
    const y = 148 + index * (h + 14)
    return { x, y, w, h }
  }

  /** The SOULS menu: three colour-coded slots (Red cast / Blue guardian / Yellow
   *  passive). A/D cycles the equipped soul in the highlighted slot. */
  private drawSouls(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    const red = getBulletSoul(this.save.equippedBulletSoul)
    const blue = getBlueSoul(this.save.equippedBlueSoul)
    const yellow = this.save.equippedYellowSoul ? getSoul(this.save.equippedYellowSoul) : undefined
    const rows = [
      { color: '#ff9ad6', label: 'RED  ·  SUB-WEAPON BUTTON', name: red?.name, blurb: red?.blurb, meta: `${this.ownedBulletSoulIds().length} OWNED · ${red?.mpCost ?? 0} MP` },
      { color: '#7ad6ff', label: 'BLUE  ·  ; BUTTON (GUARDIAN)', name: blue?.name, blurb: blue?.blurb, meta: `${this.ownedBlueSoulIds().length} OWNED · ${blue?.mpCost ?? 0} MP` },
      { color: '#f6d24a', label: 'YELLOW  ·  PASSIVE', name: yellow?.name ?? null, blurb: yellow?.blurb ?? 'No enchant soul equipped.', meta: `${this.save.souls.length} OWNED` },
    ]
    ctx.save()
    ctx.fillStyle = 'rgba(6, 5, 12, 0.94)'
    ctx.fillRect(0, 0, width, height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('SOULS', width / 2, 84)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('W/S SLOT     A/D CHANGE     K CLOSE', width / 2, 116)

    rows.forEach((row, i) => {
      const r = this.soulRowRect(i)
      const selected = i === this.soulSlotIndex
      ctx.fillStyle = selected ? 'rgba(40, 33, 56, 0.96)' : 'rgba(16, 24, 43, 0.82)'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeStyle = selected ? row.color : '#5a567a'
      ctx.lineWidth = selected ? 3 : 2
      ctx.strokeRect(r.x, r.y, r.w, r.h)
      ctx.fillStyle = row.color
      ctx.fillRect(r.x + 16, r.y + 18, 16, 16)

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = row.color
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText(row.label, r.x + 44, r.y + 14)
      ctx.fillStyle = row.name ? '#e8d4a0' : '#6a6480'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(row.name ? row.name.toUpperCase() : '— NONE —', r.x + 44, r.y + 32)
      if (row.blurb) {
        ctx.fillStyle = '#9aa8c8'
        ctx.font = '8px "Press Start 2P", monospace'
        ctx.fillText(row.blurb, r.x + 44, r.y + 56)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = '#5a567a'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText(row.meta, r.x + r.w - 16, r.y + 16)
      if (selected) {
        ctx.fillStyle = row.color
        ctx.font = '10px "Press Start 2P", monospace'
        ctx.fillText('‹ A/D ›', r.x + r.w - 16, r.y + r.h - 22)
      }
    })
    ctx.restore()
  }

  /** The ITEMS menu: consumables (potion / elixir) with counts; J uses the one
   *  highlighted. */
  private drawItems(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(6, 5, 12, 0.94)'
    ctx.fillRect(0, 0, width, height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('ITEMS', width / 2, 84)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('W/S SELECT     J USE     K CLOSE', width / 2, 116)

    CONSUMABLE_POOL.forEach((item, i) => {
      const r = this.soulRowRect(i)
      const selected = i === this.itemIndex
      const count = this.save.consumables[item.id] ?? 0
      const color = item.effect === 'heal' ? '#7ad67a' : '#7aa8ff'
      ctx.fillStyle = selected ? 'rgba(40, 33, 56, 0.96)' : 'rgba(16, 24, 43, 0.82)'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeStyle = selected ? color : '#5a567a'
      ctx.lineWidth = selected ? 3 : 2
      ctx.strokeRect(r.x, r.y, r.w, r.h)
      ctx.fillStyle = count > 0 ? color : '#4a4660'
      ctx.fillRect(r.x + 16, r.y + 20, 16, 16)

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = count > 0 ? '#e8d4a0' : '#6a6480'
      ctx.font = '13px "Press Start 2P", monospace'
      ctx.fillText(item.name.toUpperCase(), r.x + 44, r.y + 18)
      ctx.fillStyle = '#9aa8c8'
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText(item.blurb, r.x + 44, r.y + 46)
      ctx.textAlign = 'right'
      ctx.fillStyle = count > 0 ? '#f6b74a' : '#5a567a'
      ctx.font = '14px "Press Start 2P", monospace'
      ctx.fillText(`x${count}`, r.x + r.w - 18, r.y + 30)
      if (selected && count > 0) {
        ctx.textAlign = 'right'
        ctx.fillStyle = color
        ctx.font = '9px "Press Start 2P", monospace'
        ctx.fillText('J USE', r.x + r.w - 18, r.y + r.h - 20)
      }
    })
    ctx.restore()
  }
}

function soulSummary(soul: SoulDef): string {
  const parts: string[] = []
  if (soul.maxHealthBonus) parts.push(`+${soul.maxHealthBonus} HP`)
  if (soul.damageMultiplier && soul.damageMultiplier !== 1) parts.push(`+${Math.round((soul.damageMultiplier - 1) * 100)}% ATK`)
  if (soul.moveSpeedMultiplier && soul.moveSpeedMultiplier !== 1) parts.push(`+${Math.round((soul.moveSpeedMultiplier - 1) * 100)}% SPD`)
  if (soul.meterGainMultiplier && soul.meterGainMultiplier !== 1) parts.push(`+${Math.round((soul.meterGainMultiplier - 1) * 100)}% MTR`)
  return parts.join('   ')
}

function relicSummary(relic: RelicDef): string {
  if (relic.maxHealthBonus) return `+${relic.maxHealthBonus} MAX HP`
  if (relic.damageMultiplier !== 1) return `${relic.damageMultiplier.toFixed(2)}X DAMAGE`
  if (relic.meterGainMultiplier !== 1) return `${relic.meterGainMultiplier.toFixed(2)}X METER`
  if (relic.moveSpeedMultiplier !== 1) return `${relic.moveSpeedMultiplier.toFixed(2)}X SPEED`
  if (relic.startMeterBonus) return `+${relic.startMeterBonus} START METER`
  return ''
}

function buildEnemies(node: ReturnType<typeof getCampaignNode>, assets: AssetManager, layout: RoomLayout): CastleActor[] {
  if (SAVE_POINTS[node.id] !== undefined) return [] // save rooms are safe
  if (WARP_POINTS[node.id] !== undefined) return [] // warp rooms are safe too
  if (node.isBoss) {
    const boss = new CastleActor(node.enemy, assets, layout.doorX - 180, layout.checkpointY, -1, campaignEnemySpeed(node.enemy.id))
    boss.setMaxHealth(campaignBossHealth(node.id))
    boss.meter = 100
    boss.isBoss = true
    if (node.enemy.id === 'creakingSkull') boss.rangedAttacker = true // fires charged fireballs
    return [boss]
  }
  const groups = [
    { def: node.enemy, count: campaignEnemyCount(node.enemy.id, node.difficulty) },
    ...(node.extraEnemies ?? []).map((extra) => ({ def: extra.def, count: extra.count })),
  ]
  const total = Math.max(1, groups.reduce((sum, group) => sum + group.count, 0))
  const slots = spread(layout.checkpointX + 360, layout.doorX - 160, total)
  const batCount = groups.filter((g) => g.def.id === 'bat').reduce((n, g) => n + g.count, 0)
  const batXs = spread(layout.checkpointX + 300, layout.doorX - 220, Math.max(1, batCount))
  const enemies: CastleActor[] = []
  let slot = 0
  let batIndex = 0
  for (const group of groups) {
    for (let i = 0; i < group.count; i += 1) {
      const isBat = group.def.id === 'bat'
      // Bats get their own spread across the room (so some roost near the player);
      // everyone else uses the ground slots.
      const x = isBat ? batXs[batIndex] ?? layout.doorX - 300 : slots[slot] ?? layout.doorX - 200
      const enemy = new CastleActor(group.def, assets, x, layout.checkpointY, -1, campaignEnemySpeed(group.def.id))
      enemy.setMaxHealth(campaignEnemyHealth(group.def.id, node.difficulty))
      if (group.def.id === 'boneThrower' || group.def.id === 'skeleton' || group.def.id === 'axeArmor') enemy.rangedAttacker = true
      if (group.def.id === 'zombie') { enemy.riseTicks = 20 + slot * 12; enemy.riseMax = enemy.riseTicks }
      if (isBat) {
        // Roost up in the air at a staggered height; it dives when the player nears.
        enemy.flying = true
        enemy.position.y = FLOOR_Y - (228 + (batIndex % 3) * 54)
        enemy.prevPosition.y = enemy.position.y
        batIndex += 1
      }
      enemies.push(enemy)
      slot += 1
    }
  }
  return enemies
}

function campaignEnemyReward(enemy: CastleActor): { xp: number; gold: number } {
  if (enemy.isBoss) return { xp: 60, gold: 50 }
  return ENEMY_REWARD[enemy.def.id] ?? { xp: 5, gold: 3 }
}

function campaignEnemySpeed(enemyId: string): number {
  if (enemyId === 'armoredSkeleton') return 0.58
  if (enemyId === 'axeArmor') return 0.5
  if (enemyId === 'creakingSkull') return 0.3 // a ponderous colossus
  if (enemyId === 'ghoul') return 1.02
  if (enemyId === 'boneThrower') return 0.72
  return 0.78
}

function campaignBossHealth(nodeId: string): number {
  const bossHp: Record<string, number> = {
    'cor-skull': 200,
    'res-golem': 240,
    'chp-manticore': 230,
    'dnc-greatarmor': 240,
    'inr-headhunter': 250,
    'clk-death': 280,
    'grd-legion': 270,
    'fbd-chaos': 340,
  }
  return bossHp[nodeId] ?? 180
}

function campaignEnemyCount(enemyId: string, difficulty: 'easy' | 'normal' | 'hard'): number {
  if (enemyId === 'skeleton') {
    if (difficulty === 'easy') return 2
    if (difficulty === 'normal') return 3
    return 4
  }
  if (enemyId === 'zombie') return difficulty === 'hard' ? 2 : 1
  if (enemyId === 'axeArmor') return difficulty === 'hard' ? 2 : 1
  return difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3
}

function campaignEnemyHealth(enemyId: string, difficulty: 'easy' | 'normal' | 'hard'): number {
  if (enemyId === 'skeleton') return 21
  if (enemyId === 'zombie') return 6
  if (enemyId === 'bat') return 12
  if (enemyId === 'axeArmor') return difficulty === 'hard' ? 56 : 44
  if (enemyId === 'ghoul') return 16
  if (enemyId === 'boneThrower') return 18
  if (enemyId === 'armoredSkeleton') return difficulty === 'hard' ? 96 : 78
  return difficulty === 'easy' ? 28 : difficulty === 'normal' ? 40 : 52
}

function enemyIntent(enemy: CastleActor, player: CastleActor, node: ReturnType<typeof getCampaignNode>, rng: Rng): IntentState {
  const intent = neutralIntent()
  if (enemy.isDead) return intent
  const dx = player.position.x - enemy.position.x
  const dist = Math.abs(dx)
  const dir: -1 | 1 = dx >= 0 ? 1 : -1
  const kind = enemy.def.id

  if (kind === 'zombie') {
    // Shambles aimlessly — wanders and pauses, never targets the player. Its
    // threat is contact, not pursuit.
    enemy.wanderTicks -= 1
    if (enemy.wanderTicks <= 0) {
      const r = rng.next()
      enemy.wanderMove = r < 0.35 ? 0 : r < 0.675 ? -1 : 1
      enemy.wanderTicks = 50 + Math.floor(rng.next() * 110)
    }
    if (enemy.position.x <= WALL_MARGIN + 40) enemy.wanderMove = 1
    else if (enemy.position.x >= enemy.roomWidth - WALL_MARGIN - 40) enemy.wanderMove = -1
    intent.moveX = enemy.wanderMove
    return intent
  }

  if (kind === 'ghoul') {
    // Fast and reckless: closes hard, then rakes or pounces from range.
    if (dist > 74) intent.moveX = dir
    else if (enemy.currentMove === null) {
      if (dist > 52 && rng.next() < 0.4) intent.specialPressed = true
      else if (rng.next() < 0.25) intent.heavyPressed = true
      else intent.lightPressed = true
    }
    return intent
  }

  if (kind === 'boneThrower') {
    // Kites: backs away when the player closes, throws bones from mid range.
    if (dist < 150) intent.moveX = dir === 1 ? -1 : 1
    else if (dist > 330) intent.moveX = dir
    else if (enemy.currentMove === null) intent.lightPressed = true
    return intent
  }

  if (kind === 'armoredSkeleton') {
    // Slow bruiser: walks in without jumping and leans on heavy swings.
    if (dist > 150) intent.moveX = dir
    else if (dist > 96) intent.moveX = dir
    else if (enemy.currentMove === null) {
      if (dist < 92 || node.difficulty === 'hard') intent.heavyPressed = true
      else intent.lightPressed = true
    }
    return intent
  }

  if (kind === 'skeleton') {
    // Bone Soldier: holds its ground and lobs a bone in a high arc — no chasing.
    // Throws are deliberately sparse: roughly one every 5s (+ jitter so a pack
    // doesn't fire in unison), not a continuous barrage.
    intent.moveX = 0
    if (enemy.throwCooldown > 0) enemy.throwCooldown -= 1
    if (enemy.currentMove === null && enemy.throwCooldown <= 0 && dist < 560) {
      intent.lightPressed = true
      enemy.throwCooldown = SKELETON_THROW_COOLDOWN + Math.floor(rng.next() * 90)
    }
    return intent
  }

  if (kind === 'axeArmor') {
    // Marches into mid-range and lobs axes on a cooldown; chops if you crowd it.
    if (enemy.throwCooldown > 0) enemy.throwCooldown -= 1
    if (dist < 104) {
      if (enemy.currentMove === null) intent.heavyPressed = true // axe chop up close
    } else if (dist > 360) {
      intent.moveX = dir // close the gap
    } else if (enemy.currentMove === null && enemy.throwCooldown <= 0) {
      intent.lightPressed = true // throw an axe
      enemy.throwCooldown = AXE_THROW_COOLDOWN + Math.floor(rng.next() * 40)
    } else if (enemy.currentMove === null) {
      intent.moveX = dir // drift closer between throws
    }
    return intent
  }

  if (kind === 'creakingSkull') {
    // Ponderous colossus: plants itself to attack (no drift while swinging). Up
    // close it smashes; from range it charges a horizontal fireball. Shuffles in
    // only between attacks.
    if (enemy.throwCooldown > 0) enemy.throwCooldown -= 1
    if (enemy.currentMove !== null) return intent // stop moving while attacking
    if (enemy.throwCooldown <= 0) {
      if (dist < 220) intent.heavyPressed = true // the huge-range sweep
      else intent.lightPressed = true // charge + fire a horizontal fireball
      enemy.throwCooldown = CREAKING_SKULL_ATTACK_CD
    } else if (dist > 170) {
      intent.moveX = dir // close the gap slowly between attacks
    }
    return intent
  }

  // Boss AI: three phases that ramp aggression as health falls. A phase-3
  // (enraged) boss pressures from farther out, favors heavies, and fires supers
  // as soon as meter allows. The winged Seal Warden also leaps to close gaps.
  const ratio = enemy.health / enemy.maxHealth
  const phase = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3
  const approach = phase === 1 ? 74 : phase === 2 ? 96 : 124
  const canSuper = enemy.meter >= (enemy.def.moves.super.meterCost ?? Number.POSITIVE_INFINITY)
  const winged = kind === 'sealGuardian'

  if (dist > approach) {
    intent.moveX = dir
    if (winged && enemy.grounded && phase >= 2 && rng.next() < 0.05) intent.jumpPressed = true
    return intent
  }
  if (enemy.currentMove !== null) return intent

  const superChance = phase === 1 ? 0.35 : phase === 2 ? 0.7 : 0.92
  if (canSuper && rng.next() < superChance) {
    intent.specialPressed = true
    return intent
  }
  const heavyChance = phase === 1 ? 0.4 : phase === 2 ? 0.62 : 0.82
  if (node.difficulty === 'hard' || dist < 54 || rng.next() < heavyChance) intent.heavyPressed = true
  else intent.lightPressed = true
  return intent
}

function createProjectile(spawn: ProjectileSpawn, assets: AssetManager): ProjectileRuntime {
  const spec = spawn.move.projectile
  if (!spec) throw new Error('Projectile spawn missing spec')
  const sheet = makeSheet(assets.image(spec.sprite), spec.frames)
  return {
    spawn,
    sheet,
    animator: new Animator(sheet, spec.hold, true),
    position: { x: spawn.x, y: spawn.y },
    ticksLeft: spec.lifetime,
    hasHit: false,
  }
}

function projectileBox(projectile: ProjectileRuntime): Rect {
  const spec = projectile.spawn.move.projectile
  if (!spec) return { x: projectile.position.x, y: projectile.position.y, width: 1, height: 1 }
  const x = projectile.spawn.facing === 1 ? projectile.position.x + spec.hitbox.offsetX : projectile.position.x - spec.hitbox.offsetX - spec.hitbox.width
  return { x, y: projectile.position.y + spec.hitbox.offsetY, width: spec.hitbox.width, height: spec.hitbox.height }
}

function renderProjectile(projectile: ProjectileRuntime, renderer: Renderer, cameraX: number): void {
  if (!projectile.spawn.move.projectile) return
  const { ctx } = renderer
  const x = projectile.position.x - cameraX
  const y = projectile.position.y - projectile.sheet.frameHeight * 0.4
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(projectile.animator.currentFrame * 0.9)
  ctx.fillStyle = '#e0dac6'
  ctx.fillRect(-9, -2, 18, 4) // a small tumbling shard
  ctx.restore()
}

function updateSubweapon(subweapon: SubweaponRuntime): void {
  if (subweapon.kind === 'stopwatch') return

  if (subweapon.kind === 'holyWater' && subweapon.phase === 'flame') {
    return
  }

  subweapon.velocity.y += SUBWEAPON_GRAVITY[subweapon.kind]
  subweapon.position.x += subweapon.velocity.x
  subweapon.position.y += subweapon.velocity.y

  if (subweapon.kind === 'cross') {
    if (subweapon.phase !== 'returning' && subweapon.ticksLeft <= 76) {
      subweapon.phase = 'returning'
      subweapon.velocity.x *= -1
      // Forget who it already struck so it damages again on the way back.
      subweapon.hitTargets?.clear()
    }
  }

  if (subweapon.kind === 'holyWater' && subweapon.position.y >= FLOOR_Y - 18) {
    subweapon.phase = 'flame'
    subweapon.position.y = FLOOR_Y - 18
    subweapon.velocity.x = 0
    subweapon.velocity.y = 0
    subweapon.ticksLeft = Math.min(subweapon.ticksLeft, 36)
  }
}

function renderSubweapon(subweapon: SubweaponRuntime, renderer: Renderer, cameraX: number): void {
  const { ctx } = renderer
  if (subweapon.kind === 'stopwatch') return
  const x = subweapon.position.x - cameraX
  const y = subweapon.position.y
  ctx.save()
  ctx.translate(x, y)
  if (subweapon.kind === 'dagger') {
    ctx.rotate(subweapon.facing * 0.1)
    ctx.fillStyle = '#dfe8ff'
    ctx.fillRect(-14, -2, 24, 4)
    ctx.fillStyle = '#b91d2d'
    ctx.fillRect(8, -4, 5, 8)
    ctx.strokeStyle = '#0b0912'
    ctx.lineWidth = 2
    ctx.strokeRect(-14, -2, 24, 4)
  } else if (subweapon.kind === 'axe') {
    ctx.rotate(subweapon.facing * -0.2)
    ctx.fillStyle = '#dfe8ff'
    ctx.fillRect(-3, -12, 6, 18)
    ctx.fillStyle = '#e8d4a0'
    ctx.fillRect(-10, -14, 20, 10)
    ctx.strokeStyle = '#0b0912'
    ctx.lineWidth = 2
    ctx.strokeRect(-3, -12, 6, 18)
  } else if (subweapon.kind === 'cross') {
    ctx.rotate(subweapon.facing * 0.14)
    ctx.fillStyle = '#dfe8ff'
    ctx.fillRect(-3, -12, 6, 24)
    ctx.fillRect(-12, -3, 24, 6)
    ctx.fillStyle = '#e8d4a0'
    ctx.fillRect(-4, -4, 8, 8)
    ctx.strokeStyle = '#0b0912'
    ctx.lineWidth = 2
    ctx.strokeRect(-3, -12, 6, 24)
    ctx.strokeRect(-12, -3, 24, 6)
  } else if (subweapon.kind === 'holyWater') {
    if (subweapon.phase === 'flame') {
      ctx.fillStyle = '#f6b74a'
      ctx.fillRect(-18, -12, 36, 16)
      ctx.fillStyle = '#fff0a8'
      ctx.fillRect(-10, -18, 20, 10)
      ctx.strokeStyle = '#b91d2d'
      ctx.lineWidth = 2
      ctx.strokeRect(-18, -12, 36, 16)
    } else {
      ctx.rotate(subweapon.facing * 0.24)
      ctx.fillStyle = '#8dc2ff'
      ctx.fillRect(-8, -11, 16, 18)
      ctx.fillStyle = '#e8d4a0'
      ctx.fillRect(-4, -16, 8, 5)
      ctx.strokeStyle = '#0b0912'
      ctx.lineWidth = 2
      ctx.strokeRect(-8, -11, 16, 18)
    }
  }
  ctx.restore()
}

function buildCandles(layout: RoomLayout): Candle[] {
  const xs = [layout.checkpointX + 250, layout.checkpointX + 560, layout.doorX - 230]
  return xs
    .filter((x) => x > WALL_MARGIN && x < ROOM_WIDTH - WALL_MARGIN)
    .map((x) => ({ x, y: FLOOR_Y - 38, broken: false }))
}

function candleBox(candle: Candle): Rect {
  // Tall enough to reach up into the whip's arc (which swings at torso height,
  // well above a floor candle) — otherwise the whip sails over and never breaks
  // it. Widened a little so you don't have to be pixel-perfect.
  return { x: candle.x - 13, y: candle.y - 66, width: 26, height: 74 }
}

function pickupBox(pickup: Pickup): Rect {
  return { x: pickup.position.x - 11, y: pickup.position.y - 11, width: 22, height: 22 }
}

function subweaponBox(subweapon: SubweaponRuntime): Rect {
  if (subweapon.kind === 'holyWater' && subweapon.phase === 'flame') {
    return { x: subweapon.position.x - 18, y: subweapon.position.y - 12, width: 36, height: 20 }
  }
  const box = SUBWEAPON_BOX[subweapon.kind]
  return {
    x: subweapon.position.x - box.width / 2,
    y: subweapon.position.y - box.height / 2,
    width: box.width,
    height: box.height,
  }
}

function boneBox(bone: EnemyBone): Rect {
  return { x: bone.position.x - 9, y: bone.position.y - 9, width: 18, height: 18 }
}

function drawBone(bone: EnemyBone, renderer: Renderer, cameraX: number): void {
  const { ctx } = renderer
  if (bone.kind === 'fire') {
    const x = bone.position.x - cameraX
    const y = bone.position.y
    ctx.save()
    const aura = ctx.createRadialGradient(x, y, 0, x, y, 22)
    aura.addColorStop(0, 'rgba(255, 170, 60, 0.7)')
    aura.addColorStop(1, 'rgba(255, 90, 30, 0)')
    ctx.fillStyle = aura
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffd24a'
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ff7a2a'
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    return
  }
  ctx.save()
  ctx.translate(bone.position.x - cameraX, bone.position.y)
  ctx.rotate(bone.spin)
  ctx.strokeStyle = '#0b0912'
  ctx.lineWidth = 1
  if (bone.kind === 'axe') {
    // A spinning throwing axe: wooden haft + steel head.
    ctx.fillStyle = '#7a5230'
    ctx.fillRect(-2, -12, 4, 24) // haft
    ctx.strokeRect(-2, -12, 4, 24)
    ctx.fillStyle = '#c8cdd6'
    ctx.beginPath() // axe head
    ctx.moveTo(2, -12); ctx.lineTo(14, -8); ctx.lineTo(14, 0); ctx.lineTo(2, -2)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.restore()
    return
  }
  ctx.fillStyle = '#e8e2cf'
  ctx.fillRect(-8, -2, 16, 4)
  ctx.strokeRect(-8, -2, 16, 4)
  ctx.fillRect(-11, -5, 6, 10)
  ctx.strokeRect(-11, -5, 6, 10)
  ctx.fillRect(5, -5, 6, 10)
  ctx.strokeRect(5, -5, 6, 10)
  ctx.restore()
}

// Reused offscreen buffer for the GBA downscale so we don't allocate per frame.
let _pixelBuf: HTMLCanvasElement | null = null

/** Downscale the whole canvas to a low resolution, quantize to 15-bit color,
 *  and blit it back nearest-neighbor — a GBA-style crunch of everything drawn
 *  so far. Called after the world and before the HUD so text stays sharp. */
function pixelateWorld(renderer: Renderer): void {
  const { canvas, ctx, width, height } = renderer
  const w = Math.max(1, Math.floor(width / PIXELATE_FACTOR))
  const h = Math.max(1, Math.floor(height / PIXELATE_FACTOR))
  if (!_pixelBuf) _pixelBuf = document.createElement('canvas')
  const buf = _pixelBuf
  if (buf.width !== w || buf.height !== h) {
    buf.width = w
    buf.height = h
  }
  const bctx = buf.getContext('2d', { willReadFrequently: true })
  if (!bctx) return
  bctx.imageSmoothingEnabled = false
  bctx.clearRect(0, 0, w, h)
  bctx.drawImage(canvas, 0, 0, width, height, 0, 0, w, h)
  // Snap each channel to the GBA's 5-bits-per-channel palette for retro banding.
  const img = bctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i]! & 0xf8
    d[i + 1] = d[i + 1]! & 0xf8
    d[i + 2] = d[i + 2]! & 0xf8
  }
  bctx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(buf, 0, 0, w, h, 0, 0, width, height)
}

function soulBoltBox(bolt: SoulBolt): Rect {
  return { x: bolt.position.x - 16, y: bolt.position.y - 16, width: 32, height: 32 }
}

function drawSoulBolt(bolt: SoulBolt, renderer: Renderer, cameraX: number): void {
  const { ctx } = renderer
  const x = bolt.position.x - cameraX
  const y = bolt.position.y
  const fade = clamp(bolt.ticksLeft / 12, 0, 1)
  if (bolt.arc) { drawSoulSpear(bolt, ctx, x, y, fade); return }
  ctx.save()
  // Soft outer aura.
  const aura = ctx.createRadialGradient(x, y, 0, x, y, 22)
  aura.addColorStop(0, `rgba(120, 200, 255, ${0.5 * fade})`)
  aura.addColorStop(1, 'rgba(120, 200, 255, 0)')
  ctx.fillStyle = aura
  ctx.beginPath()
  ctx.arc(x, y, 22, 0, Math.PI * 2)
  ctx.fill()
  // Spinning four-point core.
  ctx.translate(x, y)
  ctx.rotate(bolt.spin)
  ctx.globalAlpha = fade
  ctx.fillStyle = '#eaf6ff'
  ctx.strokeStyle = '#3aa0e0'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 8; i += 1) {
    const r = i % 2 === 0 ? 11 : 5
    const a = (i / 8) * Math.PI * 2
    const px = Math.cos(a) * r
    const py = Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** The default soul: a spirit spear that points along its arcing flight path. */
function drawSoulSpear(bolt: SoulBolt, ctx: CanvasRenderingContext2D, x: number, y: number, fade: number): void {
  const angle = Math.atan2(bolt.velocity.y, bolt.velocity.x)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = fade
  // Trailing glow behind the head.
  const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, 26)
  aura.addColorStop(0, `rgba(120, 200, 255, ${0.45 * fade})`)
  aura.addColorStop(1, 'rgba(120, 200, 255, 0)')
  ctx.fillStyle = aura
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill()
  // Shaft.
  ctx.strokeStyle = '#bfe6ff'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(9, 0); ctx.stroke()
  // Spearhead.
  ctx.fillStyle = '#eaf6ff'
  ctx.strokeStyle = '#3aa0e0'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(22, 0); ctx.lineTo(8, -6); ctx.lineTo(11, 0); ctx.lineTo(8, 6)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.restore()
}

function drawExit(ctx: CanvasRenderingContext2D, edgeX: number, floorY: number, side: 'w' | 'e', sealed = false): void {
  const w = 90, h = 172
  const x = side === 'w' ? edgeX : edgeX - w
  const top = floorY - h
  ctx.save()
  // Dark passage into the next room, with a faint warm light spilling from it.
  ctx.fillStyle = '#070510'
  ctx.fillRect(x, top, w, h)
  const glow = sealed ? 'rgba(150,60,180,0.30)' : 'rgba(120,96,56,0.32)'
  const grad = ctx.createLinearGradient(side === 'w' ? x : x + w, 0, side === 'w' ? x + w : x, 0)
  grad.addColorStop(0, glow)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(x, top, w, h)
  // Stone frame: lintel + an inner pillar so it reads as a doorway.
  ctx.fillStyle = '#3a3352'
  ctx.fillRect(x - 4, top - 12, w + 8, 12)
  const pw = 12
  const px = side === 'w' ? x + w - pw : x
  ctx.fillRect(px, top - 4, pw, h + 4)
  // A sealed door gets glowing magic bars across it.
  if (sealed) {
    ctx.strokeStyle = '#c86adc'
    ctx.lineWidth = 4
    for (let i = 1; i <= 4; i++) {
      const gy = top + (h * i) / 5
      ctx.beginPath(); ctx.moveTo(x + 4, gy); ctx.lineTo(x + w - 4, gy); ctx.stroke()
    }
    ctx.fillStyle = '#e0a0ff'
    ctx.beginPath(); ctx.arc(x + w / 2, top + h / 2, 8, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function drawMapItemPickup(ctx: CanvasRenderingContext2D, x: number, floorY: number, blink: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(blink * 0.1)
  const cy = floorY - 66 - pulse * 5
  ctx.save()
  const g = ctx.createRadialGradient(x, cy, 0, x, cy, 34)
  g.addColorStop(0, `rgba(122, 214, 122, ${0.35 + 0.25 * pulse})`)
  g.addColorStop(1, 'rgba(122, 214, 122, 0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, cy, 34, 0, Math.PI * 2); ctx.fill()
  // A rolled parchment map.
  ctx.fillStyle = '#e6dcb8'
  ctx.fillRect(x - 12, cy - 9, 24, 18)
  ctx.fillStyle = '#c9bd90'
  ctx.fillRect(x - 14, cy - 11, 4, 22) // left roll
  ctx.fillRect(x + 10, cy - 11, 4, 22) // right roll
  ctx.strokeStyle = '#7a8a5a'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x - 8, cy - 3); ctx.lineTo(x + 6, cy - 3); ctx.moveTo(x - 6, cy + 2); ctx.lineTo(x + 4, cy + 2); ctx.stroke()
  ctx.restore()
}

function drawLifeUpPickup(ctx: CanvasRenderingContext2D, x: number, centerY: number, blink: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(blink * 0.12)
  const cy = centerY - pulse * 5
  ctx.save()
  const g = ctx.createRadialGradient(x, cy, 0, x, cy, 34)
  g.addColorStop(0, `rgba(255, 122, 154, ${0.4 + 0.3 * pulse})`)
  g.addColorStop(1, 'rgba(255, 122, 154, 0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, cy, 34, 0, Math.PI * 2); ctx.fill()
  // A pixel heart.
  ctx.fillStyle = '#ff5a7a'
  ctx.fillRect(x - 10, cy - 8, 8, 8); ctx.fillRect(x + 2, cy - 8, 8, 8)
  ctx.fillRect(x - 12, cy - 4, 24, 8)
  ctx.fillRect(x - 8, cy + 4, 16, 5); ctx.fillRect(x - 4, cy + 9, 8, 4)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillRect(x - 8, cy - 6, 3, 3) // glint
  ctx.restore()
}

function drawAbilityOrb(ctx: CanvasRenderingContext2D, x: number, floorY: number, blink: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(blink * 0.1)
  const cy = floorY - 70 - pulse * 6 // gentle float
  ctx.save()
  const g = ctx.createRadialGradient(x, cy, 0, x, cy, 40)
  g.addColorStop(0, `rgba(246,183,74,${0.4 + 0.3 * pulse})`)
  g.addColorStop(1, 'rgba(246,183,74,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, cy, 40, 0, Math.PI * 2); ctx.fill()
  // Spinning relic star.
  ctx.translate(x, cy)
  ctx.rotate(blink * 0.05)
  ctx.fillStyle = '#fff2cc'; ctx.strokeStyle = '#f6b74a'; ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 13 : 6
    const a = (i / 8) * Math.PI * 2
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.restore()
}

/** Draw a treasure chest — closed and glinting, or open and empty once looted. */
function drawChest(ctx: CanvasRenderingContext2D, x: number, floorY: number, opened: boolean, blink: number): void {
  const w = 46
  const bodyH = 28
  const top = floorY - bodyH
  ctx.save()
  // Body.
  ctx.fillStyle = '#5a3c1e'
  ctx.fillRect(x - w / 2, top, w, bodyH)
  ctx.fillStyle = '#3c2712'
  ctx.fillRect(x - w / 2, top + bodyH - 5, w, 5)
  // Iron bands + lock.
  ctx.fillStyle = '#caa24a'
  ctx.fillRect(x - w / 2, top + 8, w, 3)
  if (opened) {
    // Lid swung open, empty interior.
    ctx.fillStyle = '#241608'
    ctx.fillRect(x - w / 2 + 3, top - 1, w - 6, 8)
    ctx.fillStyle = '#5a3c1e'
    ctx.fillRect(x - w / 2 - 2, top - 16, w + 4, 8) // raised lid
    ctx.fillStyle = '#caa24a'
    ctx.fillRect(x - w / 2 - 2, top - 16, w + 4, 3)
  } else {
    // Domed lid + a soft glint.
    ctx.fillStyle = '#6a4824'
    ctx.fillRect(x - w / 2, top - 12, w, 12)
    ctx.fillStyle = '#caa24a'
    ctx.fillRect(x - w / 2, top - 12, w, 3)
    ctx.fillStyle = '#e8c96a'
    ctx.fillRect(x - 4, top - 2, 8, 10) // lock plate
    const glint = 0.4 + 0.6 * Math.abs(Math.sin(blink * 0.08))
    ctx.fillStyle = `rgba(255, 240, 190, ${glint})`
    ctx.fillRect(x - 2, top + 1, 2, 5)
  }
  ctx.restore()
}

/** Draw a low tunnel: a hanging block of masonry with a slide-through gap at the
 *  floor. A standing player is blocked; only a slide fits under. */
function drawLowBarrier(ctx: CanvasRenderingContext2D, bar: Barrier): void {
  const topY = 150
  const bottomY = FLOOR_Y - CRAWL_GAP
  ctx.save()
  ctx.fillStyle = '#241d30'
  ctx.fillRect(bar.x, topY, bar.width, bottomY - topY)
  // Blocky stones + a lit lower lip so the gap reads clearly.
  ctx.fillStyle = '#39304e'
  for (let y = topY; y < bottomY - 8; y += 26) {
    for (let x = bar.x + 2; x < bar.x + bar.width - 2; x += 30) ctx.fillRect(x, y + 2, 26, 22)
  }
  ctx.fillStyle = '#6a5a86'
  ctx.fillRect(bar.x - 3, bottomY - 8, bar.width + 6, 8)
  ctx.restore()
}

/** Draw a diagonal staircase as stepped stone columns down to the floor. */
function drawStair(ctx: CanvasRenderingContext2D, stair: Stair): void {
  ctx.save()
  for (let i = 0; i < stair.steps; i++) {
    const topY = stair.y - stair.rise * (i + 1)
    const sx = stair.dir === 1 ? stair.x + i * stair.run : stair.x - (i + 1) * stair.run
    ctx.fillStyle = '#2a2238'
    ctx.fillRect(sx, topY, stair.run, stair.y - topY) // column down to the base
    ctx.fillStyle = '#5a567a'
    ctx.fillRect(sx, topY, stair.run, 4) // lit tread edge
  }
  ctx.restore()
}

function drawVertPassage(ctx: CanvasRenderingContext2D, x: number, floorY: number, roomTop: number, roomWidth: number, up: boolean, down: boolean, blink: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(blink * 0.1)
  ctx.save()
  if (up) {
    // A framed stone door set into the room's top wall — climb up and cross it.
    const half = DOORWAY_HALF
    const bandY = roomTop + 132, bandH = 16    // top-wall band, broken by the door
    const top = bandY, base = roomTop + 162    // door opening at the top edge
    // Masonry top wall either side of the door, with a lit lower lip.
    ctx.fillStyle = '#2c2440'
    ctx.fillRect(0, bandY, x - half - 10, bandH)
    ctx.fillRect(x + half + 10, bandY, roomWidth - (x + half + 10), bandH)
    ctx.fillStyle = '#4a4568'
    ctx.fillRect(0, bandY + bandH - 3, x - half - 10, 3)
    ctx.fillRect(x + half + 10, bandY + bandH - 3, roomWidth - (x + half + 10), 3)
    // Dark opening with a warm glow spilling out.
    ctx.fillStyle = '#05040c'
    ctx.fillRect(x - half, top, half * 2, base - top)
    const g = ctx.createLinearGradient(0, base, 0, top)
    g.addColorStop(0, `rgba(240,200,130,${0.34 + 0.16 * pulse})`)
    g.addColorStop(1, 'rgba(240,200,130,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - half, top, half * 2, base - top)
    // Stone frame: bright pillars, a lintel across the top, and a threshold slab.
    ctx.fillStyle = '#6a628c'
    ctx.fillRect(x - half - 10, top, 10, base - top)      // left pillar
    ctx.fillRect(x + half, top, 10, base - top)           // right pillar
    ctx.fillRect(x - half - 10, top, half * 2 + 20, 8)    // lintel
    ctx.fillStyle = '#4a4568'
    ctx.fillRect(x - half - 10, base, half * 2 + 20, 8)   // threshold slab
    // Keystone notch at the centre of the lintel.
    ctx.fillStyle = '#8a82ac'
    ctx.fillRect(x - 7, top, 14, 12)
  }
  if (down) {
    // An open shaft in the floor — the thin cover platform draws with the others;
    // here we add the dark hole below it and a downward hint.
    const half = FLOOR_GAP_HALF
    ctx.fillStyle = '#05040c'
    ctx.fillRect(x - half, floorY, half * 2, 60)
    ctx.fillStyle = '#4a4568'
    ctx.fillRect(x - half - 6, floorY - 6, 6, 18) // broken floor lips
    ctx.fillRect(x + half, floorY - 6, 6, 18)
    ctx.strokeStyle = `rgba(232,212,160,${0.3 + 0.4 * pulse})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x - 9, floorY + 18); ctx.lineTo(x, floorY + 27); ctx.lineTo(x + 9, floorY + 18)
    ctx.stroke()
  }
  ctx.restore()
}

function drawMerchant(ctx: CanvasRenderingContext2D, x: number, floorY: number, blink: number): void {
  ctx.save()
  // A hooded merchant behind a small stall.
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 34, floorY - 34, 68, 34)          // stall body
  ctx.fillStyle = '#5a4326'; ctx.fillRect(x - 40, floorY - 40, 80, 8)           // counter
  ctx.fillStyle = '#f6b74a'; ctx.fillRect(x - 30, floorY - 30, 8, 8); ctx.fillRect(x + 6, floorY - 26, 6, 6) // wares (coins/gems)
  ctx.fillStyle = '#7ad6ff'; ctx.fillRect(x - 12, floorY - 28, 6, 6)
  // hooded figure behind the counter
  ctx.fillStyle = '#2a2238'; ctx.fillRect(x - 12, floorY - 74, 24, 40)          // cloak
  ctx.fillStyle = '#1a1420'; ctx.beginPath(); ctx.arc(x, floorY - 74, 12, Math.PI, 0); ctx.fill() // hood
  ctx.fillStyle = '#b7913f'; ctx.beginPath(); ctx.arc(x, floorY - 68, 5, 0, Math.PI * 2); ctx.fill() // face glow
  const pulse = 0.5 + 0.5 * Math.sin(blink * 0.09)
  ctx.fillStyle = `rgba(246,183,74,${0.5 + 0.5 * pulse})`
  ctx.font = '9px "Press Start 2P", monospace'; ctx.textAlign = 'center'
  ctx.fillText('W: SHOP', x, floorY - 92)
  ctx.restore()
}

function drawSavePoint(ctx: CanvasRenderingContext2D, x: number, floorY: number, blink: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(blink * 0.08)
  const cy = floorY - 62
  ctx.save()
  const g = ctx.createRadialGradient(x, cy, 0, x, cy, 64)
  g.addColorStop(0, `rgba(90,180,255,${0.26 + 0.18 * pulse})`)
  g.addColorStop(1, 'rgba(90,180,255,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, cy, 64, 0, Math.PI * 2); ctx.fill()
  // pedestal + floating crystal
  ctx.fillStyle = '#2a2238'; ctx.fillRect(x - 16, floorY - 16, 32, 16)
  ctx.fillStyle = '#5a567a'; ctx.fillRect(x - 18, floorY - 18, 36, 4)
  ctx.fillStyle = '#8fd4ff'; ctx.strokeStyle = '#eaf6ff'; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, cy - 18); ctx.lineTo(x + 12, cy); ctx.lineTo(x, cy + 18); ctx.lineTo(x - 12, cy); ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.fillStyle = `rgba(143,212,255,${0.5 + 0.5 * pulse})`
  ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center'
  ctx.fillText('W: SAVE', x, cy - 34)
  ctx.restore()
}

/** A violet teleport gate: pedestal + slowly-turning portal rings. */
function drawWarpPad(ctx: CanvasRenderingContext2D, x: number, floorY: number, blink: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(blink * 0.08)
  const spin = blink * 0.05
  const cy = floorY - 62
  ctx.save()
  const g = ctx.createRadialGradient(x, cy, 0, x, cy, 64)
  g.addColorStop(0, `rgba(200,106,220,${0.26 + 0.18 * pulse})`)
  g.addColorStop(1, 'rgba(200,106,220,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, cy, 64, 0, Math.PI * 2); ctx.fill()
  // pedestal
  ctx.fillStyle = '#2a2238'; ctx.fillRect(x - 16, floorY - 16, 32, 16)
  ctx.fillStyle = '#5a567a'; ctx.fillRect(x - 18, floorY - 18, 36, 4)
  // two counter-rotating portal rings
  ctx.strokeStyle = '#e6b4f2'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.ellipse(x, cy, 16, 22, spin, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = `rgba(200,106,220,${0.55 + 0.45 * pulse})`
  ctx.beginPath(); ctx.ellipse(x, cy, 16, 22, -spin, 0, Math.PI * 2); ctx.stroke()
  // inner glow core
  ctx.fillStyle = `rgba(230,180,242,${0.35 + 0.3 * pulse})`
  ctx.beginPath(); ctx.arc(x, cy, 7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = `rgba(200,106,220,${0.5 + 0.5 * pulse})`
  ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center'
  ctx.fillText('W: WARP', x, cy - 34)
  ctx.restore()
}

function drawSpikes(ctx: CanvasRenderingContext2D, hazard: Hazard): void {
  const count = Math.max(2, Math.floor(hazard.width / 16))
  const width = hazard.width / count
  ctx.save()
  ctx.fillStyle = '#3a3550'
  ctx.fillRect(hazard.x, hazard.y + hazard.height - 5, hazard.width, 5)
  ctx.fillStyle = '#c9ccd6'
  ctx.strokeStyle = '#0b0912'
  ctx.lineWidth = 1
  for (let i = 0; i < count; i += 1) {
    const x = hazard.x + i * width
    ctx.beginPath()
    ctx.moveTo(x, hazard.y + hazard.height)
    ctx.lineTo(x + width / 2, hazard.y)
    ctx.lineTo(x + width, hazard.y + hazard.height)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

function drawCandle(ctx: CanvasRenderingContext2D, candle: Candle): void {
  if (candle.broken) return
  ctx.save()
  ctx.fillStyle = '#f2e6bf'
  ctx.fillRect(candle.x - 6, candle.y - 22, 12, 22)
  ctx.fillStyle = '#b91d2d'
  ctx.fillRect(candle.x - 7, candle.y - 5, 14, 5)
  ctx.fillStyle = '#f6b74a'
  ctx.fillRect(candle.x - 3, candle.y - 30, 6, 8)
  ctx.fillStyle = '#fff0a8'
  ctx.fillRect(candle.x - 1, candle.y - 34, 2, 5)
  ctx.restore()
}

function drawPickup(ctx: CanvasRenderingContext2D, pickup: Pickup): void {
  const { x, y } = pickup.position
  // Blink out over the final second so the player knows it is about to vanish.
  const blinkOut = pickup.ticksLeft < 60 && Math.floor(pickup.ticksLeft / 5) % 2 === 0
  if (blinkOut) return
  ctx.save()
  if (pickup.kind === 'heart') {
    ctx.fillStyle = '#b91d2d'
    ctx.fillRect(x - 5, y - 7, 10, 12)
    ctx.fillRect(x - 8, y - 4, 16, 7)
    ctx.fillStyle = '#ff9f9f'
    ctx.fillRect(x - 2, y - 5, 3, 3)
  } else if (pickup.kind === 'gold') {
    // Little coin: gold disc with a highlight.
    ctx.fillStyle = '#8a5a12'
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f6b74a'
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffe6a8'
    ctx.fillRect(x - 3, y - 4, 2, 5)
  } else {
    // MP orb: glowing cyan bead with an aura.
    const aura = ctx.createRadialGradient(x, y, 0, x, y, 12)
    aura.addColorStop(0, 'rgba(90, 200, 255, 0.7)')
    aura.addColorStop(1, 'rgba(90, 200, 255, 0)')
    ctx.fillStyle = aura
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d6f2ff'
    ctx.strokeStyle = '#3aa0e0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/** Surface y of a staircase at world-x `px`, or null if `px` is off the stair.
 *  The surface is a smooth ramp between the low and high ends. */
function stairSurfaceY(stair: Stair, px: number): number | null {
  const span = stair.steps * stair.run
  const lowX = stair.dir === 1 ? stair.x : stair.x - span
  const highX = stair.dir === 1 ? stair.x + span : stair.x
  if (px < lowX || px > highX) return null
  const along = stair.dir === 1 ? px - stair.x : stair.x - px // 0..span
  const t = Math.max(0, Math.min(1, along / span))
  return stair.y - stair.rise * stair.steps * t
}

/** Rooms with an up-door get a climb to the top doorway: a walkable diagonal
 *  staircase up one side, plus staggered jump-ledges up the other, meeting at a
 *  ledge under the doorway. Climb past the top edge (either route) to exit up. */
/** Grow a room beyond one screen and fill the extra space so it stays explorable.
 *  The floor stays at FLOOR_Y; width extends right, a negative top extends up. */
function enlargeRoom(layout: RoomLayout, big: { width: number; top: number } | undefined): void {
  if (!big) return
  layout.width = big.width
  layout.top = big.top
  // Stretch the base floor across the whole width.
  const floor = layout.platforms.find((p) => p.y === FLOOR_Y && p.x <= 0)
  if (floor) floor.width = big.width
  // Platforms across the extra width (beyond the original screen-and-a-half).
  for (let x = ROOM_WIDTH - 120; x < big.width - 220; x += 340) {
    layout.platforms.push({ x, y: FLOOR_Y - 118, width: 210, height: 12 })
    layout.platforms.push({ x: x + 170, y: FLOOR_Y - 250, width: 180, height: 12, crumble: (x / 340) % 2 < 1 })
  }
  // Platforms up the extra height (kept off-centre so they don't foul the shaft).
  if (big.top < 0) {
    let s = 1
    for (let y = FLOOR_Y - 170; y > big.top + 130; y -= 128) {
      layout.platforms.push({ x: s > 0 ? 1080 : 1420, y, width: 220, height: 12 })
      s = -s
    }
  }
}

function addVerticalPassages(layout: RoomLayout, doors: Record<MapDir, boolean>): void {
  const px = VERT_PASSAGE_X
  if (doors.n) {
    // Climb to the top door. The doorstep sits at the room's top edge, so in a
    // tall room the shaft is correspondingly taller — the staircase and the
    // zig-zag jump-ledges both scale to reach it.
    // Stairs removed for now — climb the zig-zag jump-ledges to the top door.
    const doorstepY = layout.top + 150
    let side = 1
    for (let y = FLOOR_Y - 78; y > doorstepY + 40; y -= 76) {
      layout.platforms.push({ x: px + (side > 0 ? 40 : -190), y, width: 150, height: 12 })
      side = -side
    }
    layout.platforms.push({ x: px - 74, y: doorstepY, width: 148, height: 12 }) // doorstep
  }
  if (doors.s) {
    // Open a drop-through shaft in the floor: solid floor either side, and a
    // one-way platform over the gap (hold Down to fall through to the room below).
    const gapL = px - FLOOR_GAP_HALF
    const gapW = FLOOR_GAP_HALF * 2
    const floor = layout.platforms.find((p) => p.y === FLOOR_Y && p.x <= 0 && p.x + p.width >= layout.width)
    if (floor) {
      floor.width = gapL - floor.x
      layout.platforms.push(
        { x: gapL + gapW, y: FLOOR_Y, width: layout.width - (gapL + gapW), height: 22 },
        { x: gapL, y: FLOOR_Y, width: gapW, height: 22, dropThrough: true },
      )
    }
    layout.floorGap = { x: gapL, width: gapW }
  }
}

function buildLayout(stage: string): RoomLayout {
  const base = { width: ROOM_WIDTH, top: 0, doorX: ROOM_WIDTH - 128, doorY: FLOOR_Y, checkpointX: 120, checkpointY: FLOOR_Y, stairs: [] as Stair[], barriers: [] as Barrier[], floorGap: null as { x: number; width: number } | null, water: null as { x: number; width: number; surfaceY: number } | null }
  switch (stage) {
    case 'outer_wall':
      // Stairs removed for now — flat floor with a few one-way ledges.
      return {
        ...base,
        backdrop: '#111221',
        doorX: ROOM_WIDTH - 132,
        platforms: [
          { x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 },
          { x: 300, y: FLOOR_Y - 96, width: 220, height: 12 },
          { x: 700, y: FLOOR_Y - 150, width: 220, height: 12 },
          { x: 1120, y: FLOOR_Y - 96, width: 260, height: 12 },
        ],
        hazards: [],
      }
    case 'cathedral':
      return { ...base, backdrop: '#100b16', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 220, y: 364, width: 220, height: 12 }, { x: 560, y: 302, width: 240, height: 12 }, { x: 990, y: 344, width: 220, height: 12 }], hazards: [] }
    case 'library':
      return { ...base, backdrop: '#08121e', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 180, y: 382, width: 160, height: 12 }, { x: 420, y: 320, width: 180, height: 12 }, { x: 680, y: 262, width: 220, height: 12, crumble: true }, { x: 980, y: 324, width: 220, height: 12 }, { x: 1290, y: 284, width: 180, height: 12 }], hazards: [] }
    case 'clock_tower':
      return { ...base, backdrop: '#1a120b', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 160, y: 404, width: 170, height: 12 }, { x: 390, y: 350, width: 160, height: 12, crumble: true }, { x: 640, y: 292, width: 160, height: 12 }, { x: 890, y: 238, width: 160, height: 12, crumble: true }, { x: 1140, y: 304, width: 170, height: 12 }, { x: 1380, y: 246, width: 170, height: 12, crumble: true }], hazards: [] }
    case 'catacombs':
      // The Underground Reservoir. Water bodies are attached per-room (WATER_ROOMS)
      // so the boss room stays dry.
      return { ...base, backdrop: '#081018', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 150, y: 384, width: 170, height: 12 }, { x: 1560, y: 384, width: 200, height: 12 }], hazards: [] }
    case 'throne_room':
      return { ...base, backdrop: '#13080c', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 360, y: 340, width: 200, height: 12 }, { x: 980, y: 340, width: 200, height: 12 }], hazards: [] }
    default:
      return { ...base, backdrop: '#0e0f18', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 240, y: 382, width: 180, height: 12 }, { x: 520, y: 320, width: 200, height: 12 }, { x: 860, y: 372, width: 220, height: 12 }, { x: 1230, y: 300, width: 160, height: 12 }], hazards: [] }
  }
}

function hazardBox(hazard: Hazard): Rect {
  return { x: hazard.x, y: hazard.y, width: hazard.width, height: hazard.height }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, stage: string, width: number, top: number, castleGate = false): void {
  ctx.save()
  ctx.fillStyle = backdropColor(stage)
  ctx.fillRect(0, top, width, ROOM_HEIGHT - top)
  ctx.fillStyle = 'rgba(8, 6, 14, 0.58)'
  ctx.fillRect(0, 364, width, 212)
  ctx.fillStyle = 'rgba(20, 18, 31, 0.82)'
  ctx.fillRect(0, 220, width, 14)
  // Buttress columns + lit windows tiled across the whole width.
  for (let bx = 160; bx < width - 120; bx += 300) {
    ctx.fillStyle = 'rgba(20, 18, 31, 0.82)'
    ctx.fillRect(bx, 120, 112, 220)
    ctx.fillStyle = 'rgba(232, 212, 160, 0.08)'
    ctx.fillRect(bx + 80, 156, 22, 112)
  }
  if (stage === 'throne_room') {
    ctx.fillStyle = 'rgba(185, 29, 43, 0.12)'
    ctx.fillRect(0, top, width, ROOM_HEIGHT - top)
  }
  if (castleGate) drawCastleGateBackdrop(ctx)
  ctx.restore()
}

function drawCastleGateBackdrop(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.translate(-480, 0)
  ctx.fillStyle = 'rgba(5, 4, 10, 0.74)'
  ctx.fillRect(1020, 92, 430, 304)
  ctx.fillRect(940, 154, 74, 242)
  ctx.fillRect(1456, 154, 74, 242)
  ctx.fillStyle = 'rgba(185, 29, 43, 0.16)'
  ctx.fillRect(1102, 140, 266, 220)
  ctx.fillStyle = '#090710'
  ctx.fillRect(1134, 190, 202, 206)
  ctx.fillStyle = 'rgba(232, 212, 160, 0.12)'
  ctx.fillRect(1162, 218, 18, 96)
  ctx.fillRect(1290, 218, 18, 96)
  ctx.fillStyle = 'rgba(232, 212, 160, 0.18)'
  ctx.fillRect(1208, 150, 54, 14)
  ctx.fillRect(1228, 116, 14, 72)
  ctx.fillStyle = 'rgba(185, 29, 43, 0.2)'
  ctx.beginPath()
  ctx.arc(1235, 178, 98, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#05040a'
  ctx.beginPath()
  ctx.moveTo(1014, 92)
  ctx.lineTo(1235, 18)
  ctx.lineTo(1456, 92)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(958, 112, 38, 68)
  ctx.fillRect(1474, 112, 38, 68)
  ctx.restore()
}

function backdropColor(stage: string): string {
  if (stage === 'outer_wall') return '#111221'
  if (stage === 'cathedral') return '#1a0c18'
  if (stage === 'library') return '#08142a'
  if (stage === 'clock_tower') return '#1c1208'
  if (stage === 'catacombs') return '#071018'
  if (stage === 'throne_room') return '#16050d'
  return '#0c0f1a'
}

function spread(start: number, end: number, count: number): number[] {
  if (count <= 1) return [end]
  const step = (end - start) / Math.max(1, count - 1)
  return Array.from({ length: count }, (_unused, i) => Math.round(start + i * step))
}


function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = Number.POSITIVE_INFINITY,
): void {
  const words = text.split(' ')
  let line = ''
  let offsetY = 0
  let linesDrawn = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      if (linesDrawn >= maxLines - 1) {
        ctx.fillText(fitLine(ctx, `${line}...`, maxWidth), x, y + offsetY)
        return
      }
      ctx.fillText(line, x, y + offsetY)
      linesDrawn += 1
      line = word
      offsetY += lineHeight
    } else {
      line = test
    }
  }
  if (line && linesDrawn < maxLines) ctx.fillText(line, x, y + offsetY)
}

function fitLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  const ellipsis = '...'
  let end = Math.max(0, text.length - ellipsis.length)
  while (end > 0 && ctx.measureText(`${text.slice(0, end).trimEnd()}${ellipsis}`).width > maxWidth) end -= 1
  return `${text.slice(0, end).trimEnd()}${ellipsis}`
}
