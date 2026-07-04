/** SOTN-style equippable gear. Each piece occupies one slot and stacks flat and
 *  multiplicative bonuses onto Julius. Modifiers mirror the relic/soul pipeline so
 *  the campaign can aggregate everything into one set of run stats. */

export type EquipSlot = 'weapon' | 'armor' | 'helm' | 'cloak' | 'accessory'

export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'helm', 'cloak', 'accessory']

export const EQUIP_SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'WEAPON',
  armor: 'ARMOR',
  helm: 'HELM',
  cloak: 'CLOAK',
  accessory: 'RELIC RING',
}

export type EquipmentId =
  | 'shortSword'
  | 'alucardSword'
  | 'crissaegrim'
  | 'leatherArmor'
  | 'platinumMail'
  | 'draculaTunic'
  | 'bronzeHelm'
  | 'goldCirclet'
  | 'clothCape'
  | 'twilightCloak'
  | 'ringOfAres'
  | 'heartBrooch'
  | 'ringOfVlad'

export interface EquipmentDef {
  id: EquipmentId
  name: string
  slot: EquipSlot
  blurb: string
  price: number
  maxHealthBonus: number
  /** >1 raises attack output. */
  damageMultiplier: number
  /** <1 reduces damage taken (defense). */
  damageTakenMultiplier: number
  meterGainMultiplier: number
  moveSpeedMultiplier: number
  startMeterBonus: number
}

export interface EquipmentModifiers {
  maxHealthBonus: number
  damageMultiplier: number
  damageTakenMultiplier: number
  meterGainMultiplier: number
  moveSpeedMultiplier: number
  startMeterBonus: number
}

const base = {
  maxHealthBonus: 0,
  damageMultiplier: 1,
  damageTakenMultiplier: 1,
  meterGainMultiplier: 1,
  moveSpeedMultiplier: 1,
  startMeterBonus: 0,
}

export const EQUIPMENT_POOL: readonly EquipmentDef[] = [
  // Weapons — raw attack.
  { ...base, id: 'shortSword', name: 'Short Sword', slot: 'weapon', price: 60, damageMultiplier: 1.08, blurb: '+8% ATTACK. A reliable starting blade.' },
  { ...base, id: 'alucardSword', name: 'Alucard Sword', slot: 'weapon', price: 180, damageMultiplier: 1.18, startMeterBonus: 8, blurb: '+18% ATTACK, start with 8 meter.' },
  { ...base, id: 'crissaegrim', name: 'Crissaegrim', slot: 'weapon', price: 380, damageMultiplier: 1.3, meterGainMultiplier: 1.1, blurb: '+30% ATTACK, +10% meter. A relic blade.' },
  // Armor — bulk defense.
  { ...base, id: 'leatherArmor', name: 'Leather Armor', slot: 'armor', price: 55, damageTakenMultiplier: 0.92, blurb: '-8% DAMAGE TAKEN.' },
  { ...base, id: 'platinumMail', name: 'Platinum Mail', slot: 'armor', price: 200, damageTakenMultiplier: 0.84, maxHealthBonus: 15, blurb: '-16% DAMAGE TAKEN, +15 MAX HP.' },
  { ...base, id: 'draculaTunic', name: 'Dracula Tunic', slot: 'armor', price: 420, damageTakenMultiplier: 0.78, maxHealthBonus: 30, blurb: '-22% DAMAGE TAKEN, +30 MAX HP.' },
  // Helms — support.
  { ...base, id: 'bronzeHelm', name: 'Bronze Helm', slot: 'helm', price: 45, damageTakenMultiplier: 0.94, blurb: '-6% DAMAGE TAKEN.' },
  { ...base, id: 'goldCirclet', name: 'Gold Circlet', slot: 'helm', price: 120, meterGainMultiplier: 1.2, blurb: '+20% METER GAIN.' },
  // Cloaks — mobility.
  { ...base, id: 'clothCape', name: 'Cloth Cape', slot: 'cloak', price: 50, moveSpeedMultiplier: 1.08, blurb: '+8% MOVE SPEED.' },
  { ...base, id: 'twilightCloak', name: 'Twilight Cloak', slot: 'cloak', price: 190, moveSpeedMultiplier: 1.14, damageTakenMultiplier: 0.94, blurb: '+14% MOVE SPEED, -6% DAMAGE TAKEN.' },
  // Accessories — focused boosts.
  { ...base, id: 'heartBrooch', name: 'Heart Brooch', slot: 'accessory', price: 80, maxHealthBonus: 20, blurb: '+20 MAX HP.' },
  { ...base, id: 'ringOfAres', name: 'Ring of Ares', slot: 'accessory', price: 90, damageMultiplier: 1.12, blurb: '+12% ATTACK.' },
  { ...base, id: 'ringOfVlad', name: 'Ring of Vlad', slot: 'accessory', price: 350, damageMultiplier: 1.15, maxHealthBonus: 10, meterGainMultiplier: 1.1, blurb: '+15% ATTACK, +10 MAX HP, +10% meter.' },
]

export function getEquipment(id: EquipmentId): EquipmentDef | undefined {
  return EQUIPMENT_POOL.find((item) => item.id === id)
}

export function equipmentForSlot(slot: EquipSlot): EquipmentDef[] {
  return EQUIPMENT_POOL.filter((item) => item.slot === slot)
}

/** Fold a loadout of equipped pieces into a single modifier set. */
export function buildEquipmentModifiers(items: readonly EquipmentDef[]): EquipmentModifiers {
  return items.reduce<EquipmentModifiers>(
    (mods, item) => ({
      maxHealthBonus: mods.maxHealthBonus + item.maxHealthBonus,
      damageMultiplier: mods.damageMultiplier * item.damageMultiplier,
      damageTakenMultiplier: mods.damageTakenMultiplier * item.damageTakenMultiplier,
      meterGainMultiplier: mods.meterGainMultiplier * item.meterGainMultiplier,
      moveSpeedMultiplier: mods.moveSpeedMultiplier * item.moveSpeedMultiplier,
      startMeterBonus: mods.startMeterBonus + item.startMeterBonus,
    }),
    { ...base },
  )
}
