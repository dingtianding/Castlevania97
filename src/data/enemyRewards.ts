/**
 * XP and gold granted per enemy type on defeat. Shared by CampaignScene (to
 * actually grant the reward) and LootTableScene (to display it in the
 * Archive's loot codex) so the two never drift.
 */
export const BOSS_REWARD = { xp: 60, gold: 50 } as const

export const ENEMY_REWARD: Record<string, { xp: number; gold: number }> = {
  skeleton: { xp: 6, gold: 4 },
  zombie: { xp: 5, gold: 3 },
  ghoul: { xp: 4, gold: 2 },
  bat: { xp: 4, gold: 3 },
  axeArmor: { xp: 13, gold: 9 },
  armoredSkeleton: { xp: 14, gold: 10 },
  boneThrower: { xp: 10, gold: 7 },
}

export function rewardForEnemy(enemyId: string, isBoss: boolean): { xp: number; gold: number } {
  if (isBoss) return BOSS_REWARD
  return ENEMY_REWARD[enemyId] ?? { xp: 5, gold: 3 }
}
