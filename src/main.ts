import './style.css'
import { GameLoop } from './core/loop.ts'
import { Renderer } from './render/Renderer.ts'
import { Camera } from './render/Camera.ts'
import { AssetManager } from './assets/AssetManager.ts'
import { AudioManager } from './audio/AudioManager.ts'
import { SceneManager } from './scenes/SceneManager.ts'
import { Rng } from './core/rng.ts'
import { BootScene } from './scenes/BootScene.ts'
import type { GameContext } from './core/GameContext.ts'
import { GAME_WIDTH, GAME_HEIGHT } from './constants.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Canvas element #game not found')

const camera = new Camera()
camera.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const audio = new AudioManager()

const ctx: GameContext = {
  renderer: new Renderer(canvas, GAME_WIDTH, GAME_HEIGHT),
  camera,
  assets: new AssetManager(),
  audio,
  scenes: new SceneManager(),
  rng: new Rng(0x9e3779b1),
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
}

// Browsers block audio until a user gesture; unlock the context on the first
// input, then drop the listeners.
const unlockAudio = (): void => {
  audio.unlock()
  window.removeEventListener('keydown', unlockAudio)
  window.removeEventListener('pointerdown', unlockAudio)
}
window.addEventListener('keydown', unlockAudio)
window.addEventListener('pointerdown', unlockAudio)

ctx.scenes.replace(new BootScene(ctx))

const loop = new GameLoop({
  update: (tick) => ctx.scenes.update(tick),
  render: (alpha) => ctx.scenes.render(alpha),
})
loop.start()
