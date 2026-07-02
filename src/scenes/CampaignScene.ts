import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { PauseScene } from './PauseScene.ts'
import { AssetManager } from '../assets/AssetManager.ts'
import { AUDIO_MANIFEST } from '../assets/manifest.ts'
import { addCampaignRelic, completeCampaignBattle, getCampaignChapter, getCampaignNode, loadCampaignSave } from '../data/campaign.ts'
import { buildRunModifiers, draftRelics, RELIC_POOL, type RelicDef, type RelicId, type RunModifiers } from '../data/relics.ts'
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
const CONTACT_HIT_COOLDOWN = 24
const BIG_HIT_FLASH_TICKS = 10
const SPIKE_DAMAGE = 14
const CRUMBLE_DELAY = 40
const CRUMBLE_RESPAWN = 150
const ROOM_CLEAR_AUTO_ADVANCE_TICKS = 240
const DEFEAT_RETRY_TICKS = 120
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

interface HeartPickup {
  position: Vec2
  velocity: Vec2
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
  grounded = true
  facing: Facing
  state: 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'dash' | 'hurt' | 'death' = 'idle'
  private glowPhase = 0
  private readonly sheets: SpriteSet
  private readonly animator: Animator
  private readonly moveSpeedMultiplier: number
  private attackMove: AttackMove | null = null
  private attackTick = 0
  private attackConnected = false
  private projectileSpawned = false
  private pendingProjectileSpawn: ProjectileSpawn | null = null
  private hurtTick = 0
  private invulnerableTicks = 0
  private jumpCount = 0
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
    this.animator.play(this.sheets.idle, 8, true)
    this.animator.reset()
  }

  update(intent: IntentState, opponentX: number, platforms: Platform[]): void {
    this.prevPosition.x = this.position.x
    this.prevPosition.y = this.position.y
    if (this.invulnerableTicks > 0) this.invulnerableTicks -= 1
    if (this.dashCooldown > 0) this.dashCooldown -= 1

    if (this.state === 'death') {
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
    this.health = Math.max(0, this.health - Math.max(1, Math.round(move.damage * damageMultiplier)))
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
    this.health = Math.max(0, this.health - Math.max(1, Math.round(damage * damageMultiplier)))
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

  tryJump(): void {
    if (!this.grounded && this.jumpCount >= 2) return
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
    const gy = this.position.y - this.def.visual.hurtbox.height * 0.5
    const radius = this.def.visual.hurtbox.width * (enraged ? 1.1 : 0.95)
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
    if (this.def.id === 'juliusBelmont' && this.state === 'attack') return 0.84
    return this.def.visual.scale
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
    const { width, height } = this.def.visual.hurtbox
    return { x: this.position.x - width / 2, y: this.position.y - height, width, height }
  }

  setMaxHealth(value: number): void {
    this.maxHealth = value
    this.health = value
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
  private candles: Candle[] = []
  private heartPickups: HeartPickup[] = []
  private input!: InputSource
  private cameraX = 0
  private clearTicks = 0
  private blink = 0
  private ending = false
  private transitionTicks = 0
  private hitstop = 0
  private flashTicks = 0
  private contactHitCooldown = 0
  private defeatTicks = 0
  private hearts = STARTING_HEARTS
  private selectedSubweaponIndex = 0
  private enemyFreezeTicks = 0
  private runMods: RunModifiers = buildRunModifiers([])
  private drafting = false
  private draftOptions: RelicDef[] = []
  private draftIndex = 0
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
    if (!this.ending && this.isRoomClear && isMenuConfirm(e.code)) {
      e.preventDefault()
      this.advanceRoom()
      return
    }
    if (e.code === 'Escape') {
      e.preventDefault()
      this.ctx.scenes.push(new PauseScene(this.ctx))
    }
    if (e.code === 'KeyM') this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.drafting || this.draftOptions.length === 0) return
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * this.ctx.width
    const py = ((e.clientY - rect.top) / rect.height) * this.ctx.height
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
    if (this.ending || this.drafting) return
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

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      if (this.enemyFreezeTicks > 0) continue
      const ai = enemyIntent(enemy, this.player, this.node, this.ctx.rng)
      enemy.update(ai, this.player.position.x, this.layout.platforms)
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
    for (const pickup of this.heartPickups) {
      pickup.velocity.y += 0.34
      pickup.position.x += pickup.velocity.x
      pickup.position.y += pickup.velocity.y
      if (pickup.position.y >= FLOOR_Y - 18) {
        pickup.position.y = FLOOR_Y - 18
        pickup.velocity.y = 0
      }
      pickup.ticksLeft -= 1
    }

    this.resolveCombat()
    this.projectiles = this.projectiles.filter((p) => p.ticksLeft > 0 && !p.hasHit)
    this.subweapons = this.subweapons.filter((p) => p.ticksLeft > 0 && !p.hasHit)
    this.resolveCandles()
    this.resolveHeartPickups()
    this.heartPickups = this.heartPickups.filter((pickup) => pickup.ticksLeft > 0)

    if (this.player.isDead && this.player.hurtbox().y > 0) {
      this.defeatTicks = 1
      this.hitstop = 0
      this.contactHitCooldown = CONTACT_HIT_COOLDOWN
      this.projectiles = []
      return
    }

    if (!this.player.isDead && this.enemies.every((enemy) => enemy.isDead)) {
      this.clearTicks += 1
      if (this.clearTicks > ROOM_CLEAR_AUTO_ADVANCE_TICKS || this.player.position.x >= this.layout.doorX - 24) {
        this.advanceRoom()
      }
    } else {
      this.clearTicks = 0
    }

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
    this.drawHud()
    if (this.ending) this.drawEnding()
    else if (this.drafting) this.drawDraft()
    else if (this.defeatTicks > 0) this.drawDefeat()
    else if (this.isRoomClear) this.drawRoomClear()
    else if (Math.floor(this.blink / 30) % 2 === 0) this.drawPrompt()
    this.drawFlash()
  }

  private get isRoomClear(): boolean {
    return !this.player.isDead && this.enemies.length > 0 && this.enemies.every((enemy) => enemy.isDead)
  }

  private get isCastleGateNode(): boolean {
    return this.node.id === '1999-dracula'
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
    this.player = new CastleActor(CAMPAIGN_HERO, this.ctx.assets, this.layout.checkpointX, this.layout.checkpointY, 1, this.runMods.moveSpeedMultiplier)
    this.player.setMaxHealth(100 + this.runMods.maxHealthBonus)
    this.player.reset(this.layout.checkpointX, this.layout.checkpointY, 1)
    this.player.meterGainMultiplier = this.runMods.meterGainMultiplier
    this.player.meter = this.runMods.startMeterBonus
    this.enemies = buildEnemies(this.node, this.ctx.assets, this.layout)
    this.projectiles = []
    this.subweapons = []
    this.candles = buildCandles(this.layout)
    this.heartPickups = []
    this.clearTicks = 0
    this.transitionTicks = fromReset ? 0 : 12
    this.hitstop = 0
    this.flashTicks = 0
    this.contactHitCooldown = 0
    this.defeatTicks = 0
    this.enemyFreezeTicks = 0
    this.attackingLastTick.clear()
    this.ending = false
    this.save = { ...this.save, currentNodeId: nodeId, finished: false }
  }

  private resolveCombat(): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      const playerAtk = this.player.activeAttack()
      const enemyAtk = enemy.activeAttack()
      if (playerAtk && rectsOverlap(playerAtk.box, enemy.hurtbox())) {
        if (enemy.applyHit(playerAtk.spec, this.player.position.x, this.runMods.damageMultiplier)) {
          this.player.markAttackConnected()
          this.onHit(playerAtk.spec, enemy.isDead)
        }
      }
      if (enemyAtk && rectsOverlap(enemyAtk.box, this.player.hurtbox())) {
        if (this.player.applyHit(enemyAtk.spec, enemy.position.x)) {
          enemy.markAttackConnected()
          this.onHit(enemyAtk.spec, this.player.isDead)
        }
      }
      if (this.contactHitCooldown <= 0 && rectsOverlap(this.player.hurtbox(), enemy.hurtbox())) {
        if (this.player.applyHit(enemy.def.moves.light, enemy.position.x)) {
          this.contactHitCooldown = CONTACT_HIT_COOLDOWN
          this.onHit(enemy.def.moves.light, this.player.isDead)
        }
      }
    }
    for (const projectile of this.projectiles) {
      if (projectile.hasHit) continue
      if (!rectsOverlap(projectileBox(projectile), this.player.hurtbox())) continue
      if (!this.player.applyHit(projectile.spawn.move, projectile.spawn.x)) continue
      projectile.hasHit = true
      this.onHit(projectile.spawn.move, this.player.isDead)
    }
    for (const subweapon of this.subweapons) {
      const box = subweaponBox(subweapon)
      if (subweapon.kind === 'holyWater' && subweapon.phase === 'flame') {
        for (const enemy of this.enemies) {
          if (enemy.isDead) continue
          if (subweapon.hitTargets?.has(enemy)) continue
          if (!rectsOverlap(box, enemy.hurtbox())) continue
          if (!enemy.applyFlatDamage(SUBWEAPON_DAMAGE.holyWater, subweapon.position.x, -4, this.runMods.damageMultiplier)) continue
          subweapon.hitTargets?.add(enemy)
          this.ctx.audio.hit()
          this.hitstop = Math.max(this.hitstop, 4)
          if (enemy.isDead) this.flashTicks = BIG_HIT_FLASH_TICKS
        }
        continue
      }
      if (subweapon.hasHit) continue
      for (const enemy of this.enemies) {
        if (enemy.isDead || !rectsOverlap(box, enemy.hurtbox())) continue
        if (!enemy.applyFlatDamage(SUBWEAPON_DAMAGE[subweapon.kind], subweapon.position.x, -6, this.runMods.damageMultiplier)) continue
        subweapon.hasHit = true
        this.ctx.audio.hit()
        this.hitstop = Math.max(this.hitstop, 6)
        if (enemy.isDead) this.flashTicks = BIG_HIT_FLASH_TICKS
        break
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
      if (!hitByWhip && !hitBySubweapon) continue
      candle.broken = true
      this.spawnHeart(candle.x, candle.y)
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

  private resolveHazards(): void {
    if (this.player.isDead || !this.player.canBeHit) return
    const box = this.player.hurtbox()
    for (const hazard of this.layout.hazards) {
      if (!rectsOverlap(box, hazardBox(hazard))) continue
      if (this.player.applyFlatDamage(SPIKE_DAMAGE, hazard.x + hazard.width / 2, -12)) {
        this.ctx.audio.hit()
        this.hitstop = Math.max(this.hitstop, 6)
        this.flashTicks = BIG_HIT_FLASH_TICKS
      }
      break
    }
  }

  private resolveHeartPickups(): void {
    const playerBox = this.player.hurtbox()
    for (const pickup of this.heartPickups) {
      if (!rectsOverlap(heartPickupBox(pickup), playerBox)) continue
      this.hearts = Math.min(MAX_HEARTS, this.hearts + pickup.value)
      pickup.ticksLeft = 0
      this.ctx.audio.hit()
    }
  }

  private spawnHeart(x: number, y: number): void {
    this.heartPickups.push({
      position: { x, y },
      velocity: { x: 0, y: -4.5 },
      value: 1,
      ticksLeft: 420,
    })
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

  private advanceRoom(): void {
    const next = completeCampaignBattle(this.save)
    this.save = next
    if (next.finished) {
      this.ending = true
      return
    }
    if (!next.currentNodeId) {
      this.ending = true
      return
    }
    // Offer a relic between rooms while any remain undrafted; the run modifiers
    // it grants persist to every future room via the campaign save.
    const options = draftRelics(this.ctx.rng, this.save.relicIds, 3)
    if (options.length > 0) {
      this.drafting = true
      this.draftOptions = options
      this.draftIndex = 0
      this.pendingNodeId = next.currentNodeId
      this.ctx.audio.swing()
      return
    }
    this.reloadNode(next.currentNodeId)
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
    if (nodeId) this.reloadNode(nodeId)
    else this.ending = true
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
    for (const pickup of this.heartPickups) drawHeartPickup(ctx, pickup)
    const doorOpen = this.enemies.every((enemy) => enemy.isDead)
    ctx.fillStyle = doorOpen ? '#e8d4a0' : '#3c374f'
    ctx.fillRect(this.layout.doorX, this.layout.doorY - 144, 76, 144)
    ctx.strokeStyle = '#0b0912'
    ctx.lineWidth = 4
    ctx.strokeRect(this.layout.doorX, this.layout.doorY - 144, 76, 144)
    ctx.fillStyle = '#b91d2d'
    ctx.fillRect(this.layout.doorX + 15, this.layout.doorY - 126, 10, 10)
    ctx.fillRect(this.layout.doorX + 51, this.layout.doorY - 126, 10, 10)
    ctx.restore()

    this.player.render(this.ctx.renderer, this.cameraX)
    for (const enemy of this.enemies) enemy.render(this.ctx.renderer, this.cameraX)
    for (const projectile of this.projectiles) renderProjectile(projectile, this.ctx.renderer, this.cameraX)
    for (const subweapon of this.subweapons) renderSubweapon(subweapon, this.ctx.renderer, this.cameraX)
    this.drawEnemyHealthBars()
    if (DEBUG_HITBOXES) this.drawDebugBoxes()
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
    for (const candle of this.candles) {
      if (!candle.broken) stroke(candleBox(candle), '#e8d4a0')
    }
    ctx.restore()
  }

  private drawHud(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.78)'
    ctx.fillRect(24, 20, 392, 84)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(24, 20, 392, 84)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('JULIUS BELMONT', 40, 36)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(`${this.chapter.year}  ${this.chapter.title.toUpperCase()}`, 40, 56)
    ctx.fillStyle = '#8a8aa0'
    ctx.fillText(this.node.title.toUpperCase(), 40, 72)
    ctx.fillStyle = '#b7c7e6'
    ctx.fillText(`SUB ${SUBWEAPON_LABELS[this.currentSubweapon()]}`, 266, 56)
    ctx.fillStyle = '#2a1014'
    ctx.fillRect(40, 90, 300, 10)
    ctx.fillStyle = '#b91d2d'
    ctx.fillRect(40, 90, 300 * (this.player.health / this.player.maxHealth), 10)
    ctx.strokeStyle = '#e8d4a0'
    ctx.strokeRect(40, 90, 300, 10)
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(`HEARTS ${this.hearts.toString().padStart(2, '0')}`, 266, 72)
    this.drawRelicPips(ctx)
    ctx.restore()
  }

  private drawRelicPips(ctx: CanvasRenderingContext2D): void {
    if (this.save.relicIds.length === 0) return
    const size = 12
    const gap = 6
    let x = 40
    const y = 108
    for (const id of this.save.relicIds) {
      ctx.fillStyle = RELIC_PIP_COLORS[id] ?? '#e8d4a0'
      ctx.fillRect(x, y, size, size)
      ctx.strokeStyle = '#0b0912'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, size, size)
      x += size + gap
    }
  }

  private drawPrompt(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('A/D MOVE   W UP   J JUMP   ; DASH', this.ctx.width / 2, this.ctx.height - 38)
    ctx.fillText('K ATTACK   W+K USE   L SWITCH   ESC PAUSE', this.ctx.width / 2, this.ctx.height - 22)
    ctx.restore()
  }

  private drawRoomClear(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(8, 6, 14, 0.68)'
    ctx.fillRect(this.ctx.width / 2 - 240, this.ctx.height - 76, 480, 44)
    ctx.strokeStyle = '#e8d4a0'
    ctx.lineWidth = 2
    ctx.strokeRect(this.ctx.width / 2 - 240, this.ctx.height - 76, 480, 44)
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('ROOM CLEAR', this.ctx.width / 2, this.ctx.height - 60)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('J ADVANCE     OR WALK TO THE DOOR', this.ctx.width / 2, this.ctx.height - 42)
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
      enemies.push(enemy)
      slot += 1
    }
  }
  return enemies
}

function campaignEnemySpeed(enemyId: string): number {
  if (enemyId === 'armoredSkeleton') return 0.58
  if (enemyId === 'ghoul') return 1.02
  return 0.78
}

function campaignBossHealth(nodeId: string): number {
  if (nodeId === '1997-seal') return 210
  if (nodeId === '1999-dracula') return 240
  return 180
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

function heartPickupBox(pickup: HeartPickup): Rect {
  return { x: pickup.position.x - 9, y: pickup.position.y - 9, width: 18, height: 18 }
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

function drawHeartPickup(ctx: CanvasRenderingContext2D, pickup: HeartPickup): void {
  ctx.save()
  ctx.fillStyle = '#b91d2d'
  ctx.fillRect(pickup.position.x - 5, pickup.position.y - 7, 10, 12)
  ctx.fillRect(pickup.position.x - 8, pickup.position.y - 4, 16, 7)
  ctx.fillStyle = '#ff9f9f'
  ctx.fillRect(pickup.position.x - 2, pickup.position.y - 5, 3, 3)
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
