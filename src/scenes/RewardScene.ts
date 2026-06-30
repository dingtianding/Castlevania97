import { Scene } from './Scene.ts'
import { BattleScene, type BattleConfig } from './BattleScene.ts'
import { TitleScene } from './TitleScene.ts'
import { arcadeDifficulty } from '../data/arcade.ts'
import { draftRelics, type RelicDef } from '../data/relics.ts'
import type { GameContext } from '../core/GameContext.ts'
import { isMenuCancel, isMenuConfirm } from '../input/menuButtons.ts'

/** Arcade-only relic draft. Pick one buff before the next ladder fight. */
export class RewardScene extends Scene {
  private index = 0
  private readonly options: RelicDef[]
  private autoContinue = false

  constructor(
    ctx: GameContext,
    private readonly config: BattleConfig,
  ) {
    super(ctx)
    const taken = this.config.arcade?.relics ?? []
    this.options = draftRelics(ctx.rng, taken, 3)
    this.autoContinue = this.options.length === 0
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.options.length === 0) return
    if (isMenuConfirm(e.code)) {
      e.preventDefault()
      this.choose()
      return
    }
    if (isMenuCancel(e.code)) {
      e.preventDefault()
      this.ctx.scenes.replace(new TitleScene(this.ctx))
      return
    }
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
      case 'ArrowUp':
      case 'KeyW':
        this.index = (this.index - 1 + this.options.length) % this.options.length
        break
      case 'ArrowRight':
      case 'KeyD':
      case 'ArrowDown':
      case 'KeyS':
        this.index = (this.index + 1) % this.options.length
        break
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.options.length === 0) return
    const point = this.toGamePoint(e)
    const layout = this.layout()
    const hit = this.options.findIndex((_opt, i) => {
      const x = layout.startX + i * (layout.cardW + layout.gap)
      return point.x >= x && point.x <= x + layout.cardW && point.y >= 170 && point.y <= 390
    })
    if (hit >= 0) {
      this.index = hit
      this.choose()
    }
  }

  override enter(): void {
    window.addEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.addEventListener('pointerdown', this.onPointerDown)
    if (this.autoContinue) this.continueBattle()
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.removeEventListener('pointerdown', this.onPointerDown)
  }

  update(): void {}

  render(): void {
    const { renderer, assets, width, height } = this.ctx
    const { ctx } = renderer
    const stageName = this.config.arcade ? `STAGE ${this.config.arcade.stage + 1}` : 'REWARD'
    const layout = this.layout()

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.82)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText('RELIC DRAFT', width / 2, 76)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillText(`${stageName}   PICK ONE BUFF`, width / 2, 104)

    this.options.forEach((relic, i) => this.drawCard(relic, layout, i))

    ctx.fillStyle = '#5a567a'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('A/D OR ARROWS MOVE     J SELECT     K QUIT', width / 2, height - 30)
  }

  private drawCard(relic: RelicDef, layout: { startX: number; cardW: number; gap: number }, index: number): void {
    const { ctx } = this.ctx.renderer
    const x = layout.startX + index * (layout.cardW + layout.gap)
    const y = 170
    const selected = index === this.index

    ctx.fillStyle = selected ? 'rgba(40, 33, 56, 0.96)' : 'rgba(16, 24, 43, 0.84)'
    ctx.fillRect(x, y, layout.cardW, 220)
    ctx.strokeStyle = selected ? '#e8d4a0' : '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, layout.cardW, 220)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '12px "Press Start 2P", monospace'
    ctx.fillText(relic.name.toUpperCase(), x + 16, y + 18)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '9px "Press Start 2P", monospace'
    wrapText(ctx, relic.blurb, x + 16, y + 56, layout.cardW - 32, 16)

    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(this.summaryLine(relic), x + 16, y + 184)
  }

  private summaryLine(relic: RelicDef): string {
    if (relic.id === 'vitality') return '+20 MAX HP'
    if (relic.id === 'fury') return '1.15X DAMAGE'
    if (relic.id === 'focus') return '1.25X METER'
    if (relic.id === 'quickstep') return '1.10X SPEED'
    return '30 START METER'
  }

  private choose(): void {
    const selected = this.options[this.index]
    if (!selected || !this.config.arcade) return
    this.continueBattle(selected.id)
  }

  private continueBattle(selectedId?: RelicDef['id']): void {
    if (!this.config.arcade) return
    const stage = this.config.arcade.stage + 1
    this.ctx.scenes.replace(
      new BattleScene(this.ctx, {
        p1: this.config.arcade.player,
        p2: this.config.arcade.ladder[stage] ?? this.config.arcade.ladder[this.config.arcade.ladder.length - 1]!,
        p2Controller: 'ai',
        aiDifficulty: arcadeDifficulty(stage),
        arcade: {
          player: this.config.arcade.player,
          ladder: this.config.arcade.ladder,
          stage,
          relics: selectedId ? [...this.config.arcade.relics, selectedId] : [...this.config.arcade.relics],
        },
        ...(this.config.selectMode ? { selectMode: this.config.selectMode } : {}),
      }),
    )
  }

  private layout(): { startX: number; cardW: number; gap: number } {
    const cardW = 250
    const gap = this.options.length > 1 ? 36 : 0
    const total = this.options.length * cardW + Math.max(0, this.options.length - 1) * gap
    return { startX: (this.ctx.width - total) / 2, cardW, gap }
  }

  private toGamePoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.ctx.width,
      y: ((e.clientY - rect.top) / rect.height) * this.ctx.height,
    }
  }
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
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + offsetY)
      line = word
      offsetY += lineHeight
    } else {
      line = testLine
    }
  }
  if (line) ctx.fillText(line, x, y + offsetY)
}
