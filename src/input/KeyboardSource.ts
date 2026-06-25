import type { InputSource, IntentState } from './InputSource.ts'
import type { KeyBindings } from './bindings.ts'

/**
 * Tracks held keys and buffers fresh key-presses between polls.
 *
 * Edges are taken from buffered keydown events, not from sampling the held set
 * — so a tap that goes down and up within a single 60 Hz tick is still seen as
 * a press. Sampling held state for edges would silently drop sub-frame taps.
 */
export class KeyboardSource implements InputSource {
  private readonly held = new Set<string>()
  private readonly pressed = new Set<string>()
  private readonly bound: Set<string>

  constructor(private readonly keys: KeyBindings) {
    this.bound = new Set([...keys.left, ...keys.right, ...keys.jump, ...keys.attack])
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.bound.has(e.code)) return
    // Stop game keys (arrows, space) from scrolling the page.
    e.preventDefault()
    if (!e.repeat) this.pressed.add(e.code)
    this.held.add(e.code)
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code)
  }

  private anyHeld(codes: string[]): boolean {
    for (const code of codes) if (this.held.has(code)) return true
    return false
  }

  private anyPressed(codes: string[]): boolean {
    for (const code of codes) if (this.pressed.has(code)) return true
    return false
  }

  poll(): IntentState {
    const left = this.anyHeld(this.keys.left)
    const right = this.anyHeld(this.keys.right)
    const moveX: -1 | 0 | 1 = left === right ? 0 : right ? 1 : -1

    const intent: IntentState = {
      moveX,
      jumpHeld: this.anyHeld(this.keys.jump),
      jumpPressed: this.anyPressed(this.keys.jump),
      attackHeld: this.anyHeld(this.keys.attack),
      attackPressed: this.anyPressed(this.keys.attack),
    }
    this.pressed.clear()
    return intent
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.held.clear()
    this.pressed.clear()
  }
}
