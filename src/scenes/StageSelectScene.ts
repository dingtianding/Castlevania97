import { Scene } from './Scene.ts'
import { BattleScene, type BattleConfig } from './BattleScene.ts'
import { CharacterSelectScene } from './CharacterSelectScene.ts'
import { STAGES, getStage } from '../data/stages.ts'
import { ROSTER } from '../data/characters/registry.ts'
import type { GameContext } from '../core/GameContext.ts'

type StageBattleConfig = Omit<BattleConfig, 'stage'>

/** Stage picker for local and non-arcade matches. It keeps the fight flow
 *  lightweight while giving each match a distinct stage identity. */
export class StageSelectScene extends Scene {
  private index = 0

  constructor(
    ctx: GameContext,
    private readonly config: StageBattleConfig,
  ) {
    super(ctx)
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
      case 'ArrowLeft':
      case 'KeyA':
        this.index = (this.index - 1 + STAGES.length) % STAGES.length
        break
      case 'ArrowDown':
      case 'KeyS':
      case 'ArrowRight':
      case 'KeyD':
        this.index = (this.index + 1) % STAGES.length
        break
      case 'Enter':
      case 'Space':
        e.preventDefault()
        this.choose()
        break
      case 'Escape':
        this.ctx.scenes.replace(
          new CharacterSelectScene(
            this.ctx,
            this.config.selectMode && this.config.selectMode !== 'campaign' ? this.config.selectMode : 'local',
            {
              p1Index: this.findRosterIndex(this.config.p1.id),
              p2Index: this.findRosterIndex(this.config.p2.id),
            },
          ),
        )
        break
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const point = this.toGamePoint(e)
    const hit = STAGES.findIndex((_stage, i) => {
      const y = 176 + i * 58
      return point.y >= y - 24 && point.y <= y + 34
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
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText('SELECT STAGE', width / 2, 86)

    STAGES.forEach((stage, i) => {
      const y = 176 + i * 58
      const selected = i === this.index
      ctx.fillStyle = selected ? '#e8d4a0' : '#6c6c8c'
      ctx.font = '18px "Press Start 2P", monospace'
      ctx.fillText(`${selected ? '> ' : '  '}${stage.name}`, width / 2, y)
      if (selected) {
        ctx.fillStyle = '#8a8aa0'
        ctx.font = '11px "Press Start 2P", monospace'
        ctx.fillText(stage.blurb, width / 2, y + 28)
      }
    })

    const selectedStage = getStage(STAGES[this.index]?.id ?? 'outer_wall')
    ctx.fillStyle = 'rgba(8, 6, 14, 0.78)'
    ctx.fillRect(92, 360, width - 184, 118)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(92, 360, width - 184, 118)
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText(selectedStage.name.toUpperCase(), width / 2, 384)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(selectedStage.blurb, width / 2, 412)

    ctx.fillStyle = '#5a567a'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText('W/S OR A/D MOVE     ENTER SELECT     ESC BACK', width / 2, height - 30)
  }

  private choose(): void {
    const stage = STAGES[this.index]?.id ?? 'outer_wall'
    this.ctx.scenes.replace(new BattleScene(this.ctx, { ...this.config, stage }))
  }

  private findRosterIndex(id: string): number {
    const index = ROSTER.findIndex((fighter) => fighter.id === id)
    return index >= 0 ? index : 0
  }

  private toGamePoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.ctx.width,
      y: ((e.clientY - rect.top) / rect.height) * this.ctx.height,
    }
  }
}
