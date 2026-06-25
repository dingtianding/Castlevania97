import { Animator, drawSprite, makeSheet, type SpriteSheet } from '../render/SpriteRenderer.ts'
import { rectsOverlap } from '../core/math.ts'
import type { AssetManager } from '../assets/AssetManager.ts'
import type { Fighter } from '../entities/Fighter.ts'
import type { Renderer } from '../render/Renderer.ts'
import type { AttackMove, ProjectileSpec } from './AttackMove.ts'
import type { Facing, Rect, Vec2 } from '../types.ts'

export interface ProjectileHitEvent {
  attacker: Fighter
  defender: Fighter
  point: Vec2
  dir: Facing
  hitstop: number
}

export interface ProjectileSpawn {
  owner: Fighter
  move: AttackMove
  spec: ProjectileSpec
  x: number
  y: number
  facing: Facing
}

class Projectile {
  private readonly sheet: SpriteSheet
  private readonly animator: Animator
  private readonly position: Vec2
  private ticksLeft: number
  private hasHit = false

  constructor(
    private readonly spawn: ProjectileSpawn,
    assets: AssetManager,
  ) {
    this.sheet = makeSheet(assets.image(spawn.spec.sprite), spawn.spec.frames)
    this.animator = new Animator(this.sheet, spawn.spec.hold, true)
    this.position = { x: spawn.x, y: spawn.y }
    this.ticksLeft = spawn.spec.lifetime
  }

  update(): void {
    this.position.x += this.spawn.facing * this.spawn.spec.speedX
    this.ticksLeft -= 1
    this.animator.update()
  }

  tryHit(defender: Fighter): ProjectileHitEvent | null {
    if (defender === this.spawn.owner) return null
    if (this.hasHit || !defender.canBeHit()) return null
    const box = this.hitbox()
    const hurt = defender.hurtbox()
    if (!rectsOverlap(box, hurt)) return null

    this.hasHit = true
    defender.applyHit(this.spawn.move, this.spawn.owner.position.x)
    return {
      attacker: this.spawn.owner,
      defender,
      point: overlapCenter(box, hurt),
      dir: this.spawn.facing,
      hitstop: this.spawn.move.hitstop,
    }
  }

  render(renderer: Renderer): void {
    const { scale } = this.spawn.spec
    const x = this.spawn.facing === 1
      ? this.position.x
      : this.position.x - this.sheet.frameWidth * scale
    const y = this.position.y - this.sheet.frameHeight * scale
    drawSprite(renderer, this.sheet, this.animator.currentFrame, x, y, scale, this.spawn.facing)
  }

  get alive(): boolean {
    return this.ticksLeft > 0 && !this.hasHit
  }

  debugHitbox(): Rect {
    return this.hitbox()
  }

  private hitbox(): Rect {
    const { hitbox } = this.spawn.spec
    const x = this.spawn.facing === 1
      ? this.position.x + hitbox.offsetX
      : this.position.x - hitbox.offsetX - hitbox.width
    return {
      x,
      y: this.position.y + hitbox.offsetY,
      width: hitbox.width,
      height: hitbox.height,
    }
  }
}

export class ProjectileSystem {
  private readonly projectiles: Projectile[] = []

  constructor(private readonly assets: AssetManager) {}

  spawn(spawn: ProjectileSpawn): void {
    this.projectiles.push(new Projectile(spawn, this.assets))
  }

  update(): void {
    for (const p of this.projectiles) p.update()
    this.prune()
  }

  resolve(defenders: readonly Fighter[]): ProjectileHitEvent[] {
    const hits: ProjectileHitEvent[] = []
    for (const p of this.projectiles) {
      for (const defender of defenders) {
        const hit = p.tryHit(defender)
        if (hit) {
          hits.push(hit)
          break
        }
      }
    }
    this.prune()
    return hits
  }

  render(renderer: Renderer): void {
    for (const p of this.projectiles) p.render(renderer)
  }

  debugHitboxes(): Rect[] {
    return this.projectiles.map((p) => p.debugHitbox())
  }

  clear(): void {
    this.projectiles.length = 0
  }

  private prune(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      if (!this.projectiles[i]!.alive) this.projectiles.splice(i, 1)
    }
  }
}

function overlapCenter(a: Rect, b: Rect): Vec2 {
  const x1 = Math.max(a.x, b.x)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y1 = Math.max(a.y, b.y)
  const y2 = Math.min(a.y + a.height, b.y + b.height)
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
}
