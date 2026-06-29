# Castlevania97

[**▶ Play Castlevania97**](https://dingtianding.github.io/Castlevania97/)

A Castlevania-inspired action campaign centered on Julius Belmont and the 1999 Demon Castle War, built as a production-grade TypeScript canvas engine.
The current build pivots the original fighter scaffold into a castle campaign with a node-based map, room encounters, chapter story text, and a legacy archive that preserves the old versus modes.

![Character select](docs/select.png)
![Battle](docs/battle.png)

## Modes

- **Campaign** — Julius travels through a node-based castle map, clears room encounters, and advances the 1997-1999 story.
- **Archive** — the legacy versus fighter modes remain available as a side menu.
- **Settings** — audio, reduced motion, and CPU difficulty.
- **Move Codices** — browse the legacy roster data and move lists.
- **Records** — view saved score tables from the archive modes.

Campaign battles are still best-of-3 rounds with a 60-second timer.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | `A` / `D` | `←` / `→` |
| Fast fall | `S` while falling | `↓` while falling |
| Jump | `J` | `↑` |
| Light attack | `K` | `.` |
| Heavy attack | `L` | `,` |
| Special / Super | `;` | `/` |

Press **special with a full meter** to spend it on a super.
Every fighter has one air jump, can attack while airborne, can fast fall, and can dash by double-tapping left or right.
Heavy attacks launch and can be jump-canceled on hit for aerial follow-ups.
Menus use `W`/`S` (or arrows) and `Enter`; `Esc` goes back.
A standard gamepad works in either player slot (left stick / d-pad to move, face buttons to attack).
Touch devices can tap through menus and use on-screen P1 movement / attack controls in battle.
Training adds `R` to reset positions and `M` to refill both meters.
Character select uses `M` to open the move list.

Each fighter builds a **super meter** by dealing and taking damage, shown under their health bar.
The Settings menu persists audio volume, reduced motion, and VS CPU difficulty in the browser.

## Engineering highlights

The rebuild fixes the original's real problems by construction and adds the systems a showcase fighter needs:

- **Fixed-timestep loop** — the simulation advances in whole 1/60s steps drained from a clamped accumulator, with rendering decoupled via interpolation, so physics and animation are identical on a 60 Hz or 144 Hz display (the original moved 2.4× faster at 144 Hz).
- **Frame-data combat** — attacks are data (`startup` / `active` / `recovery`, hitbox, knockback, hitstop, optional projectiles) and combat systems resolve world-space hitbox-vs-hurtbox each tick, replacing the old magic-frame collision check.
- **Air combat foundation** — universal double jump, fast fall, dash/backdash, landing recovery, and airborne attacks push the game toward platform-fighter movement and Marvel-style jump-in pressure.
- **Launcher routes** — heavy attacks pop opponents upward and open a short jump-cancel window for air follow-ups.
- **Score chase** — results grade player-one performance using damage, time, health, perfect rounds, and super hits.
- **Local records** — score results are saved to a browser-local high score table.
- **Explicit Fighter FSM** — a transition table drives locomotion and time-driven action states (attack / hurt / death), so each fighter reasons about its own state (the original had a copy-paste bug where the enemy animated off the player's velocity).
- **Input abstraction** — keyboard, gamepad, and AI all implement one `InputSource` that emits a per-tick intent; the AI is "just another controller," so 1P-vs-CPU needed zero combat-code changes.
- **Data-driven roster** — each fighter is a `CharacterDef` (sprites, hurtbox, full moveset) collected by a registry; adding a character is one file.
- **Expanded content** — three playable fighters plus a boss-only demon finale, with projectile supers and a dedicated Boss Rush route.
- **Character identity layer** — select screen archetypes, stat bars, move names, and match intro callouts make the roster easier to read and tune.
- **Training tools** — infinite timer, passive dummy, full-meter refill, reset shortcut, spacing/damage/combo overlay, and `?hitbox` support for frame-data tuning.
- **Move list** — a roster browser built from `CharacterDef.meta`, so move names and stats stay in one source of truth.
- **Game feel** — hitstop, trauma-based screen shake (reduce-motion aware), pooled hit-spark particles, KO slow-motion, and a WebAudio mixer with streamed BGM and procedurally synthesized SFX.
- **Scenes** — a scene-stack manager (Boot → Load → Title → Campaign → Battle → Result, with Archive screens behind it) with overlay support.

## Tech stack

- **TypeScript** (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) for all game logic.
- **Canvas 2D** for rendering (pixel-perfect, `imageSmoothingEnabled = false`), **WebAudio** for sound.
- **Vite** for dev/build, deployed to **GitHub Pages** via **GitHub Actions** (build from source — no committed bundle).

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # strict type check
npm run build      # type check + production build
npm run preview    # serve the production build
```

Append `?hitbox` to the URL to see the hitbox / hurtbox / pushbox debug overlay.
