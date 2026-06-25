import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'

/** Preloads the asset manifest behind a progress bar, then advances to the
 *  title. Decoding everything here kills the first-frame race. */
export class LoadScene extends Scene {
  private loaded = 0
  private total = 1
  private done = false

  override enter(): void {
    void this.ctx.assets
      .loadAll((loaded, total) => {
        this.loaded = loaded
        this.total = total
      })
      .then(() => {
        this.done = true
      })
  }

  update(): void {
    if (this.done) {
      this.ctx.scenes.replace(new TitleScene(this.ctx))
    }
  }

  render(): void {
    const { renderer } = this.ctx
    const { ctx } = renderer
    renderer.clear('#0a0a12')

    ctx.fillStyle = '#e8d4a0'
    ctx.font = '16px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('LOADING', this.ctx.width / 2, this.ctx.height / 2 - 28)

    const barWidth = 420
    const barHeight = 18
    const barX = (this.ctx.width - barWidth) / 2
    const barY = this.ctx.height / 2
    const pct = this.total === 0 ? 0 : this.loaded / this.total

    ctx.strokeStyle = '#6c6c8c'
    ctx.lineWidth = 2
    ctx.strokeRect(barX, barY, barWidth, barHeight)
    ctx.fillStyle = '#b91d2b'
    ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * pct, barHeight - 4)
  }
}
