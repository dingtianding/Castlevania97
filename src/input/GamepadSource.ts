import { neutralIntent, type InputSource, type IntentState } from './InputSource.ts'

const DEADZONE = 0.4

/** Standard-mapping gamepad as an InputSource. Like every other source it emits
 *  per-tick intents with buffered button edges, so it drops into any player slot
 *  with no combat-code changes. */
export class GamepadSource implements InputSource {
  private prevJump = false
  private prevLight = false
  private prevHeavy = false
  private prevSpecial = false

  constructor(private readonly index: number) {}

  poll(): IntentState {
    const pad = navigator.getGamepads?.()[this.index]
    if (!pad) return neutralIntent()

    const axis = pad.axes[0] ?? 0
    const left = axis < -DEADZONE || pressed(pad, 14)
    const right = axis > DEADZONE || pressed(pad, 15)
    const moveX: -1 | 0 | 1 = left === right ? 0 : right ? 1 : -1

    // Face buttons: A=jump, X=light, Y=heavy, B=special (also Up/dpad for jump).
    const jump = pressed(pad, 0) || pressed(pad, 12) || (pad.axes[1] ?? 0) < -DEADZONE
    const light = pressed(pad, 2)
    const heavy = pressed(pad, 3)
    const special = pressed(pad, 1)

    const intent: IntentState = {
      moveX,
      jumpHeld: jump,
      jumpPressed: jump && !this.prevJump,
      lightPressed: light && !this.prevLight,
      heavyPressed: heavy && !this.prevHeavy,
      specialPressed: special && !this.prevSpecial,
    }
    this.prevJump = jump
    this.prevLight = light
    this.prevHeavy = heavy
    this.prevSpecial = special
    return intent
  }
}

function pressed(pad: Gamepad, index: number): boolean {
  return pad.buttons[index]?.pressed ?? false
}
