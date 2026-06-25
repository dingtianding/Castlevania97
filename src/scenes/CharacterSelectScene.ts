import { Scene } from './Scene.ts'
import { BattleScene } from './BattleScene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { ROSTER } from '../data/characters/registry.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { PLAYER1_KEYS, PLAYER2_KEYS } from '../input/bindings.ts'
import { makeSheet, drawSprite, type SpriteSheet } from '../render/SpriteRenderer.ts'
import type { GameContext } from '../core/GameContext.ts'
import { TICK_RATE } from '../core/Time.ts'

const CELL_W = 190
const CELL_H = 230
const GAP = 36

export type SelectMode = 'local' | 'ai'

interface Selector {
  index: number
  locked: boolean
  prevMoveX: number
  color: string
}

/**
 * Two-cursor character select. In local 2P both players pick at once; in VS-CPU
 * Player 1 picks their fighter, then picks the CPU's. The grid is built from
 * ROSTER, so a new fighter shows up here with no code change.
 */
export class CharacterSelectScene extends Scene {
  private p1!: Selector
  private p2!: Selector
  private input1!: KeyboardSource
  private input2: KeyboardSource | null = null
  private portraits: SpriteSheet[] = []
  private tick = 0

  constructor(
    ctx: GameContext,
    private readonly mode: SelectMode = 'local',
  ) {
    super(ctx)
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
  }

  override enter(): void {
    this.p1 = { index: 0, locked: false, prevMoveX: 0, color: '#e8d4a0' }
    this.p2 = { index: Math.min(1, ROSTER.length - 1), locked: false, prevMoveX: 0, color: '#e64b3c' }
    this.input1 = new KeyboardSource(PLAYER1_KEYS)
    if (this.mode === 'local') this.input2 = new KeyboardSource(PLAYER2_KEYS)
    this.portraits = ROSTER.map((c) =>
      makeSheet(this.ctx.assets.image(c.sprites.idle.key), c.sprites.idle.frames),
    )
    window.addEventListener('keydown', this.onKeyDown)
  }

  override exit(): void {
    this.input1.dispose()
    this.input2?.dispose()
    window.removeEventListener('keydown', this.onKeyDown)
  }

  update(): void {
    this.tick += 1

    if (this.mode === 'local') {
      this.step(this.p1, this.input1)
      if (this.input2) this.step(this.p2, this.input2)
    } else if (!this.p1.locked) {
      // VS CPU: P1 picks own fighter, then picks the CPU's, all on P1's keys.
      this.step(this.p1, this.input1)
    } else if (!this.p2.locked) {
      this.step(this.p2, this.input1)
    }

    if (this.p1.locked && this.p2.locked) {
      this.ctx.scenes.replace(
        new BattleScene(this.ctx, {
          p1: ROSTER[this.p1.index]!,
          p2: ROSTER[this.p2.index]!,
          p2Controller: this.mode === 'ai' ? 'ai' : 'human',
        }),
      )
    }
  }

  private step(s: Selector, source: KeyboardSource): void {
    const intent = source.poll()
    if (!s.locked) {
      if (intent.moveX !== 0 && s.prevMoveX === 0) {
        s.index = (s.index + intent.moveX + ROSTER.length) % ROSTER.length
      }
      if (intent.lightPressed || intent.jumpPressed || intent.heavyPressed) s.locked = true
    } else if (intent.specialPressed) {
      s.locked = false
    }
    s.prevMoveX = intent.moveX
  }

  render(): void {
    const { renderer, assets, width, height } = this.ctx
    const { ctx } = renderer

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.78)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText('SELECT YOUR FIGHTER', width / 2, 70)

    const total = ROSTER.length * CELL_W + (ROSTER.length - 1) * GAP
    const startX = (width - total) / 2
    const cellY = (height - CELL_H) / 2 + 10

    ROSTER.forEach((_def, i) => this.drawCell(startX + i * (CELL_W + GAP), cellY, i))
    this.drawCursor(this.p1, startX, cellY, -6)
    this.drawCursor(this.p2, startX, cellY, 6)

    ctx.font = '12px "Press Start 2P", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = this.p1.color
    ctx.fillText(`P1 ${ROSTER[this.p1.index]!.name}`, 40, height - 56)
    ctx.textAlign = 'right'
    ctx.fillStyle = this.p2.color
    const p2Tag = this.mode === 'ai' ? 'CPU' : 'P2'
    ctx.fillText(`${ROSTER[this.p2.index]!.name} ${p2Tag}`, width - 40, height - 56)

    if (Math.floor(this.tick / (TICK_RATE / 2)) % 2 === 0) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#8a8aa0'
      const hint =
        this.mode === 'ai'
          ? 'A/D MOVE   F LOCK (PICK YOURS, THEN CPU)   ESC BACK'
          : 'MOVE A/D · J-L     LOCK F · .     ESC BACK'
      ctx.fillText(hint, width / 2, height - 26)
    }
  }

  private drawCell(x: number, y: number, i: number): void {
    const { ctx } = this.ctx.renderer
    ctx.fillStyle = 'rgba(20, 18, 31, 0.9)'
    ctx.fillRect(x, y, CELL_W, CELL_H)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, CELL_W, CELL_H)

    const def = ROSTER[i]!
    const sheet = this.portraits[i]
    if (sheet) {
      const scale = 2.2
      const drawX = x + CELL_W / 2 - def.visual.anchorX * scale
      const drawY = y + CELL_H - 18 - def.visual.anchorY * scale
      drawSprite(this.ctx.renderer, sheet, 0, drawX, drawY, scale, 1)
    }
  }

  private drawCursor(s: Selector, startX: number, cellY: number, inset: number): void {
    const { ctx } = this.ctx.renderer
    const x = startX + s.index * (CELL_W + GAP)
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.locked ? 6 : 3
    ctx.strokeRect(x + inset, cellY + inset, CELL_W - inset * 2, CELL_H - inset * 2)
    if (s.locked) {
      ctx.fillStyle = s.color
      ctx.font = '10px "Press Start 2P", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('LOCKED', x + CELL_W / 2, cellY + 16)
    }
  }
}
