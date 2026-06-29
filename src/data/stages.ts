export type StageId =
  | 'outer_wall'
  | 'cathedral'
  | 'library'
  | 'clock_tower'
  | 'catacombs'
  | 'throne_room'

export interface StageDef {
  id: StageId
  name: string
  blurb: string
  overlay: string
  overlayAlpha: number
  shopX: number
  shopY: number
  shopScale: number
}

export const STAGES: readonly StageDef[] = [
  {
    id: 'outer_wall',
    name: 'Outer Wall',
    blurb: 'Stone ramparts and open air. The castle is still distant, but awake.',
    overlay: 'rgba(18, 16, 34, 0.14)',
    overlayAlpha: 0.14,
    shopX: 112,
    shopY: 14,
    shopScale: 1.62,
  },
  {
    id: 'cathedral',
    name: 'Cathedral',
    blurb: 'A vaulted hall of bells, candles, and long sightlines for whips and blades.',
    overlay: 'rgba(40, 18, 46, 0.18)',
    overlayAlpha: 0.18,
    shopX: 142,
    shopY: 8,
    shopScale: 1.68,
  },
  {
    id: 'library',
    name: 'Forbidden Library',
    blurb: 'Shelves, shadows, and hidden routes. Every step feels like trespass.',
    overlay: 'rgba(10, 20, 34, 0.2)',
    overlayAlpha: 0.2,
    shopX: 74,
    shopY: 16,
    shopScale: 1.56,
  },
  {
    id: 'clock_tower',
    name: 'Clock Tower',
    blurb: 'A vertical gauntlet of gears and iron bridges hanging over the dark.',
    overlay: 'rgba(44, 28, 18, 0.18)',
    overlayAlpha: 0.18,
    shopX: 176,
    shopY: 6,
    shopScale: 1.72,
  },
  {
    id: 'catacombs',
    name: 'Catacombs',
    blurb: 'The lower bones of the castle. The air is wet, cold, and hostile.',
    overlay: 'rgba(8, 12, 26, 0.24)',
    overlayAlpha: 0.24,
    shopX: 96,
    shopY: 20,
    shopScale: 1.58,
  },
  {
    id: 'throne_room',
    name: 'Throne Room',
    blurb: 'The center of the storm. Dracula waits where the castle becomes a seal.',
    overlay: 'rgba(62, 10, 18, 0.26)',
    overlayAlpha: 0.26,
    shopX: 148,
    shopY: 12,
    shopScale: 1.66,
  },
]

export const DEFAULT_STAGE: StageId = 'outer_wall'

export function getStage(id: StageId): StageDef {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0]!
}

export function stageForArcade(stage: number): StageId {
  const order: StageId[] = ['outer_wall', 'cathedral', 'library', 'clock_tower', 'catacombs', 'throne_room']
  if (stage <= 0) return order[0]!
  return order[Math.min(stage, order.length - 1)]!
}
