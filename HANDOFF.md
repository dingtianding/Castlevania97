# Castlevania97 Rebuild — Handoff

_Last updated: 2026-06-24. This file is a resume point for a fresh agent session or a new contributor._

## What this is

A **full rebuild** of `dingtianding/Castlevania97` — a 2D pixel fighting game — from vanilla JS +
Webpack into a **production-grade TypeScript canvas engine**. Vision: a crossover roster fighter in
the spirit of **Super Smash Bros / Marvel vs Capcom** — many characters, each with a **unique skill
kit + super meter**, modular drop-in roster, **PVP** (Local 2P, Player vs AI) and **PVE** (Arcade
ladder, Boss Rush) modes.

The full approved plan lives at: `/Users/deanding/.claude/plans/elegant-splashing-sparrow.md`
(read it first — it has the architecture decisions, directory tree, and per-phase detail).

## Current state (where we are)

- **Branch:** `rebuild/ts-engine` (off `main`). The original game is untouched on `main`.
- **Phase:** P0 (tooling) — **DONE & committed** (`7f979f7`). **P1 is next.**
- **P0 delivered:** Vite + TypeScript-strict skeleton replacing the old Webpack/JS toolchain.
  Wrote `package.json` (`type: module`; scripts dev/build/preview/typecheck; devDeps `typescript`
  + `vite`, no runtime deps), `tsconfig.json` (strict + `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`), `vite.config.ts`
  (`base: '/Castlevania97/'`), root `index.html` (canvas/`#hud`/`#overlay` + Press Start 2P font),
  `src/main.ts` (1024×576 placeholder canvas, `imageSmoothingEnabled=false`), `src/style.css`,
  `src/vite-env.d.ts`, `.github/workflows/deploy.yml` (Actions Pages deploy on push to `main`).
  Moved `favicon.ico` → `public/favicon.ico` (Vite serves it under the base path). Added `dist/`
  + `*.local` to `.gitignore`.
- **Verified:** `npm install` clean (14 pkgs), `npm run typecheck` clean, `npm run build` clean —
  built `dist/index.html` references all assets under `/Castlevania97/` (JS/CSS/favicon). `npm run
  dev` serves the canvas under the subpath (`/Castlevania97/src/main.ts` → 200).
- **Kept:** `assets/` (all art + 2 mp3s — DO NOT delete), `.gitignore`, `.vscode/`, `README.md`
  (still the old one — update in P9), `HANDOFF.md` (this file).
- **Env:** Node v22.14.0, Vite 6.4.3, TypeScript 5.x.

### Verified environment
- Node v22.14.0, npm 10.9.2.
- GitHub: account `dingtianding`, repo `https://github.com/dingtianding/Castlevania97.git`.

### Verified asset facts (use these for frame data)
- `assets/samuraiMack/` & `assets/kenji/` — complete fighters, **200×200** frames, all states.
  Frame counts per sheet (width ÷ 200): samuraiMack Idle=8, Run=8, Jump=2, Fall=2, Attack1=6,
  Attack2=6, TakeHit=4, Death=6. kenji Idle=4, Run=8, Jump=2, Fall=2, Attack1=4, Attack2=4,
  TakeHit=3, Death=7.
- `assets/hero/` — gothic hero, **partial** set, **48px** frame scale (Idle/Run/Attack/Hurt/jump/
  jump-attack only; no death/fall). Stretch character — substitute missing states.
- `assets/demon-Files/` — **boss only**: idle/attack + `breath`/`breath-fire` (800×96) → use as a
  **projectile super**.
- `assets/background2.png` (stage), `assets/shop.png` (parallax prop),
  `assets/heart of fire.mp3` + `assets/giorno theme.mp3` (BGM).

## Resume instructions (next steps, in order)

### P1 — Loop + renderer + assets (NEXT)
Build the engine foundation so samuraiMack's idle animates frame-rate-independent. Per the plan:
- `src/core/loop.ts` — fixed-timestep accumulator @ **60 Hz** logical tick, render decoupled with
  interpolation `alpha`, accumulator clamped against the spiral-of-death. Hitstop/slow-mo later
  scale/skip *ticks*, never `FIXED_DT`.
- `src/core/` — `Time.ts`, `math.ts`, `rng.ts`, `events.ts`, `GameContext.ts` service bag.
- `src/render/` — `Renderer.ts` (+ `Camera.ts`, `SpriteRenderer.ts`, `layers.ts`).
- `src/assets/` — `AssetManager.ts` + `manifest.ts`; **all assets `import`-ed** (Vite-hashed,
  base-path-safe) — see ASSET PATHS footgun below. A LoadScene-style preload (full SceneManager
  lands in P2) decodes everything before first draw to kill the first-frame race.
- Demo target: samuraiMack idle sprite animates at a constant rate regardless of refresh rate.

### ASSET PATHS (the #1 migration footgun — applies every phase)
Never hardcode `./assets/...`. Either `import url from '../../assets/...png'` (Vite hashes + fixes
the base path) or build URLs with `import.meta.env.BASE_URL`. Hardcoded paths 404 under
`/Castlevania97/`.

### Commit discipline
Commit after each meaningful step (message: why, one sentence per line, **no AI co-author trailer**
per Dean's standards). Stay on `rebuild/ts-engine`. Each phase = a deployable commit.

### Then P2–P9
Follow the phase list in the plan file. Each phase = a deployable commit. Playable 2P at P3.
Build order: P1 loop/renderer/assets → P2 scenes/Fighter FSM/keyboard → P3 combat MVP →
P4 rounds/result → P5 game feel (hitstop/shake/sparks/SFX) → P6 title/character-select/skill kits/
super meter/roster registry → P7 AI + arcade/boss-rush → P8 mobile-touch/gamepad/settings →
P9 polish + PR.

Directory structure to build (from the plan): `src/{core,scenes,entities,combat,input,render,fx,`
`audio,assets,data,ui,settings}` — see plan file for the full tree and core TypeScript interfaces.

## Shipping gate (IMPORTANT)
- **Branch → PR → user merges.** Do NOT push to `main` or merge. Do NOT force-push. Never `--no-verify`.
- At the end: open a PR from `rebuild/ts-engine` with screenshots/GIF + phase notes.
- **One-time note for the PR:** GitHub Pages "Source" must be switched from "Deploy from branch" to
  **"GitHub Actions"** in repo settings for the new deploy to go live. The old site keeps working off
  `main` until then.

## Verification per phase
- `npm run typecheck` (or `npm run build`) clean — strict mode, no implicit any.
- `npm run dev`, drive the game in a browser: move, jump, attack, KO, rounds. Be picky about pixel/UI
  correctness.
- Confirm the production build works under the `/Castlevania97/` base path (`npm run build &&
  npm run preview`) before trusting deploy.

## Task list (mirrors the plan phases)
P0 tooling/deploy (in progress) · P1 loop/renderer/assets · P2 scenes/Fighter/input ·
P3 combat MVP (playable) · P4 rounds/result · P5 game feel · P6 title/select/skills/meter/roster ·
P7 AI + PVE · P8 mobile/gamepad/settings · P9 polish + PR.

## Notes / decisions already made
- Fixed-timestep loop @ 60 Hz logical tick, render decoupled with interpolation alpha (fixes the old
  frame-rate-dependent physics).
- Input abstraction: all sources (keyboard/touch/gamepad/**AI**) emit a per-tick `IntentState`; AI is
  just another `InputSource` (1P mode swaps P2's source — zero combat-code change).
- Combat: frame-data-driven `AttackMove` (startup/active/recovery + hitbox/hurtbox AABB), replaces
  the old `rectangularCollision` + `framesCurrent===4` magic. Fixes the enemy-facing copy-paste bug
  and the 30-vs-99 timer mismatch by construction.
- HUD = DOM overlay (crisp font, CSS width-transition for health drain — replaces GSAP).
- Characters are **data** (`data/characters/*.ts` + a registry); adding a fighter = one file.
