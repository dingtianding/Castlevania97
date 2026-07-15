import { neutralIntent, type InputSource, type IntentState } from './InputSource.ts'

/**
 * Merges several input sources into one player slot, so e.g. keyboard and a
 * gamepad both drive Player 1. Buttons OR together; movement takes the first
 * source that's pushing a direction.
 *
 * Each child is polled exactly once per tick (sources clear their press buffers
 * on poll), so this must be the only place its children are polled.
 */
export class CompositeSource implements InputSource {
  constructor(private readonly sources: InputSource[]) {}

  poll(): IntentState {
    const intents = this.sources.map((s) => s.poll())
    const merged = neutralIntent()
    for (const intent of intents) {
      if (merged.moveX === 0 && intent.moveX !== 0) merged.moveX = intent.moveX
      merged.upHeld ||= intent.upHeld
      merged.downHeld ||= intent.downHeld
      merged.jumpHeld ||= intent.jumpHeld
      merged.jumpPressed ||= intent.jumpPressed
      merged.lightPressed ||= intent.lightPressed
      merged.heavyPressed ||= intent.heavyPressed
      merged.specialPressed ||= intent.specialPressed
      merged.dashPressed ||= intent.dashPressed
      merged.dashHeld ||= intent.dashHeld
    }
    return merged
  }

  dispose(): void {
    for (const s of this.sources) s.dispose?.()
  }
}
