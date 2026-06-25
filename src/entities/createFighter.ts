import { Fighter, type FighterAnimations } from './Fighter.ts'
import { makeSheet } from '../render/SpriteRenderer.ts'
import type { AssetManager } from '../assets/AssetManager.ts'
import type { CharacterDef } from '../data/characters/CharacterDef.ts'
import type { Facing } from '../types.ts'

/** Resolve a CharacterDef's sprite keys to decoded sheets and build a Fighter. */
export function createFighter(
  def: CharacterDef,
  assets: AssetManager,
  spawnX: number,
  facing: Facing,
  floorY: number,
  stageWidth: number,
): Fighter {
  const s = def.sprites
  const anims: FighterAnimations = {
    idle: makeSheet(assets.image(s.idle.key), s.idle.frames),
    run: makeSheet(assets.image(s.run.key), s.run.frames),
    jump: makeSheet(assets.image(s.jump.key), s.jump.frames),
    fall: makeSheet(assets.image(s.fall.key), s.fall.frames),
    attack1: makeSheet(assets.image(s.attack1.key), s.attack1.frames),
    attack2: makeSheet(assets.image(s.attack2.key), s.attack2.frames),
    takeHit: makeSheet(assets.image(s.takeHit.key), s.takeHit.frames),
    death: makeSheet(assets.image(s.death.key), s.death.frames),
  }
  return new Fighter(anims, def.visual, def.moves, spawnX, facing, floorY, stageWidth)
}
