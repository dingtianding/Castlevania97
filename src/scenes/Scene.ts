import type { GameContext } from '../core/GameContext.ts'

/** Base scene. Lifecycle: enter() once on push, update()/render() each frame
 *  while active, exit() once on pop/replace. A `transparent` scene lets the
 *  scene beneath it keep drawing (used by pause/settings overlays in P4+). */
export abstract class Scene {
  constructor(protected readonly ctx: GameContext) {}

  enter(): void {}
  exit(): void {}

  abstract update(tick: number): void
  abstract render(alpha: number): void

  get transparent(): boolean {
    return false
  }
}
