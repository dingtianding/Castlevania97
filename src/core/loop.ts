import { FIXED_DT, MAX_FRAME_TIME } from './Time.ts'

export interface LoopCallbacks {
  /** One fixed simulation step. `tick` is the monotonic logical-frame index. */
  update: (tick: number) => void
  /** Draw. `alpha` in [0,1) is how far we are between the last and next tick,
   *  for interpolating rendered positions so motion stays smooth above 60 Hz. */
  render: (alpha: number) => void
}

/**
 * Fixed-timestep game loop with a render decoupled from simulation.
 *
 * Real elapsed time is accumulated and drained in whole `FIXED_DT` steps, so
 * the simulation advances at exactly `TICK_RATE` regardless of display refresh
 * rate. This is the core fix for the original game's frame-rate-dependent
 * physics (`pos += velocity` once per rAF moved 2.4× faster at 144 Hz).
 */
export class GameLoop {
  private accumulator = 0
  private lastTime = 0
  private rafId = 0
  private running = false
  private tick = 0

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return

    let delta = (now - this.lastTime) / 1000
    this.lastTime = now
    if (delta > MAX_FRAME_TIME) delta = MAX_FRAME_TIME

    this.accumulator += delta
    while (this.accumulator >= FIXED_DT) {
      this.callbacks.update(this.tick)
      this.tick += 1
      this.accumulator -= FIXED_DT
    }

    this.callbacks.render(this.accumulator / FIXED_DT)
    this.rafId = requestAnimationFrame(this.frame)
  }
}
