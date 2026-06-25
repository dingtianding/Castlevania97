import type { Scene } from './Scene.ts'

/**
 * Stack of scenes. Only the top scene updates (so an overlay freezes the scene
 * below), but rendering walks down to the lowest transparent run so overlays
 * draw on top of the frozen world.
 */
export class SceneManager {
  private readonly stack: Scene[] = []

  /** Clear the whole stack and start fresh with `scene`. */
  replace(scene: Scene): void {
    while (this.stack.length > 0) {
      this.stack.pop()?.exit()
    }
    this.push(scene)
  }

  push(scene: Scene): void {
    this.stack.push(scene)
    scene.enter()
  }

  pop(): void {
    this.stack.pop()?.exit()
  }

  get current(): Scene | undefined {
    return this.stack[this.stack.length - 1]
  }

  update(tick: number): void {
    this.current?.update(tick)
  }

  render(alpha: number): void {
    // Find the lowest scene we must redraw: everything from the first
    // non-transparent scene (scanning down from the top) upward.
    let start = this.stack.length - 1
    while (start > 0 && this.stack[start]?.transparent) start -= 1
    for (let i = start; i < this.stack.length; i += 1) {
      this.stack[i]?.render(alpha)
    }
  }
}
