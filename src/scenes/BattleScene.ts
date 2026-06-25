import { Scene } from './Scene.ts'
import { ResultScene } from './ResultScene.ts'
import { Fighter, type FighterAnimations, type FighterVisual } from '../entities/Fighter.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { PLAYER1_KEYS, PLAYER2_KEYS } from '../input/bindings.ts'
import { neutralIntent } from '../input/InputSource.ts'
import { makeSheet } from '../render/SpriteRenderer.ts'
import { CombatSystem } from '../combat/CombatSystem.ts'
import type { AttackMove } from '../combat/AttackMove.ts'
import { RoundManager } from '../combat/RoundManager.ts'
import { ParticleSystem } from '../fx/ParticleSystem.ts'
import { emitHitSparks } from '../fx/HitSparks.ts'
import { HUD } from '../ui/HUD.ts'
import { AUDIO_MANIFEST } from '../assets/manifest.ts'
import { FLOOR_Y } from '../constants.ts'
import { TICK_RATE } from '../core/Time.ts'
import type { Rect } from '../types.ts'

const ROUND_TICKS = 60 * TICK_RATE
const INTRO_TICKS = 110
const ROUND_OVER_TICKS = 130
/** How long the match-result banner holds before the ResultScene takes over. */
const MATCH_OVER_HOLD = 120
/** Real ticks of KO slow-motion (simulation runs at 1/SLOWMO_DIVISOR speed). */
const KO_SLOWMO_TICKS = 72
const SLOWMO_DIVISOR = 3
/** Trauma added to the camera per landed hit. */
const HIT_TRAUMA = 0.42

const P1_SPAWN = 320
const P2_SPAWN = 704

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
  private readonly rounds = new RoundManager(ROUND_TICKS, INTRO_TICKS, ROUND_OVER_TICKS)
  private readonly particles = new ParticleSystem(140)
  private matchOverHold = MATCH_OVER_HOLD
  private hitstop = 0
  private slowmoLeft = 0
  private slowmoPhase = 0
  private p1WasAttacking = false
  private p2WasAttacking = false

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

    this.p1 = new Fighter(mackAnims, MACK_VISUAL, MACK_LIGHT, P1_SPAWN, 1, FLOOR_Y, this.ctx.width)
    this.p2 = new Fighter(kenjiAnims, KENJI_VISUAL, KENJI_LIGHT, P2_SPAWN, -1, FLOOR_Y, this.ctx.width)
    this.input1 = new KeyboardSource(PLAYER1_KEYS)
    this.input2 = new KeyboardSource(PLAYER2_KEYS)

    const container = document.querySelector<HTMLElement>('#hud')
    if (!container) throw new Error('#hud container not found')
    this.hud = new HUD(container)
    this.syncHud()

    this.ctx.audio.startBgm(AUDIO_MANIFEST['bgm.battle'])
  }

  override exit(): void {
    this.input1.dispose()
    this.input2.dispose()
    this.hud.dispose()
    this.ctx.audio.stopBgm()
  }

  update(): void {
    // Hitstop freezes the whole simulation for a few ticks so blows land with
    // weight. Time itself stops — fighters, combat, and the round clock.
    if (this.hitstop > 0) {
      this.hitstop -= 1
      return
    }
    // KO slow-motion: run the simulation at a fraction of speed by skipping
    // ticks (never by scaling FIXED_DT, which would break determinism).
    if (this.slowmoLeft > 0) {
      this.slowmoLeft -= 1
      this.slowmoPhase = (this.slowmoPhase + 1) % SLOWMO_DIVISOR
      if (this.slowmoPhase !== 0) return
    }

    // Players only act during the fight phase; otherwise neutral input keeps
    // KO/idle animations playing while banners (READY/FIGHT/K.O.) show.
    const fighting = this.rounds.isFighting
    const i1 = fighting ? this.input1.poll() : neutralIntent()
    const i2 = fighting ? this.input2.poll() : neutralIntent()

    this.p1.update(i1, this.p2.position.x)
    this.p2.update(i2, this.p1.position.x)
    this.separateBodies()
    this.playSwingSfx()

    if (fighting) {
      const hits = this.combat.resolve(this.p1, this.p2)
      for (const hit of hits) {
        emitHitSparks(this.particles, hit.point.x, hit.point.y, hit.dir, this.ctx.rng)
        this.ctx.camera.addTrauma(HIT_TRAUMA)
        this.ctx.audio.hit()
        this.hitstop = Math.max(this.hitstop, hit.hitstop)
        if (hit.defender.isDead) this.slowmoLeft = KO_SLOWMO_TICKS
      }
    }

    this.particles.update()
    this.ctx.camera.tick(this.ctx.rng)

    const signal = this.rounds.update(this.p1, this.p2)
    if (signal === 'newRound') {
      this.p1.reset(P1_SPAWN, 1)
      this.p2.reset(P2_SPAWN, -1)
    }

    this.syncHud()

    if (this.rounds.isMatchOver) {
      this.matchOverHold -= 1
      if (this.matchOverHold <= 0) {
        this.ctx.scenes.replace(
          new ResultScene(this.ctx, {
            winner: this.rounds.matchWinner,
            p1Wins: this.rounds.p1Wins,
            p2Wins: this.rounds.p2Wins,
          }),
        )
      }
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

  /** Play a swing sound on the tick a fighter starts an attack. */
  private playSwingSfx(): void {
    if (this.p1.isAttacking && !this.p1WasAttacking) this.ctx.audio.swing()
    if (this.p2.isAttacking && !this.p2WasAttacking) this.ctx.audio.swing()
    this.p1WasAttacking = this.p1.isAttacking
    this.p2WasAttacking = this.p2.isAttacking
  }

  private syncHud(): void {
    this.hud.setHealth(this.p1.healthFraction, this.p2.healthFraction)
    this.hud.setTimer(this.rounds.timeLeftSeconds)
    this.hud.setRounds(this.rounds.p1Wins, this.rounds.p2Wins)
    this.hud.setBanner(this.rounds.bannerText)
  }

  render(alpha: number): void {
    const { renderer, camera, assets } = this.ctx
    renderer.clear('#000')
    camera.begin(renderer)

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, this.ctx.width, this.ctx.height)
    this.p1.render(renderer, alpha)
    this.p2.render(renderer, alpha)
    this.particles.render(renderer)

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
