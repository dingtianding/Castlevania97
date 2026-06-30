import { Scene } from './Scene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { CampaignScene } from './CampaignScene.ts'
import { SettingsScene } from './SettingsScene.ts'
import { TICK_RATE } from '../core/Time.ts'
import { campaignHasProgress, loadCampaignSave, resetCampaignSave } from '../data/campaign.ts'
import type { CampaignSave } from '../data/campaign.ts'

interface TitleOption {
  label: string
  action: 'start' | 'continue' | 'archive' | 'settings'
}

export class TitleScene extends Scene {
  private index = 0
  private tick = 0
  private save: CampaignSave = loadCampaignSave()

  private get options(): TitleOption[] {
    const options: TitleOption[] = [
      { label: 'START CAMPAIGN', action: 'start' },
    ]
    if (campaignHasProgress(this.save)) {
      options.push({
        label: this.save.finished ? 'CAMPAIGN CLEAR' : 'CONTINUE',
        action: 'continue',
      })
    }
    options.push(
      { label: 'ARCHIVE', action: 'archive' },
      { label: 'SETTINGS', action: 'settings' },
    )
    return options
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.index = (this.index - 1 + this.options.length) % this.options.length
        break
      case 'ArrowDown':
      case 'KeyS':
        this.index = (this.index + 1) % this.options.length
        break
      case 'Enter':
      case 'Space':
        e.preventDefault()
        this.choose()
        break
      case 'Escape':
        this.index = 0
        break
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const point = this.toGamePoint(e)
    const hit = this.options.findIndex((_option, i) => {
      const y = this.ctx.height / 2 + 16 + i * 34
      return point.y >= y - 18 && point.y <= y + 18
    })
    if (hit < 0) return
    this.index = hit
    this.choose()
  }

  override enter(): void {
    this.save = loadCampaignSave()
    this.index = campaignHasProgress(this.save) ? 1 : 0
    window.addEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.addEventListener('pointerdown', this.onPointerDown)
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.removeEventListener('pointerdown', this.onPointerDown)
  }

  update(): void {
    this.tick += 1
  }

  render(): void {
    const { renderer } = this.ctx
    const { ctx } = renderer
    renderer.clear('#05040a')

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = '#e8d4a0'
    ctx.font = '34px "Press Start 2P", monospace'
    ctx.fillText('CASTLEVANIA97', this.ctx.width / 2, this.ctx.height / 2 - 88)

    this.options.forEach((opt, i) => {
      const y = this.ctx.height / 2 + 16 + i * 34
      ctx.fillStyle = i === this.index ? '#e8d4a0' : '#6c6c8c'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(`${i === this.index ? '> ' : '  '}${opt.label}`, this.ctx.width / 2, y)
    })

    if (Math.floor(this.tick / (TICK_RATE / 2)) % 2 === 0) {
      ctx.fillStyle = '#b91d2b'
      ctx.font = '10px "Press Start 2P", monospace'
      ctx.fillText('ENTER TO SELECT', this.ctx.width / 2, this.ctx.height / 2 + 200)
    }
  }

  private choose(): void {
    const option = this.options[this.index]
    if (!option) return
    switch (option.action) {
      case 'start':
        resetCampaignSave()
        this.ctx.scenes.replace(new CampaignScene(this.ctx))
        break
      case 'continue':
        this.ctx.scenes.replace(new CampaignScene(this.ctx))
        break
      case 'archive':
        this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
        break
      case 'settings':
        this.ctx.scenes.replace(new SettingsScene(this.ctx, 'title'))
        break
    }
  }

  private toGamePoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.ctx.width,
      y: ((e.clientY - rect.top) / rect.height) * this.ctx.height,
    }
  }
}
