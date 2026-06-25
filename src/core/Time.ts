/** Logical simulation runs at a fixed rate so physics and frame data are
 *  deterministic and refresh-rate-independent. */
export const TICK_RATE = 60
export const FIXED_DT = 1 / TICK_RATE

/** Largest real-time delta we feed the accumulator in one rAF. Clamps the
 *  "spiral of death" — after a long stall (tab backgrounded, GC pause) we drop
 *  simulation time rather than trying to catch up with a burst of ticks. */
export const MAX_FRAME_TIME = 0.25
