/** Keyboard bindings by `KeyboardEvent.code`. Two local players get disjoint
 *  halves of the keyboard; the second player is wired up in P3. */
export interface KeyBindings {
  left: string[]
  right: string[]
  jump: string[]
  attack: string[]
}

export const PLAYER1_KEYS: KeyBindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['KeyW', 'ArrowUp'],
  attack: ['Space', 'KeyF'],
}

export const PLAYER2_KEYS: KeyBindings = {
  left: ['KeyJ'],
  right: ['KeyL'],
  jump: ['KeyI'],
  attack: ['KeyN', 'Slash'],
}
