/**
 * Per-tick controller output. Every input source — keyboard, touch, gamepad,
 * and AI — produces one of these, and the Fighter only ever reads intents.
 * That indirection is what lets AI be "just another controller": swapping a
 * player's source changes nothing in combat code.
 *
 * `*Held` is the current button state; `*Pressed` is the rising edge (true only
 * on the tick the button went down). Edge detection lives in the source so
 * consumers never track previous state themselves.
 */
export interface IntentState {
  /** -1 left, 0 none, 1 right. */
  moveX: -1 | 0 | 1
  upHeld: boolean
  downHeld: boolean
  jumpHeld: boolean
  jumpPressed: boolean
  /** Rising edges for the three attack buttons. Super is derived from special
   *  when the fighter has meter, so it needs no button of its own. */
  lightPressed: boolean
  heavyPressed: boolean
  specialPressed: boolean
  dashPressed: boolean
  dashHeld: boolean
}

export interface InputSource {
  /** Sample intents for the current tick. Called once per fixed update. */
  poll(): IntentState
  /** Release any listeners/handles. */
  dispose?(): void
}

export function neutralIntent(): IntentState {
  return {
    moveX: 0,
    upHeld: false,
    downHeld: false,
    jumpHeld: false,
    jumpPressed: false,
    lightPressed: false,
    heavyPressed: false,
    specialPressed: false,
    dashPressed: false,
    dashHeld: false,
  }
}
