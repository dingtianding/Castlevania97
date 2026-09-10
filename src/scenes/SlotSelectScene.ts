import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import {
  getActiveSaveSlot,
  getCampaignChapter,
  loadCampaignSaveFromSlot,
  SAVE_SLOT_COUNT,
  saveSlotIsEmpty,
  setActiveSaveSlot,
} from '../data/campaign.ts'
import { isMenuCancel, isMenuConfirm } from '../input/menuButtons.ts'

interface SlotSummary {
  empty: boolean
  label: string
}

function summarize(slot: number): SlotSummary {
  if (saveSlotIsEmpty(slot)) return { empty: true, label: 'EMPTY — START A NEW HUNT' }
  const save = loadCampaignSaveFromSlot(slot)
  const area = getCampaignChapter(save.chapterId).title.toUpperCase()
  const status = save.finished ? (save.ngPlusCycle > 0 ? `CLEAR — NG+${save.ngPlusCycle}` : 'CLEAR') : area
  return { empty: false, label: `LV ${save.level}  ·  ${status}` }
}

export class SlotSelectScene extends Scene {
  private index = getActiveSaveSlot()

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isMenuCancel(e.code)) {
      e.preventDefault()
      this.ctx.scenes.replace(new TitleScene(this.ctx))
      return
    }
    if (isMenuConfirm(e.code)) {
      e.preventDefault()
      setActiveSaveSlot(this.index)
      this.ctx.scenes.replace(new TitleScene(this.ctx))
      return
    }
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.index = (this.index - 1 + SAVE_SLOT_COUNT) % SAVE_SLOT_COUNT
        break
      case 'ArrowDown':
      case 'KeyS':
        this.index = (this.index + 1) % SAVE_SLOT_COUNT
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
    const { renderer, width, height } = this.ctx
    const { ctx } = renderer
    renderer.clear('#05040a')

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '22px "Press Start 2P", monospace'
    ctx.fillText('SAVE SLOTS', width / 2, 96)
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '9px "Press Start 2P", monospace'
    ctx.fillText('CHOOSE WHICH HUNT TO PLAY', width / 2, 128)

    const activeSlot = getActiveSaveSlot()
    const rowH = 84
    const startY = 190
    for (let slot = 0; slot < SAVE_SLOT_COUNT; slot += 1) {
      const y = startY + slot * rowH
      const selected = slot === this.index
      const summary = summarize(slot)
      const w = 560
      const x = width / 2 - w / 2

      ctx.fillStyle = selected ? 'rgba(40, 33, 56, 0.96)' : 'rgba(16, 24, 43, 0.84)'
      ctx.fillRect(x, y, w, rowH - 16)
      ctx.strokeStyle = selected ? '#e8d4a0' : '#5a567a'
      ctx.lineWidth = selected ? 3 : 2
      ctx.strokeRect(x, y, w, rowH - 16)

      ctx.textAlign = 'left'
      ctx.fillStyle = selected ? '#e8d4a0' : '#b7c7e6'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(`SLOT ${slot + 1}${slot === activeSlot ? '  (ACTIVE)' : ''}`, x + 18, y + 20)
      ctx.fillStyle = summary.empty ? '#5a567a' : '#f6b74a'
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText(summary.label, x + 18, y + 46)
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = '#5a567a'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('J / ENTER SELECT      K / ESC BACK', width / 2, height - 44)
  }
}
