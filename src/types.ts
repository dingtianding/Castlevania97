/** Shared value types used across the engine. */

export interface Vec2 {
  x: number
  y: number
}

/** Axis-aligned box in world space. `x`,`y` is the top-left corner. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type Facing = 1 | -1
