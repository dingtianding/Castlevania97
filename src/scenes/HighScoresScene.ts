import { Scene } from './Scene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { loadHighScores } from '../data/highScores.ts'
import type { GameContext } from '../core/GameContext.ts'
import { isMenuCancel, isMenuConfirm } from '../input/menuButtons.ts'

export class HighScoresScene extends Scene {
  constructor(ctx: GameContext) {
    super(ctx)
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isMenuCancel(e.code) || isMenuConfirm(e.code)) {
      e.preventDefault()
      this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
    }
  }

  private readonly onPointerDown = (): void => {
    this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
  }

  override enter(): void {
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
    const scores = loadHighScores()

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.84)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '24px "Press Start 2P", monospace'
    ctx.fillText('HIGH SCORES', width / 2, 78)

    if (scores.length === 0) {
      ctx.fillStyle = '#8a8aa0'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText('NO SCORES YET', width / 2, height / 2)
    } else {
      ctx.textAlign = 'left'
      scores.forEach((entry, i) => {
        const y = 142 + i * 36
        ctx.fillStyle = i === 0 ? '#ffe08a' : '#e8d4a0'
        ctx.font = '11px "Press Start 2P", monospace'
        ctx.fillText(`${String(i + 1).padStart(2, '0')}  ${entry.score}`, 120, y)
        ctx.fillStyle = '#8a8aa0'
        ctx.font = '9px "Press Start 2P", monospace'
        ctx.fillText(`${entry.grade}  ${entry.fighterName}  ${entry.mode}`, 360, y)
      })
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = '#5a567a'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillText('J / K BACK', width / 2, height - 32)
  }
}
