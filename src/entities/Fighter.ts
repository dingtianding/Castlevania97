import type { Renderer } from '../render/Renderer.ts'
import { Animator, drawSprite, type SpriteSheet } from '../render/SpriteRenderer.ts'
import type { IntentState } from '../input/InputSource.ts'
import type { Vec2, Facing } from '../types.ts'
import { clamp, lerp } from '../core/math.ts'
import { nextState } from './fsm/transitions.ts'
import type { FighterStateId } from './fsm/FighterState.ts'

// Per-tick physics. Because the loop steps at a fixed 60 Hz these are stable
// regardless of monitor refresh rate.
const GRAVITY = 0.8
const MOVE_SPEED = 4.2
const JUMP_VELOCITY = -16
/** Keep the fighter's center this far from the stage edges. */
const WALL_MARGIN = 70

export interface FighterAnimations {
  idle: SpriteSheet
  run: SpriteSheet
  jump: SpriteSheet
  fall: SpriteSheet
}

/**
 * How a character's art sits inside its (mostly empty) sprite cell. These
 * sheets place a small figure in the upper-left of a 200×200 frame, so we
 * anchor by the character's feet rather than the frame box.
 */
export interface FighterVisual {
  /** Frame-local x of the character's horizontal center, in source pixels. */
  anchorX: number
  /** Frame-local y of the character's feet (bottom), in source pixels. */
  anchorY: number
  /** Source→screen scale factor. */
  scale: number
}

interface StateAnim {
  key: keyof FighterAnimations
  hold: number
  loop: boolean
}

const STATE_ANIM: Record<FighterStateId, StateAnim> = {
  idle: { key: 'idle', hold: 9, loop: true },
  run: { key: 'run', hold: 6, loop: true },
  jump: { key: 'jump', hold: 10, loop: false },
  fall: { key: 'fall', hold: 10, loop: false },
}

/**
 * A controllable fighter: physics body + animation + locomotion FSM. Its
 * `position` is the feet point (horizontal center, ground contact) in world
 * space. Reads intents only; never touches the input device or another
 * fighter. Combat (hitboxes, health, hurt/death states) arrives in P3.
 */
export class Fighter {
  /** Feet point: x = horizontal center, y = ground-contact line. */
  readonly position: Vec2
  readonly velocity: Vec2 = { x: 0, y: 0 }
  facing: Facing

  private readonly prevPosition: Vec2
  private stateId: FighterStateId = 'idle'
  private grounded = true
  private readonly animator: Animator

  constructor(
    private readonly anims: FighterAnimations,
    private readonly visual: FighterVisual,
    spawnX: number,
    facing: Facing,
    private readonly floorY: number,
    private readonly stageWidth: number,
  ) {
    this.position = { x: spawnX, y: floorY }
    this.prevPosition = { x: spawnX, y: floorY }
    this.facing = facing
    this.animator = new Animator(anims.idle, STATE_ANIM.idle.hold, true)
  }

  update(intent: IntentState): void {
    this.prevPosition.x = this.position.x
    this.prevPosition.y = this.position.y

    this.velocity.x = intent.moveX * MOVE_SPEED
    if (intent.moveX > 0) this.facing = 1
    else if (intent.moveX < 0) this.facing = -1

    if (intent.jumpPressed && this.grounded) {
      this.velocity.y = JUMP_VELOCITY
      this.grounded = false
    }

    this.velocity.y += GRAVITY
    this.position.x += this.velocity.x
    this.position.y += this.velocity.y

    if (this.position.y >= this.floorY) {
      this.position.y = this.floorY
      this.velocity.y = 0
      this.grounded = true
    }

    this.position.x = clamp(this.position.x, WALL_MARGIN, this.stageWidth - WALL_MARGIN)

    const next = nextState(this.stateId, {
      grounded: this.grounded,
      velocityY: this.velocity.y,
      moveX: intent.moveX,
    })
    if (next !== this.stateId) this.setState(next)

    this.animator.update()
  }

  private setState(id: FighterStateId): void {
    this.stateId = id
    const cfg = STATE_ANIM[id]
    this.animator.play(this.anims[cfg.key], cfg.hold, cfg.loop)
  }

  /** Draw at the position interpolated between the last two ticks by `alpha`,
   *  so motion is smooth even when rendering above 60 Hz. The feet anchor is
   *  mirrored about the character's center when facing left. */
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
