import { TICK_RATE } from '../core/Time.ts'

/** Minimal view of a fighter the round logic needs. */
export interface RoundParticipant {
  readonly isDead: boolean
  readonly health: number
}

export type MatchWinner = 'p1' | 'p2' | 'draw'
export type RoundPhase = 'intro' | 'fight' | 'roundOver' | 'matchOver'

/** Signal returned from update() so the scene knows when to reset the fighters. */
export type RoundSignal = 'none' | 'newRound'

const ROUNDS_TO_WIN = 2
const MAX_ROUNDS = 3

/**
 * Best-of-3 match flow: an intro (READY/FIGHT) before each round, a timed fight,
 * a round-over beat, then the next round or the match result. Owns the round
 * timer (in ticks) and per-player round wins; the scene reads phase + banner.
 */
export class RoundManager {
  phase: RoundPhase = 'intro'
  round = 1
  p1Wins = 0
  p2Wins = 0

  private timer: number
  private phaseTimer: number
  private banner = ''

  constructor(
    private readonly roundTicks: number,
    private readonly introTicks: number,
    private readonly roundOverTicks: number,
  ) {
    this.timer = roundTicks
    this.phaseTimer = introTicks
    this.banner = `ROUND ${this.round}`
  }

  get isFighting(): boolean {
    return this.phase === 'fight'
  }

  get isMatchOver(): boolean {
    return this.phase === 'matchOver'
  }

  get timeLeftSeconds(): number {
    return this.timer / TICK_RATE
  }

  get bannerText(): string {
    return this.banner
  }

  get matchWinner(): MatchWinner {
    if (this.p1Wins > this.p2Wins) return 'p1'
    if (this.p2Wins > this.p1Wins) return 'p2'
    return 'draw'
  }

  update(p1: RoundParticipant, p2: RoundParticipant): RoundSignal {
    switch (this.phase) {
      case 'intro':
        return this.updateIntro()
      case 'fight':
        return this.updateFight(p1, p2)
      case 'roundOver':
        return this.updateRoundOver()
      case 'matchOver':
        return 'none'
    }
  }

  private updateIntro(): RoundSignal {
    this.phaseTimer -= 1
    this.banner = this.phaseTimer > this.introTicks * 0.4 ? `ROUND ${this.round}` : 'FIGHT'
    if (this.phaseTimer <= 0) {
      this.phase = 'fight'
      this.banner = ''
      this.timer = this.roundTicks
    }
    return 'none'
  }

  private updateFight(p1: RoundParticipant, p2: RoundParticipant): RoundSignal {
    this.timer -= 1
    const koed = p1.isDead || p2.isDead
    if (!koed && this.timer > 0) return 'none'

    const winner = this.decideRound(p1, p2)
    if (winner === 'p1') this.p1Wins += 1
    else if (winner === 'p2') this.p2Wins += 1
    else {
      this.p1Wins += 1
      this.p2Wins += 1
    }

    this.banner = koed ? 'K.O.' : 'TIME'
    this.phase = 'roundOver'
    this.phaseTimer = this.roundOverTicks
    return 'none'
  }

  private updateRoundOver(): RoundSignal {
    this.phaseTimer -= 1
    if (this.phaseTimer > 0) return 'none'

    const decided = this.p1Wins >= ROUNDS_TO_WIN || this.p2Wins >= ROUNDS_TO_WIN
    if (decided || this.round >= MAX_ROUNDS) {
      this.phase = 'matchOver'
      this.banner = this.matchBanner()
      return 'none'
    }

    this.round += 1
    this.phase = 'intro'
    this.phaseTimer = this.introTicks
    this.banner = `ROUND ${this.round}`
    return 'newRound'
  }

  private decideRound(p1: RoundParticipant, p2: RoundParticipant): MatchWinner {
    if (p1.isDead && p2.isDead) return 'draw'
    if (p2.isDead) return 'p1'
    if (p1.isDead) return 'p2'
    if (p1.health > p2.health) return 'p1'
    if (p2.health > p1.health) return 'p2'
    return 'draw'
  }

  private matchBanner(): string {
    const w = this.matchWinner
    return w === 'draw' ? 'DRAW' : w === 'p1' ? 'P1 WINS' : 'P2 WINS'
  }
}
