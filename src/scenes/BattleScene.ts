import { Scene } from './Scene.ts'
import { Fighter, type FighterAnimations, type FighterVisual } from '../entities/Fighter.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { PLAYER1_KEYS, PLAYER2_KEYS } from '../input/bindings.ts'
import { makeSheet } from '../render/SpriteRenderer.ts'
import { CombatSystem } from '../combat/CombatSystem.ts'
import type { AttackMove } from '../combat/AttackMove.ts'
import { HUD } from '../ui/HUD.ts'
import { FLOOR_Y } from '../constants.ts'
import { TICK_RATE } from '../core/Time.ts'
import type { Rect } from '../types.ts'

const ROUND_SECONDS = 60
const ROUND_TICKS = ROUND_SECONDS * TICK_RATE

// Anchors/hurtboxes measured from the sprite cells' non-transparent bounds.
const MACK_VISUAL: FighterVisual = {
  anchorX: 95,
  anchorY: 123,
  scale: 3.6,
  hurtbox: { width: 74, height: 185 },
}
const KENJI_VISUAL: FighterVisual = {
  anchorX: 102,
  anchorY: 128,
  scale: 3.5,
  hurtbox: { width: 74, height: 190 },
}

const MACK_LIGHT: AttackMove = {
  id: 'mack-light',
  animKey: 'attack1',
  startup: 8,
  active: 6,
  recovery: 16,
  damage: 9,
  knockbackX: 7,
  knockbackY: -5,
  hitstop: 6,
  hitbox: { forward: 18, top: 185, width: 118, height: 95 },
}
const KENJI_LIGHT: AttackMove = {
  id: 'kenji-light',
  animKey: 'attack1',
  startup: 7,
  active: 5,
  recovery: 15,
  damage: 8,
  knockbackX: 7,
  knockbackY: -5,
  hitstop: 6,
  hitbox: { forward: 22, top: 182, width: 110, height: 95 },
}

const DEBUG_HITBOXES = new URLSearchParams(location.search).has('hitbox')

/**
 * P3 battle: two keyboard-driven fighters, frame-data combat, health, and a DOM
 * HUD with a round timer. Best-of-3 rounds and the result screen arrive in P4.
 */
export class BattleScene extends Scene {
  private p1!: Fighter
  private p2!: Fighter
  private input1!: KeyboardSource
  private input2!: KeyboardSource
  private hud!: HUD
  private readonly combat = new CombatSystem()
  private ticksLeft = ROUND_TICKS
  private over = false

  override enter(): void {
    const { assets } = this.ctx

    const mackAnims: FighterAnimations = {
      idle: makeSheet(assets.image('mack.idle'), 8),
      run: makeSheet(assets.image('mack.run'), 8),
      jump: makeSheet(assets.image('mack.jump'), 2),
      fall: makeSheet(assets.image('mack.fall'), 2),
      attack1: makeSheet(assets.image('mack.attack1'), 6),
      takeHit: makeSheet(assets.image('mack.takeHit'), 4),
      death: makeSheet(assets.image('mack.death'), 6),
    }
    const kenjiAnims: FighterAnimations = {
      idle: makeSheet(assets.image('kenji.idle'), 4),
      run: makeSheet(assets.image('kenji.run'), 8),
      jump: makeSheet(assets.image('kenji.jump'), 2),
      fall: makeSheet(assets.image('kenji.fall'), 2),
      attack1: makeSheet(assets.image('kenji.attack1'), 4),
      takeHit: makeSheet(assets.image('kenji.takeHit'), 3),
      death: makeSheet(assets.image('kenji.death'), 7),
    }

    this.p1 = new Fighter(mackAnims, MACK_VISUAL, MACK_LIGHT, 320, 1, FLOOR_Y, this.ctx.width)
    this.p2 = new Fighter(kenjiAnims, KENJI_VISUAL, KENJI_LIGHT, 704, -1, FLOOR_Y, this.ctx.width)
    this.input1 = new KeyboardSource(PLAYER1_KEYS)
    this.input2 = new KeyboardSource(PLAYER2_KEYS)

    const container = document.querySelector<HTMLElement>('#hud')
    if (!container) throw new Error('#hud container not found')
    this.hud = new HUD(container)
    this.syncHud()
  }

  override exit(): void {
    this.input1.dispose()
    this.input2.dispose()
    this.hud.dispose()
  }

  update(): void {
    if (this.over) return

    this.p1.update(this.input1.poll(), this.p2.position.x)
    this.p2.update(this.input2.poll(), this.p1.position.x)
    this.separateBodies()
    this.combat.resolve(this.p1, this.p2)

    this.ticksLeft -= 1
    this.syncHud()

    if (this.p1.isDead || this.p2.isDead || this.ticksLeft <= 0) {
      this.over = true
      this.hud.setBanner(this.resultText())
    }
  }

  /** Keep the two bodies from interpenetrating by splitting any overlap. */
  private separateBodies(): void {
    const minDist = this.p1.pushHalfWidth + this.p2.pushHalfWidth
    let dx = this.p2.position.x - this.p1.position.x
    if (dx === 0) dx = 1
    const dist = Math.abs(dx)
    if (dist >= minDist) return

    const push = (minDist - dist) / 2
    const dir = Math.sign(dx)
    this.p1.nudgeX(-dir * push)
    this.p2.nudgeX(dir * push)
  }

  private resultText(): string {
    if (this.p1.isDead && this.p2.isDead) return 'DRAW'
    if (this.p2.isDead || this.p1.health > this.p2.health) return 'P1 WINS'
    if (this.p1.isDead || this.p2.health > this.p1.health) return 'P2 WINS'
    return 'TIME'
  }

  private syncHud(): void {
    this.hud.setHealth(this.p1.healthFraction, this.p2.healthFraction)
    this.hud.setTimer(this.ticksLeft / TICK_RATE)
  }

  render(alpha: number): void {
    const { renderer, camera, assets } = this.ctx
    renderer.clear('#000')
    camera.begin(renderer)

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, this.ctx.width, this.ctx.height)
    this.p1.render(renderer, alpha)
    this.p2.render(renderer, alpha)

    if (DEBUG_HITBOXES) this.drawDebug()
    camera.end(renderer)
  }

  private drawDebug(): void {
    const { ctx } = this.ctx.renderer
    const stroke = (rect: Rect, color: string): void => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
    }
    for (const f of [this.p1, this.p2]) {
      stroke(f.hurtbox(), '#39d353')
      const atk = f.activeAttack()
      if (atk) stroke(atk.box, '#ff2d2d')
    }
  }
}
