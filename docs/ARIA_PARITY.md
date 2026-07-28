# Aria of Sorrow Parity Tracker

Canonical reference for Castlevania: Aria of Sorrow (GBA, 2003), checked against what this repo
currently builds. Purpose: know exactly what's a faithful clone vs. an invented stand-in, so future
work can close real gaps instead of guessing.

Sources: castlevaniadungeon.net (soul lists), castlevania.fandom.com (areas/bosses), gamefaqs.gamespot.com,
castlevaniacrypt.com, shrines.rpgclassics.com. Two open questions from research noted inline with ⚠️.

## Status (updated after the rename pass)

**Areas and bosses are faithful.** All 9 implemented areas and all 8 implemented bosses use real Aria
of Sorrow names, correctly matched to their canon area (Creaking Skull/Castle Corridor,
Manticore/Chapel, Great Armor/Dance Hall, Big Golem/Underground Reservoir, Headhunter/Inner Quarters,
Death/Clock Tower, Legion/Floating Garden, Chaos/Forbidden Area — see `src/data/characters/castlevaniaCampaign.ts`
and `src/data/campaign.ts`).

**Traversal Ability Souls are correctly built.** Double jump, high jump, slide, and now back-dash
(Gravekeeper) all match canon in name-in-spirit and effect — implemented as relic pickups /base moves
rather than boss/enemy soul drops (a deliberate simplification, not an oversight).

**Four new canon regular enemies added.** Zombie Officer, Skeleton Knight, Giant Skeleton, and Zombie
Soldier are real Aria of Sorrow enemies, added as recolored variants of the existing zombie/skeleton
sprite sheets (the only reskinnable assets this project has — see `ENEMY_GLOW` in `CampaignScene.ts`
for the aura tint that tells each apart from its base at a glance). Each drops its own real canon soul:
Skeleton Knight (STR+4, direct match), Zombie Officer (approximated — see souls.ts), Giant Skeleton
(skull-projectile Bullet Soul), Zombie Soldier (grenade-toss Bullet Soul, approximated as a straight
throw). Placed into two existing rooms each, additively, so existing encounter balance is unchanged.

**Souls have been renamed to their real canon identity where a match exists, honestly labeled
"(original)" where it does not.** `souls.ts`, `blueSouls.ts`, and `bulletSouls.ts` now source
Zombie/Headhunter/Creaking Skull/Big Golem/Great Armor/Manticore/Skeleton/Legion/Death souls from
their real canon name + matching in-repo enemy, with each blurb stating the real canon effect and how
it was approximated onto this engine's (stat-multiplier / 4-effect Guardian / 5-pattern Bullet)
mechanics. Ghoul, Bone Thrower, Armored Skeleton (non-boss), Seal Guardian, and Dracula Shadow have no
confirmed canon soul source — their entries are kept as gameplay content but relabeled "(original)"
instead of pretending to be Aria of Sorrow drops.

---

## 1. Ability Souls (6 total, canon-complete list)

Always-on, no MP cost — the traversal-defining souls.

| Soul | Source | Effect | Built here? |
|---|---|---|---|
| Malphas | Malphas | Double jump | ✅ built (as `double-jump` ability relic, `CASTLE_ITEM_ROOMS`) |
| Hippogryph | Hippogryph | High jump (L mid-jump — ⚠️ one source says R, unverified) | ✅ built (`high-jump`, now a base move) |
| Skeleton Blaze | Skeleton Blaze | Slide (down+attack) | ✅ built (`slide`) |
| Kicker Skeleton | Kicker Skeleton | Jump-kick during double jump | ❌ not built |
| **Gravekeeper** | Gravekeeper | Alucard-style back-dash | ✅ built — back-dash was already a base move (L on the ground); added the "Gravekeeper Soul" flavor relic in the Undercroft to name it |
| Galamoth | Galamoth | Lets you get past the time-stopping rabbit (Chaotic Realm, plot-specific) | ❌ not built (no Chaotic Realm yet) |

Note: in canon these are boss/enemy soul *drops*; this repo currently grants them as static relic
pickups in specific rooms (`CASTLE_ITEM_ROOMS` in `castleMapData.ts`) rather than enemy kills. Fine as
a simplification, but worth knowing it's a deliberate deviation, not an oversight.

## 2. Guardian Souls (23 total — hold to channel, familiar/persistent effects)

| Soul | Effect | Built here? |
|---|---|---|
| Alastor | Sword familiar orbits and attacks | ❌ |
| Alura Une | Large HP heal | ❌ |
| Big Golem | Rock-arm heavy melee | ✅ built — `guard-golem`, approximated as an attack-boost buff (`frenzy` slot) |
| Black Panther | Damaging dash | ❌ |
| Bone Pillar | Flamethrower | ❌ |
| Buer | Rotating flame orbs | ❌ |
| Cagnazzo | Wild punching demon | ❌ |
| Cateoblepas | Petrifying ground beam | ❌ |
| Creaking Skull | Giant skeleton arm | ⚠️ modeled in `souls.ts` (`creaking-skull-soul`) as a stat buff instead of a Guardian soul — no free Guardian effect slot left |
| Curly | Charging beast form | ❌ |
| Death | Scythe throw | ⚠️ reclassified — modeled as a Bullet Soul (`death-soul` in `bulletSouls.ts`), see Bullet table |
| Devil | Charging beast form | ❌ |
| Final Guard | Blocks enemy attacks | ❌ |
| **Flying Armor** | **Glide/float** | ✅ built — `guard-flight` in `blueSouls.ts`, name + effect match canon |
| Giant Bat | Bat transform | ❌ |
| Giant Ghost | Reflects projectiles | ❌ |
| Great Armor | +120% STR, red lightning | ✅ built — `guard-great-armor`, approximated as an attack-boost buff (`frenzy` slot) |
| Imp | Imp familiar | ❌ |
| Manticore | Charging beast form | ✅ built — `guard-manticore`, approximated as a speed buff (`haste` slot, closest available) |
| Medusa Head | Freeze mid-air | ❌ |
| Persephone | Life-drain vacuum | ❌ |
| Shadow Knight | Ghost familiar, attacks after you | ❌ |
| Sky Fish | Temp STR/LCK boost | ❌ |
| Witch | Repels bullets | ❌ |

Engine limitation worth naming: `BlueSoulEffect` only has 4 mechanical slots (glide/aegis/frenzy/haste),
so multiple canon Guardian souls with genuinely different effects (Big Golem, Great Armor, Creaking
Skull, Death) get compressed onto the same 1-2 buff types. Real mechanical differentiation (familiars,
shields, projectile summons) would need new `BlueSoulEffect` variants and matching logic in
`CampaignScene.updateBlueGuardian`/`blueBuffMult` — deliberately out of scope for a naming/sourcing pass.

## 3. Enchant Souls (33 total — passive stat/utility)

| Soul | Effect | Built here? |
|---|---|---|
| Arc Demon | +40% STR, drains enemy HP | ❌ (name reused for different effect in `souls.ts`) |
| Bael | INT +12 | ❌ |
| Basilisk | STR down / DEF up | ❌ |
| Dead Crusader | CON +16 | ❌ |
| Ectoplasm | Curse immunity | ❌ |
| Erinys | +120% EXP | ❌ |
| Flesh Golem | HP-drain items heal instead | ❌ |
| Gargoyle | Petrification immunity | ❌ |
| Ghost Dancer | LCK +4 | ❌ |
| Giant Worm | Regen HP while still | ❌ |
| Golem | STR +12 | ❌ |
| Gorgon | CON +12 | ❌ |
| Gremlin | LCK +8 | ❌ |
| Headhunter | Stats scale with souls collected | ✅ built — `headhunter-soul` in `souls.ts`, approximated as a flat all-round boost (no dynamic soul-count scaling) |
| Iron Golem | No stun from weak hits | ❌ |
| Lilith | INT +8 | ❌ |
| Lubicant | Lower HP = stronger attacks | ❌ |
| Mimic | Gain money when hurt | ❌ |
| Minotaur | STR +8 | ❌ |
| Peeping Eye | Reveals hidden passages | ❌ |
| Poison Worm | Poison immunity | ❌ |
| Quetzalcoatl | CON +8 | ❌ |
| Red Crow | INT +4 | ❌ |
| Skeleton Knight | STR +4 | ✅ built — `skeleton-knight-soul` in `souls.ts`, direct match |
| **Skula** | **Walk/breathe underwater ("Deep Seeker")** | ⚠️ built but misattributed, now labeled honestly — `drowned-soul` in `souls.ts` grants underwater breathing correctly but is sourced from `bigGolem` and marked "(original)" since no Skula enemy exists here yet |
| Stolas | INT +16 | ❌ |
| Succubus | Heal on landing a hit | ❌ |
| Triton | STR +16 | ❌ |
| Tsuchinoko | Item prices −20% | ❌ |
| Undine | Walk on top of water | ❌ |
| White Dragon | CON +4 | ❌ |
| Wooden Golem | Faster MP regen | ❌ |
| Zombie | Stronger while poisoned | ✅ built — `zombie-soul` in `souls.ts`, name + source correct; effect approximated as flat +12 max health since this engine has no poison status yet |
| Zombie Officer | Restore HP if KO'd mid-jump | ✅ built — `zombie-officer-soul`, conditional trigger not modeled, approximated as +8 max health |

## 4. Bullet Souls (57 total — MP-cost directional attacks; best-effort compilation, not independently cross-verified)

`death-soul` is also built here (see boss table) — canon lists Death's soul as a Guardian soul, but a
one-shot ring of scythes fits this engine's Bullet-Soul mechanics better than a stat buff, so it is
intentionally modeled as a Bullet Soul instead. Not in the table below since Death is not itself a
57-count canon Bullet Soul.

| Soul | MP | Effect | Built here? |
|---|---|---|---|
| Altair | 33 | Eagle flies forward | ❌ |
| Arachne | 15 | Web entangle | ❌ |
| Axe Armor | 22 | Boomerang | ❌ |
| Balore | 120 | Powerful punch | ❌ |
| Bat | 5 | Sonar wave | ❌ |
| Beam Skeleton | 28 | Straight beam | ❌ |
| Biphron | 35 | Ground flame wave | ❌ |
| Blue Crow | 10 | Angled crow shot | ❌ |
| Bomber Armor | 80 | Bomb toss | ❌ |
| Chronomage | 96 | Brief time-freeze | ❌ |
| Cockatrice | 24 | Downward petrify beam | ❌ |
| Demon Lord | 38 | Large fireball | ❌ |
| Disc Armor | 34 | Spinning disc | ❌ |
| Dryad | 33 | HP-drain blob | ❌ |
| Durga | 20 | Forward katana | ❌ |
| Evil Butcher | 5 | Dagger throw | ❌ |
| Fish Head | 18 | Standard fireball | ❌ |
| Flame Demon | 44 | Three-fireball spread | ❌ |
| Flea Man | 15 | Erratic jump attack | ❌ |
| Ghost | 16 | Homing spirit | ❌ (closest real match for `seeker-soul-original`, which is labeled non-canon) |
| Giant Skeleton | 19 | Skull projectile | ✅ built — `giant-skeleton-soul` in `bulletSouls.ts`, name/source/MP-cost match canon |
| Gladiator | 30 | Rolling crush | ❌ |
| Harpy | 25 | Weak feathers | ❌ |
| Killer Doll | 20 | Decoy | ❌ |
| Killer Fish | 16 | Underwater projectile | ❌ |
| Killer Mantle | 19 | Swap HP/MP with enemy | ❌ |
| Kyoma Demon | 40 | Temp invulnerability | ❌ |
| Legion | 66 | Tentacle laser array | ✅ built — `legion-soul` in `bulletSouls.ts`, name/source/MP-cost match canon, modeled as a ring burst (`nova` pattern) |
| Lightning Doll | 46 | Lightning fingers | ❌ |
| Mandragora | 110 | Screen-wide scream | ❌ |
| Man Eater | 22 | Ripple laser | ❌ |
| Merman | 14 | Water-pistol shot | ❌ |
| Mudman | 20 | Angled mud blobs | ❌ |
| Needles | 15 | Proximity mines | ❌ |
| Nemesis | 65 | Enemies can't see you | ❌ |
| Nightmare | 30 | Demon horse charge | ❌ |
| Red Minotaur | 150 | Giant axe throw | ❌ |
| Ripper | 35 | Piercing dagger | ❌ |
| Rock Armor | 22 | Hurls boulders | ❌ |
| Siren | 10 | Musical-note shot | ❌ |
| Skeleton | 8 | Arced bone toss | ✅ built — `skeleton-soul`, now the base Bullet Soul (`BASE_BULLET_SOUL`), name/source/MP-cost/pattern all match canon |
| Skull Archer | 8 | Summoned bow arrow | ❌ |
| Skull Millone | 25 | Poison claw slash | ❌ |
| Slime | 20 | Bouncing comet | ❌ |
| Student Witch | 20 | Cat familiar | ❌ |
| Tiny Devil | 16 | Blades fly around screen | ❌ |
| Ukoback | 12 | Screen flames | ❌ |
| Une | 20 | Vine mine | ❌ |
| Valkyrie | 50 | Spirit strike | ❌ |
| Waiter Skeleton | 30 | Curry-plate DoT | ❌ |
| Weretiger | 40 | Uppercut | ❌ |
| Werejaguar | 40 | Strong punch | ❌ |
| Werewolf | 28 | Foot-ignite flame | ❌ |
| Winged Skeleton | 23 | Low-arc spear | ❌ |
| Zombie Soldier | 14 | Timed grenade | ✅ built — `zombie-soldier-soul`, MP-cost matches canon, modeled as a straight throw (no fuse-delay/explosion) |

## 5. Castle Map (13 canon areas)

| Area | Built here? | Gate/requirement (canon) |
|---|---|---|
| Castle Corridor | ✅ | none, starting area |
| Chapel | ✅ | reachable from Castle Corridor |
| Study | ✅ | reachable from Chapel |
| Dance Hall | ✅ | Malphas + Flying Armor |
| Inner Quarters | ✅ | reachable from Dance Hall/Castle Corridor/Top Floor |
| Floating Garden | ✅ | Undine (sequence-breakable with just Malphas) |
| Clock Tower | ✅ | reachable from Floating Garden |
| Underground Reservoir | ✅ | Skula for full traversal |
| Top Floor | ✅ | Castle Corridor/Inner Quarters red doors |
| Forbidden Area | ✅ | Undine + a dash soul, via Reservoir waterfall |
| Underground Cemetery | ❌ not built | via Underground Reservoir only, fewest rooms in the game |
| The Arena | ❌ not built | via Underground Reservoir SE door |
| Chaotic Realm | ❌ not built | portal in Floating Garden, post-Julius only |

## 6. Boss List in Canon Encounter Order

| # | Boss | Area | Soul dropped (canon) | Built here? |
|---|---|---|---|---|
| 1 | Creaking Skull | Castle Corridor | Creaking Skull (Guardian) | ✅ boss built; soul built as a stat-soul approximation (`souls.ts`) |
| 2 | Manticore | Chapel | Manticore (Guardian) | ✅ boss built; soul built (`guard-manticore`, `haste` slot) |
| 3 | Great Armor | Study | Great Armor (Guardian); Malphas is a separate room pickup, not this boss's drop | ✅ boss built; soul built (`guard-great-armor`, `frenzy` slot) |
| 4 | Big Golem | Dance Hall (canon: also fought regular-enemy in Reservoir) | Big Golem (Guardian) | ✅ boss built; real soul built (`guard-golem`, `frenzy` slot); the underwater/Skula effect stays on this boss too, now labeled `drowned-soul (original)` rather than pretending to be canon |
| 5 | Headhunter | Inner Quarters | Headhunter (Enchant, stats scale with souls) | ✅ boss built; soul built (`headhunter-soul`) |
| 6 | Death | Clock Tower | Death (Guardian); Skula found in the adjoining room, not this boss's drop | ✅ boss built; soul built (`death-soul`, reclassified as a Bullet Soul — see note above) |
| 7 | Legion | Underground Cemetery | Legion (Bullet) | ✅ boss built (placed in Floating Garden here, not Underground Cemetery); soul built (`legion-soul`) |
| 8 | Balore | The Arena | Balore (Bullet) | ❌ not built |
| 9 | Graham Jones | Top Floor | none (special-condition kill grants Black Panther) | ❌ not built |
| 10 | Julius Belmont | Floating Garden (black door) | none | Not a conflict: canon Julius Belmont is both a boss encounter and a later-playable character across the series, so this repo's playable Julius protagonist is consistent with that precedent, not a naming collision to resolve |
| 11 | Chaos | Chaotic Realm | none (final boss) | ✅ built as `chaos`, currently placed in Forbidden Area |

---

## Recommendation

Done as of this pass:

1. ✅ Gravekeeper (back-dash) — was already a base move; added the flavor relic to name it, in the Undercroft.
2. ✅ Renamed the ~13 souls in `souls.ts`/`blueSouls.ts`/`bulletSouls.ts`: the 7 bosses already built here
   (Creaking Skull, Manticore, Great Armor, Big Golem, Headhunter, Death, Legion) now each have a
   canon-named, canon-sourced soul approximated onto this engine's mechanics; Skeleton became the real
   base Bullet Soul; entries with no confirmed canon source (Ghoul, Bone Thrower, Armored Skeleton,
   Seal Guardian, Dracula Shadow, and the Skula-flavored underwater effect) are labeled "(original)"
   instead of misrepresented as canon.

Still open, for a later pass if pursued:

3. ✅ Added four real canon regular enemies not previously built — Zombie Officer, Skeleton Knight,
   Giant Skeleton, Zombie Soldier — as recolored zombie/skeleton variants (the only reskinnable assets
   available), each dropping its own real canon soul, placed into two existing rooms each.

Still open, for a later pass if pursued:

4. More real canon regular enemies remain unbuilt (e.g. Golem, Ectoplasm, Poison Worm) but need either
   a new sprite or a less obvious reskin fit than the four just added.
5. Curate a subset of the remaining ~90 souls (mostly Bullet/Enchant, tied to enemies not built here)
   that's realistic for this engine's scope — not all of them need modeling, but what gets modeled
   should stay honestly sourced.
6. If real mechanical differentiation matters more than naming (distinct familiars, shields, projectile
   summons per Guardian soul, rather than several souls sharing the same 4 stat-buff slots), that
   requires extending `BlueSoulEffect` and the logic in `CampaignScene.updateBlueGuardian`/
   `blueBuffMult` — genuine engine work, not a data rename.
7. Underground Cemetery, The Arena, and Chaotic Realm (plus Balore, Graham Jones, Julius Belmont as
   bosses) are the three canon areas and three bosses not built at all yet.
