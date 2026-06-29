import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { AssetManager } from '../assets/AssetManager.ts'
import { AUDIO_MANIFEST } from '../assets/manifest.ts'
import { completeCampaignBattle, getCampaignChapter, getCampaignNode, loadCampaignSave } from '../data/campaign.ts'
import { juliusBelmont as CAMPAIGN_HERO } from '../data/characters/castlevaniaCampaign.ts'
import { getStage } from '../data/stages.ts'
import type { CharacterDef } from '../data/characters/CharacterDef.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { GamepadSource } from '../input/GamepadSource.ts'
import { CompositeSource } from '../input/CompositeSource.ts'
import { TouchSource, createTouchControlState } from '../input/TouchSource.ts'
import { TouchControls } from '../ui/TouchControls.ts'
import { PLAYER1_KEYS } from '../input/bindings.ts'
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
const JUMP_VELOCITY = -15.5
const FAST_FALL_SPEED = 12
const WALL_MARGIN = 48
const HURT_TICKS = 20
const DEBUG_HITBOXES = new URLSearchParams(location.search).has('hitbox')

interface Platform {
  x: number
  y: number
  width: number
  height: number
}

interface RoomLayout {
  platforms: Platform[]
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

class CastleActor {
  readonly position: Vec2
  readonly prevPosition: Vec2
  readonly velocity: Vec2 = { x: 0, y: 0 }
  maxHealth = 100
  health = 100
  meter = 0
  grounded = true
  facing: Facing
  state: 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'hurt' | 'death' = 'idle'
  private readonly sheets: SpriteSet
  private readonly animator: Animator
  private attackMove: AttackMove | null = null
  private attackTick = 0
  private attackConnected = false
  private projectileSpawned = false
  private pendingProjectileSpawn: ProjectileSpawn | null = null
  private hurtTick = 0

  constructor(
    readonly def: CharacterDef,
    assets: AssetManager,
    x: number,
    y: number,
    facing: Facing,
  ) {
    this.position = { x, y }
    this.prevPosition = { x, y }
    this.facing = facing
    this.sheets = buildSpriteSet(def, assets)
    this.animator = new Animator(this.sheets.idle, 8, true)
  }

  get isDead(): boolean {
    return this.state === 'death' || this.health <= 0
  }

  get currentMove(): AttackMove | null {
    return this.attackMove
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
    this.animator.play(this.sheets.idle, 8, true)
    this.animator.reset()
  }

  update(intent: IntentState, opponentX: number, platforms: Platform[]): void {
    this.prevPosition.x = this.position.x
    this.prevPosition.y = this.position.y

    if (this.state === 'death') {
      this.animator.update()
      return
    }

    if (this.state === 'hurt') {
      this.updateHurt(platforms)
      this.animator.update()
      return
    }

    if (this.state === 'attack') {
      this.updateAttack(intent, platforms)
      this.animator.update()
      return
    }

    this.updateLocomotion(intent, opponentX, platforms)
    this.animator.update()
  }

  activeAttack(): { box: Rect; spec: AttackMove } | null {
    if (this.state !== 'attack' || !this.attackMove) return null
    if (this.attackConnected) return null
    if (!isActiveAt(this.attackMove, this.attackTick)) return null
    return { box: computeHitbox(this.attackMove.hitbox, this.position.x, this.position.y, this.facing), spec: this.attackMove }
  }

  markAttackConnected(): void {
    this.attackConnected = true
    if (this.attackMove) this.meter = clamp(this.meter + this.attackMove.damage * 0.8, 0, 100)
  }

  applyHit(move: AttackMove, fromX: number): void {
    if (this.state === 'death') return
    this.health = Math.max(0, this.health - Math.max(1, Math.round(move.damage)))
    this.velocity.x = this.position.x >= fromX ? 6 : -6
    this.velocity.y = move.knockbackY
    this.grounded = false
    this.hurtTick = 0
    this.attackMove = null
    this.attackConnected = false
    this.projectileSpawned = false
    this.pendingProjectileSpawn = null
    this.state = this.health <= 0 ? 'death' : 'hurt'
    const sheet = this.sheets
    if (this.state === 'death') this.animator.play(sheet.death, 6, false)
    else this.animator.play(sheet.takeHit, 4, false)
  }

  consumeProjectileSpawn(): ProjectileSpawn | null {
    const spawn = this.pendingProjectileSpawn
    this.pendingProjectileSpawn = null
    return spawn
  }

  tryJump(): void {
    if (this.grounded) {
      this.velocity.y = JUMP_VELOCITY
      this.grounded = false
      this.state = 'jump'
      this.animator.play(this.sheets.jump, 8, true)
    }
  }

  private updateLocomotion(intent: IntentState, opponentX: number, platforms: Platform[]): void {
    const moveSpeed = this.grounded ? WALK_SPEED : AIR_SPEED
    this.velocity.x = intent.moveX * moveSpeed
    if (intent.moveX > 0) this.facing = 1
    else if (intent.moveX < 0) this.facing = -1
    else this.facing = opponentX >= this.position.x ? 1 : -1

    if (intent.jumpPressed) this.tryJump()
    if (!this.grounded && intent.downHeld && this.velocity.y > 0 && this.velocity.y < FAST_FALL_SPEED) {
      this.velocity.y = FAST_FALL_SPEED
    }

    this.integrate(platforms)

    const next = !this.grounded ? (this.velocity.y < 0 ? 'jump' : 'fall') : intent.moveX === 0 ? 'idle' : 'run'
    this.setMotion(next)
  }

  private updateAttack(intent: IntentState, platforms: Platform[]): void {
    this.attackTick += 1
    this.velocity.x = 0
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
      this.setMotion(this.grounded ? 'idle' : 'fall')
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
    this.position.x += this.velocity.x
    this.position.x = clamp(this.position.x, WALL_MARGIN, ROOM_WIDTH - WALL_MARGIN)
    this.velocity.y += GRAVITY
    this.position.y += this.velocity.y

    let landed = false
    let landingY = FLOOR_Y
    for (const platform of platforms) {
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
      if (this.state === 'jump' || this.state === 'fall') this.setMotion(Math.abs(this.velocity.x) > 0 ? 'run' : 'idle')
    } else {
      this.grounded = false
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
      case 'hurt':
      case 'death':
        break
    }
  }

  render(renderer: Renderer, cameraX: number): void {
    const sheet = this.currentSheet()
    const frame = this.animator.currentFrame
    const scale = this.def.visual.scale
    const x = this.position.x - cameraX
    const y = this.position.y
    const drawX = this.facing === 1 ? x - this.def.visual.anchorX * scale : x - (sheet.frameWidth - this.def.visual.anchorX) * scale
    const drawY = y - this.def.visual.anchorY * scale
    drawSprite(renderer, sheet, frame, drawX, drawY, scale, this.facing)
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
  private input!: InputSource
  private cameraX = 0
  private clearTicks = 0
  private blink = 0
  private ending = false
  private transitionTicks = 0
  private touchControls: TouchControls | null = null
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.ending && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) {
      e.preventDefault()
      this.ctx.scenes.replace(new TitleScene(this.ctx))
      return
    }
    if (e.code === 'Escape') this.ctx.scenes.replace(new TitleScene(this.ctx))
    if (e.code === 'KeyR') this.reloadNode(this.node.id, true)
    if (e.code === 'KeyM') this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
  }

  override enter(): void {
    this.ctx.audio.startBgm(AUDIO_MANIFEST['bgm.battle'])
    this.bindInput()
    window.addEventListener('keydown', this.onKeyDown)
    this.reloadFromSave()
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    this.input.dispose?.()
    this.touchControls?.dispose()
    this.touchControls = null
    this.ctx.audio.stopBgm()
  }

  update(): void {
    this.blink += 1
    if (this.ending) return
    if (this.transitionTicks > 0) {
      this.transitionTicks -= 1
      return
    }

    const intent = this.input.poll()
    this.player.update(intent, this.player.position.x + this.player.facing * 80, this.layout.platforms)

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      const ai = enemyIntent(enemy, this.player, this.node, this.ctx.rng)
      enemy.update(ai, this.player.position.x, this.layout.platforms)
    }

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

    this.resolveCombat()
    this.projectiles = this.projectiles.filter((p) => p.ticksLeft > 0 && !p.hasHit)

    if (this.player.isDead && this.player.hurtbox().y > 0) {
      this.reloadNode(this.node.id, true)
    }

    if (!this.player.isDead && this.enemies.every((enemy) => enemy.isDead)) {
      this.clearTicks += 1
      if (this.clearTicks > 40) this.advanceRoom()
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
    drawBackdrop(ctx, this.node.stage)
    this.drawWorld()
    this.drawHud()
    this.drawStory()
    if (this.ending) this.drawEnding()
    else if (Math.floor(this.blink / 30) % 2 === 0) this.drawPrompt()
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
    this.player = new CastleActor(CAMPAIGN_HERO, this.ctx.assets, this.layout.checkpointX, this.layout.checkpointY, 1)
    this.player.reset(this.layout.checkpointX, this.layout.checkpointY, 1)
    this.enemies = buildEnemies(this.node, this.ctx.assets, this.layout)
    this.projectiles = []
    this.clearTicks = 0
    this.transitionTicks = fromReset ? 0 : 12
    this.ending = false
    this.save = { ...this.save, currentNodeId: nodeId, finished: false }
  }

  private resolveCombat(): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      const playerAtk = this.player.activeAttack()
      const enemyAtk = enemy.activeAttack()
      if (playerAtk && rectsOverlap(playerAtk.box, enemy.hurtbox())) {
        enemy.applyHit(playerAtk.spec, this.player.position.x)
        this.player.markAttackConnected()
      }
      if (enemyAtk && rectsOverlap(enemyAtk.box, this.player.hurtbox())) {
        this.player.applyHit(enemyAtk.spec, enemy.position.x)
        enemy.markAttackConnected()
      }
      if (rectsOverlap(this.player.hurtbox(), enemy.hurtbox())) {
        this.player.applyHit(enemy.def.moves.light, enemy.position.x)
      }
    }
    for (const projectile of this.projectiles) {
      if (projectile.hasHit) continue
      if (!rectsOverlap(projectileBox(projectile), this.player.hurtbox())) continue
      projectile.hasHit = true
      this.player.applyHit(projectile.spawn.move, projectile.spawn.x)
    }
  }

  private advanceRoom(): void {
    const next = completeCampaignBattle(this.save)
    this.save = next
    if (next.finished) {
      this.ending = true
      return
    }
    if (next.currentNodeId) this.reloadNode(next.currentNodeId)
    else this.ending = true
  }

  private drawWorld(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.translate(-this.cameraX, 0)
    for (const platform of this.layout.platforms) {
      ctx.fillStyle = '#2a2238'
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height)
      ctx.fillStyle = '#5a567a'
      ctx.fillRect(platform.x, platform.y - 4, platform.width, 4)
    }
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
    ctx.fillStyle = '#2a1014'
    ctx.fillRect(40, 90, 300, 10)
    ctx.fillStyle = '#b91d2d'
    ctx.fillRect(40, 90, 300 * (this.player.health / this.player.maxHealth), 10)
    ctx.strokeStyle = '#e8d4a0'
    ctx.strokeRect(40, 90, 300, 10)
    ctx.restore()
  }

  private drawStory(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = 'rgba(8, 6, 14, 0.74)'
    ctx.fillRect(676, 22, 316, 120)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(676, 22, 316, 120)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(this.node.title.toUpperCase(), 692, 40)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '8px "Press Start 2P", monospace'
    wrapText(ctx, this.node.story, 692, 62, 284, 14)
    ctx.restore()
  }

  private drawPrompt(): void {
    const { ctx } = this.ctx.renderer
    ctx.save()
    ctx.fillStyle = '#5a567a'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('J JUMP   K LIGHT   L HEAVY   ; SPECIAL   R RESET   ESC TITLE', this.ctx.width / 2, this.ctx.height - 28)
    ctx.restore()
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
    wrapText(ctx, 'The 1999 Demon Castle War is over. Julius Belmont stands at the end of the bloodline and the beginning of a new silence.', this.ctx.width / 2 - 260, 234, 520, 16)
    ctx.fillStyle = '#5a567a'
    ctx.fillText('ENTER / SPACE / ESC RETURN TO TITLE', this.ctx.width / 2, this.ctx.height - 164)
    ctx.restore()
  }
}

function buildEnemies(node: ReturnType<typeof getCampaignNode>, assets: AssetManager, layout: RoomLayout): CastleActor[] {
  const def = node.enemy
  const count = node.isBoss ? 1 : node.difficulty === 'easy' ? 1 : node.difficulty === 'normal' ? 2 : 3
  const slots = spread(layout.checkpointX + 380, layout.doorX - 180, count)
  return slots.map((x) => {
    const enemy = new CastleActor(def, assets, x, layout.checkpointY, -1)
    enemy.setMaxHealth(node.isBoss ? 180 : node.difficulty === 'hard' ? 110 : 80)
    enemy.meter = def.id === 'dracula1999' ? 100 : 0
    return enemy
  })
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

  if (dist > 74) {
    intent.moveX = dir
  } else if (enemy.currentMove === null) {
    if (node.isBoss && enemy.meter >= (enemy.def.moves.super.meterCost ?? 0)) intent.specialPressed = true
    else if (node.difficulty === 'hard' || dist < 54) intent.heavyPressed = true
    else intent.lightPressed = true
  }

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

function buildLayout(stage: string): RoomLayout {
  switch (stage) {
    case 'outer_wall':
      return {
        backdrop: '#111221',
        doorX: ROOM_WIDTH - 132,
        doorY: FLOOR_Y,
        checkpointX: 120,
        checkpointY: FLOOR_Y,
        platforms: [
          { x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 },
          { x: 180, y: 414, width: 190, height: 12 },
          { x: 460, y: 356, width: 180, height: 12 },
          { x: 760, y: 304, width: 210, height: 12 },
          { x: 1120, y: 344, width: 180, height: 12 },
        ],
      }
    case 'cathedral':
      return { backdrop: '#100b16', doorX: ROOM_WIDTH - 128, doorY: FLOOR_Y, checkpointX: 120, checkpointY: FLOOR_Y, platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 220, y: 364, width: 220, height: 12 }, { x: 560, y: 302, width: 240, height: 12 }, { x: 990, y: 344, width: 220, height: 12 }] }
    case 'library':
      return { backdrop: '#08121e', doorX: ROOM_WIDTH - 128, doorY: FLOOR_Y, checkpointX: 120, checkpointY: FLOOR_Y, platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 180, y: 382, width: 160, height: 12 }, { x: 420, y: 320, width: 180, height: 12 }, { x: 680, y: 262, width: 220, height: 12 }, { x: 980, y: 324, width: 220, height: 12 }, { x: 1290, y: 284, width: 180, height: 12 }] }
    case 'clock_tower':
      return { backdrop: '#1a120b', doorX: ROOM_WIDTH - 128, doorY: FLOOR_Y, checkpointX: 120, checkpointY: FLOOR_Y, platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 160, y: 404, width: 170, height: 12 }, { x: 390, y: 350, width: 160, height: 12 }, { x: 640, y: 292, width: 160, height: 12 }, { x: 890, y: 238, width: 160, height: 12 }, { x: 1140, y: 304, width: 170, height: 12 }, { x: 1380, y: 246, width: 170, height: 12 }] }
    case 'catacombs':
      return { backdrop: '#081018', doorX: ROOM_WIDTH - 128, doorY: FLOOR_Y, checkpointX: 120, checkpointY: FLOOR_Y, platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 260, y: 378, width: 220, height: 12 }, { x: 620, y: 346, width: 220, height: 12 }, { x: 1020, y: 378, width: 200, height: 12 }] }
    case 'throne_room':
      return { backdrop: '#13080c', doorX: ROOM_WIDTH - 128, doorY: FLOOR_Y, checkpointX: 120, checkpointY: FLOOR_Y, platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 360, y: 340, width: 200, height: 12 }, { x: 980, y: 340, width: 200, height: 12 }] }
    default:
      return { backdrop: '#0e0f18', doorX: ROOM_WIDTH - 128, doorY: FLOOR_Y, checkpointX: 120, checkpointY: FLOOR_Y, platforms: [{ x: 0, y: FLOOR_Y, width: ROOM_WIDTH, height: 22 }, { x: 240, y: 382, width: 180, height: 12 }, { x: 520, y: 320, width: 200, height: 12 }, { x: 860, y: 372, width: 220, height: 12 }, { x: 1230, y: 300, width: 160, height: 12 }] }
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, stage: string): void {
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
): void {
  const words = text.split(' ')
  let line = ''
  let offsetY = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + offsetY)
      line = word
      offsetY += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, y + offsetY)
}
