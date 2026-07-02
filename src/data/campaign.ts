import type { CharacterDef } from './characters/CharacterDef.ts'
import { dracula1999, juliusBelmont, sealGuardian, skeleton, zombie } from './characters/castlevaniaCampaign.ts'
import type { StageId } from './stages.ts'
import { RELIC_POOL, type RelicId } from './relics.ts'

const STORAGE_KEY = 'castlevania97.campaign.v1'

export interface CampaignNodeDef {
  id: string
  chapterId: string
  title: string
  year: number
  blurb: string
  story: string
  stage: StageId
  enemy: CharacterDef
  difficulty: 'easy' | 'normal' | 'hard'
  nextIds: readonly string[]
  position: { x: number; y: number }
  isBoss?: boolean
}

export interface CampaignChapterDef {
  id: string
  year: number
  title: string
  intro: string
  outro: string
  nodeIds: readonly string[]
}

export interface CampaignSave {
  chapterId: string
  currentNodeId: string | null
  completedNodeIds: readonly string[]
  unlockedNodeIds: readonly string[]
  relicIds: readonly RelicId[]
  finished: boolean
}

export interface CampaignBattleSeed {
  chapterId: string
  nodeId: string
}

export const CAMPAIGN_HERO = juliusBelmont

export const CAMPAIGN_CHAPTERS: readonly CampaignChapterDef[] = [
  {
    id: '1997-dusk',
    year: 1997,
    title: 'The First Hunt',
    intro:
      'In 1997, a younger Julius Belmont follows his first true lead: graves opened without tracks, bells ringing with no wind, and old seals warming beneath ruined chapels.',
    outro:
      'Julius seals the first breach and learns the disturbance is not random. Someone is testing the locks two years before the great war begins.',
    nodeIds: ['1997-chapel', '1997-library', '1997-seal'],
  },
  {
    id: '1998-ash',
    year: 1997,
    title: 'The Hidden Trail',
    intro:
      'The trail widens across the same dark year. Forgotten orders, old pages, and a broken chain of priests point Julius toward the hands preparing Dracula’s return.',
    outro:
      'The second seal falls. Julius is still too early for the war, but no longer too young to understand what is coming.',
    nodeIds: ['1998-catacombs', '1998-clock', '1998-archive'],
  },
  {
    id: '1999-war',
    year: 1997,
    title: 'The Last Omen',
    intro:
      'The last omen of 1997 pulls Julius toward a forbidden horizon. The signs no longer point to villages or crypts. They point to the place the Belmonts will one day have to enter.',
    outro:
      'Julius survives the omen and carries its warning forward. The war is still ahead, but the young Belmont has seen where the final road will end.',
    nodeIds: ['1999-wall', '1999-throne', '1999-dracula'],
  },
]

export const CAMPAIGN_NODES: readonly CampaignNodeDef[] = [
  {
    id: '1997-chapel',
    chapterId: '1997-dusk',
    title: 'Ruined Chapel',
    year: 1997,
    blurb: 'A first sweep through a desecrated sanctum where the ritual smoke is still warm.',
    story:
      'A broken chapel sits on the border of the disturbance. Young Julius clears the nave, finds the first sigil, and leaves a warning carved into the stone for whatever is listening.',
    stage: 'cathedral',
    enemy: skeleton,
    difficulty: 'easy',
    nextIds: ['1997-library'],
    position: { x: 160, y: 220 },
  },
  {
    id: '1997-library',
    chapterId: '1997-dusk',
    title: 'Forbidden Library',
    year: 1997,
    blurb: 'Shelves packed with censored scripture and map fragments copied by hand.',
    story:
      'The books do not name Dracula directly. They name the signs around him: the seals, the thresholds, and the rites that must be broken before the war arrives.',
    stage: 'library',
    enemy: zombie,
    difficulty: 'normal',
    nextIds: ['1997-seal'],
    position: { x: 390, y: 150 },
  },
  {
    id: '1997-seal',
    chapterId: '1997-dusk',
    title: 'Sealed Annex',
    year: 1997,
    blurb: 'A hidden chamber built around a lock that should have stayed buried.',
    story:
      'At the chamber’s core is a seal that has already been cracked from the inside. Julius breaks the warden that keeps it open and learns this is only the first of several locks.',
    stage: 'catacombs',
    enemy: sealGuardian,
    difficulty: 'normal',
    nextIds: ['1998-catacombs'],
    position: { x: 620, y: 230 },
    isBoss: true,
  },
  {
    id: '1998-catacombs',
    chapterId: '1998-ash',
    title: 'Lower Catacombs',
    year: 1997,
    blurb: 'Damp stone, old bones, and movement in the walls below the province.',
    story:
      'The underground passages connect the chapel ruins to newer work. Someone is moving relics beneath the province, using the dead as cover.',
    stage: 'catacombs',
    enemy: zombie,
    difficulty: 'normal',
    nextIds: ['1998-clock'],
    position: { x: 160, y: 220 },
  },
  {
    id: '1998-clock',
    chapterId: '1998-ash',
    title: 'Clock Tower',
    year: 1997,
    blurb: 'A vertical chain of gears, bridges, and timed jumps above the dark.',
    story:
      'The tower keeps perfect time even when the rest of the world is broken. Julius realizes the cult is counting down to a war he has not yet seen.',
    stage: 'clock_tower',
    enemy: skeleton,
    difficulty: 'hard',
    nextIds: ['1998-archive'],
    position: { x: 400, y: 150 },
  },
  {
    id: '1998-archive',
    chapterId: '1998-ash',
    title: 'Black Archive',
    year: 1997,
    blurb: 'A sealed record room where the final name in the war is finally written down.',
    story:
      'The archive confirms the missing name and the shape of the threat. Julius is early, but the ritual engine is already being designed.',
    stage: 'library',
    enemy: zombie,
    difficulty: 'hard',
    nextIds: ['1999-wall'],
    position: { x: 640, y: 230 },
    isBoss: true,
  },
  {
    id: '1999-wall',
    chapterId: '1999-war',
    year: 1997,
    title: 'Old Causeway',
    blurb: 'A rain-cut road toward the forbidden border. There is no stealth left, only pursuit.',
    story:
      'Julius reaches the old causeway as the last omen takes shape. The enemy is no longer hiding behind rumor. It is testing how far a Belmont will follow.',
    stage: 'outer_wall',
    enemy: skeleton,
    difficulty: 'hard',
    nextIds: ['1999-throne'],
    position: { x: 150, y: 210 },
  },
  {
    id: '1999-throne',
    chapterId: '1999-war',
    year: 1997,
    title: 'Crimson Approach',
    blurb: 'A straight road through the final defenders of the night.',
    story:
      'Every clue from the year has been leading to this approach. Julius cuts through the final defenses with the seal nearly spent.',
    stage: 'outer_wall',
    enemy: zombie,
    difficulty: 'hard',
    nextIds: ['1999-dracula'],
    position: { x: 390, y: 150 },
  },
  {
    id: '1999-dracula',
    chapterId: '1999-war',
    title: 'Demon Castle Gate',
    year: 1997,
    blurb: 'The castle appears for one impossible night. Julius reaches the gate, but not yet the war.',
    story:
      'The Demon Castle opens only at the edge of the omen. Dracula’s shadow answers from within, and young Julius learns what he must be ready to face two years from now.',
    stage: 'throne_room',
    enemy: dracula1999,
    difficulty: 'hard',
    nextIds: [],
    position: { x: 620, y: 220 },
    isBoss: true,
  },
]

export function getCampaignChapter(id: string): CampaignChapterDef {
  return CAMPAIGN_CHAPTERS.find((chapter) => chapter.id === id) ?? CAMPAIGN_CHAPTERS[0]!
}

export function getCampaignNode(id: string): CampaignNodeDef {
  const node = CAMPAIGN_NODES.find((entry) => entry.id === id)
  if (!node) throw new Error(`Unknown campaign node: ${id}`)
  return node
}

export function getCampaignNodesForChapter(chapterId: string): readonly CampaignNodeDef[] {
  return CAMPAIGN_NODES.filter((node) => node.chapterId === chapterId)
}

export function initialCampaignSave(): CampaignSave {
  const firstChapter = CAMPAIGN_CHAPTERS[0]!
  return {
    chapterId: firstChapter.id,
    currentNodeId: firstChapter.nodeIds[0] ?? null,
    completedNodeIds: [],
    unlockedNodeIds: firstChapter.nodeIds.slice(0, 1),
    relicIds: [],
    finished: false,
  }
}

export function addCampaignRelic(save: CampaignSave, relicId: RelicId): CampaignSave {
  if (save.relicIds.includes(relicId)) return save
  const next: CampaignSave = { ...save, relicIds: [...save.relicIds, relicId] }
  saveCampaignSave(next)
  return next
}

export function loadCampaignSave(): CampaignSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialCampaignSave()
    const parsed = JSON.parse(raw) as Partial<CampaignSave>
    return sanitizeCampaignSave(parsed)
  } catch {
    return initialCampaignSave()
  }
}

export function saveCampaignSave(save: CampaignSave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch {
    // Campaign progress is a convenience; keep playing if storage is blocked.
  }
}

export function resetCampaignSave(): CampaignSave {
  const next = initialCampaignSave()
  saveCampaignSave(next)
  return next
}

export function beginCampaignBattle(save: CampaignSave, nodeId: string): CampaignSave {
  const node = getCampaignNode(nodeId)
  const unlocked = new Set(save.unlockedNodeIds)
  unlocked.add(node.id)
  const next: CampaignSave = {
    ...save,
    chapterId: node.chapterId,
    currentNodeId: node.id,
    unlockedNodeIds: Array.from(unlocked),
    finished: false,
  }
  saveCampaignSave(next)
  return next
}

export function completeCampaignBattle(save: CampaignSave): CampaignSave {
  if (!save.currentNodeId) return save
  const node = getCampaignNode(save.currentNodeId)
  const completed = new Set(save.completedNodeIds)
  completed.add(node.id)
  const unlocked = new Set(save.unlockedNodeIds)
  node.nextIds.forEach((nextId) => unlocked.add(nextId))

  const chapter = getCampaignChapter(node.chapterId)
  const chapterNodes = getCampaignNodesForChapter(chapter.id)
  const chapterComplete = chapterNodes.every((entry) => completed.has(entry.id))
  let nextChapterId = chapter.id
  let currentNodeId: string | null = null
  let finished = false

  if (chapterComplete) {
    const chapterIndex = CAMPAIGN_CHAPTERS.findIndex((entry) => entry.id === chapter.id)
    const nextChapter = CAMPAIGN_CHAPTERS[chapterIndex + 1]
    if (nextChapter) {
      nextChapterId = nextChapter.id
      currentNodeId = nextChapter.nodeIds[0] ?? null
      if (currentNodeId) unlocked.add(currentNodeId)
    } else {
      finished = true
    }
  } else {
    currentNodeId = pickNextNode(chapter.id, completed, unlocked)
  }

  const next: CampaignSave = {
    chapterId: nextChapterId,
    currentNodeId,
    completedNodeIds: Array.from(completed),
    unlockedNodeIds: Array.from(unlocked),
    relicIds: save.relicIds,
    finished,
  }
  saveCampaignSave(next)
  return next
}

export function campaignIsComplete(save: CampaignSave): boolean {
  return save.finished
}

export function campaignHasProgress(save: CampaignSave): boolean {
  return save.completedNodeIds.length > 0 || save.finished
}

export function currentCampaignChapter(save: CampaignSave): CampaignChapterDef {
  return getCampaignChapter(save.chapterId)
}

export function availableCampaignNodes(save: CampaignSave): CampaignNodeDef[] {
  const chapter = getCampaignChapter(save.chapterId)
  const completed = new Set(save.completedNodeIds)
  const unlocked = new Set(save.unlockedNodeIds)
  return chapter.nodeIds
    .map((id) => getCampaignNode(id))
    .filter((node) => unlocked.has(node.id) && !completed.has(node.id))
}

function pickNextNode(
  chapterId: string,
  completed: Set<string>,
  unlocked: Set<string>,
): string | null {
  const chapter = getCampaignChapter(chapterId)
  const next = chapter.nodeIds
    .map((id) => getCampaignNode(id))
    .find((node) => unlocked.has(node.id) && !completed.has(node.id))
  return next?.id ?? null
}

function sanitizeCampaignSave(value: Partial<CampaignSave>): CampaignSave {
  const fallback = initialCampaignSave()
  const chapterId =
    CAMPAIGN_CHAPTERS.find((entry) => entry.id === value.chapterId)?.id ?? fallback.chapterId
  const chapterDef = getCampaignChapter(chapterId)
  const completed = filterExisting(value.completedNodeIds)
  const unlocked = filterExisting(value.unlockedNodeIds)
  if (unlocked.length === 0 && chapterDef.nodeIds[0]) unlocked.push(chapterDef.nodeIds[0])
  const currentNodeId =
    value.finished && value.currentNodeId === null
      ? null
      : typeof value.currentNodeId === 'string' && CAMPAIGN_NODES.some((node) => node.id === value.currentNodeId)
        ? value.currentNodeId
        : chapterDef.nodeIds[0] ?? null

  return {
    chapterId: chapterDef.id,
    currentNodeId,
    completedNodeIds: completed,
    unlockedNodeIds: unlocked,
    relicIds: filterRelics(value.relicIds),
    finished: Boolean(value.finished),
  }
}

function filterRelics(value: readonly RelicId[] | undefined): RelicId[] {
  if (!Array.isArray(value)) return []
  const valid = new Set(RELIC_POOL.map((relic) => relic.id))
  return value.filter((entry): entry is RelicId => valid.has(entry))
}

function filterExisting(value: readonly string[] | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => CAMPAIGN_NODES.some((node) => node.id === entry))
}
