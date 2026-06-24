import './style.css'
import { GameLoop } from './core/loop.ts'
import { Renderer } from './render/Renderer.ts'
import { Camera } from './render/Camera.ts'
import { AssetManager } from './assets/AssetManager.ts'
import { Animator, drawSprite, makeSheet, type SpriteSheet } from './render/SpriteRenderer.ts'

// Logical resolution (16:9). CSS letterbox-scales the canvas to the window.
const GAME_WIDTH = 1024
const GAME_HEIGHT = 576

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Canvas element #game not found')

const renderer = new Renderer(canvas, GAME_WIDTH, GAME_HEIGHT)
const camera = new Camera()
const assets = new AssetManager()

function drawLoadingScreen(loaded: number, total: number): void {
  const { ctx } = renderer
  renderer.clear('#0a0a12')

  ctx.fillStyle = '#e8d4a0'
  ctx.font = '16px "Press Start 2P", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('LOADING', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 28)

  const barWidth = 420
  const barHeight = 18
  const barX = (GAME_WIDTH - barWidth) / 2
  const barY = GAME_HEIGHT / 2
  const pct = total === 0 ? 0 : loaded / total

  ctx.strokeStyle = '#6c6c8c'
  ctx.lineWidth = 2
  ctx.strokeRect(barX, barY, barWidth, barHeight)
  ctx.fillStyle = '#b91d2b'
  ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * pct, barHeight - 4)
}

/** Throwaway P1 demo: prove the fixed-timestep loop drives sprite animation
 *  independent of refresh rate. The real Battle scene replaces this in P2/P3. */
function startDemo(): void {
  // Floor line the fighters stand on, and a draw scale for the 200px frames.
  const FLOOR_Y = 556
  const FIGHTER_SCALE = 2.3
  const FRAME = 200

  const stageBg = assets.image('stage.bg')
  const stageShop = assets.image('stage.shop')

  const mackIdle = makeSheet(assets.image('mack.idle'), 8)
  const kenjiIdle = makeSheet(assets.image('kenji.idle'), 4)

  const mack = new Animator(mackIdle, 9)
  const kenji = new Animator(kenjiIdle, 9)

  // Anchor each frame so its bottom sits on the floor.
  const spriteTop = FLOOR_Y - FRAME * FIGHTER_SCALE
  const drawFighter = (anim: Animator, sheet: SpriteSheet, x: number, facing: 1 | -1): void => {
    drawSprite(renderer, sheet, anim.currentFrame, x, spriteTop, FIGHTER_SCALE, facing)
  }

  const loop = new GameLoop({
    update: () => {
      mack.update()
      kenji.update()
    },
    render: () => {
      renderer.clear('#000')
      camera.begin(renderer)
      renderer.ctx.drawImage(stageBg, 0, 0, GAME_WIDTH, GAME_HEIGHT)
      renderer.ctx.drawImage(stageShop, 612, 290, stageShop.width * 0.9, stageShop.height * 0.9)
      drawFighter(mack, mackIdle, 150, 1)
      drawFighter(kenji, kenjiIdle, 560, -1)
      camera.end(renderer)
    },
  })

  loop.start()
}

async function boot(): Promise<void> {
  drawLoadingScreen(0, 1)
  await assets.loadAll(drawLoadingScreen)
  startDemo()
}

void boot()
