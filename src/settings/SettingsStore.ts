import type { AIDifficulty } from '../input/AISource.ts'

const STORAGE_KEY = 'castlevania97.settings.v1'

export interface GameSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  reduceMotion: boolean
  difficulty: AIDifficulty
}

const DEFAULTS: GameSettings = {
  masterVolume: 0.85,
  musicVolume: 0.35,
  sfxVolume: 0.6,
  reduceMotion: false,
  difficulty: 'normal',
}

type Listener = (settings: GameSettings) => void

export class SettingsStore {
  private settings: GameSettings
  private readonly listeners = new Set<Listener>()

  constructor(prefersReducedMotion: boolean) {
    this.settings = { ...DEFAULTS, reduceMotion: prefersReducedMotion, ...this.load() }
  }

  get current(): GameSettings {
    return { ...this.settings }
  }

  update(patch: Partial<GameSettings>): void {
    this.settings = sanitize({ ...this.settings, ...patch })
    this.save()
    for (const listener of this.listeners) listener(this.current)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.current)
    return () => this.listeners.delete(listener)
  }

  private load(): Partial<GameSettings> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return {}
      return sanitizePartial(JSON.parse(raw) as Partial<GameSettings>)
    } catch {
      return {}
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
    } catch {
      // Storage can be unavailable in private modes; the in-memory settings
      // still apply for this session.
    }
  }
}

function sanitize(value: GameSettings): GameSettings {
  return {
    masterVolume: clamp01(value.masterVolume),
    musicVolume: clamp01(value.musicVolume),
    sfxVolume: clamp01(value.sfxVolume),
    reduceMotion: Boolean(value.reduceMotion),
    difficulty: sanitizeDifficulty(value.difficulty),
  }
}

function sanitizePartial(value: Partial<GameSettings>): Partial<GameSettings> {
  const out: Partial<GameSettings> = {}
  if (typeof value.masterVolume === 'number') out.masterVolume = clamp01(value.masterVolume)
  if (typeof value.musicVolume === 'number') out.musicVolume = clamp01(value.musicVolume)
  if (typeof value.sfxVolume === 'number') out.sfxVolume = clamp01(value.sfxVolume)
  if (typeof value.reduceMotion === 'boolean') out.reduceMotion = value.reduceMotion
  if (value.difficulty) out.difficulty = sanitizeDifficulty(value.difficulty)
  return out
}

function sanitizeDifficulty(value: string): AIDifficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal'
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
