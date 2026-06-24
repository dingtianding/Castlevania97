import { Scene } from './Scene.ts'
import { Fighter, type FighterAnimations, type FighterVisual } from '../entities/Fighter.ts'
import { KeyboardSource } from '../input/KeyboardSource.ts'
import { PLAYER1_KEYS } from '../input/bindings.ts'
import { makeSheet } from '../render/SpriteRenderer.ts'
import { FLOOR_Y } from '../constants.ts'

// Feet/center anchors measured from the sprite cells' non-transparent bounds.
const MACK_VISUAL: FighterVisual = { anchorX: 95, anchorY: 123, scale: 3.6 }

/** P2 battle: one keyboard-driven fighter on the stage with real gravity.
 *  The second fighter, hitboxes, health, and HUD land in P3. */
export class BattleScene extends Scene {
  private player!: Fighter
  private input!: KeyboardSource

  override enter(): void {
    const { assets } = this.ctx
    const anims: FighterAnimations = {
      idle: makeSheet(assets.image('mack.idle'), 8),
      run: makeSheet(assets.image('mack.run'), 8),
      jump: makeSheet(assets.image('mack.jump'), 2),
      fall: makeSheet(assets.image('mack.fall'), 2),
    }
    this.player = new Fighter(anims, MACK_VISUAL, 320, 1, FLOOR_Y, this.ctx.width)
    this.input = new KeyboardSource(PLAYER1_KEYS)
  }

  override exit(): void {
    this.input.dispose()
  }

  update(): void {
    this.player.update(this.input.poll())
  }

  render(alpha: number): void {
    const { renderer, camera, assets } = this.ctx
    renderer.clear('#000')
    camera.begin(renderer)

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, this.ctx.width, this.ctx.height)
    this.player.render(renderer, alpha)

    camera.end(renderer)
  }
}
