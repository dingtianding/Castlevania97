import { Scene } from './Scene.ts'
import { ModeSelectScene } from './ModeSelectScene.ts'
import { CAMPAIGN_ENEMIES, CAMPAIGN_BOSS_IDS } from '../data/characters/castlevaniaCampaign.ts'
import { rewardForEnemy } from '../data/enemyRewards.ts'
import { soulForEnemy } from '../data/souls.ts'
import { blueSoulForEnemy } from '../data/blueSouls.ts'
import { bulletSoulForEnemy } from '../data/bulletSouls.ts'
import { drawSprite, makeSheet, type SpriteSheet } from '../render/SpriteRenderer.ts'
import type { CharacterDef } from '../data/characters/CharacterDef.ts'
import { isMenuCancel, isMenuConfirm } from '../input/menuButtons.ts'

interface LootRow {
  color: string
  label: string
  blurb: string
}

/** Archive codex: what each castle mob/boss yields on defeat — XP, gold, and
 *  any soul (Red/Blue/Yellow) it can drop. Mirrors MoveListScene's layout. */
export class LootTableScene extends Scene {
  private index = 0
  private portraits: SpriteSheet[] = []

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isMenuCancel(e.code) || isMenuConfirm(e.code)) {
      e.preventDefault()
      this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
      return
    }
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.index = (this.index - 1 + CAMPAIGN_ENEMIES.length) % CAMPAIGN_ENEMIES.length
        break
      case 'ArrowRight':
      case 'KeyD':
        this.index = (this.index + 1) % CAMPAIGN_ENEMIES.length
        break
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const point = this.toGamePoint(e)
    if (point.x < this.ctx.width * 0.35) this.index = (this.index - 1 + CAMPAIGN_ENEMIES.length) % CAMPAIGN_ENEMIES.length
    else if (point.x > this.ctx.width * 0.65) this.index = (this.index + 1) % CAMPAIGN_ENEMIES.length
    else this.ctx.scenes.replace(new ModeSelectScene(this.ctx))
  }

  override enter(): void {
    this.portraits = CAMPAIGN_ENEMIES.map((c) => makeSheet(this.ctx.assets.image(c.sprites.idle.key), c.sprites.idle.frames))
    window.addEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.addEventListener('pointerdown', this.onPointerDown)
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    this.ctx.renderer.canvas.removeEventListener('pointerdown', this.onPointerDown)
  }

  update(): void {}

  render(): void {
    const { renderer, assets, width, height } = this.ctx
    const { ctx } = renderer
    const def = CAMPAIGN_ENEMIES[this.index]!
    const isBoss = CAMPAIGN_BOSS_IDS.has(def.id)

    renderer.ctx.drawImage(assets.image('stage.bg'), 0, 0, width, height)
    ctx.fillStyle = 'rgba(8, 6, 14, 0.84)'
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '22px "Press Start 2P", monospace'
    ctx.fillText('LOOT TABLE', width / 2, 60)

    this.drawPortrait(def, isBoss, 90, 125, 300, 300)
    this.drawDetails(def, isBoss, 430, 125, 520)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#5a567a'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillText('A/D CHANGE MOB     J / K BACK', width / 2, height - 28)
  }

  private drawPortrait(def: CharacterDef, isBoss: boolean, x: number, y: number, w: number, h: number): void {
    const { ctx } = this.ctx.renderer
    ctx.fillStyle = 'rgba(20, 18, 31, 0.9)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = isBoss ? '#b91d2b' : '#5a567a'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    const sheet = this.portraits[this.index]
    if (!sheet) return
    const scale = Math.min(4, (h - 40) / (def.visual.anchorY * 1.15))
    const drawX = x + w / 2 - def.visual.anchorX * scale
    const drawY = y + h - 24 - def.visual.anchorY * scale
    drawSprite(this.ctx.renderer, sheet, 0, drawX, drawY, scale, 1)

    if (isBoss) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#b91d2b'
      ctx.font = '10px "Press Start 2P", monospace'
      ctx.fillText('BOSS', x + w / 2, y + 20)
    }
  }

  private drawDetails(def: CharacterDef, isBoss: boolean, x: number, y: number, w: number): void {
    const { ctx } = this.ctx.renderer
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    ctx.fillStyle = '#e8d4a0'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText(def.name, x, y)

    ctx.fillStyle = isBoss ? '#b91d2b' : '#8a8aa0'
    ctx.font = '11px "Press Start 2P", monospace'
    ctx.fillText(def.meta.archetype, x, y + 34)

    ctx.fillStyle = '#8a8aa0'
    ctx.font = '9px "Press Start 2P", monospace'
    drawWrappedText(ctx, def.meta.bio, x, y + 62, w, 16)

    this.drawReward(def, isBoss, x, y + 120)
    this.drawSouls(def, x, y + 170)
  }

  private drawReward(def: CharacterDef, isBoss: boolean, x: number, y: number): void {
    const { ctx } = this.ctx.renderer
    const reward = rewardForEnemy(def.id, isBoss)
    ctx.fillStyle = '#6c6c8c'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillText('XP', x, y)
    ctx.fillText('GOLD', x + 160, y)
    ctx.fillStyle = '#e8d4a0'
    ctx.font = '14px "Press Start 2P", monospace'
    ctx.fillText(String(reward.xp), x, y + 20)
    ctx.fillStyle = '#f6b74a'
    ctx.fillText(String(reward.gold), x + 160, y + 20)
  }

  private drawSouls(def: CharacterDef, x: number, y: number): void {
    const { ctx } = this.ctx.renderer
    ctx.fillStyle = '#6c6c8c'
    ctx.font = '10px "Press Start 2P", monospace'
    ctx.fillText('SOUL DROPS', x, y)

    const rows = lootRowsFor(def.id)
    if (rows.length === 0) {
      ctx.fillStyle = '#5a567a'
      ctx.font = '9px "Press Start 2P", monospace'
      ctx.fillText('None', x, y + 26)
      return
    }
    rows.forEach((row, i) => {
      const rowY = y + 26 + i * 30
      ctx.fillStyle = row.color
      ctx.font = '10px "Press Start 2P", monospace'
      ctx.fillText(row.label, x, rowY)
      ctx.fillStyle = '#8a8aa0'
      ctx.font = '8px "Press Start 2P", monospace'
      drawWrappedText(ctx, row.blurb, x, rowY + 15, 480, 12)
    })
  }

  private toGamePoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.ctx.width,
      y: ((e.clientY - rect.top) / rect.height) * this.ctx.height,
    }
  }
}

/** One row per soul color (Red/Blue/Yellow) this enemy can drop, in that order. */
function lootRowsFor(enemyId: string): LootRow[] {
  const rows: LootRow[] = []
  const red = bulletSoulForEnemy(enemyId)
  if (red) rows.push({ color: '#d9534f', label: `RED — ${red.name} (${Math.round(red.dropChance * 100)}%)`, blurb: red.blurb })
  const blue = blueSoulForEnemy(enemyId)
  if (blue) rows.push({ color: '#5b9bd5', label: `BLUE — ${blue.name} (${Math.round(blue.dropChance * 100)}%)`, blurb: blue.blurb })
  const yellow = soulForEnemy(enemyId)
  if (yellow) rows.push({ color: '#e8c84a', label: `YELLOW — ${yellow.name} (${Math.round(yellow.dropChance * 100)}%)`, blurb: yellow.blurb })
  return rows
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(' ')
  let line = ''
  let row = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight)
      line = word
      row += 1
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight)
}
