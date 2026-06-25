import { Scene } from './Scene.ts'
import { CharacterSelectScene, type SelectMode } from './CharacterSelectScene.ts'
import { TitleScene } from './TitleScene.ts'

interface ModeOption {
  label: string
  mode: SelectMode
  blurb: string
}

const OPTIONS: ModeOption[] = [
  { label: 'LOCAL 2P', mode: 'local', blurb: 'Two players, one keyboard' },
  { label: 'VS CPU', mode: 'ai', blurb: 'Fight the computer' },
  { label: 'ARCADE', mode: 'arcade', blurb: 'Climb the CPU gauntlet' },
]

/** Mode menu. Up/Down to choose, Enter to confirm, Esc back to title. */
export class ModeSelectScene extends Scene {
  private index = 0

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.index = (this.index - 1 + OPTIONS.length) % OPTIONS.length
        break
      case 'ArrowDown':
      case 'KeyS':
        this.index = (this.index + 1) % OPTIONS.length
        break
      case 'Enter':
      case 'Space':
        e.preventDefault()
        this.ctx.scenes.replace(new CharacterSelectScene(this.ctx, OPTIONS[this.index]!.mode))
        break
      case 'Escape':
        this.ctx.scenes.replace(new TitleScene(this.ctx))
        break
    }
  }

  override enter(): void {
    window.addEventListener('keydown', this.onKeyDown)
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
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
    ctx.fillText('SELECT MODE', width / 2, 110)

    OPTIONS.forEach((opt, i) => {
      const y = 230 + i * 80
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
    ctx.fillText('W/S MOVE     ENTER SELECT     ESC BACK', width / 2, height - 30)
  }
}
