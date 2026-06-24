import type { InputSource, IntentState } from './InputSource.ts'
import type { KeyBindings } from './bindings.ts'

/** Tracks held keys via window events and emits per-tick intents with edges
 *  computed against the previous poll. */
export class KeyboardSource implements InputSource {
  private readonly held = new Set<string>()
  private readonly bound: Set<string>
  private prevJump = false
  private prevAttack = false

  constructor(private readonly keys: KeyBindings) {
    this.bound = new Set([...keys.left, ...keys.right, ...keys.jump, ...keys.attack])
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.bound.has(e.code)) return
    // Stop game keys (arrows, space) from scrolling the page.
    e.preventDefault()
    this.held.add(e.code)
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code)
  }

  private anyHeld(codes: string[]): boolean {
    for (const code of codes) if (this.held.has(code)) return true
    return false
  }

  poll(): IntentState {
    const left = this.anyHeld(this.keys.left)
    const right = this.anyHeld(this.keys.right)
    const jump = this.anyHeld(this.keys.jump)
    const attack = this.anyHeld(this.keys.attack)

    const moveX: -1 | 0 | 1 = right === left ? 0 : right ? 1 : -1
    const jumpPressed = jump && !this.prevJump
    const attackPressed = attack && !this.prevAttack
    this.prevJump = jump
    this.prevAttack = attack

    return { moveX, jumpHeld: jump, jumpPressed, attackHeld: attack, attackPressed }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.held.clear()
  }
}
