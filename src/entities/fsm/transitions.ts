import type { FighterStateId } from './FighterState.ts'

/** Everything a transition guard is allowed to look at. Each Fighter evaluates
 *  its OWN context — which is precisely why the original copy-paste bug (the
 *  enemy animating off the player's `velocity.y`) cannot exist here. */
export interface TransitionContext {
  grounded: boolean
  velocityY: number
  moveX: number
}

type Guard = (c: TransitionContext) => boolean

interface Transition {
  to: FighterStateId
  when: Guard
}

const airborneRising: Guard = (c) => !c.grounded && c.velocityY < 0
const airborneFalling: Guard = (c) => !c.grounded && c.velocityY >= 0
const groundedMoving: Guard = (c) => c.grounded && c.moveX !== 0
const groundedStill: Guard = (c) => c.grounded && c.moveX === 0

/** Ordered guard table. The first matching transition from the current state
 *  wins; if none match, the state is unchanged. */
const TABLE: Record<FighterStateId, Transition[]> = {
  idle: [
    { to: 'jump', when: airborneRising },
    { to: 'fall', when: airborneFalling },
    { to: 'run', when: groundedMoving },
  ],
  run: [
    { to: 'jump', when: airborneRising },
    { to: 'fall', when: airborneFalling },
    { to: 'idle', when: groundedStill },
  ],
  jump: [
    { to: 'fall', when: (c) => c.velocityY >= 0 },
    { to: 'run', when: groundedMoving },
    { to: 'idle', when: groundedStill },
  ],
  fall: [
    { to: 'run', when: groundedMoving },
    { to: 'idle', when: groundedStill },
  ],
}

export function nextState(current: FighterStateId, ctx: TransitionContext): FighterStateId {
  for (const transition of TABLE[current]) {
    if (transition.when(ctx)) return transition.to
  }
  return current
}
