import { Scene } from './Scene.ts'
import { BattleScene } from './BattleScene.ts'
import { TitleScene } from './TitleScene.ts'
import { ROSTER } from '../data/characters/registry.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { PLAYER1_KEYS, PLAYER2_KEYS } from '../input/bindings.ts'
import { makeSheet, drawSprite, type SpriteSheet } from '../render/SpriteRenderer.ts'
import { TICK_RATE } from '../core/Time.ts'

const CELL_W = 190
const CELL_H = 230
const GAP = 36

interface Selector {
  source: KeyboardSource
  index: number
  locked: boolean
  prevMoveX: number
  color: string
}

/** Two-cursor character select. Each player moves over the roster grid and
 *  locks in; when both are locked the chosen pair starts a battle. The grid is
 *  built straight from ROSTER, so a new fighter appears here automatically. */
export class CharacterSelectScene extends Scene {
  private p1!: Selector
  private p2!: Selector
  private portraits: SpriteSheet[] = []
  private tick = 0

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') this.ctx.scenes.replace(new TitleScene(this.ctx))
  }

  override enter(): void {
    this.p1 = sel(new KeyboardSource(PLAYER1_KEYS), 0, '#e8d4a0')
    this.p2 = sel(new KeyboardSource(PLAYER2_KEYS), Math.min(1, ROSTER.length - 1), '#e64b3c')
    this.portraits = ROSTER.map((c) => makeSheet(this.ctx.assets.image(c.sprites.idle.key), c.sprites.idle.frames))
    window.addEventListener('keydown', this.onKeyDown)
  }

  override exit(): void {
    this.p1.source.dispose()
    this.p2.source.dispose()
    window.removeEventListener('keydown', this.onKeyDown)
  }

  update(): void {
    this.tick += 1
    this.step(this.p1)
    this.step(this.p2)

    if (this.p1.locked && this.p2.locked) {
      this.ctx.scenes.replace(
        new BattleScene(this.ctx, { p1: ROSTER[this.p1.index]!, p2: ROSTER[this.p2.index]! }),
      )
    }
  }

  private step(s: Selector): void {
    const intent = s.source.poll()
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
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.textBaseline = 'middle'
    ctx.fillText('SELECT YOUR FIGHTER', width / 2, 70)

    const total = ROSTER.length * CELL_W + (ROSTER.length - 1) * GAP
    const startX = (width - total) / 2
    const cellY = (height - CELL_H) / 2 + 10

    ROSTER.forEach((_def, i) => {
      const cellX = startX + i * (CELL_W + GAP)
      this.drawCell(cellX, cellY, i)
    })

    this.drawCursor(this.p1, startX, cellY, -6)
    this.drawCursor(this.p2, startX, cellY, 6)

    // Selected names, P1 left / P2 right.
    ctx.font = '12px "Press Start 2P", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = this.p1.color
    ctx.fillText(`P1 ${ROSTER[this.p1.index]!.name}`, 40, height - 56)
    ctx.textAlign = 'right'
    ctx.fillStyle = this.p2.color
    ctx.fillText(`${ROSTER[this.p2.index]!.name} P2`, width - 40, height - 56)

    if (Math.floor(this.tick / (TICK_RATE / 2)) % 2 === 0) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#8a8aa0'
      ctx.fillText('MOVE: A/D  ·  J/L     LOCK: F  ·  .     ESC: BACK', width / 2, height - 26)
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

function sel(source: KeyboardSource, index: number, color: string): Selector {
  return { source, index, locked: false, prevMoveX: 0, color }
}
