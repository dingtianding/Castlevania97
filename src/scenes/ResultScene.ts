import { Scene } from './Scene.ts'
import { TitleScene } from './TitleScene.ts'
import { CharacterSelectScene } from './CharacterSelectScene.ts'
import { BattleScene, type BattleConfig } from './BattleScene.ts'
import { RewardScene } from './RewardScene.ts'
import { CampaignScene } from './CampaignScene.ts'
import { getStage, stageForArcade } from '../data/stages.ts'
import { completeCampaignBattle, getCampaignChapter, getCampaignNode } from '../data/campaign.ts'
import { recordHighScore } from '../data/highScores.ts'
import { TICK_RATE } from '../core/Time.ts'
import type { GameContext } from '../core/GameContext.ts'
import type { MatchWinner } from '../combat/RoundManager.ts'
import { isMenuCancel, isMenuConfirm } from '../input/menuButtons.ts'

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
  private scoreSaved = false

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
    if (isMenuConfirm(e.code)) {
      e.preventDefault()
      this.done = true
      this.advance()
    } else if (isMenuCancel(e.code)) {
      e.preventDefault()
      this.done = true
      this.ctx.scenes.replace(new TitleScene(this.ctx))
    } else if (e.code === 'KeyC' && this.config.selectMode && this.config.selectMode !== 'campaign') {
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
    this.saveScore()
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

  private saveScore(): void {
    if (this.scoreSaved || !this.result.score || this.result.winner !== 'p1' || this.config.selectMode === 'campaign') return
    this.scoreSaved = true
    recordHighScore(this.result.score, this.config.p1, modeLabel(this.config))
  }

  private advance(): void {
    if (this.config.selectMode === 'campaign') {
      if (this.result.winner === 'p1' && this.config.campaign) {
        completeCampaignBattle(this.config.campaign)
      }
      this.ctx.scenes.replace(new CampaignScene(this.ctx))
      return
    }

    const arc = this.config.arcade
    if (arc && this.hasNextStage) {
      this.ctx.scenes.replace(new RewardScene(this.ctx, this.config))
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

    this.drawStageCard()
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

  private drawStageCard(): void {
    const { ctx } = this.ctx.renderer
    const x = this.ctx.width / 2 - 240
    const y = this.ctx.height / 2 - 130

    ctx.fillStyle = 'rgba(8, 6, 14, 0.62)'
    ctx.fillRect(x, y, 480, 92)
    ctx.strokeStyle = '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, 480, 92)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#8a8aa0'
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText('STAGE', x + 16, y + 24)
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '12px "Press Start 2P", monospace'
    ctx.fillText(this.currentStageTag(), x + 92, y + 24)
    ctx.fillStyle = '#b7c7e6'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillText(this.currentStageLabel(), x + 16, y + 48)
    ctx.font = '8px "Press Start 2P", monospace'
    ctx.fillText(this.currentStageBlurb(), x + 16, y + 70)
  }

  private headline(): string {
    if (this.config.selectMode === 'campaign') {
      if (!this.playerWon) return 'JULIUS FALLS'
      if (this.config.campaign?.currentNodeId === '1999-dracula') return 'DRACULA FALLS'
      return 'SEAL BROKEN'
    }
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
    if (this.config.selectMode === 'campaign' && this.config.campaign) {
      const node = getCampaignNode(this.config.campaign.currentNodeId ?? '1997-chapel')
      const chapter = getCampaignChapter(this.config.campaign.chapterId)
      return `${chapter.year}  ${chapter.title}  ${node.title}`
    }
    if (arc) {
      if (this.hasNextStage) return `NEXT: ${arc.ladder[arc.stage + 1]!.name}`
      if (this.playerWon) return `STAGE ${arc.ladder.length}/${arc.ladder.length}`
      return `STAGE ${arc.stage + 1}/${arc.ladder.length}`
    }
    return `${this.result.p1Wins} - ${this.result.p2Wins}`
  }

  private currentStageLabel(): string {
    if (this.config.arcade) {
      return getStage(stageForArcade(this.config.arcade.stage)).name
    }
    return getStage(this.config.stage ?? 'outer_wall').name
  }

  private currentStageBlurb(): string {
    if (this.config.arcade) {
      return getStage(stageForArcade(this.config.arcade.stage)).blurb
    }
    return getStage(this.config.stage ?? 'outer_wall').blurb
  }

  private currentStageTag(): string {
    if (this.config.arcade) {
      return stageForArcade(this.config.arcade.stage).toUpperCase()
    }
    return (this.config.stage ?? 'outer_wall').toUpperCase()
  }

  private prompt(): string {
    if (this.config.selectMode === 'campaign') return 'J: BACK TO MAP'
    if (this.config.arcade && this.hasNextStage) return 'J: NEXT FIGHT'
    if (this.config.arcade) return this.config.selectMode ? 'J: TITLE    C: SELECT' : 'J: TITLE'
    return this.config.selectMode ? 'J: REMATCH    C: SELECT    K: TITLE' : 'J: REMATCH    K: TITLE'
  }
}

function modeLabel(config: BattleConfig): string {
  if (config.selectMode === 'campaign') return 'Campaign'
  if (config.selectMode === 'boss') return 'Boss Rush'
  if (config.selectMode === 'arcade') return 'Arcade'
  if (config.selectMode === 'ai') return 'VS CPU'
  if (config.selectMode === 'local') return 'Local'
  return 'Match'
}
