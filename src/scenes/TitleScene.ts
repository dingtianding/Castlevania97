import { Scene } from './Scene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { CampaignScene } from './CampaignScene.ts'
import { SettingsScene } from './SettingsScene.ts'
import { TICK_RATE } from '../core/Time.ts'
import { loadCampaignSave, resetCampaignSave } from '../data/campaign.ts'

export class TitleScene extends Scene {
  private index = 0
  private tick = 0

  private readonly options = [
    { label: 'START CAMPAIGN', action: 'start' as const, blurb: 'Begin Julius Belmont\'s run through the castle' },
    { label: 'CONTINUE', action: 'continue' as const, blurb: 'Load the current campaign save' },
    { label: 'ARCHIVE', action: 'archive' as const, blurb: 'Open the legacy fighter modes' },
    { label: 'SETTINGS', action: 'settings' as const, blurb: 'Audio, motion, and difficulty' },
  ]

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
    this.index = this.saveIsFresh() ? 0 : 1
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
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('Demon Castle War', this.ctx.width / 2, this.ctx.height / 2 - 50)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillText('1997-1999', this.ctx.width / 2, this.ctx.height / 2 - 24)

    this.options.forEach((opt, i) => {
      const y = this.ctx.height / 2 + 16 + i * 34
      ctx.fillStyle = i === this.index ? '#e8d4a0' : '#6c6c8c'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(`${i === this.index ? '> ' : '  '}${opt.label}`, this.ctx.width / 2, y)
    })
    ctx.fillStyle = '#5a567a'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText(this.options[this.index]?.blurb ?? '', this.ctx.width / 2, this.ctx.height / 2 + 164)

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
        this.ctx.scenes.replace(new SettingsScene(this.ctx))
        break
    }
  }

  private saveIsFresh(): boolean {
    const save = loadCampaignSave()
    return save.completedNodeIds.length === 0 && save.currentNodeId === save.unlockedNodeIds[0] && !save.finished
  }

  private toGamePoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.ctx.width,
      y: ((e.clientY - rect.top) / rect.height) * this.ctx.height,
    }
  }
}
