import { Scene } from './Scene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { TICK_RATE } from '../core/Time.ts'

/** Title card. Press Enter/Space to drop into the battle (the full mode menu
 *  and character select arrive in P6). */
export class TitleScene extends Scene {
  private start = false
  private tick = 0

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault()
      this.start = true
    }
  }

  override enter(): void {
    window.addEventListener('keydown', this.onKeyDown)
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
  }

  update(): void {
    this.tick += 1
    if (this.start) {
      this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
    }
  }

  render(): void {
    const { renderer } = this.ctx
    const { ctx } = renderer
    renderer.clear('#0a0a12')

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = '#e8d4a0'
    ctx.font = '40px "Press Start 2P", monospace'
    ctx.fillText('CASTLEVANIA 97', this.ctx.width / 2, this.ctx.height / 2 - 40)

    // Blink the prompt roughly twice a second.
    if (Math.floor(this.tick / (TICK_RATE / 2)) % 2 === 0) {
      ctx.fillStyle = '#b91d2b'
      ctx.font = '14px "Press Start 2P", monospace'
      ctx.fillText('PRESS ENTER', this.ctx.width / 2, this.ctx.height / 2 + 48)
    }
  }
}
