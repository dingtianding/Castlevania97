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
} from '../combat/AttackMove.ts'

// Per-tick physics. Stable across refresh rates thanks to the fixed timestep.
const GRAVITY = 0.8
const MOVE_SPEED = 4.2
const JUMP_VELOCITY = -16
const WALL_MARGIN = 70
const HURT_TICKS = 22
const HURT_FRICTION = 0.88

export interface FighterAnimations {
  idle: SpriteSheet
  run: SpriteSheet
  jump: SpriteSheet
  fall: SpriteSheet
  attack1: SpriteSheet
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

  private readonly prevPosition: Vec2
  private stateId: FighterStateId = 'idle'
  private grounded = true
  private readonly animator: Animator

  // Action-state bookkeeping.
  private attackMove: AttackMove | null = null
  private attackTick = 0
  private attackConnected = false
  private hurtTick = 0

  constructor(
    private readonly anims: FighterAnimations,
    private readonly visual: FighterVisual,
    private readonly lightMove: AttackMove,
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

  // ---- simulation ---------------------------------------------------------

  /** Restore to a fresh round state at the given spawn. */
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
    this.hurtTick = 0
    this.stateId = 'idle'
    this.animator.play(this.anims.idle, LOCO_ANIM.idle.hold, true)
    this.animator.reset()
  }

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
    if (intent.attackPressed && this.grounded) {
      this.enterAttack(opponentX)
      return
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

  private updateAttack(): void {
    this.attackTick += 1
    // Grounded attacks root the fighter in place; gravity still applies so an
    // attack interrupted in air keeps falling.
    this.velocity.x = 0
    this.integrateVertical()

    if (this.attackMove && this.attackTick >= totalFrames(this.attackMove)) {
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

  private enterAttack(opponentX: number): void {
    this.stateId = 'attack'
    this.attackMove = this.lightMove
    this.attackTick = 0
    this.attackConnected = false
    this.velocity.x = 0
    this.facing = opponentX >= this.position.x ? 1 : -1

    const sheet = this.anims.attack1
    const hold = Math.max(1, Math.floor(totalFrames(this.lightMove) / sheet.frameCount))
    this.animator.play(sheet, hold, false)
  }

  applyHit(move: AttackMove, fromX: number): void {
    if (this.stateId === 'death') return

    this.health = Math.max(0, this.health - move.damage)
    const dir: Facing = this.position.x >= fromX ? 1 : -1
    this.velocity.x = dir * move.knockbackX
    this.velocity.y = move.knockbackY
    if (move.knockbackY < 0) this.grounded = false

    if (this.health <= 0) {
      this.stateId = 'death'
      this.velocity.x = 0
      const death = this.anims.death
      this.animator.play(death, 6, false)
      return
    }

    this.stateId = 'hurt'
    this.hurtTick = 0
    const takeHit = this.anims.takeHit
    const hold = Math.max(1, Math.floor(HURT_TICKS / takeHit.frameCount))
    this.animator.play(takeHit, hold, false)
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

  markAttackConnected(): void {
    this.attackConnected = true
  }

  /** Shift horizontally (pushbox separation), clamped to the stage. */
  nudgeX(dx: number): void {
    this.position.x = clamp(this.position.x + dx, WALL_MARGIN, this.stageWidth - WALL_MARGIN)
  }

  /** Half-width of the body pushbox (fighters can't overlap closer than the
   *  sum of their half-widths). */
  get pushHalfWidth(): number {
    return this.visual.hurtbox.width / 2
  }

  hurtbox(): Rect {
    const { width, height } = this.visual.hurtbox
    return {
      x: this.position.x - width / 2,
      y: this.position.y - height,
      width,
      height,
    }
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
