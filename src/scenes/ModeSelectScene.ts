import { Scene } from './Scene.ts'
import { CharacterSelectScene, type SelectMode } from './CharacterSelectScene.ts'
import { TitleScene } from './TitleScene.ts'
import { SettingsScene } from './SettingsScene.ts'
import { MoveListScene } from './MoveListScene.ts'
import { HighScoresScene } from './HighScoresScene.ts'
import { isMenuCancel, isMenuConfirm } from '../input/menuButtons.ts'

interface ModeOption {
  label: string
  mode?: SelectMode
  settings?: true
  moves?: true
  scores?: true
  blurb: string
}

const OPTIONS: ModeOption[] = [
  { label: 'LEGACY 2P', mode: 'local', blurb: 'Two players, one keyboard' },
  { label: 'LEGACY VS CPU', mode: 'ai', blurb: 'Fight the computer' },
  { label: 'TRAINING HALL', mode: 'training', blurb: 'Tune moves and hitboxes' },
  { label: 'ARCHIVE ARC', mode: 'arcade', blurb: 'Climb the CPU gauntlet' },
  { label: 'BOSS RUSH', mode: 'boss', blurb: 'Challenge the demon' },
  { label: 'MOVE CODICES', moves: true, blurb: 'Read fighter kits' },
  { label: 'RECORDS', scores: true, blurb: 'View local records' },
  { label: 'SETTINGS', settings: true, blurb: 'Audio, motion, CPU level' },
]

/** Mode menu. Up/Down to choose, Enter to confirm, Esc back to title. */
export class ModeSelectScene extends Scene {
  private index = 0

  private readonly onKeyDown = (e: KeyboardEvent): void => {
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
      case 'ArrowUp':
      case 'KeyW':
        this.index = (this.index - 1 + OPTIONS.length) % OPTIONS.length
        break
      case 'ArrowDown':
      case 'KeyS':
        this.index = (this.index + 1) % OPTIONS.length
        break
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const point = this.toGamePoint(e)
    const hit = OPTIONS.findIndex((_opt, i) => {
      const y = 142 + i * 48
      return point.y >= y - 28 && point.y <= y + 34
    })
    if (hit >= 0) {
      this.index = hit
      this.choose()
    }
  }

  override enter(): void {
    window.addEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.addEventListener('pointerdown', this.onPointerDown)
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.removeEventListener('pointerdown', this.onPointerDown)
  }

  private choose(): void {
    const option = OPTIONS[this.index]
    if (!option) return
    if (option.settings) this.ctx.scenes.replace(new SettingsScene(this.ctx))
    else if (option.moves) this.ctx.scenes.replace(new MoveListScene(this.ctx))
    else if (option.scores) this.ctx.scenes.replace(new HighScoresScene(this.ctx))
    else if (option.mode) this.ctx.scenes.replace(new CharacterSelectScene(this.ctx, option.mode))
  }

  update(): void {}

  render(): void {
    const { renderer, assets, width, height } = this.ctx
    const { ctx } = renderer

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.8)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '24px "Press Start 2P", monospace'
    ctx.fillText('ARCHIVE', width / 2, 110)

    OPTIONS.forEach((opt, i) => {
      const y = 142 + i * 48
      const selected = i === this.index
      ctx.fillStyle = selected ? '#e8d4a0' : '#6c6c8c'
      ctx.font = '20px "Press Start 2P", monospace'
      ctx.fillText(`${selected ? '> ' : '  '}${opt.label}`, width / 2, y)
      if (selected) {
        ctx.fillStyle = '#8a8aa0'
        ctx.font = '11px "Press Start 2P", monospace'
        ctx.fillText(opt.blurb, width / 2, y + 28)
      }
    })

    ctx.fillStyle = '#5a567a'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('W/S MOVE     J SELECT     K BACK', width / 2, height - 30)
  }

  private toGamePoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.ctx.width,
      y: ((e.clientY - rect.top) / rect.height) * this.ctx.height,
    }
  }
}
