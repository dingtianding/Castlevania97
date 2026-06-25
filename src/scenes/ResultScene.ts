import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import { BattleScene, type BattleConfig } from './BattleScene.ts'
import { TICK_RATE } from '../core/Time.ts'
import type { GameContext } from '../core/GameContext.ts'
import type { MatchWinner } from '../combat/RoundManager.ts'

export interface MatchResult {
  winner: MatchWinner
  p1Wins: number
  p2Wins: number
}

/** Post-match screen: result, round tally, rematch or back to title. */
export class ResultScene extends Scene {
  private tick = 0
  private choice: 'rematch' | 'title' | null = null

  constructor(
    ctx: GameContext,
    private readonly result: MatchResult,
    private readonly config: BattleConfig,
  ) {
    super(ctx)
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault()
      this.choice = 'rematch'
    } else if (e.code === 'Escape') {
      this.choice = 'title'
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
    if (this.choice === 'rematch') this.ctx.scenes.replace(new BattleScene(this.ctx, this.config))
    else if (this.choice === 'title') this.ctx.scenes.replace(new TitleScene(this.ctx))
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
    ctx.font = '48px "Press Start 2P", monospace'
    ctx.fillText(this.headline(), width / 2, height / 2 - 60)

    ctx.fillStyle = '#b91d2b'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText(`${this.result.p1Wins} - ${this.result.p2Wins}`, width / 2, height / 2 + 8)

    if (Math.floor(this.tick / (TICK_RATE / 2)) % 2 === 0) {
      ctx.fillStyle = '#e8d4a0'
      ctx.font = '12px "Press Start 2P", monospace'
      ctx.fillText('ENTER: REMATCH    ESC: TITLE', width / 2, height / 2 + 72)
    }
  }

  private headline(): string {
    switch (this.result.winner) {
      case 'p1':
        return 'P1 WINS'
      case 'p2':
        return 'P2 WINS'
      default:
        return 'DRAW'
    }
  }
}
