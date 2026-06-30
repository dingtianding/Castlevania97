/** Keyboard bindings by `KeyboardEvent.code`. Two local players get disjoint
 *  halves of the keyboard. */
export interface KeyBindings {
  left: string[]
  right: string[]
  up: string[]
  down: string[]
  jump: string[]
  light: string[]
  heavy: string[]
  special: string[]
  dash: string[]
}

export const PLAYER1_KEYS: KeyBindings = {
  left: ['KeyA'],
  right: ['KeyD'],
  up: ['KeyW'],
  down: ['KeyS'],
  jump: ['KeyJ'],
  light: ['KeyK'],
  heavy: ['KeyL'],
  special: [],
  dash: ['Semicolon'],
}

export const PLAYER2_KEYS: KeyBindings = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  jump: ['ArrowUp'],
  light: ['Period'],
  heavy: ['Comma'],
  special: ['Slash'],
  dash: ['ShiftRight'],
}
