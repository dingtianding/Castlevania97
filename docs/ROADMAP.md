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
  (Griffon Wing, height-gates the sky-bridge Life Max Up), **slide ✅** (Fleet
  Greaves, low-tunnel-gates the cistern Life Max Up), grapple. Areas stay closed
  until you earn the ability.
- **Key items / colored doors** — ✅ first lock-and-key done (Silver Key → the
  Chapel's barred bell-loft branch → a Life Max Up).
- **Backtracking payoffs:** early dead-ends open up later — ✅ demonstrated
  (find the key deeper in the Study, backtrack to the Chapel).
- Three gate flavors now exist: keyed door, height gate, low-tunnel gate.
- Still to do: grapple/other abilities, colored-door tiers, more gated branches,
  warp network to ease backtracking.
- *Effort: M. Depends on Phase 1.*

## Phase 3 — Combat identity & build depth  *(can interleave)*
Round out the Aria soul trinity + payoffs:
- **Guardian souls** (blue): hold-to-channel familiars / persistent effects.
- **Enchant souls** (yellow): formalize the existing passive souls as this tier.
- **Item Crash / super:** spend a full MP bar for a screen-clearing version of
  the equipped Bullet Soul.
- **Weapon variety:** multiple main weapons (whip / sword / spear) with distinct
  movesets — the hook for multiple characters.
- **Status effects** (poison / curse / stone) on enemies and player.
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
- **Boss Rush** (scored gauntlet, reuses bosses).
- **New Game+** (keep levels/gear, tougher enemies).
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
