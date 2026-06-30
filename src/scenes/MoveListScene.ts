import { Scene } from './Scene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { CharacterSelectScene, type SelectMode } from './CharacterSelectScene.ts'
import { ROSTER } from '../data/characters/registry.ts'
import { drawSprite, makeSheet, type SpriteSheet } from '../render/SpriteRenderer.ts'
import type { CharacterDef, CharacterStats } from '../data/characters/CharacterDef.ts'
import type { GameContext } from '../core/GameContext.ts'
import { isMenuCancel, isMenuConfirm } from '../input/menuButtons.ts'

const MOVE_KEYS = ['light', 'heavy', 'special', 'super'] as const

export class MoveListScene extends Scene {
  private index = 0
  private portraits: SpriteSheet[] = []

  constructor(
    ctx: GameContext,
    private readonly returnMode: SelectMode | null = null,
  ) {
    super(ctx)
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isMenuCancel(e.code) || isMenuConfirm(e.code) || e.code === 'KeyM') {
      e.preventDefault()
      this.back()
      return
    }
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.index = (this.index - 1 + ROSTER.length) % ROSTER.length
        break
      case 'ArrowRight':
      case 'KeyD':
        this.index = (this.index + 1) % ROSTER.length
        break
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const point = this.toGamePoint(e)
    if (point.x < this.ctx.width * 0.35) this.index = (this.index - 1 + ROSTER.length) % ROSTER.length
    else if (point.x > this.ctx.width * 0.65) this.index = (this.index + 1) % ROSTER.length
    else this.back()
  }

  override enter(): void {
    this.portraits = ROSTER.map((c) =>
      makeSheet(this.ctx.assets.image(c.sprites.idle.key), c.sprites.idle.frames),
    )
    window.addEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.addEventListener('pointerdown', this.onPointerDown)
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.removeEventListener('pointerdown', this.onPointerDown)
  }

  update(): void {}

  render(): void {
    const { renderer, assets, width, height } = this.ctx
    const { ctx } = renderer
    const def = ROSTER[this.index]!

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.84)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '22px "Press Start 2P", monospace'
    ctx.fillText('MOVE LIST', width / 2, 60)

    this.drawPortrait(def, 90, 125, 300, 300)
    this.drawDetails(def, 430, 125, 520)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#5a567a'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillText('A/D CHANGE FIGHTER     J / K BACK', width / 2, height - 28)
  }

  private drawPortrait(def: CharacterDef, x: number, y: number, w: number, h: number): void {
    const { ctx } = this.ctx.renderer
    ctx.fillStyle = 'rgba(20, 18, 31, 0.9)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    const sheet = this.portraits[this.index]
    if (!sheet) return
    const scale = Math.min(4, (h - 40) / (def.visual.anchorY * 1.15))
    const drawX = x + w / 2 - def.visual.anchorX * scale
    const drawY = y + h - 24 - def.visual.anchorY * scale
    drawSprite(this.ctx.renderer, sheet, 0, drawX, drawY, scale, 1)
  }

  private drawDetails(def: CharacterDef, x: number, y: number, w: number): void {
    const { ctx } = this.ctx.renderer
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    ctx.fillStyle = '#e8d4a0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText(def.name, x, y)

    ctx.fillStyle = '#b91d2b'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText(def.meta.archetype, x, y + 34)

    ctx.fillStyle = '#8a8aa0'
    ctx.font = '9px "Press Start 2P", monospace'
    drawWrappedText(ctx, def.meta.bio, x, y + 62, w, 16)

    this.drawStats(x, y + 116, def.meta.stats)
    this.drawMoves(x, y + 205, def)
  }

  private drawStats(x: number, y: number, stats: CharacterStats): void {
    const labels: Array<keyof CharacterStats> = ['power', 'speed', 'range', 'technique']
    labels.forEach((key, i) => {
      const rowY = y + i * 24
      const { ctx } = this.ctx.renderer
      ctx.fillStyle = '#6c6c8c'
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText(key.toUpperCase(), x, rowY)
      for (let p = 0; p < 5; p += 1) {
        ctx.fillStyle = p < stats[key] ? '#e8d4a0' : '#2a1014'
        ctx.fillRect(x + 142 + p * 18, rowY - 2, 12, 12)
      }
    })
  }

  private drawMoves(x: number, y: number, def: CharacterDef): void {
    const { ctx } = this.ctx.renderer
    MOVE_KEYS.forEach((key, i) => {
      const rowY = y + i * 38
      ctx.fillStyle = key === 'super' ? '#ffe08a' : '#e8d4a0'
      ctx.font = '10px "Press Start 2P", monospace'
      ctx.fillText(key.toUpperCase(), x, rowY)
      ctx.fillStyle = '#8a8aa0'
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText(def.meta.moveNames[key], x + 148, rowY)
      ctx.fillStyle = '#5a567a'
      ctx.font = '7px "Press Start 2P", monospace'
      ctx.fillText(moveNote(key), x + 148, rowY + 16)
    })
  }

  private back(): void {
    if (this.returnMode) this.ctx.scenes.replace(new CharacterSelectScene(this.ctx, this.returnMode))
    else this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
  }

  private toGamePoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.ctx.width,
      y: ((e.clientY - rect.top) / rect.height) * this.ctx.height,
    }
  }
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ')
  let line = ''
  let row = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight)
      line = word
      row += 1
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight)
}

function moveNote(key: (typeof MOVE_KEYS)[number]): string {
  switch (key) {
    case 'light':
      return 'Fast poke for close or air confirms.'
    case 'heavy':
      return 'Launcher; jump-cancel on hit for air follow-ups.'
    case 'special':
      return 'Unique spacing or pressure tool; works airborne.'
    case 'super':
      return 'Spend full meter for a big swing.'
  }
}
