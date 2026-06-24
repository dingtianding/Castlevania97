import type { Renderer } from '../render/Renderer.ts'
import type { Camera } from '../render/Camera.ts'
import type { AssetManager } from '../assets/AssetManager.ts'
import type { SceneManager } from '../scenes/SceneManager.ts'
import type { Rng } from './rng.ts'

/** Service bag handed to every scene. Grows as subsystems land (audio,
 *  settings in later phases); scenes pull what they need from here rather than
 *  reaching for globals. */
export interface GameContext {
  readonly renderer: Renderer
  readonly camera: Camera
  readonly assets: AssetManager
  readonly scenes: SceneManager
  readonly rng: Rng
  readonly width: number
  readonly height: number
}
