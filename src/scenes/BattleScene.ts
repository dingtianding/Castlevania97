import { Scene } from './Scene.ts'
import { ResultScene } from './ResultScene.ts'
import { Fighter } from '../entities/Fighter.ts'
import { createFighter } from '../entities/createFighter.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { AISource, type AIDifficulty } from '../input/AISource.ts'
import { PLAYER1_KEYS, PLAYER2_KEYS } from '../input/bindings.ts'
import { neutralIntent, type InputSource } from '../input/InputSource.ts'
import { CombatSystem } from '../combat/CombatSystem.ts'
import { RoundManager } from '../combat/RoundManager.ts'
import { ParticleSystem } from '../fx/ParticleSystem.ts'
import { emitHitSparks } from '../fx/HitSparks.ts'
import { HUD } from '../ui/HUD.ts'
import { AUDIO_MANIFEST } from '../assets/manifest.ts'
import { ROSTER } from '../data/characters/registry.ts'
import type { CharacterDef } from '../data/characters/CharacterDef.ts'
import type { ArcadeRun } from '../data/arcade.ts'
import type { GameContext } from '../core/GameContext.ts'
import { FLOOR_Y } from '../constants.ts'
import { TICK_RATE } from '../core/Time.ts'
import type { Rect } from '../types.ts'

/** Which characters fill the two player slots, and who controls P2. When part
 *  of an arcade run, `arcade` carries the ladder state for the result screen. */
export interface BattleConfig {
  p1: CharacterDef
  p2: CharacterDef
  p2Controller?: 'human' | 'ai'
  aiDifficulty?: AIDifficulty
  arcade?: ArcadeRun
}

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

const DEBUG_HITBOXES = new URLSearchParams(location.search).has('hitbox')

/**
 * P3 battle: two keyboard-driven fighters, frame-data combat, health, and a DOM
 * HUD with a round timer. Best-of-3 rounds and the result screen arrive in P4.
 */
export class BattleScene extends Scene {
  private p1!: Fighter
  private p2!: Fighter
  private input1!: KeyboardSource
  private input2!: InputSource
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

  constructor(
    ctx: GameContext,
    private readonly config: BattleConfig = { p1: ROSTER[0]!, p2: ROSTER[1]! },
  ) {
    super(ctx)
  }

  override enter(): void {
    const { assets } = this.ctx

    this.p1 = createFighter(this.config.p1, assets, P1_SPAWN, 1, FLOOR_Y, this.ctx.width)
    this.p2 = createFighter(this.config.p2, assets, P2_SPAWN, -1, FLOOR_Y, this.ctx.width)
    this.input1 = new KeyboardSource(PLAYER1_KEYS)

    if (this.config.p2Controller === 'ai') {
      const ai = new AISource(this.config.aiDifficulty ?? 'normal', this.ctx.rng)
      ai.bind(this.p2, this.p1)
      this.input2 = ai
    } else {
      this.input2 = new KeyboardSource(PLAYER2_KEYS)
    }

    const container = document.querySelector<HTMLElement>('#hud')
    if (!container) throw new Error('#hud container not found')
    this.hud = new HUD(container)
    this.syncHud()

    this.ctx.audio.startBgm(AUDIO_MANIFEST['bgm.battle'])
  }

  override exit(): void {
    this.input1.dispose()
    this.input2.dispose?.()
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
          new ResultScene(
            this.ctx,
            {
              winner: this.rounds.matchWinner,
              p1Wins: this.rounds.p1Wins,
              p2Wins: this.rounds.p2Wins,
            },
            this.config,
          ),
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
    this.hud.setMeter(this.p1.meterFraction, this.p2.meterFraction)
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
