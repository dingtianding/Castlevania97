import type { ImageKey } from '../../assets/manifest.ts'
import type { FighterVisual } from '../../entities/Fighter.ts'
import type { Moveset } from '../../combat/AttackMove.ts'

/** One animation sheet: which manifest image, and how many frames it holds. */
export interface SpriteDef {
  key: ImageKey
  frames: number
}

export type AnimName =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'attack1'
  | 'attack2'
  | 'takeHit'
  | 'death'

export interface CharacterStats {
  power: number
  speed: number
  range: number
  technique: number
}

export interface CharacterMoveNames {
  light: string
  heavy: string
  special: string
  super: string
}

export interface CharacterMeta {
  archetype: string
  bio: string
  stats: CharacterStats
  moveNames: CharacterMoveNames
}

/**
 * A playable fighter as pure data. Adding a character to the roster is one of
 * these object literals registered in `registry.ts` — no engine changes. Sprite
 * keys are resolved to decoded sheets at battle start; everything else (body
 * anchor/hurtbox, frame data for the whole moveset) lives here.
 */
export interface CharacterDef {
  id: string
  name: string
  meta: CharacterMeta
  sprites: Record<AnimName, SpriteDef>
  visual: FighterVisual
  moves: Moveset
  /** Body colour for the placeholder stick-figure renderer. */
  color?: string
  /** A player-controlled character (gets hit invulnerability, etc.). */
  isHero?: boolean
}
