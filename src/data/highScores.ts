import type { CharacterDef } from './characters/CharacterDef.ts'
import type { MatchScore } from '../scenes/ResultScene.ts'

const STORAGE_KEY = 'castlevania97.highScores.v1'
const MAX_ENTRIES = 10

export interface HighScoreEntry {
  score: number
  grade: string
  fighterId: string
  fighterName: string
  mode: string
  recordedAt: string
}

export function recordHighScore(
  score: MatchScore,
  fighter: CharacterDef,
  mode: string,
  now = new Date(),
): HighScoreEntry[] {
  if (score.total <= 0) return loadHighScores()
  const entries = loadHighScores()
  entries.push({
    score: score.total,
    grade: score.grade,
    fighterId: fighter.id,
    fighterName: fighter.name,
    mode,
    recordedAt: now.toISOString(),
  })
  entries.sort((a, b) => b.score - a.score)
  const next = entries.slice(0, MAX_ENTRIES)
  saveHighScores(next)
  return next
}

export function loadHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HighScoreEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

function saveHighScores(entries: HighScoreEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Scores are a convenience; gameplay should continue if storage is blocked.
  }
}

function isEntry(value: unknown): value is HighScoreEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.score === 'number' &&
    typeof v.grade === 'string' &&
    typeof v.fighterId === 'string' &&
    typeof v.fighterName === 'string' &&
    typeof v.mode === 'string' &&
    typeof v.recordedAt === 'string'
  )
}
