# Castlevania97 — Main Game Roadmap

## North star
A GBA/NDS-style Castlevania: **one explorable gothic castle** you traverse,
backtrack through, and unlock — layered with the RPG depth already built
(levels, souls, Bullet Souls, equipment, drops, roguelite perks).

## Where we are (done)
Combat (whip + subweapons + hearts) · MP magic with collectible **Bullet Souls**
(4 patterns) · passive **souls** · **SOTN equipment** (5 slots) · **XP + level-up
perks** · **item drops** (hearts/gold/MP) · **25-room Aria-style castle map**
(10 areas, 8 bosses) · between-area **merchant shop** · **relics** · roguelite
room flow (no auto-skip, walk-to-advance, respawn-to-grind) · status/equipment
menu + castle map screens.

Today it plays as a chain of **combat arenas** stitched by an auto-route, with a
map you look at but can't walk. The main-game gap is turning that into a place.

---

## The pivotal decision (do this first)
**Metroidvania traversal vs. keep the arena/roguelite loop.**

Recommendation: **Metroidvania.** The map, the areas, and the "all GBA/NDS
Castlevania" north star all point there; the current arena+grind flow is a
stopgap. Everything below assumes we commit to a single walkable castle. (The
RPG depth — levels, souls, equipment — carries over unchanged.)

---

## Phase 1 — Traversal & structure  *(the keystone — do first)*
Make the castle actually walkable instead of isolated arenas.
- **Room-to-room movement:** walk off a room edge → load the adjacent room,
  spawn at the matching entrance, hand off the camera. (Re-entry respawns
  enemies — that logic already exists.)
- **Connected room graph** driven by the existing 25-cell map; edges = doors
  (N/S/E/W), matching what the map already draws.
- **Save / warp rooms:** safe rooms that heal, save, and warp between discovered
  ones.
- Rework the forced auto-route + shop-per-area: the **merchant becomes a room**
  you choose to visit.
- **Map screen** upgrades to show real position + doors traversed.
- *Effort: L (biggest single piece). De-risk with a 2-room vertical slice first.*

## Phase 2 — Progression gating  *(what makes it a Metroidvania)*  — **in progress**
- **Traversal abilities** that lock/unlock areas: double jump ✅, **high jump ✅**
  (now a base move: always on, W on the ground or L mid-air once per airtime; the
  Griffon Wing relic remains as flavor), **slide ✅** (Fleet Greaves,
  low-tunnel-gates the cistern Life Max Up), grapple. Areas stay closed
  until you earn the ability.
- **Key items / colored doors** — ✅ two lock-and-key pairs now: Silver Key → the
  Chapel's barred bell-loft branch → a Life Max Up (a "far key": found deeper in
  the Study, chapters after the Chapel, so it's a genuine cross-area
  backtrack); Bronze Key → the Corridor Larder's barred chest (a "near key":
  found one branch over, off the same alcove, in the Watch Post — a tighter
  find-key-see-lock loop within a single room cluster). The larder also has a
  second, unsealed entrance down from the West Tower — an intentional
  alternate route, not a bypass of the gate's intent (by the time you reach
  the tower in Dance Hall you'll almost certainly already have the key).
- **Backtracking payoffs:** early dead-ends open up later — ✅ demonstrated
  (find the key deeper in the Study, backtrack to the Chapel; and now the
  Flooded Drain's collapsed archway, sealed with the `slide` ability itself
  rather than a key item — seen in chapter 1 but not openable until Fleet
  Greaves turns up in the Dance Hall, four chapters later, the game's longest
  gate-to-unlock distance yet).
- Three gate flavors now exist: keyed door, height gate, low-tunnel gate — plus
  this ability-gated *door* (as opposed to ability-gated in-room content,
  which the height/low-tunnel gates already did).
- **Warp network ✅** — three warp rooms (entrance alcove, chapel nave, garden
  hanging walk); Up at a pad opens a map-based warp select; any discovered warp
  teleports to any other. Eases backtracking across the gates.
- **West Tower ✅** — a 2-wide × 3-tall shaft off the Ballroom (also linking down
  to the Corridor Larder), bats + a Life Max Up on the top ledge. First room
  taller than two screens; proves big-room h>2 works. (Its high-jump door seals
  came off when the high jump became a base move.)
- Still to do: grapple/other abilities, colored-door tiers, more gated branches.
- *Effort: M. Depends on Phase 1.*

## Phase 3 — Combat identity & build depth  *(can interleave)*
Round out the Aria soul trinity + payoffs:
- **Guardian souls** (blue) — started. Big Golem (`golemslam`, a periodic
  ground-slam AoE pulse) and Cagnazzo (`flurry`, a rapid close-range tick) each
  got their own hold-to-channel effect instead of sharing the generic `frenzy`
  stat buff. Still to do: distinct familiars/shields/projectile summons for the
  rest of the still-unbuilt canon Guardian souls (see `docs/ARIA_PARITY.md`).
- **Enchant souls** (yellow): formalize the existing passive souls as this tier.
- **Item Crash / super** — ✅ done. Casting the equipped Bullet Soul at a full MP
  bar spends the whole bar instead of the soul's normal cost and fires a
  bigger, harder-hitting, further-piercing burst of the same pattern (more/
  wider bolts, ~2.2x damage each, gold-tinted and larger) — a payoff for
  banking MP rather than a new button. The MP bar pulses gold at 100 to
  signal it's ready. `castSoul()` in `CampaignScene.ts`.
- **Weapon variety** — ✅ done. All 8 weapons in `equipment.ts` now carry a real
  `WeaponProfile` (reach/speed/damage/hitbox, some with a distinct `swing` —
  Broadsword's planted overhead chop, Lance's long narrow thrust) that
  replaces the base light attack entirely, not just a stat multiplier. Five
  (Dagger/Long Sword/Broadsword/Lance/Elemental Sword) already had one; this
  pass gave Short Sword, Alucard Sword, and Crissaegrim their own profiles
  too instead of a flat +% attack — Crissaegrim in particular leans into its
  canon identity as the fastest blade in the game (startup 2 / active 3 /
  recovery 4, vs. 6-8/5-6/11-17 for the others) rather than a raw damage
  number. Swapping weapons at the merchant already changes moveset feel
  in-game, including crouch attacks. Still the hook for multiple characters
  (Phase 4) whenever that's picked up.
- **Status effects** (poison ✅ / curse / stone). A poison DoT now exists
  (`CastleActor.applyPoison`, ticks independent of hit-invulnerability) —
  Poison Worm's bite inflicts it on the player, and it turned four soul
  approximations into exact matches (Zombie, Poison Worm, Skull Millone,
  Waiter Skeleton — see `docs/ARIA_PARITY.md`). Zombie Officer Soul also got
  its real effect (`reviveIfAirborneKO`): a killing blow taken mid-jump pops
  you back up at 30% max HP instead of ending the run. Curse and stone
  (petrification) still don't exist; Ectoplasm's curse immunity is the last
  approximation waiting on a system.
- *Effort: M. Mostly independent of Phase 1/2.*

## Phase 4 — Characters
- **Character-select + swappable playable characters** (the original dhampir +
  Julius), each a distinct weapon/moveset + a signature mechanic.
- Art slots in from the parked AI-sprite pipeline (`tools/gba-sprites/`).
- *Effort: M. Best after Phase 3's weapon-moveset system exists.*

## Phase 5 — Content depth  *(after systems are stable)*
- **More enemies per area** (2–4 distinct types each) + a **mini-boss** per area.
- **Expand/finish the castle:** more rooms, secret rooms, hidden collectibles.
- **Item/equipment variety:** consumables (potions), more gear, set bonuses.
- **More bosses** with genuinely distinct movesets (not reskins).
- *Effort: L, ongoing.*

## Phase 6 — Meta & replay
- **Boss Rush** (scored gauntlet, reuses bosses). Note: a Boss Rush already
  exists for the Archive/legacy fighter roster (`data/arcade.ts`'s
  `startBossRush`) — this item means one for the *campaign*'s 8 area bosses,
  which doesn't exist yet and would need a new scene (the campaign has no
  mode-select to hang it off).
- **New Game+** — ✅ done. Beating the campaign (`save.finished`) turns the
  title's CONTINUE into NEW GAME+ (`startNewGamePlus` in `campaign.ts`):
  resets castle progress to the entrance but keeps level/xp/gold/equipment/
  souls/abilities/perks/worldFlags (so already-collected Life Max Ups etc.
  can't be re-farmed across cycles). Enemies scale up per cycle — +35% HP and
  +15% damage taken by the player, capped at 3 stacked cycles
  (`NG_PLUS_*` consts in `CampaignScene.ts`) — applied to both the initial
  room spawn and zombie-room's continuous trickle-spawner. `save.ngPlusCycle`
  shows as a small badge next to the level in the HUD and Status screen once
  active.
- **Multiple endings** / true-ending condition (find X%, beat Y).
- **Completion tracking:** map %, souls %, records/achievements.
- *Effort: M.*

## Phase 7 — Presentation & polish  *(ongoing)*
- **Audio:** per-area music, boss themes, richer SFX.
- **Story delivery:** intro/outro cutscenes, in-room dialogue, lore items.
- **UI:** tabbed pause menu, tutorial/onboarding, map legend.
- **Meta polish:** save slots, options, accessibility (reduce-motion exists),
  touch controls, performance/mobile pass.

---

## Recommended order
1. **Phase 1 vertical slice** — two connected rooms you can walk between + a save
   room. Proves the traversal refactor before committing the whole castle.
2. Finish **Phase 1** across the castle.
3. **Phase 2** ability gating (now the map means something).
4. Interleave **Phase 3** combat depth throughout (independent, keeps it fun).
5. **Phase 4 → 5 → 6 → 7.**

Parallelizable anytime: Phase 3 combat pieces, Phase 5 enemy/content authoring,
Phase 7 audio — none block on traversal.
