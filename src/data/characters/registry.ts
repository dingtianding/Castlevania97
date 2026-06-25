import type { CharacterDef } from './CharacterDef.ts'
import { samuraiMack } from './samuraiMack.ts'
import { kenji } from './kenji.ts'
import { gothicHero } from './gothicHero.ts'

/** The playable roster, in select-grid order. Drop a new CharacterDef here (and
 *  its sprites in the manifest) to add a fighter — no engine edits. */
export const ROSTER: readonly CharacterDef[] = [samuraiMack, kenji, gothicHero]

export function characterById(id: string): CharacterDef {
  const def = ROSTER.find((c) => c.id === id)
  if (!def) throw new Error(`Unknown character: ${id}`)
  return def
}
