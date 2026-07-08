import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { PauseScene } from './PauseScene.ts'
import { AssetManager } from '../assets/AssetManager.ts'
import { AUDIO_MANIFEST } from '../assets/manifest.ts'
import { addCampaignAbility, addCampaignBulletSoul, addCampaignEquipment, addCampaignPerk, addCampaignRelic, addCampaignSoul, equipCampaignBulletSoul, equipCampaignItem, equippedDefs, getCampaignChapter, getCampaignNode, grantCampaignRewards, loadCampaignSave, markCampaignVisited, MAX_LEVEL, saveCampaignSave, unequipCampaignSlot, xpForNextLevel } from '../data/campaign.ts'
import { draftPowerUps, powerUpStacks, type PowerUpDef } from '../data/powerups.ts'
import { BASE_BULLET_SOUL, bulletSoulForEnemy, getBulletSoul, type BulletSoulDef } from '../data/bulletSouls.ts'
import { CASTLE_CELLS, CASTLE_ROOM_IDS, castleDoors, castleGridBounds, castleNeighbor, isBossRoom, type MapDir } from '../data/castleMap.ts'
import { buildEquipmentModifiers, EQUIP_SLOT_LABELS, EQUIP_SLOTS, equipmentForSlot, EQUIPMENT_POOL, getEquipment, type EquipmentDef, type EquipmentModifiers } from '../data/equipment.ts'
import { buildRunModifiers, RELIC_POOL, type RelicDef, type RelicId, type RunModifiers } from '../data/relics.ts'
import { buildSoulModifiers, getSoul, soulForEnemy, SOUL_POOL, type SoulDef, type SoulModifiers } from '../data/souls.ts'
import { juliusBelmont as CAMPAIGN_HERO } from '../data/characters/castlevaniaCampaign.ts'
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
import { Animator, drawSprite, makeSheet, type SpriteSheet } from '../render/SpriteRenderer.ts'
import { computeHitbox, isActiveAt, totalFrames, type AttackMove } from '../combat/AttackMove.ts'

const ROOM_WIDTH = 1680
// How close to a room edge counts as "walking through the doorway".
const EDGE_ZONE = 14
// Vertical stairwell passage: centered, activated from the floor with up/down.
const VERT_PASSAGE_X = ROOM_WIDTH / 2
const VERT_RANGE = 120
// Save rooms: safe (no enemies spawn) rooms with a save crystal, keyed to its
// x-position. The save point heals the player and writes the save.
const SAVE_POINTS: Record<string, number> = {
  'cor-entrance': 520,
  'std-reading': 840,
  'top-antechamber': 840,
}
const SAVE_RANGE = 72
// Rooms with a wandering merchant, keyed to its x-position. Approach + up opens
// the shop. Kept clear of the central stairwell so the up-press doesn't clash.
const MERCHANT_ROOMS: Record<string, number> = { 'cor-entrance': 1180 }
const MERCHANT_RANGE = 80
// Beating this room's boss completes the campaign.
const FINAL_BOSS_NODE = 'fbd-chaos'
// Navigable pause menu entries (GBA-style).
const MENU_ITEMS = ['STATUS', 'EQUIP', 'MAP', 'RESUME'] as const
// Metroidvania traversal abilities.
const ABILITIES: Record<string, { name: string; blurb: string }> = {
  'double-jump': { name: 'Leap Stone', blurb: 'Jump a second time in mid-air, and pass doors sealed against the earthbound.' },
}
// Rooms that hold an ability relic, keyed to its x-position and the ability id.
// Double jump is granted right at the start.
const ABILITY_PICKUPS: Record<string, { x: number; ability: string }> = {
  'cor-entrance': { x: 320, ability: 'double-jump' },
}
// Doors sealed until an ability is owned: nodeId -> direction -> required ability.
// (None while double jump is a starting relic; the system stays for later abilities.)
const SEALED_DOORS: Record<string, Partial<Record<MapDir, string>>> = {}
const ROOM_HEIGHT = 576
const FLOOR_Y = 492
const GRAVITY = 0.78
const WALK_SPEED = 3.4
const AIR_SPEED = 3.0
const ATTACK_DRIFT_SPEED = 1.6
const DASH_SPEED = 12
const DASH_TICKS = 10
const DASH_COOLDOWN_TICKS = 28
const JUMP_VELOCITY = -15.5
const FAST_FALL_SPEED = 12
const WALL_MARGIN = 48
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
const DEATH_HOLD_TICKS = 44 // let the death animation play, then fade the corpse
const DEATH_FADE_TICKS = 22
const DEFEAT_RETRY_TICKS = 120
const BOSS_INTRO_TICKS = 120 // cinematic name-reveal pause when a boss room starts
// Global shrink applied uniformly to every campaign actor's on-screen size and
// hit target (Julius, enemies, and bosses) for a tighter classic-Castlevania read.
// Feet stay planted because anchorY is scaled at draw time; attack reach is data
// (absolute px) so it is intentionally left untouched.
const ACTOR_SCALE = 0.8
const STARTING_HEARTS = 10
const MAX_HEARTS = 99
const SUBWEAPON_ORDER = ['dagger', 'axe', 'cross', 'holyWater', 'stopwatch'] as const
type SubweaponKind = (typeof SUBWEAPON_ORDER)[number]
const SUBWEAPON_LABELS: Record<SubweaponKind, string> = {
  dagger: 'DAGGER',
  axe: 'AXE',
  cross: 'CROSS',
  holyWater: 'HOLY WATER',
  stopwatch: 'STOPWATCH',
}
const SUBWEAPON_COSTS: Record<SubweaponKind, number> = {
  dagger: 1,
  axe: 1,
  cross: 1,
  holyWater: 1,
  stopwatch: 5,
}
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

const RELIC_PIP_COLORS: Record<RelicId, string> = {
  vitality: '#b91d2d',
  fury: '#f6b74a',
  focus: '#8dc2ff',
  quickstep: '#7ad67a',
  catalyst: '#d67ad6',
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
}

interface Hazard {
  x: number
  y: number
  width: number
  height: number
}

interface RoomLayout {
  platforms: Platform[]
  hazards: Hazard[]
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

interface EnemyBone {
  position: Vec2
  velocity: Vec2
  spin: number
  ticksLeft: number
  hasHit: boolean
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
  hitTargets: Set<CastleActor>
}

const MP_REGEN = 0.18
const SOUL_SPEED = 13
const SOUL_LIFETIME = 66
const SOUL_HOMING_LIFETIME = 100
const SOUL_HIT_LIMIT = 3
const SOUL_CAST_COOLDOWN = 22

const BONE_DAMAGE = 8
const BONE_SPEED = 8
const BONE_GRAVITY = 0.2

// XP and gold granted when each enemy type is defeated. Bosses use a fixed
// bounty (see campaignEnemyReward) rather than this table.
const ENEMY_REWARD: Record<string, { xp: number; gold: number }> = {
  skeleton: { xp: 6, gold: 4 },
  zombie: { xp: 5, gold: 3 },
  ghoul: { xp: 4, gold: 2 },
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
  private pendingRangedShot: { x: number; y: number; facing: Facing } | null = null
  grounded = true
  facing: Facing
  state: 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'dash' | 'hurt' | 'death' = 'idle'
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
  private dashTicks = 0
  private dashCooldown = 0

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

  /** True once the death animation and fade have fully played out. */
  get isGone(): boolean {
    return this.state === 'death' && this.deathTicks >= DEATH_HOLD_TICKS + DEATH_FADE_TICKS
  }

  get currentMove(): AttackMove | null {
    return this.attackMove
  }

  get isAttacking(): boolean {
    return this.state === 'attack'
  }

  get canBeHit(): boolean {
    return this.state !== 'death' && this.invulnerableTicks <= 0
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

    if (this.tryStartAttack(intent)) {
      this.updateAttack(intent, platforms)
      this.updateAnimator()
      return
    }

    this.updateLocomotion(intent, opponentX, platforms)
    this.updateAnimator()
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
    this.jumpCount += 1
    this.state = 'jump'
    this.attackMove = null
    this.attackConnected = false
    this.animator.play(this.sheets.jump, 8, true)
  }

  tryDash(direction: Facing): void {
    if (this.state === 'death' || this.state === 'hurt' || this.dashCooldown > 0) return
    this.facing = direction
    this.dashTicks = DASH_TICKS
    this.dashCooldown = DASH_COOLDOWN_TICKS
    this.attackMove = null
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.state = 'dash'
    this.animator.play(this.sheets.run, 3, true)
  }

  private tryStartAttack(intent: IntentState): boolean {
    if (this.state === 'death' || this.state === 'hurt' || this.state === 'attack') return false
    const move = intent.specialPressed && this.meter >= (this.def.moves.super.meterCost ?? Number.POSITIVE_INFINITY)
      ? this.def.moves.super
      : intent.specialPressed
        ? this.def.moves.special
        : intent.heavyPressed
          ? this.def.moves.heavy
          : intent.lightPressed
            ? this.def.moves.light
            : null
    if (!move) return false
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

  private updateLocomotion(intent: IntentState, opponentX: number, platforms: Platform[]): void {
    const moveSpeed = (this.grounded ? WALK_SPEED : AIR_SPEED) * this.moveSpeedMultiplier
    const dashing = this.dashTicks > 0
    if (this.dashTicks > 0) {
      this.dashTicks -= 1
      this.velocity.x = this.facing * DASH_SPEED
    } else {
      this.velocity.x = intent.moveX * moveSpeed
    }
    if (intent.moveX > 0) this.facing = 1
    else if (intent.moveX < 0) this.facing = -1
    else this.facing = opponentX >= this.position.x ? 1 : -1

    if (intent.jumpPressed) this.tryJump()
    if (!this.grounded && intent.downHeld && this.velocity.y > 0 && this.velocity.y < FAST_FALL_SPEED) {
      this.velocity.y = FAST_FALL_SPEED
    }

    this.integrate(platforms)

    if (dashing) {
      this.state = 'dash'
      return
    }
    const next = !this.grounded ? (this.velocity.y < 0 ? 'jump' : 'fall') : intent.moveX === 0 ? 'idle' : 'run'
    this.setMotion(next)
  }

  private updateAttack(intent: IntentState, platforms: Platform[]): void {
    this.attackTick += 1
    this.velocity.x = intent.moveX * ATTACK_DRIFT_SPEED
    if (intent.moveX > 0) this.facing = 1
    else if (intent.moveX < 0) this.facing = -1
    // Ranged enemies (bone throwers) release a projectile once as the swing goes active.
    if (this.rangedAttacker && this.attackMove && this.attackTick === this.attackMove.startup + 1) {
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

  private integrate(platforms: Platform[]): void {
    const wasGrounded = this.grounded
    this.position.x += this.velocity.x
    this.position.x = clamp(this.position.x, WALL_MARGIN, ROOM_WIDTH - WALL_MARGIN)
    this.velocity.y += GRAVITY
    this.position.y += this.velocity.y

    let landed = false
    let landingY = FLOOR_Y
    for (const platform of platforms) {
      if (platform.fallen) continue
      if (this.position.x < platform.x - 2 || this.position.x > platform.x + platform.width + 2) continue
      if (this.prevPosition.y <= platform.y && this.position.y >= platform.y && this.velocity.y >= 0) {
        landed = true
        landingY = Math.min(landingY, platform.y)
      }
    }

    if (this.position.y >= FLOOR_Y || landed) {
      this.position.y = landed ? landingY : FLOOR_Y
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
      case 'attack':
      case 'dash':
      case 'hurt':
      case 'death':
        break
    }
  }

  private updateAnimator(): void {
    if (this.def.id === 'juliusBelmont' && this.state === 'idle') return
    this.animator.update()
  }

  render(renderer: Renderer, cameraX: number): void {
    this.drawGlow(renderer, cameraX)
    const sheet = this.currentSheet()
    const frame = this.animator.currentFrame
    const scale = this.renderScale()
    const anchorY = this.renderAnchorY()
    const x = this.position.x - cameraX
    const y = this.position.y
    const attackShiftX = this.renderAttackShiftX(frame) * scale * this.facing
    const drawX =
      (this.facing === 1 ? x - this.def.visual.anchorX * scale : x - (sheet.frameWidth - this.def.visual.anchorX) * scale) +
      attackShiftX
    const drawY = y - anchorY * scale
    if (this.invulnerableTicks > 0 && Math.floor(this.invulnerableTicks / 4) % 2 === 0) return
    if (this.state === 'death') {
      // Play the death animation, then fade the corpse out and stop drawing it.
      if (this.deathTicks >= DEATH_HOLD_TICKS + DEATH_FADE_TICKS) return
      const alpha = clamp(1 - (this.deathTicks - DEATH_HOLD_TICKS) / DEATH_FADE_TICKS, 0, 1)
      const { ctx } = renderer
      ctx.save()
      ctx.globalAlpha = alpha
      drawSprite(renderer, sheet, frame, drawX, drawY, scale, this.facing)
      ctx.restore()
      return
    }
    if (this.state === 'dash') {
      const { ctx } = renderer
      ctx.save()
      ctx.globalAlpha = 0.28
      drawSprite(renderer, sheet, frame, drawX - this.facing * 28, drawY, scale, this.facing)
      ctx.globalAlpha = 0.14
      drawSprite(renderer, sheet, frame, drawX - this.facing * 54, drawY, scale, this.facing)
      ctx.restore()
    }
    if (this.shouldDrawJuliusWhipExtension(frame)) {
      const extensionX = drawX + this.facing * sheet.frameWidth * scale
      drawSprite(renderer, sheet, 1, drawX, drawY, scale, this.facing)
      drawSprite(renderer, sheet, frame, extensionX, drawY, scale, this.facing)
      return
    }
    drawSprite(renderer, sheet, frame, drawX, drawY, scale, this.facing)
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

  private shouldDrawJuliusWhipExtension(frame: number): boolean {
    return this.def.id === 'juliusBelmont' && this.state === 'attack' && (frame === 2 || frame === 3)
  }

  private shouldUseHitInvulnerability(): boolean {
    return this.def.id === 'juliusBelmont'
  }

  private renderScale(): number {
    if (this.def.id === 'juliusBelmont' && this.state === 'attack') return 0.84 * ACTOR_SCALE
    return this.def.visual.scale * ACTOR_SCALE
  }

  private renderAnchorY(): number {
    if (this.def.id === 'juliusBelmont' && this.state === 'attack') return 98
    return this.def.visual.anchorY
  }

  private renderAttackShiftX(frame: number): number {
    if ((this.def.id !== 'skeleton' && this.def.id !== 'armoredSkeleton') || this.state !== 'attack') return 0
    if (frame <= 2) return 0
    if (frame === 3) return 6
    return 0
  }

  hurtbox(): Rect {
    const width = this.def.visual.hurtbox.width * ACTOR_SCALE
    const height = this.def.visual.hurtbox.height * ACTOR_SCALE
    return { x: this.position.x - width / 2, y: this.position.y - height, width, height }
  }

  setMaxHealth(value: number): void {
    this.maxHealth = value
    this.health = value
  }

  setMoveSpeedMultiplier(value: number): void {
    this.moveSpeedMultiplier = value
  }

  private currentSheet(): SpriteSheet {
    const s = this.sheets
    if (this.state === 'attack') return this.attackMove?.animKey === 'attack2' ? s.attack2 : s.attack1
    if (this.state === 'dash') return s.run
    if (this.state === 'jump') return s.jump
    if (this.state === 'fall') return s.fall
    if (this.state === 'hurt') return s.takeHit
    if (this.state === 'death') return s.death
    return this.state === 'run' ? s.run : s.idle
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
  private blink = 0
  private ending = false
  private transitionTicks = 0
  private hitstop = 0
  private flashTicks = 0
  private contactHitCooldown = 0
  private defeatTicks = 0
  private bossIntroTicks = 0
  private savedFlashTicks = 0
  private roomCooldown = 0
  private victoryTicks = 0
  private sealMessageTicks = 0
  private sealMessageText = ''
  private abilityGetTicks = 0
  private abilityGetName = ''
  private hearts = STARTING_HEARTS
  private selectedSubweaponIndex = 0
  private enemyFreezeTicks = 0
  private runMods: RunModifiers = buildRunModifiers([])
  private soulMods: SoulModifiers = buildSoulModifiers([])
  private equipMods: EquipmentModifiers = buildEquipmentModifiers([])
  private playerDamageMult = 1
  private playerDamageTakenMult = 1
  private levelUpTicks = 0
  private readonly rewardedDeaths = new Set<CastleActor>()
  private floatingTexts: FloatingText[] = []
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
  private showMap = false
  private showMenu = false
  private menuIndex = 0
  private menuReturn = false
  private mapCursorId = ''
  private equipSlotIndex = 0
  private pendingNodeId: string | null = null
  private readonly attackingLastTick = new Set<CastleActor>()
  private touchControls: TouchControls | null = null
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.ctx.scenes.current !== this) return
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
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault()
        this.cycleEquipSlot(-1)
        return
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight' || isMenuConfirm(e.code)) {
        e.preventDefault()
        this.cycleEquipSlot(1)
        return
      }
      if (isMenuCancel(e.code) || e.code === 'Escape' || e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault()
        this.showEquipment = false
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
      const dir = mapDirForKey(e.code)
      if (dir) {
        e.preventDefault()
        this.moveMapCursor(dir)
        return
      }
      if (e.code === 'Space' || e.code === 'Escape' || isMenuCancel(e.code) || isMenuConfirm(e.code)) {
        e.preventDefault()
        this.showMap = false
        if (this.menuReturn) this.showMenu = true
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
    this.ctx.renderer.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.reloadFromSave()
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.input.dispose?.()
    this.touchControls?.dispose()
    this.touchControls = null
    this.ctx.audio.stopBgm()
  }

  update(): void {
    this.blink += 1
    if (this.flashTicks > 0) this.flashTicks -= 1
    if (this.contactHitCooldown > 0) this.contactHitCooldown -= 1
    if (this.ending || this.drafting || this.perkChoosing || this.shopping || this.showStatus || this.showEquipment || this.showMap || this.showMenu) return
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
    if (this.bossIntroTicks > 0) {
      this.bossIntroTicks -= 1
      return
    }
    if (this.enemyFreezeTicks > 0) this.enemyFreezeTicks -= 1

    const intent = this.input.poll()
    if (intent.dashPressed) {
      this.player.tryDash(intent.moveX === 0 ? this.player.facing : intent.moveX)
    }
    if (intent.heavyPressed) {
      this.cycleSubweapon()
      intent.heavyPressed = false
    }
    if (intent.upHeld && intent.lightPressed && this.tryUseSubweapon()) intent.lightPressed = false
    this.player.update(intent, this.player.position.x + this.player.facing * 80, this.layout.platforms)
    // MP passively refills so soul magic is always coming back (Aria-style).
    this.player.meter = clamp(this.player.meter + MP_REGEN, 0, 100)
    if (this.soulCooldown > 0) this.soulCooldown -= 1

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      if (this.enemyFreezeTicks > 0) continue
      const ai = enemyIntent(enemy, this.player, this.node, this.ctx.rng)
      enemy.update(ai, this.player.position.x, this.layout.platforms)
      const shot = enemy.consumeRangedShot()
      if (shot) this.spawnBone(shot)
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
      bone.velocity.y += BONE_GRAVITY
      bone.position.x += bone.velocity.x
      bone.position.y += bone.velocity.y
      bone.spin += 0.5
      bone.ticksLeft -= 1
    }
    for (const bolt of this.soulBolts) {
      if (bolt.homing) this.steerHomingBolt(bolt)
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
    if (this.levelUpTicks > 0) this.levelUpTicks -= 1

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
    this.tryPickupAbility()
    if (this.sealMessageTicks > 0) this.sealMessageTicks -= 1
    if (this.abilityGetTicks > 0) this.abilityGetTicks -= 1

    this.cameraX = clamp(this.player.position.x - this.ctx.width / 2, 0, ROOM_WIDTH - this.ctx.width)
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
    drawBackdrop(ctx, this.node.stage, this.isCastleGateNode)
    this.drawWorld()
    // Crush the rendered world down to a GBA-style resolution + 15-bit palette,
    // then draw the crisp HUD/menus on top (so text stays readable).
    if (GBA_PIXELATE) pixelateWorld(renderer)
    this.drawHud()
    if (this.ending) this.drawEnding()
    else if (this.perkChoosing) this.drawPerkChoice()
    else if (this.drafting) this.drawDraft()
    else if (this.shopping) this.drawShop()
    else if (this.showMenu) this.drawMenu()
    else if (this.showMap) this.drawMap()
    else if (this.showEquipment) this.drawEquipment()
    else if (this.showStatus) this.drawStatus()
    else if (this.defeatTicks > 0) this.drawDefeat()
    else {
      this.drawBossBar()
      if (Math.floor(this.blink / 30) % 2 === 0) this.drawPrompt()
    }
    if (this.levelUpTicks > 0 && !this.ending && !this.drafting && !this.perkChoosing) this.drawLevelUp()
    if (this.bossIntroTicks > 0) this.drawBossIntro()
    if (this.sealMessageTicks > 0) this.drawSealMessage()
    if (this.abilityGetTicks > 0) this.drawAbilityGet()
    this.drawFlash()
  }

  private get bossActor(): CastleActor | null {
    if (!this.node.isBoss) return null
    return this.enemies.find((enemy) => enemy.isBoss) ?? null
  }

  /** True when the room is in normal play, i.e. no blocking overlay is up. */
  private get canOpenOverlay(): boolean {
    return !this.ending && !this.drafting && !this.shopping && !this.showStatus && !this.showEquipment && !this.showMenu && this.defeatTicks === 0
  }

  private isRoomRevealed(nodeId: string): boolean {
    return this.save.visitedNodeIds.includes(nodeId) || this.save.unlockedNodeIds.includes(nodeId)
  }

  private openMap(): void {
    this.showMap = true
    this.mapCursorId = this.node.id
    this.ctx.audio.swing()
  }

  private openMenu(): void {
    this.showMenu = true
    this.menuIndex = 0
    this.ctx.audio.swing()
  }

  private selectMenu(): void {
    const item = MENU_ITEMS[this.menuIndex]
    this.ctx.audio.hit()
    this.showMenu = false
    if (item === 'RESUME') { this.menuReturn = false; return }
    this.menuReturn = true
    if (item === 'STATUS') this.showStatus = true
    else if (item === 'EQUIP') { this.showEquipment = true; this.equipSlotIndex = 0 }
    else if (item === 'MAP') this.openMap()
  }

  private moveMapCursor(dir: MapDir): void {
    const next = castleNeighbor(this.mapCursorId, dir)
    if (!next || !this.isRoomRevealed(next)) return
    this.mapCursorId = next
    this.ctx.audio.swing()
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
    this.layout = buildLayout(this.node.stage)
    this.runMods = buildRunModifiers(this.save.relicIds.map((id) => RELIC_POOL.find((relic) => relic.id === id)).filter((relic): relic is RelicDef => Boolean(relic)))
    this.soulMods = buildSoulModifiers(this.save.souls)
    this.equipMods = buildEquipmentModifiers(equippedDefs(this.save))
    this.playerDamageMult = this.computeDamageMult()
    this.playerDamageTakenMult = this.computeDamageTakenMult()
    const moveSpeed = this.computeMoveSpeedMult()
    this.player = new CastleActor(CAMPAIGN_HERO, this.ctx.assets, this.layout.checkpointX, this.layout.checkpointY, 1, moveSpeed)
    this.player.setMaxHealth(this.computeMaxHealth())
    this.player.reset(this.layout.checkpointX, this.layout.checkpointY, 1)
    this.player.meterGainMultiplier = this.computeMeterGainMult()
    this.player.meter = this.runMods.startMeterBonus + this.equipMods.startMeterBonus
    this.applyAbilities()
    this.enemies = buildEnemies(this.node, this.ctx.assets, this.layout)
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
    this.showStatus = false
    this.showEquipment = false
    this.perkChoosing = false
    this.perkOptions = []
    this.pendingLevelUps = 0
    this.victoryTicks = 0
    this.rewardedDeaths.clear()
    this.floatingTexts = []
    this.attackingLastTick.clear()
    this.showMap = false
    this.showMenu = false
    this.menuReturn = false
    this.ending = false
    this.save = { ...this.save, currentNodeId: nodeId, finished: false }
    this.save = markCampaignVisited(this.save, nodeId)
  }

  private resolveCombat(): void {
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

  /** Owned castable souls in a stable order: base first, then collected. */
  private ownedBulletSoulIds(): string[] {
    return [BASE_BULLET_SOUL, ...this.save.bulletSouls]
  }

  private cycleBulletSoul(): void {
    const owned = this.ownedBulletSoulIds()
    if (owned.length <= 1) return
    const i = owned.indexOf(this.save.equippedBulletSoul)
    const next = owned[(i + 1) % owned.length] ?? BASE_BULLET_SOUL
    this.save = equipCampaignBulletSoul(this.save, next)
    this.ctx.audio.swing()
  }

  private spawnSoulBolt(vx: number, vy: number, damage: number, homing: boolean, x: number, y: number): void {
    this.soulBolts.push({
      position: { x, y },
      velocity: { x: vx, y: vy },
      facing: this.player.facing,
      ticksLeft: homing ? SOUL_HOMING_LIFETIME : SOUL_LIFETIME,
      spin: 0,
      damage,
      homing,
      hitTargets: new Set<CastleActor>(),
    })
  }

  /** Spend MP to cast the equipped Bullet Soul, whose pattern shapes the volley. */
  private castSoul(): void {
    if (this.player.isDead || this.soulCooldown > 0 || this.bossIntroTicks > 0) return
    const soul = this.equippedSoulDef()
    if (this.player.meter < soul.mpCost) return
    this.player.meter -= soul.mpCost
    this.soulCooldown = SOUL_CAST_COOLDOWN
    const f = this.player.facing
    const ox = this.player.position.x + f * 36
    const oy = this.player.position.y - 62
    const cx = this.player.position.x
    const cy = this.player.position.y - 46
    switch (soul.pattern) {
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
    if (this.hearts < cost) return false
    this.hearts -= cost
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

  private cycleSubweapon(): void {
    this.selectedSubweaponIndex = (this.selectedSubweaponIndex + 1) % SUBWEAPON_ORDER.length
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

  private spawnBone(shot: { x: number; y: number; facing: Facing }): void {
    this.enemyBones.push({
      position: { x: shot.x, y: shot.y },
      velocity: { x: shot.facing * BONE_SPEED, y: -3.4 },
      spin: 0,
      ticksLeft: 110,
      hasHit: false,
    })
    this.ctx.audio.swing()
  }

  private resolveEnemyBones(): void {
    if (this.player.isDead) return
    const box = this.player.hurtbox()
    for (const bone of this.enemyBones) {
      if (bone.hasHit || !rectsOverlap(boneBox(bone), box)) continue
      if (this.player.applyFlatDamage(BONE_DAMAGE, bone.position.x, -6, this.playerDamageTakenMult)) {
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
    return this.runMods.damageMultiplier * this.soulMods.damageMultiplier * this.equipMods.damageMultiplier * (1 + (this.save.level - 1) * 0.04) * (1 + this.save.atkUpgrades * 0.06) * (1 + this.perkStacks('might') * 0.07)
  }

  private computeDamageTakenMult(): number {
    return Math.max(0.4, (1 - this.save.armorTier * 0.06) * (1 - this.perkStacks('ward') * 0.05) * this.equipMods.damageTakenMultiplier)
  }

  private computeMoveSpeedMult(): number {
    return this.runMods.moveSpeedMultiplier * this.soulMods.moveSpeedMultiplier * this.equipMods.moveSpeedMultiplier * (1 + this.perkStacks('swiftness') * 0.06)
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
      this.spawnFloatingText(hurt.x + hurt.width / 2, hurt.y - 6, `+${reward.xp} XP`, '#b7c7e6')
      if (result.levelsGained > 0) this.onLevelUp(result.levelsGained)
      this.tryDropSoul(enemy, hurt)
      this.tryDropBulletSoul(enemy, hurt)
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

  /** Re-apply soul bonuses to the live player when a new soul drops mid-room. */
  private applySoulMods(): void {
    this.soulMods = buildSoulModifiers(this.save.souls)
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
    // compute* methods) and restores health.
    this.levelUpTicks = 150
    this.playerDamageMult = this.computeDamageMult()
    this.player.setMaxHealth(this.computeMaxHealth())
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, `LEVEL ${this.save.level}`, '#f6b74a')
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 100, 'STATS UP', '#b7c7e6')
    this.ctx.audio.hit()
    // A power-up pick is earned only on every 5th level. Count how many level-5
    // milestones the gain crossed and queue a choice for each.
    const top = this.save.level
    let milestones = 0
    for (let lvl = top - levelsGained + 1; lvl <= top; lvl += 1) {
      if (lvl % 5 === 0) milestones += 1
    }
    if (milestones > 0) {
      this.pendingLevelUps += milestones
      if (!this.perkChoosing) this.openPerkChoice()
    }
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
    } else if (intent.moveX > 0 && x >= ROOM_WIDTH - WALL_MARGIN - EDGE_ZONE) {
      const east = castleNeighbor(this.node.id, 'e')
      if (east && this.canPassDoor('e')) { this.enterRoom(east, 'west'); return }
    }
    // Vertical: stand at the central stairwell on the ground and press up/down.
    if (this.player.grounded && Math.abs(x - VERT_PASSAGE_X) <= VERT_RANGE) {
      if (intent.upHeld) {
        const north = castleNeighbor(this.node.id, 'n')
        if (north && this.canPassDoor('n')) { this.enterRoom(north, 'bottom'); return }
      } else if (intent.downHeld) {
        const south = castleNeighbor(this.node.id, 's')
        if (south && this.canPassDoor('s')) this.enterRoom(south, 'top')
      }
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
  }

  private tryPickupAbility(): void {
    const pk = ABILITY_PICKUPS[this.node.id]
    if (!pk || this.save.abilities.includes(pk.ability) || this.player.isDead) return
    if (Math.abs(this.player.position.x - pk.x) > 48) return
    this.save = addCampaignAbility(this.save, pk.ability)
    this.applyAbilities()
    this.abilityGetTicks = 200
    this.abilityGetName = ABILITIES[pk.ability]?.name ?? pk.ability
    this.ctx.audio.hit()
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, 'ABILITY GET', '#f6b74a')
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
    else if (entrySide === 'east') { x = ROOM_WIDTH - WALL_MARGIN - 90; facing = -1 }
    else if (entrySide === 'top') { y = 120 } // dropped in from above — falls to the floor
    this.player.reset(x, y, facing)
    if (entrySide === 'top') this.player.grounded = false
    this.player.health = Math.min(this.player.maxHealth, Math.max(1, carryHealth))
    this.player.meter = clamp(carryMeter, 0, 100)
    this.cameraX = clamp(x - this.ctx.width / 2, 0, ROOM_WIDTH - this.ctx.width)
    this.roomCooldown = 22
    this.ctx.audio.swing()
  }

  private tryUseSavePoint(intent: IntentState): void {
    if (this.savedFlashTicks > 0) this.savedFlashTicks -= 1
    const sx = SAVE_POINTS[this.node.id]
    if (sx === undefined || this.player.isDead) return
    if (!intent.upHeld || this.savedFlashTicks > 0) return
    if (Math.abs(this.player.position.x - sx) > SAVE_RANGE) return
    this.player.health = this.player.maxHealth
    saveCampaignSave(this.save)
    this.savedFlashTicks = 90
    this.spawnFloatingText(this.player.position.x, this.player.position.y - 118, 'GAME SAVED', '#8fd4ff')
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

  private resolvePickups(): void {
    if (this.player.isDead) return
    const playerBox = this.player.hurtbox()
    for (const pickup of this.pickups) {
      if (pickup.ticksLeft <= 0) continue
      if (!rectsOverlap(pickupBox(pickup), playerBox)) continue
      pickup.ticksLeft = 0
      if (pickup.kind === 'heart') {
        this.hearts = Math.min(MAX_HEARTS, this.hearts + pickup.value)
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
    const unownedSouls = SOUL_POOL.filter((soul) => !this.save.souls.includes(soul.id)).length
    // Offer up to three not-yet-owned equipment pieces so the shelf stays fresh
    // without becoming an overwhelming wall of gear.
    const gear = EQUIPMENT_POOL.filter((item) => !this.save.equipment.includes(item.id))
      .slice()
      .sort((a, b) => a.price - b.price)
      .slice(0, 3)
      .map((item) => ({
        id: `equip:${item.id}`,
        name: item.name.toUpperCase(),
        desc: `${EQUIP_SLOT_LABELS[item.slot]} · ${item.blurb}`,
        price: item.price,
        available: true,
      }))
    return [
      {
        id: 'hp',
        name: 'LIFE CRYSTAL',
        desc: `+20 MAX HEALTH  (owned ${this.save.hpUpgrades})`,
        price: 40 + this.save.hpUpgrades * 30,
        available: true,
      },
      {
        id: 'atk',
        name: 'POWER SHARD',
        desc: `+6% ATTACK  (owned ${this.save.atkUpgrades})`,
        price: 50 + this.save.atkUpgrades * 40,
        available: true,
      },
      {
        id: 'armor',
        name: 'ARMOR PLATE',
        desc: this.save.armorTier < 7 ? `-6% DAMAGE TAKEN  (owned ${this.save.armorTier})` : 'Armor maxed out',
        price: 45 + this.save.armorTier * 35,
        available: this.save.armorTier < 7,
      },
      {
        id: 'soul',
        name: 'SOUL SHARD',
        desc: unownedSouls > 0 ? `A random enemy soul  (${unownedSouls} left)` : 'All souls collected',
        price: 120,
        available: unownedSouls > 0,
      },
      ...gear,
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
    if (item.id === 'hp') this.save = { ...this.save, hpUpgrades: this.save.hpUpgrades + 1 }
    else if (item.id === 'atk') this.save = { ...this.save, atkUpgrades: this.save.atkUpgrades + 1 }
    else if (item.id === 'armor') this.save = { ...this.save, armorTier: this.save.armorTier + 1 }
    else if (item.id === 'soul') {
      const unowned = SOUL_POOL.filter((soul) => !this.save.souls.includes(soul.id))
      const pick = unowned[this.ctx.rng.int(0, unowned.length - 1)]
      if (pick) this.save = addCampaignSoul(this.save, pick.id)
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

  /** Cycle the currently selected slot through [empty, ...owned pieces] and apply
   *  the change to the live player so stats update the moment you swap. */
  private cycleEquipSlot(dir: number): void {
    const slot = EQUIP_SLOTS[this.equipSlotIndex]
    if (!slot) return
    const owned = equipmentForSlot(slot).filter((item) => this.save.equipment.includes(item.id))
    if (owned.length === 0) {
      this.ctx.audio.swing()
      return
    }
    const options: (EquipmentDef | null)[] = [null, ...owned]
    const currentId = this.save.equipped[slot]
    const currentIndex = Math.max(0, options.findIndex((opt) => (opt?.id ?? null) === (currentId ?? null)))
    const next = options[(currentIndex + dir + options.length) % options.length] ?? null
    this.save = next ? equipCampaignItem(this.save, next.id) : unequipCampaignSlot(this.save, slot)
    this.equipMods = buildEquipmentModifiers(equippedDefs(this.save))
    this.refreshLivePlayerStats()
    this.ctx.audio.hit()
  }

  private drawWorld(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.translate(-this.cameraX, 0)
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
    for (const hazard of this.layout.hazards) drawSpikes(ctx, hazard)
    for (const candle of this.candles) drawCandle(ctx, candle)
    for (const pickup of this.pickups) drawPickup(ctx, pickup)
    // Exit passages on whichever edges have a door in the castle graph.
    const doors = castleDoors(this.node.id)
    if (doors.w) drawExit(ctx, 0, this.layout.doorY, 'w', this.isDoorSealed('w'))
    if (doors.e) drawExit(ctx, ROOM_WIDTH, this.layout.doorY, 'e', this.isDoorSealed('e'))
    if (doors.n || doors.s) drawVertPassage(ctx, VERT_PASSAGE_X, this.layout.doorY, doors.n, doors.s, this.blink)
    // Ability relic, if this room has an uncollected one.
    const orb = ABILITY_PICKUPS[this.node.id]
    if (orb && !this.save.abilities.includes(orb.ability)) drawAbilityOrb(ctx, orb.x, this.layout.doorY, this.blink)
    // Save point, if this room has one.
    const sx = SAVE_POINTS[this.node.id]
    if (sx !== undefined) drawSavePoint(ctx, sx, this.layout.doorY, this.blink)
    // Wandering merchant, if this room has one.
    const mx = MERCHANT_ROOMS[this.node.id]
    if (mx !== undefined) drawMerchant(ctx, mx, this.layout.doorY, this.blink)
    ctx.restore()

    this.player.render(this.ctx.renderer, this.cameraX)
    for (const enemy of this.enemies) enemy.render(this.ctx.renderer, this.cameraX)
    for (const projectile of this.projectiles) renderProjectile(projectile, this.ctx.renderer, this.cameraX)
    for (const subweapon of this.subweapons) renderSubweapon(subweapon, this.ctx.renderer, this.cameraX)
    for (const bolt of this.soulBolts) drawSoulBolt(bolt, this.ctx.renderer, this.cameraX)
    for (const bone of this.enemyBones) drawBone(bone, this.ctx.renderer, this.cameraX)
    this.drawEnemyHealthBars()
    this.drawFloatingTexts()
    if (DEBUG_HITBOXES) this.drawDebugBoxes()
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

  private drawHud(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.78)'
    ctx.fillRect(24, 20, 392, 96)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(24, 20, 392, 96)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('JULIUS BELMONT', 40, 34)
    ctx.fillStyle = '#f6b74a'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(`LV ${this.save.level}`, 288, 35)
    if (this.save.armorTier > 0) {
      ctx.fillStyle = '#9fb0d6'
      ctx.fillText(`DEF ${this.save.armorTier}`, 356, 35)
    }
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(`${this.chapter.year}  ${this.chapter.title.toUpperCase()}`, 40, 52)
    ctx.fillStyle = '#8a8aa0'
    ctx.fillText(this.node.title.toUpperCase(), 40, 66)
    ctx.fillStyle = '#b7c7e6'
    ctx.fillText(`SUB ${SUBWEAPON_LABELS[this.currentSubweapon()]}`, 250, 52)
    ctx.fillStyle = '#e8d4a0'
    ctx.fillText(`HEARTS ${this.hearts.toString().padStart(2, '0')}`, 250, 66)
    // Health bar
    ctx.fillStyle = '#2a1014'
    ctx.fillRect(40, 78, 300, 9)
    ctx.fillStyle = '#b91d2d'
    ctx.fillRect(40, 78, 300 * (this.player.health / this.player.maxHealth), 9)
    ctx.strokeStyle = '#e8d4a0'
    ctx.strokeRect(40, 78, 300, 9)
    // MP bar (Aria-style magic): the special meter spent on soul casts.
    const soulDef = this.equippedSoulDef()
    ctx.fillStyle = '#0e1a2a'
    ctx.fillRect(40, 88, 300, 7)
    ctx.fillStyle = this.player.meter >= soulDef.mpCost ? '#3aa0e0' : '#2a5a7a'
    ctx.fillRect(40, 88, 300 * clamp(this.player.meter / 100, 0, 1), 7)
    ctx.strokeStyle = '#5a86b0'
    ctx.strokeRect(40, 88, 300, 7)
    // Equipped Bullet Soul label at the end of the magic bar.
    ctx.fillStyle = '#8fd4ff'
    ctx.font = '7px "Press Start 2P", monospace'
    ctx.fillText(`◈${soulDef.name.toUpperCase()}`, 346, 90)
    // XP bar
    const xpRatio = this.save.level >= MAX_LEVEL ? 1 : clamp(this.save.xp / xpForNextLevel(this.save.level), 0, 1)
    ctx.fillStyle = '#161326'
    ctx.fillRect(40, 96, 300, 4)
    ctx.fillStyle = '#6f7ad6'
    ctx.fillRect(40, 96, 300 * xpRatio, 4)
    ctx.strokeStyle = '#3a3550'
    ctx.strokeRect(40, 96, 300, 4)
    ctx.fillStyle = '#f6b74a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(`GOLD ${this.save.gold}`, 250, 104)
    ctx.fillStyle = '#7ad6ff'
    ctx.fillText(`SOULS ${this.save.souls.length}/${SOUL_POOL.length}`, 150, 104)
    this.drawRelicPips(ctx)
    ctx.restore()
  }

  private drawRelicPips(ctx: CanvasRenderingContext2D): void {
    if (this.save.relicIds.length === 0) return
    const size = 11
    const gap = 5
    let x = 40
    const y = 104
    for (const id of this.save.relicIds) {
      ctx.fillStyle = RELIC_PIP_COLORS[id] ?? '#e8d4a0'
      ctx.fillRect(x, y, size, size)
      ctx.strokeStyle = '#0b0912'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, size, size)
      x += size + gap
    }
  }

  private drawLevelUp(): void {
    const { ctx } = this.ctx.renderer
    const alpha = Math.min(1, this.levelUpTicks / 30)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f6b74a'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('LEVEL UP', this.ctx.width / 2, 150)
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(`JULIUS REACHES LEVEL ${this.save.level}`, this.ctx.width / 2, 176)
    ctx.restore()
  }

  private drawPrompt(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('A/D MOVE   J JUMP   ; DASH   K ATTACK   W+K SUB   U SOUL', this.ctx.width / 2, this.ctx.height - 38)
    ctx.fillText('L SWITCH SUB   O SWAP SOUL   ENTER MENU   SPACE MAP   ESC PAUSE', this.ctx.width / 2, this.ctx.height - 22)
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
    ctx.fillText('DOUBLE JUMP UNLOCKED — SEALED DOORS WILL OPEN', this.ctx.width / 2, cy + 28)
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
    ctx.fillText('JULIUS FALLS', this.ctx.width / 2, this.ctx.height / 2 - 32)
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

  private roomMapState(id: string): 'current' | 'completed' | 'visited' | 'known' | 'hidden' {
    if (id === this.node.id) return 'current'
    if (this.save.completedNodeIds.includes(id)) return 'completed'
    if (this.save.visitedNodeIds.includes(id)) return 'visited'
    if (this.save.unlockedNodeIds.includes(id)) return 'known'
    return 'hidden'
  }

  private drawMap(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(6, 5, 12, 0.94)'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(56, 36, width - 112, height - 84)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('CASTLE MAP', width / 2, 56)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(this.chapter.title.toUpperCase(), width / 2, 84)

    const bounds = castleGridBounds()
    // Fit the whole castle into the panel, scaling cells to the grid size so the
    // map stays readable however many rooms exist.
    const areaTop = 108
    const availW = width - 220
    const availH = height - 120 - areaTop
    const gap = 22
    const cellW = Math.min(90, (availW - (bounds.cols - 1) * gap) / bounds.cols)
    const cellH = Math.min(56, (availH - (bounds.rows - 1) * gap) / bounds.rows)
    const gridW = bounds.cols * cellW + (bounds.cols - 1) * gap
    const gridH = bounds.rows * cellH + (bounds.rows - 1) * gap
    const originX = width / 2 - gridW / 2
    const originY = areaTop + (availH - gridH) / 2
    const pulse = 0.5 + 0.5 * Math.sin(this.blink * 0.12)

    const cellRect = (id: string): { x: number; y: number } => {
      const cell = CASTLE_CELLS[id]!
      return {
        x: originX + (cell.col - bounds.minCol) * (cellW + gap),
        y: originY + (cell.row - bounds.minRow) * (cellH + gap),
      }
    }

    // Corridors first, so room cells sit on top of the connecting stubs.
    ctx.fillStyle = '#3a3658'
    for (const id of CASTLE_ROOM_IDS) {
      if (this.roomMapState(id) === 'hidden') continue
      const { x, y } = cellRect(id)
      const doors = castleDoors(id)
      const neighborShown = (dir: MapDir): boolean => {
        const n = castleNeighbor(id, dir)
        return Boolean(n && this.roomMapState(n) !== 'hidden')
      }
      const cx = x + cellW / 2
      const cy = y + cellH / 2
      if (doors.e && neighborShown('e')) ctx.fillRect(x + cellW, cy - 4, gap, 8)
      if (doors.w && neighborShown('w')) ctx.fillRect(x - gap, cy - 4, gap, 8)
      if (doors.s && neighborShown('s')) ctx.fillRect(cx - 4, y + cellH, 8, gap)
      if (doors.n && neighborShown('n')) ctx.fillRect(cx - 4, y - gap, 8, gap)
    }

    for (const id of CASTLE_ROOM_IDS) {
      const state = this.roomMapState(id)
      if (state === 'hidden') continue
      const { x, y } = cellRect(id)
      let fill = '#141428'
      let border = '#4a4668'
      if (state === 'current') {
        fill = `rgba(232, 212, 160, ${0.5 + 0.4 * pulse})`
        border = '#fff2cc'
      } else if (state === 'completed') {
        fill = '#243a5a'
        border = '#6a86b8'
      } else if (state === 'visited') {
        fill = '#2a2340'
        border = '#7a6ab0'
      } else {
        // known but never entered — a dim, dashed outline (fog just lifting).
        fill = 'rgba(20, 20, 40, 0.4)'
        border = '#4a4668'
      }
      ctx.fillStyle = fill
      ctx.fillRect(x, y, cellW, cellH)
      ctx.lineWidth = 2
      ctx.strokeStyle = border
      ctx.strokeRect(x, y, cellW, cellH)
      // Boss rooms carry a red pip so their danger reads at a glance.
      if (isBossRoom(id)) {
        ctx.fillStyle = state === 'known' ? '#5a2226' : '#e0393a'
        ctx.beginPath()
        ctx.arc(x + cellW / 2, y + cellH / 2, 7, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Cursor ring on the inspected room.
    if (this.mapCursorId && this.roomMapState(this.mapCursorId) !== 'hidden') {
      const { x, y } = cellRect(this.mapCursorId)
      ctx.lineWidth = 2
      ctx.strokeStyle = `rgba(246, 183, 74, ${0.55 + 0.45 * pulse})`
      ctx.strokeRect(x - 5, y - 5, cellW + 10, cellH + 10)
    }

    // Inspected-room caption.
    const cursorState = this.mapCursorId ? this.roomMapState(this.mapCursorId) : 'hidden'
    ctx.textAlign = 'center'
    if (cursorState !== 'hidden') {
      const node = getCampaignNode(this.mapCursorId)
      const label =
        cursorState === 'current' ? 'YOU ARE HERE' :
        cursorState === 'completed' ? 'CLEARED' :
        cursorState === 'visited' ? 'EXPLORED' : 'NOT YET REACHED'
      ctx.fillStyle = '#e8d4a0'
      ctx.font = '11px "Press Start 2P", monospace'
      ctx.fillText(node.title.toUpperCase(), width / 2, height - 108)
      ctx.fillStyle = cursorState === 'current' ? '#f6b74a' : '#7a8ab0'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.fillText(label + (isBossRoom(this.mapCursorId) ? '   • BOSS' : ''), width / 2, height - 90)
      ctx.fillStyle = '#8a8aa0'
      ctx.textAlign = 'left'
      wrapText(ctx, node.blurb, width / 2 - 240, height - 74, 480, 13, 2)
      ctx.textAlign = 'center'
    }

    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('ARROWS / WASD  MOVE      SPACE / K  CLOSE', width / 2, height - 40)
    ctx.restore()
  }

  private drawMenu(): void {
    const { ctx } = this.ctx.renderer
    const { width, height } = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(6, 5, 12, 0.82)'
    ctx.fillRect(0, 0, width, height)
    const pw = 320, ph = 268
    const px = width / 2 - pw / 2, py = height / 2 - ph / 2
    ctx.fillStyle = 'rgba(16, 24, 43, 0.96)'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = '#e8d4a0'
    ctx.lineWidth = 2
    ctx.strokeRect(px, py, pw, ph)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '16px "Press Start 2P", monospace'
    ctx.fillText('MENU', width / 2, py + 32)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(`JULIUS   LV ${this.save.level}   ${this.save.gold}G`, width / 2, py + 58)
    ctx.font = '13px "Press Start 2P", monospace'
    MENU_ITEMS.forEach((item, i) => {
      const iy = py + 104 + i * 38
      const sel = i === this.menuIndex
      if (sel) {
        ctx.fillStyle = 'rgba(246, 183, 74, 0.16)'
        ctx.fillRect(px + 24, iy - 15, pw - 48, 30)
      }
      ctx.fillStyle = sel ? '#f6b74a' : '#b7c7e6'
      ctx.fillText((sel ? '▶ ' : '   ') + item, width / 2, iy)
    })
    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('W/S MOVE   J SELECT   ESC CLOSE', width / 2, py + ph - 20)
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
    ctx.fillText('JULIUS  —  STATUS', width / 2, 56)

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
    stat('HEARTS', String(this.hearts))

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
    ctx.fillText('A/D SWAP     W/S SLOT     K CLOSE', width / 2, 116)

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
  if (node.isBoss) {
    const boss = new CastleActor(node.enemy, assets, layout.doorX - 180, layout.checkpointY, -1, 0.78)
    boss.setMaxHealth(campaignBossHealth(node.id))
    boss.meter = 100
    boss.isBoss = true
    return [boss]
  }
  const groups = [
    { def: node.enemy, count: campaignEnemyCount(node.enemy.id, node.difficulty) },
    ...(node.extraEnemies ?? []).map((extra) => ({ def: extra.def, count: extra.count })),
  ]
  const total = Math.max(1, groups.reduce((sum, group) => sum + group.count, 0))
  const slots = spread(layout.checkpointX + 360, layout.doorX - 160, total)
  const enemies: CastleActor[] = []
  let slot = 0
  for (const group of groups) {
    for (let i = 0; i < group.count; i += 1) {
      const x = slots[slot] ?? layout.doorX - 200
      const enemy = new CastleActor(group.def, assets, x, layout.checkpointY, -1, campaignEnemySpeed(group.def.id))
      enemy.setMaxHealth(campaignEnemyHealth(group.def.id, node.difficulty))
      if (group.def.id === 'boneThrower') enemy.rangedAttacker = true
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
  return difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3
}

function campaignEnemyHealth(enemyId: string, difficulty: 'easy' | 'normal' | 'hard'): number {
  if (enemyId === 'skeleton') return 21
  if (enemyId === 'zombie') return 6
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
    if (dist > 92) intent.moveX = dir
    else if (enemy.currentMove === null) intent.lightPressed = true
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
    if (dist > 156) intent.moveX = dir
    else if (dist > 90) {
      intent.moveX = dir
      if (enemy.grounded && rng.next() < 0.02) intent.jumpPressed = true
    } else if (enemy.currentMove === null) {
      if (dist < 78 || node.difficulty === 'hard') intent.heavyPressed = true
      else intent.lightPressed = true
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
  const spec = projectile.spawn.move.projectile
  if (!spec) return
  const x = projectile.spawn.facing === 1
    ? projectile.position.x - cameraX
    : projectile.position.x - cameraX - projectile.sheet.frameWidth * spec.scale
  const y = projectile.position.y - projectile.sheet.frameHeight * spec.scale
  drawSprite(renderer, projectile.sheet, projectile.animator.currentFrame, x, y, spec.scale, projectile.spawn.facing)
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
  return { x: candle.x - 9, y: candle.y - 28, width: 18, height: 32 }
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
  ctx.save()
  ctx.translate(bone.position.x - cameraX, bone.position.y)
  ctx.rotate(bone.spin)
  ctx.fillStyle = '#e8e2cf'
  ctx.strokeStyle = '#0b0912'
  ctx.lineWidth = 1
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

function drawVertPassage(ctx: CanvasRenderingContext2D, x: number, floorY: number, up: boolean, down: boolean, blink: number): void {
  const w = 76
  ctx.save()
  if (up) {
    const h = 150, top = floorY - h
    ctx.fillStyle = '#070510'
    ctx.fillRect(x - w / 2, top, w, h)
    const g = ctx.createLinearGradient(0, top, 0, floorY)
    g.addColorStop(0, 'rgba(120,96,56,0.30)')
    g.addColorStop(1, 'rgba(120,96,56,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - w / 2, top, w, h)
    ctx.fillStyle = '#3a3352'
    ctx.fillRect(x - w / 2 - 4, top - 10, w + 8, 10) // lintel
    ctx.fillRect(x - w / 2 - 6, top, 6, h)
    ctx.fillRect(x + w / 2, top, 6, h)
  }
  if (down) {
    ctx.fillStyle = '#070510'
    ctx.fillRect(x - w / 2, floorY - 6, w, 26)
    ctx.fillStyle = '#2a2238'
    for (let i = 0; i < 4; i++) ctx.fillRect(x - w / 2 + i * 8, floorY + i * 5 - 4, w - i * 16, 4)
  }
  const pulse = 0.5 + 0.5 * Math.sin(blink * 0.1)
  ctx.fillStyle = `rgba(232,212,160,${0.5 + 0.5 * pulse})`
  ctx.font = '9px "Press Start 2P", monospace'
  ctx.textAlign = 'center'
  const label = up && down ? 'W UP  S DOWN' : up ? 'W: UP' : 'S: DOWN'
  ctx.fillText(label, x, up ? floorY - 166 : floorY - 22)
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

function spike(x: number, width: number): Hazard {
  return { x, y: FLOOR_Y - 20, width, height: 20 }
}

function buildLayout(stage: string): RoomLayout {
  const base = { doorX: ROOM_WIDTH - 128, doorY: FLOOR_Y, checkpointX: 120, checkpointY: FLOOR_Y }
  switch (stage) {
    case 'outer_wall':
      return {
        ...base,
        backdrop: '#111221',
        doorX: ROOM_WIDTH - 132,
        platforms: [
          { x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 },
          { x: 180, y: 414, width: 190, height: 12 },
          { x: 460, y: 356, width: 180, height: 12 },
          { x: 760, y: 304, width: 210, height: 12, crumble: true },
          { x: 1120, y: 344, width: 180, height: 12 },
        ],
        hazards: [spike(600, 130), spike(1000, 150)],
      }
    case 'cathedral':
      return { ...base, backdrop: '#100b16', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 220, y: 364, width: 220, height: 12 }, { x: 560, y: 302, width: 240, height: 12 }, { x: 990, y: 344, width: 220, height: 12 }], hazards: [] }
    case 'library':
      return { ...base, backdrop: '#08121e', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 180, y: 382, width: 160, height: 12 }, { x: 420, y: 320, width: 180, height: 12 }, { x: 680, y: 262, width: 220, height: 12, crumble: true }, { x: 980, y: 324, width: 220, height: 12 }, { x: 1290, y: 284, width: 180, height: 12 }], hazards: [spike(860, 120)] }
    case 'clock_tower':
      return { ...base, backdrop: '#1a120b', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 160, y: 404, width: 170, height: 12 }, { x: 390, y: 350, width: 160, height: 12, crumble: true }, { x: 640, y: 292, width: 160, height: 12 }, { x: 890, y: 238, width: 160, height: 12, crumble: true }, { x: 1140, y: 304, width: 170, height: 12 }, { x: 1380, y: 246, width: 170, height: 12, crumble: true }], hazards: [spike(540, 120), spike(820, 120), spike(1080, 140)] }
    case 'catacombs':
      return { ...base, backdrop: '#081018', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 260, y: 378, width: 220, height: 12 }, { x: 620, y: 346, width: 220, height: 12, crumble: true }, { x: 1020, y: 378, width: 200, height: 12 }], hazards: [spike(880, 150)] }
    case 'throne_room':
      return { ...base, backdrop: '#13080c', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 360, y: 340, width: 200, height: 12 }, { x: 980, y: 340, width: 200, height: 12 }], hazards: [] }
    default:
      return { ...base, backdrop: '#0e0f18', platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 240, y: 382, width: 180, height: 12 }, { x: 520, y: 320, width: 200, height: 12 }, { x: 860, y: 372, width: 220, height: 12 }, { x: 1230, y: 300, width: 160, height: 12 }], hazards: [] }
  }
}

function hazardBox(hazard: Hazard): Rect {
  return { x: hazard.x, y: hazard.y, width: hazard.width, height: hazard.height }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, stage: string, castleGate = false): void {
  ctx.save()
  ctx.fillStyle = backdropColor(stage)
  ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT)
  ctx.fillStyle = 'rgba(8, 6, 14, 0.58)'
  ctx.fillRect(0, 364, ROOM_WIDTH, 212)
  ctx.fillStyle = 'rgba(20, 18, 31, 0.82)'
  ctx.fillRect(0, 220, ROOM_WIDTH, 14)
  ctx.fillRect(160, 140, 72, 180)
  ctx.fillRect(340, 120, 112, 220)
  ctx.fillRect(640, 100, 132, 240)
  ctx.fillRect(940, 80, 152, 260)
  ctx.fillRect(1260, 120, 112, 220)
  ctx.fillStyle = 'rgba(232, 212, 160, 0.08)'
  ctx.fillRect(240, 156, 22, 112)
  ctx.fillRect(520, 144, 22, 124)
  ctx.fillRect(840, 132, 22, 136)
  ctx.fillRect(1160, 152, 22, 116)
  if (stage === 'throne_room') {
    ctx.fillStyle = 'rgba(185, 29, 43, 0.12)'
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT)
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

/** Map an arrow/WASD key to a castle-map direction, or null for other keys. */
function mapDirForKey(code: string): MapDir | null {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      return 'n'
    case 'ArrowDown':
    case 'KeyS':
      return 's'
    case 'ArrowLeft':
    case 'KeyA':
      return 'w'
    case 'ArrowRight':
    case 'KeyD':
      return 'e'
    default:
      return null
  }
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
