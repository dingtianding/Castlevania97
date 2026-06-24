/** The discrete states a Fighter can occupy. Grows in later phases (attack,
 *  hurt, death, special). Locomotion-only for P2. */
export type FighterStateId = 'idle' | 'run' | 'jump' | 'fall'
