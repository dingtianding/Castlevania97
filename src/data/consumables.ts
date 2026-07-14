/** Consumable items — stackable single-use pickups the player carries and spends
 *  from the ITEMS menu. A potion restores HP; an elixir restores MP. Counts live
 *  on the campaign save keyed by id. */

export type ConsumableId = 'potion' | 'elixir'

export type ConsumableEffect = 'heal' | 'mana'

export interface ConsumableDef {
  id: ConsumableId
  name: string
  blurb: string
  /** Merchant price. */
  price: number
  effect: ConsumableEffect
  /** HP restored (heal) or MP restored (mana). */
  amount: number
}

export const CONSUMABLE_POOL: readonly ConsumableDef[] = [
  { id: 'potion', name: 'Potion', blurb: 'Restore 60 HP.', price: 40, effect: 'heal', amount: 60 },
  { id: 'elixir', name: 'Elixir', blurb: 'Restore 50 MP.', price: 45, effect: 'mana', amount: 50 },
]

export function getConsumable(id: string): ConsumableDef | undefined {
  return CONSUMABLE_POOL.find((c) => c.id === id)
}
