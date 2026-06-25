import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import { TICK_RATE } from '../core/Time.ts'

/**
 * Pause overlay. Being a transparent scene, the SceneManager keeps drawing the
 * frozen battle underneath while only this scene updates — the exact use case
 * the scene stack was built for.
 */
export class PauseScene extends Scene {
  private tick = 0

  override get transparent(): boolean {
    return true
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' || e.code === 'Enter') {
      e.preventDefault()
      this.ctx.scenes.pop() // resume
    } else if (e.code === 'KeyQ') {
      this.ctx.scenes.replace(new TitleScene(this.ctx))
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
  }

  render(): void {
    const { renderer, width, height } = this.ctx
    const { ctx } = renderer

    ctx.fillStyle = 'rgba(8, 6, 14, 0.66)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '40px "Press Start 2P", monospace'
    ctx.fillText('PAUSED', width / 2, height / 2 - 30)

    if (Math.floor(this.tick / (TICK_RATE / 2)) % 2 === 0) {
      ctx.fillStyle = '#8a8aa0'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText('ESC / ENTER: RESUME      Q: QUIT', width / 2, height / 2 + 40)
    }
  }
}
