import { Scene } from './Scene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import type { AIDifficulty } from '../input/AISource.ts'
import type { GameSettings } from '../settings/SettingsStore.ts'

type SettingKey = 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'reduceMotion' | 'difficulty'

interface SettingRow {
  key: SettingKey
  label: string
}

const ROWS: SettingRow[] = [
  { key: 'masterVolume', label: 'MASTER' },
  { key: 'musicVolume', label: 'MUSIC' },
  { key: 'sfxVolume', label: 'SFX' },
  { key: 'reduceMotion', label: 'MOTION' },
  { key: 'difficulty', label: 'CPU' },
]

const DIFFICULTIES: AIDifficulty[] = ['easy', 'normal', 'hard']

export class SettingsScene extends Scene {
  private index = 0
  private readonly rowRects: { x: number; y: number; w: number; h: number }[] = []

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.index = (this.index - 1 + ROWS.length) % ROWS.length
        break
      case 'ArrowDown':
      case 'KeyS':
        this.index = (this.index + 1) % ROWS.length
        break
      case 'ArrowLeft':
      case 'KeyA':
        this.adjust(-1)
        break
      case 'ArrowRight':
      case 'KeyD':
        this.adjust(1)
        break
      case 'Enter':
      case 'Space':
        this.adjust(1)
        break
      case 'Escape':
        this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
        break
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const point = this.toGamePoint(e)
    const hit = this.rowRects.findIndex(
      (r) => point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h,
    )
    if (hit >= 0) {
      this.index = hit
      this.adjust(point.x < this.ctx.width / 2 ? -1 : 1)
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

  update(): void {}

  private adjust(dir: -1 | 1): void {
    const row = ROWS[this.index]
    if (!row) return
    const settings = this.ctx.settings.current
    switch (row.key) {
      case 'masterVolume':
      case 'musicVolume':
      case 'sfxVolume':
        this.ctx.settings.update({ [row.key]: Math.round((settings[row.key] + dir * 0.1) * 10) / 10 })
        break
      case 'reduceMotion':
        this.ctx.settings.update({ reduceMotion: !settings.reduceMotion })
        break
      case 'difficulty': {
        const current = DIFFICULTIES.indexOf(settings.difficulty)
        const next = (current + dir + DIFFICULTIES.length) % DIFFICULTIES.length
        this.ctx.settings.update({ difficulty: DIFFICULTIES[next]! })
        break
      }
    }
  }

  render(): void {
    const { renderer, assets, width, height } = this.ctx
    const { ctx } = renderer
    const settings = this.ctx.settings.current

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.82)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '24px "Press Start 2P", monospace'
    ctx.fillText('SETTINGS', width / 2, 96)

    this.rowRects.length = 0
    ROWS.forEach((row, i) => {
      const y = 190 + i * 58
      const selected = i === this.index
      this.rowRects.push({ x: 210, y: y - 24, w: width - 420, h: 48 })
      ctx.fillStyle = selected ? '#e8d4a0' : '#6c6c8c'
      ctx.font = '15px "Press Start 2P", monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`${selected ? '> ' : '  '}${row.label}`, 250, y)
      ctx.textAlign = 'right'
      ctx.fillText(valueText(row.key, settings), width - 250, y)
    })

    ctx.textAlign = 'center'
    ctx.fillStyle = '#5a567a'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('W/S MOVE     A/D CHANGE     ESC BACK', width / 2, height - 30)
  }

  private toGamePoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.ctx.width,
      y: ((e.clientY - rect.top) / rect.height) * this.ctx.height,
    }
  }
}

function valueText(key: SettingKey, settings: GameSettings): string {
  switch (key) {
    case 'masterVolume':
    case 'musicVolume':
    case 'sfxVolume':
      return `${Math.round(settings[key] * 10)}`
    case 'reduceMotion':
      return settings.reduceMotion ? 'LOW' : 'FULL'
    case 'difficulty':
      return settings.difficulty.toUpperCase()
  }
}
