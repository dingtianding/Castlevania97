/** Keyboard bindings by `KeyboardEvent.code`. Two local players get disjoint
 *  halves of the keyboard. */
export interface KeyBindings {
  left: string[]
  right: string[]
  jump: string[]
  light: string[]
  heavy: string[]
  special: string[]
}

export const PLAYER1_KEYS: KeyBindings = {
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['KeyW'],
  light: ['KeyF'],
  heavy: ['KeyG'],
  special: ['KeyH'],
}

export const PLAYER2_KEYS: KeyBindings = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  jump: ['ArrowUp'],
  light: ['Period'],
  heavy: ['Comma'],
  special: ['Slash'],
}
