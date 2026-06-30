/** Keyboard bindings by `KeyboardEvent.code`. Two local players get disjoint
 *  halves of the keyboard. */
export interface KeyBindings {
  left: string[]
  right: string[]
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
  down: ['KeyS'],
  jump: ['KeyJ'],
  light: ['KeyK'],
  heavy: ['KeyL'],
  special: ['Semicolon'],
  dash: ['KeyR'],
}

export const PLAYER2_KEYS: KeyBindings = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  down: ['ArrowDown'],
  jump: ['ArrowUp'],
  light: ['Period'],
  heavy: ['Comma'],
  special: ['Slash'],
  dash: ['ShiftRight'],
}
