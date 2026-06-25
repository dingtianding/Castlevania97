import { Scene } from './Scene.ts'
import { LoadScene } from './LoadScene.ts'

/** One-shot entry point. Any global init lands here later; for now it just
 *  hands off to asset loading. */
export class BootScene extends Scene {
  override enter(): void {
    this.ctx.scenes.replace(new LoadScene(this.ctx))
  }

  update(): void {}
  render(): void {}
}
