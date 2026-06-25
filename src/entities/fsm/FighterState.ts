/** Free movement states, driven by the transition table. */
export type LocomotionState = 'idle' | 'run' | 'jump' | 'fall'

/** Action states are time-driven (their own timers/animation), not table-driven:
 *  they lock out control until they finish. */
export type ActionState = 'attack' | 'hurt' | 'death'

export type FighterStateId = LocomotionState | ActionState

export function isLocomotion(state: FighterStateId): state is LocomotionState {
  return state === 'idle' || state === 'run' || state === 'jump' || state === 'fall'
}
