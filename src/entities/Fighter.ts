import type { Renderer } from '../render/Renderer.ts'
import { Animator, drawSprite, type SpriteSheet } from '../render/SpriteRenderer.ts'
import type { IntentState } from '../input/InputSource.ts'
import type { Vec2, Facing, Rect } from '../types.ts'
import { clamp, lerp } from '../core/math.ts'
import { nextState } from './fsm/transitions.ts'
import {
  isLocomotion,
  type FighterStateId,
  type LocomotionState,
} from './fsm/FighterState.ts'
import {
  computeHitbox,
  isActiveAt,
  totalFrames,
  type AttackMove,
  type Moveset,
} from '../combat/AttackMove.ts'
import type { ProjectileSpawn } from '../combat/Projectile.ts'

// Per-tick physics. Stable across refresh rates thanks to the fixed timestep.
const GRAVITY = 0.8
const MOVE_SPEED = 4.2
const JUMP_VELOCITY = -16
const WALL_MARGIN = 70
const HURT_TICKS = 22
const HURT_FRICTION = 0.88

export const MAX_METER = 100
// Meter earned per point of damage dealt / taken.
const METER_PER_DAMAGE_DEALT = 1.2
const METER_PER_DAMAGE_TAKEN = 0.8

export interface FighterAnimations {
  idle: SpriteSheet
  run: SpriteSheet
  jump: SpriteSheet
  fall: SpriteSheet
  attack1: SpriteSheet
  attack2: SpriteSheet
  takeHit: SpriteSheet
  death: SpriteSheet
}

/** How a character's art sits inside its sprite cell, plus its body hurtbox. */
export interface FighterVisual {
  /** Frame-local x of the character's horizontal center, in source pixels. */
  anchorX: number
  /** Frame-local y of the character's feet (bottom), in source pixels. */
  anchorY: number
  scale: number
  /** Body hurtbox in world pixels, centered on the feet point and rising from it. */
  hurtbox: { width: number; height: number }
}

interface StateAnim {
  key: keyof FighterAnimations
  hold: number
  loop: boolean
}

const LOCO_ANIM: Record<LocomotionState, StateAnim> = {
  idle: { key: 'idle', hold: 9, loop: true },
  run: { key: 'run', hold: 6, loop: true },
  jump: { key: 'jump', hold: 10, loop: false },
  fall: { key: 'fall', hold: 10, loop: false },
}

/**
 * A fighter: physics body + animation + FSM + combat state. `position` is the
 * feet point (horizontal center, ground contact). Locomotion is table-driven;
 * attack/hurt/death are time-driven action states that lock out control.
 */
export class Fighter {
  readonly position: Vec2
  readonly velocity: Vec2 = { x: 0, y: 0 }
  facing: Facing
  readonly maxHealth = 100
  health = 100
  meter = 0

  private readonly prevPosition: Vec2
  private stateId: FighterStateId = 'idle'
  private grounded = true
  private readonly animator: Animator

  // Action-state bookkeeping.
  private attackMove: AttackMove | null = null
  private attackTick = 0
  private attackConnected = false
  private projectileSpawned = false
  private pendingProjectileSpawn: ProjectileSpawn | null = null
  private hurtTick = 0

  constructor(
    private readonly anims: FighterAnimations,
    private readonly visual: FighterVisual,
    private readonly moves: Moveset,
    spawnX: number,
    facing: Facing,
    private readonly floorY: number,
    private readonly stageWidth: number,
  ) {
    this.position = { x: spawnX, y: floorY }
    this.prevPosition = { x: spawnX, y: floorY }
    this.facing = facing
    this.animator = new Animator(anims.idle, LOCO_ANIM.idle.hold, true)
  }

  /** Restore to a fresh round state at the given spawn. Meter carries over. */
  reset(spawnX: number, facing: Facing): void {
    this.position.x = spawnX
    this.position.y = this.floorY
    this.prevPosition.x = spawnX
    this.prevPosition.y = this.floorY
    this.velocity.x = 0
    this.velocity.y = 0
    this.facing = facing
    this.health = this.maxHealth
    this.grounded = true
    this.attackMove = null
    this.attackTick = 0
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.hurtTick = 0
    this.stateId = 'idle'
    this.animator.play(this.anims.idle, LOCO_ANIM.idle.hold, true)
    this.animator.reset()
  }

  fillMeter(): void {
    this.meter = MAX_METER
  }

  // ---- simulation ---------------------------------------------------------

  update(intent: IntentState, opponentX: number): void {
    this.prevPosition.x = this.position.x
    this.prevPosition.y = this.position.y

    switch (this.stateId) {
      case 'death':
        this.animator.update()
        return
      case 'hurt':
        this.updateHurt()
        return
      case 'attack':
        this.updateAttack()
        return
      default:
        this.updateLocomotion(intent, opponentX)
    }
  }

  private updateLocomotion(intent: IntentState, opponentX: number): void {
    if (this.grounded) {
      const move = this.selectAttack(intent)
      if (move) {
        this.enterAttack(move, opponentX)
        return
      }
    }

    this.velocity.x = intent.moveX * MOVE_SPEED
    if (intent.moveX > 0) this.facing = 1
    else if (intent.moveX < 0) this.facing = -1
    else this.facing = opponentX >= this.position.x ? 1 : -1

    if (intent.jumpPressed && this.grounded) {
      this.velocity.y = JUMP_VELOCITY
      this.grounded = false
    }

    this.integrate()

    const current: LocomotionState = isLocomotion(this.stateId) ? this.stateId : 'idle'
    const next = nextState(current, {
      grounded: this.grounded,
      velocityY: this.velocity.y,
      moveX: intent.moveX,
    })
    if (next !== this.stateId) this.enterLocomotion(next)

    this.animator.update()
  }

  /** Map attack buttons to a move; special upgrades to super when meter allows
   *  (and spends it). Returns null if no attack was requested. */
  private selectAttack(intent: IntentState): AttackMove | null {
    if (intent.lightPressed) return this.moves.light
    if (intent.heavyPressed) return this.moves.heavy
    if (intent.specialPressed) {
      const cost = this.moves.super.meterCost ?? 0
      if (this.meter >= cost) {
        this.meter -= cost
        return this.moves.super
      }
      return this.moves.special
    }
    return null
  }

  private updateAttack(): void {
    this.attackTick += 1
    const move = this.attackMove
    if (move?.projectile && !this.projectileSpawned) {
      const spawnTick = move.projectile.spawnTick ?? move.startup
      if (this.attackTick >= spawnTick) {
        this.projectileSpawned = true
        this.pendingProjectileSpawn = {
          owner: this,
          move,
          spec: move.projectile,
          x: this.position.x + this.facing * move.projectile.offsetX,
          y: this.position.y + move.projectile.offsetY,
          facing: this.facing,
        }
      }
    }
    // A lunging move carries the fighter forward through its active window.
    const lunging = move?.lunge !== undefined && this.attackTick <= move.startup + move.active
    this.velocity.x = lunging && move ? this.facing * (move.lunge ?? 0) : 0
    this.position.x += this.velocity.x
    this.position.x = clamp(this.position.x, WALL_MARGIN, this.stageWidth - WALL_MARGIN)
    this.integrateVertical()

    if (move && this.attackTick >= totalFrames(move)) {
      this.attackMove = null
      this.enterLocomotion(this.grounded ? 'idle' : 'fall')
    }
    this.animator.update()
  }

  private updateHurt(): void {
    this.hurtTick += 1
    this.velocity.x *= HURT_FRICTION
    this.integrate()

    if (this.hurtTick >= HURT_TICKS && this.grounded) {
      this.enterLocomotion('idle')
    }
    this.animator.update()
  }

  /** Full horizontal + vertical integration with floor and wall collision. */
  private integrate(): void {
    this.position.x += this.velocity.x
    this.integrateVertical()
    this.position.x = clamp(this.position.x, WALL_MARGIN, this.stageWidth - WALL_MARGIN)
  }

  private integrateVertical(): void {
    this.velocity.y += GRAVITY
    this.position.y += this.velocity.y
    if (this.position.y >= this.floorY) {
      this.position.y = this.floorY
      this.velocity.y = 0
      this.grounded = true
    }
  }

  // ---- state entry --------------------------------------------------------

  private enterLocomotion(id: LocomotionState): void {
    this.stateId = id
    const cfg = LOCO_ANIM[id]
    this.animator.play(this.anims[cfg.key], cfg.hold, cfg.loop)
  }

  private enterAttack(move: AttackMove, opponentX: number): void {
    this.stateId = 'attack'
    this.attackMove = move
    this.attackTick = 0
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.velocity.x = 0
    this.facing = opponentX >= this.position.x ? 1 : -1

    const sheet = move.animKey === 'attack2' ? this.anims.attack2 : this.anims.attack1
    const hold = Math.max(1, Math.floor(totalFrames(move) / sheet.frameCount))
    this.animator.play(sheet, hold, false)
  }

  applyHit(move: AttackMove, fromX: number): void {
    if (this.stateId === 'death') return

    this.health = Math.max(0, this.health - move.damage)
    this.addMeter(move.damage * METER_PER_DAMAGE_TAKEN)
    const dir: Facing = this.position.x >= fromX ? 1 : -1
    this.velocity.x = dir * move.knockbackX
    this.velocity.y = move.knockbackY
    if (move.knockbackY < 0) this.grounded = false

    if (this.health <= 0) {
      this.stateId = 'death'
      this.velocity.x = 0
      this.animator.play(this.anims.death, 6, false)
      return
    }

    this.stateId = 'hurt'
    this.hurtTick = 0
    const takeHit = this.anims.takeHit
    const hold = Math.max(1, Math.floor(HURT_TICKS / takeHit.frameCount))
    this.animator.play(takeHit, hold, false)
  }

  private addMeter(amount: number): void {
    this.meter = clamp(this.meter + amount, 0, MAX_METER)
  }

  // ---- combat queries -----------------------------------------------------

  /** The live attack this tick (geometry + data), or null if none is active. */
  activeAttack(): { box: Rect; spec: AttackMove } | null {
    if (this.stateId !== 'attack' || !this.attackMove) return null
    if (this.attackConnected) return null
    if (!isActiveAt(this.attackMove, this.attackTick)) return null
    const box = computeHitbox(this.attackMove.hitbox, this.position.x, this.position.y, this.facing)
    return { box, spec: this.attackMove }
  }

  /** Called when this fighter's attack connects — rewards super meter. */
  markAttackConnected(): void {
    this.attackConnected = true
    if (this.attackMove) this.addMeter(this.attackMove.damage * METER_PER_DAMAGE_DEALT)
  }

  consumeProjectileSpawn(): ProjectileSpawn | null {
    const spawn = this.pendingProjectileSpawn
    this.pendingProjectileSpawn = null
    return spawn
  }

  get currentMove(): AttackMove | null {
    return this.attackMove
  }

  /** Shift horizontally (pushbox separation), clamped to the stage. */
  nudgeX(dx: number): void {
    this.position.x = clamp(this.position.x + dx, WALL_MARGIN, this.stageWidth - WALL_MARGIN)
  }

  get pushHalfWidth(): number {
    return this.visual.hurtbox.width / 2
  }

  hurtbox(): Rect {
    const { width, height } = this.visual.hurtbox
    return { x: this.position.x - width / 2, y: this.position.y - height, width, height }
  }

  canBeHit(): boolean {
    return this.stateId !== 'death'
  }

  get isDead(): boolean {
    return this.stateId === 'death'
  }

  get isAttacking(): boolean {
    return this.stateId === 'attack'
  }

  get healthFraction(): number {
    return this.health / this.maxHealth
  }

  get meterFraction(): number {
    return this.meter / MAX_METER
  }

  // ---- rendering ----------------------------------------------------------

  render(renderer: Renderer, alpha: number): void {
    const x = lerp(this.prevPosition.x, this.position.x, alpha)
    const y = lerp(this.prevPosition.y, this.position.y, alpha)

    const sheet = this.animator.activeSheet
    const { scale, anchorX, anchorY } = this.visual
    const effAnchorX = this.facing === 1 ? anchorX : sheet.frameWidth - anchorX
    const drawX = x - effAnchorX * scale
    const drawY = y - anchorY * scale

    drawSprite(renderer, sheet, this.animator.currentFrame, drawX, drawY, scale, this.facing)
  }
}
