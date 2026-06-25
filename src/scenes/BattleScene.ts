import { Scene } from './Scene.ts'
import { ResultScene } from './ResultScene.ts'
import { PauseScene } from './PauseScene.ts'
import { Fighter } from '../entities/Fighter.ts'
import { createFighter } from '../entities/createFighter.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { GamepadSource } from '../input/GamepadSource.ts'
import { CompositeSource } from '../input/CompositeSource.ts'
import { createTouchControlState } from '../input/TouchSource.ts'
import { TouchSource } from '../input/TouchSource.ts'
import { AISource, type AIDifficulty } from '../input/AISource.ts'
import { PLAYER1_KEYS, PLAYER2_KEYS } from '../input/bindings.ts'
import { neutralIntent, type InputSource } from '../input/InputSource.ts'
import { CombatSystem } from '../combat/CombatSystem.ts'
import { ProjectileSystem } from '../combat/Projectile.ts'
import { RoundManager } from '../combat/RoundManager.ts'
import { ParticleSystem } from '../fx/ParticleSystem.ts'
import { emitHitSparks } from '../fx/HitSparks.ts'
import { HUD } from '../ui/HUD.ts'
import { TouchControls } from '../ui/TouchControls.ts'
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
  p2Controller?: 'human' | 'ai' | 'dummy'
  aiDifficulty?: AIDifficulty
  arcade?: ArcadeRun
  selectMode?: 'local' | 'ai' | 'training' | 'arcade' | 'boss'
  rules?: 'match' | 'training'
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
const BIG_HIT_FLASH_TICKS = 10

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
  private input1!: InputSource
  private input2!: InputSource
  private hud!: HUD
  private readonly combat = new CombatSystem()
  private readonly projectiles: ProjectileSystem
  private readonly rounds = new RoundManager(ROUND_TICKS, INTRO_TICKS, ROUND_OVER_TICKS)
  private readonly particles = new ParticleSystem(140)
  private matchOverHold = MATCH_OVER_HOLD
  private hitstop = 0
  private slowmoLeft = 0
  private slowmoPhase = 0
  private p1WasAttacking = false
  private p2WasAttacking = false
  private touchControls: TouchControls | null = null
  private flashTicks = 0
  private trainingLastDamage = 0
  private trainingComboHits = 0
  private trainingComboTicks = 0

  constructor(
    ctx: GameContext,
    private readonly config: BattleConfig = { p1: ROSTER[0]!, p2: ROSTER[1]! },
  ) {
    super(ctx)
    this.projectiles = new ProjectileSystem(ctx.assets)
  }

  override enter(): void {
    const { assets } = this.ctx

    this.p1 = createFighter(this.config.p1, assets, P1_SPAWN, 1, FLOOR_Y, this.ctx.width)
    this.p2 = createFighter(this.config.p2, assets, P2_SPAWN, -1, FLOOR_Y, this.ctx.width)
    if (this.isTraining) {
      this.p1.fillMeter()
      this.p2.fillMeter()
    }
    // Each human slot accepts keyboard or gamepad interchangeably.
    const input1Sources: InputSource[] = [new KeyboardSource(PLAYER1_KEYS), new GamepadSource(0)]
    if (window.matchMedia('(pointer: coarse)').matches) {
      const touchState = createTouchControlState()
      input1Sources.push(new TouchSource(touchState))
      const overlay = document.querySelector<HTMLElement>('#overlay')
      if (overlay) this.touchControls = new TouchControls(overlay, touchState)
    }
    this.input1 = new CompositeSource(input1Sources)

    if (this.config.p2Controller === 'ai') {
      const ai = new AISource(this.config.aiDifficulty ?? 'normal', this.ctx.rng)
      ai.bind(this.p2, this.p1)
      this.input2 = ai
    } else if (this.config.p2Controller === 'dummy') {
      this.input2 = { poll: neutralIntent }
    } else {
      this.input2 = new CompositeSource([new KeyboardSource(PLAYER2_KEYS), new GamepadSource(1)])
    }

    const container = document.querySelector<HTMLElement>('#hud')
    if (!container) throw new Error('#hud container not found')
    this.hud = new HUD(container)
    this.hud.setNames(this.config.p1.name, this.config.p2.name)
    this.syncHud()

    this.ctx.audio.startBgm(AUDIO_MANIFEST['bgm.battle'])
    window.addEventListener('keydown', this.onPauseKey)
  }

  /** Esc pauses, but only while the battle is the active scene (so it doesn't
   *  stack a second pause over the existing overlay). */
  private readonly onPauseKey = (e: KeyboardEvent): void => {
    if (this.isTraining) {
      if (e.code === 'KeyR') {
        e.preventDefault()
        this.resetTraining()
        return
      }
      if (e.code === 'KeyM') {
        e.preventDefault()
        this.p1.fillMeter()
        this.p2.fillMeter()
        return
      }
    }
    if (e.code === 'Escape' && this.ctx.scenes.current === this) {
      e.preventDefault()
      this.ctx.scenes.push(new PauseScene(this.ctx))
    }
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onPauseKey)
    this.input1.dispose?.()
    this.input2.dispose?.()
    this.touchControls?.dispose()
    this.touchControls = null
    this.hud.dispose()
    this.ctx.audio.stopBgm()
  }

  update(): void {
    if (this.flashTicks > 0) this.flashTicks -= 1
    if (this.trainingComboTicks > 0) this.trainingComboTicks -= 1
    else this.trainingComboHits = 0
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
    const fighting = this.isTraining || this.rounds.isFighting
    const i1 = fighting ? this.input1.poll() : neutralIntent()
    const i2 = fighting ? this.input2.poll() : neutralIntent()

    const p2HealthBefore = this.p2.health
    this.p1.update(i1, this.p2.position.x)
    this.p2.update(i2, this.p1.position.x)
    this.spawnProjectiles()
    this.separateBodies()
    this.playSwingSfx()

    if (fighting) {
      const hits = this.combat.resolve(this.p1, this.p2)
      hits.push(...this.projectiles.resolve([this.p1, this.p2]))
      for (const hit of hits) {
        emitHitSparks(this.particles, hit.point.x, hit.point.y, hit.dir, this.ctx.rng)
        this.ctx.camera.addTrauma(HIT_TRAUMA)
        this.ctx.audio.hit()
        this.hitstop = Math.max(this.hitstop, hit.hitstop)
        if (hit.hitstop >= 12 || hit.defender.isDead) this.flashTicks = BIG_HIT_FLASH_TICKS
        if (hit.defender.isDead) this.slowmoLeft = KO_SLOWMO_TICKS
      }
      if (this.isTraining) this.updateTrainingDamage(p2HealthBefore)
    }

    this.projectiles.update()
    this.particles.update()
    this.ctx.camera.tick(this.ctx.rng)

    if (this.isTraining && (this.p1.isDead || this.p2.isDead)) {
      this.resetTraining(true)
    }

    const signal = this.isTraining ? 'none' : this.rounds.update(this.p1, this.p2)
    if (signal === 'newRound') {
      this.p1.reset(P1_SPAWN, 1)
      this.p2.reset(P2_SPAWN, -1)
      this.projectiles.clear()
    }

    this.syncHud()

    if (!this.isTraining && this.rounds.isMatchOver) {
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

  private spawnProjectiles(): void {
    const p1Spawn = this.p1.consumeProjectileSpawn()
    const p2Spawn = this.p2.consumeProjectileSpawn()
    if (p1Spawn) this.projectiles.spawn(p1Spawn)
    if (p2Spawn) this.projectiles.spawn(p2Spawn)
  }

  private syncHud(): void {
    this.hud.setHealth(this.p1.healthFraction, this.p2.healthFraction)
    this.hud.setMeter(this.p1.meterFraction, this.p2.meterFraction)
    this.hud.setTimer(this.isTraining ? '∞' : this.rounds.timeLeftSeconds)
    this.hud.setRounds(this.isTraining ? 0 : this.rounds.p1Wins, this.isTraining ? 0 : this.rounds.p2Wins)
    this.hud.setBanner(this.isTraining ? '' : this.rounds.bannerText)
  }

  render(alpha: number): void {
    const { renderer, camera } = this.ctx
    renderer.clear('#000')
    camera.begin(renderer)

    this.drawStage()
    this.p1.render(renderer, alpha)
    this.p2.render(renderer, alpha)
    this.projectiles.render(renderer)
    this.particles.render(renderer)
    if (!this.isTraining) this.drawVersusIntro()

    if (DEBUG_HITBOXES) this.drawDebug()
    camera.end(renderer)
    this.drawFlash()
    if (this.isTraining) this.drawTrainingOverlay()
  }

  private get isTraining(): boolean {
    return this.config.rules === 'training'
  }

  private resetTraining(keepStats = false): void {
    const lastDamage = this.trainingLastDamage
    const comboHits = this.trainingComboHits
    const comboTicks = this.trainingComboTicks
    this.p1.reset(P1_SPAWN, 1)
    this.p2.reset(P2_SPAWN, -1)
    this.p1.fillMeter()
    this.p2.fillMeter()
    this.projectiles.clear()
    this.hitstop = 0
    this.slowmoLeft = 0
    this.slowmoPhase = 0
    if (keepStats) {
      this.trainingLastDamage = lastDamage
      this.trainingComboHits = comboHits
      this.trainingComboTicks = comboTicks
    } else {
      this.trainingLastDamage = 0
      this.trainingComboHits = 0
      this.trainingComboTicks = 0
    }
  }

  private updateTrainingDamage(p2HealthBefore: number): void {
    const damage = Math.max(0, p2HealthBefore - this.p2.health)
    if (damage <= 0) return
    this.trainingLastDamage = damage
    this.trainingComboHits += 1
    this.trainingComboTicks = 150
  }

  private drawStage(): void {
    const { renderer, assets, width, height } = this.ctx
    const ctx = renderer.ctx
    ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)

    const shop = assets.image('stage.shop')
    const shopScale = 1.65
    const shopW = shop.width * shopScale
    const shopH = shop.height * shopScale
    ctx.drawImage(shop, 115, FLOOR_Y - shopH + 12, shopW, shopH)
  }

  private drawFlash(): void {
    if (this.flashTicks <= 0) return
    const strength = this.ctx.camera.reduceMotion ? 0.14 : 0.26
    const alpha = (this.flashTicks / BIG_HIT_FLASH_TICKS) * strength
    const { ctx } = this.ctx.renderer
    ctx.fillStyle = `rgba(255, 235, 185, ${alpha})`
    ctx.fillRect(0, 0, this.ctx.width, this.ctx.height)
  }

  private drawTrainingOverlay(): void {
    const { ctx } = this.ctx.renderer
    const distance = Math.round(Math.abs(this.p2.position.x - this.p1.position.x))
    const currentMove = this.p1.currentMove
    const moveName = currentMove ? moveNameFor(this.config.p1, currentMove.id) : 'NEUTRAL'

    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.76)'
    ctx.fillRect(24, 390, 420, 150)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(24, 390, 420, 150)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillStyle = '#e8d4a0'
    ctx.fillText('TRAINING', 42, 408)

    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(`MOVE ${moveName}`, 42, 432)
    ctx.fillText(`LAST DMG ${this.trainingLastDamage}`, 42, 452)
    ctx.fillText(`COMBO ${this.trainingComboHits}`, 42, 472)
    ctx.fillText(`DIST ${distance}px`, 42, 492)
    ctx.fillText('R RESET   M METER   ?hitbox DEBUG', 42, 516)
    ctx.restore()
  }

  private drawVersusIntro(): void {
    if (this.rounds.phase !== 'intro' || this.rounds.round !== 1 || this.rounds.bannerText !== 'ROUND 1') return
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.54)'
    ctx.fillRect(0, 205, this.ctx.width, 116)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '15px "Press Start 2P", monospace'
    ctx.fillStyle = '#8a8aa0'
    ctx.fillText(`${this.config.p1.meta.archetype}  VS  ${this.config.p2.meta.archetype}`, this.ctx.width / 2, 230)
    ctx.font = '24px "Press Start 2P", monospace'
    ctx.fillStyle = '#e8d4a0'
    ctx.fillText(`${this.config.p1.name}  /  ${this.config.p2.name}`, this.ctx.width / 2, 276)
    ctx.restore()
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
    for (const box of this.projectiles.debugHitboxes()) stroke(box, '#5ad0ff')
  }
}

function moveNameFor(def: CharacterDef, moveId: string): string {
  if (moveId === def.moves.light.id) return def.meta.moveNames.light
  if (moveId === def.moves.heavy.id) return def.meta.moveNames.heavy
  if (moveId === def.moves.special.id) return def.meta.moveNames.special
  if (moveId === def.moves.super.id) return def.meta.moveNames.super
  return moveId.toUpperCase()
}
