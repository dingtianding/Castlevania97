import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import { CharacterSelectScene } from './CharacterSelectScene.ts'
import { BattleScene, type BattleConfig } from './BattleScene.ts'
import { arcadeDifficulty } from '../data/arcade.ts'
import { TICK_RATE } from '../core/Time.ts'
import type { GameContext } from '../core/GameContext.ts'
import type { MatchWinner } from '../combat/RoundManager.ts'

export interface MatchResult {
  winner: MatchWinner
  p1Wins: number
  p2Wins: number
  score?: MatchScore
}

export interface MatchScore {
  total: number
  grade: string
  damage: number
  timeBonus: number
  healthBonus: number
  perfectBonus: number
  superBonus: number
}

/** Post-match screen. For a normal match it offers rematch or title; inside an
 *  arcade run it advances the ladder, declares a clear, or ends the run. */
export class ResultScene extends Scene {
  private tick = 0
  private done = false

  constructor(
    ctx: GameContext,
    private readonly result: MatchResult,
    private readonly config: BattleConfig,
  ) {
    super(ctx)
  }

  private get playerWon(): boolean {
    return this.result.winner === 'p1'
  }

  private get hasNextStage(): boolean {
    const arc = this.config.arcade
    return arc !== undefined && this.playerWon && arc.stage + 1 < arc.ladder.length
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.done) return
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault()
      this.done = true
      this.advance()
    } else if (e.code === 'Escape') {
      this.done = true
      this.ctx.scenes.replace(new TitleScene(this.ctx))
    } else if (e.code === 'KeyC' && this.config.selectMode) {
      this.done = true
      this.ctx.scenes.replace(new CharacterSelectScene(this.ctx, this.config.selectMode))
    }
  }

  private readonly onPointerDown = (): void => {
    if (this.done) return
    this.done = true
    this.advance()
  }

  override enter(): void {
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

  private advance(): void {
    const arc = this.config.arcade
    if (arc && this.hasNextStage) {
      const stage = arc.stage + 1
      this.ctx.scenes.replace(
        new BattleScene(this.ctx, {
          p1: arc.player,
          p2: arc.ladder[stage]!,
          p2Controller: 'ai',
          aiDifficulty: arcadeDifficulty(stage),
          arcade: { player: arc.player, ladder: arc.ladder, stage },
        }),
      )
    } else if (arc) {
      // Arcade cleared or game over — back to title either way.
      this.ctx.scenes.replace(new TitleScene(this.ctx))
    } else {
      this.ctx.scenes.replace(new BattleScene(this.ctx, this.config))
    }
  }

  render(): void {
    const { renderer, assets, width, height } = this.ctx
    const { ctx } = renderer

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.72)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = '#e8d4a0'
    ctx.font = '44px "Press Start 2P", monospace'
    ctx.fillText(this.headline(), width / 2, height / 2 - 60)

    ctx.fillStyle = '#b91d2b'
    ctx.font = '16px "Press Start 2P", monospace'
    ctx.fillText(this.subtitle(), width / 2, height / 2 + 8)

    this.drawScore()

    if (Math.floor(this.tick / (TICK_RATE / 2)) % 2 === 0) {
      ctx.fillStyle = '#e8d4a0'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText(this.prompt(), width / 2, height - 54)
    }
  }

  private drawScore(): void {
    const score = this.result.score
    if (!score) return
    const { ctx } = this.ctx.renderer
    const x = this.ctx.width / 2 - 230
    const y = this.ctx.height / 2 + 48

    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(8, 6, 14, 0.62)'
    ctx.fillRect(x - 22, y - 22, 460, 150)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(x - 22, y - 22, 460, 150)

    ctx.fillStyle = '#e8d4a0'
    ctx.font = '14px "Press Start 2P", monospace'
    ctx.fillText(`SCORE ${score.total}`, x, y)
    ctx.textAlign = 'right'
    ctx.font = '34px "Press Start 2P", monospace'
    ctx.fillText(score.grade, x + 410, y - 8)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(`DAMAGE ${score.damage}`, x, y + 36)
    ctx.fillText(`TIME ${score.timeBonus}`, x, y + 56)
    ctx.fillText(`HEALTH ${score.healthBonus}`, x, y + 76)
    ctx.fillText(`PERFECT ${score.perfectBonus}`, x + 220, y + 56)
    ctx.fillText(`SUPER ${score.superBonus}`, x + 220, y + 76)
  }

  private headline(): string {
    if (this.config.arcade) {
      if (!this.playerWon) return 'GAME OVER'
      return this.hasNextStage ? 'WINNER' : 'ARCADE CLEAR'
    }
    switch (this.result.winner) {
      case 'p1':
        return 'P1 WINS'
      case 'p2':
        return 'P2 WINS'
      default:
        return 'DRAW'
    }
  }

  private subtitle(): string {
    const arc = this.config.arcade
    if (arc) {
      if (this.hasNextStage) return `NEXT: ${arc.ladder[arc.stage + 1]!.name}`
      if (this.playerWon) return `STAGE ${arc.ladder.length}/${arc.ladder.length}`
      return `STAGE ${arc.stage + 1}/${arc.ladder.length}`
    }
    return `${this.result.p1Wins} - ${this.result.p2Wins}`
  }

  private prompt(): string {
    if (this.config.arcade && this.hasNextStage) return 'ENTER: NEXT FIGHT'
    if (this.config.arcade) return this.config.selectMode ? 'ENTER: TITLE    C: SELECT' : 'ENTER: TITLE'
    return this.config.selectMode ? 'ENTER: REMATCH    C: SELECT    ESC: TITLE' : 'ENTER: REMATCH    ESC: TITLE'
  }
}
