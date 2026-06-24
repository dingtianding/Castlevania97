import './style.css'

// Logical resolution. The canvas is letterbox-scaled to the window by CSS;
// the engine always reasons in these fixed dimensions (16:9).
const GAME_WIDTH = 1024
const GAME_HEIGHT = 576

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) {
  throw new Error('Canvas element #game not found')
}

canvas.width = GAME_WIDTH
canvas.height = GAME_HEIGHT

const ctx = canvas.getContext('2d')
if (!ctx) {
  throw new Error('2D rendering context unavailable')
}

// Crisp pixel art — no bilinear smoothing on scaled sprites.
ctx.imageSmoothingEnabled = false

function drawPlaceholder(context: CanvasRenderingContext2D): void {
  context.fillStyle = '#0a0a12'
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

  context.textAlign = 'center'
  context.textBaseline = 'middle'

  context.fillStyle = '#e8d4a0'
  context.font = '32px "Press Start 2P", monospace'
  context.fillText('CASTLEVANIA 97', GAME_WIDTH / 2, GAME_HEIGHT / 2)

  context.fillStyle = '#6c6c8c'
  context.font = '12px "Press Start 2P", monospace'
  context.fillText('P0 — engine skeleton', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 56)
}

// Paint immediately for first frame, then repaint once the pixel font has
// loaded so the title isn't drawn with the fallback face.
drawPlaceholder(ctx)
void document.fonts.ready.then(() => drawPlaceholder(ctx))
