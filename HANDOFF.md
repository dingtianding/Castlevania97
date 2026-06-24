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
- **Phase:** P0 (tooling) — *in progress, not yet committed.*
- **Done so far:** removed the old toolchain/source so the tree is clean for the rebuild.
  Deleted (staged as deletions, NOT committed): `package.json`, `package-lock.json`,
  `webpack.config.js`, `babel.config.json`, `index.html`, `src/index.js`, `src/index.scss`,
  `src/scripts/*`, `src/styles/*`, `dist/*`.
- **Kept:** `assets/` (all art + 2 mp3s — DO NOT delete), `favicon.ico`, `.gitignore`
  (`node_modules/`, `.DS_Store`), `.vscode/`, `README.md` (still the old one — update in P9),
  `HANDOFF.md` (this file).
- **No new files written yet.** `src/` is empty. Nothing has been committed on this branch.

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

### Finish P0 — tooling & deploy skeleton
Write these files, then `npm install`, then verify `npm run dev` shows a canvas under the base path,
then commit.

1. `package.json` — `"type": "module"`, scripts `dev: vite`, `build: tsc --noEmit && vite build`,
   `preview`, `typecheck: tsc --noEmit`. devDeps: `typescript`, `vite`. No runtime deps (drop GSAP &
   FontAwesome — they were CDN `<script>`s in the old `index.html`).
2. `tsconfig.json` — strict, `module/moduleResolution: bundler`, `target: ES2020`, `noEmit`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.
3. `vite.config.ts` — **`base: '/Castlevania97/'`** (critical for GitHub Pages subpath).
4. `index.html` — at repo root (Vite entry). Single `<canvas id="game">` + `<div id="hud">` +
   `<div id="overlay">`, loads Press Start 2P font, `<script type="module" src="/src/main.ts">`.
5. `src/main.ts` — minimal: grab canvas, size to 1024×576, `imageSmoothingEnabled=false`, draw
   "CASTLEVANIA 97" placeholder text. (Replaced by the real loop in P1.)
6. `src/style.css` — page reset, center the canvas, pixel-art `image-rendering: pixelated`.
7. `.github/workflows/deploy.yml` — on push to `main`: setup-node → `npm ci` → `npm run build` →
   `actions/upload-pages-artifact` (`dist/`) → `actions/deploy-pages`.
   `permissions: { pages: write, id-token: write }`, `concurrency: pages`.
8. **ASSET PATHS:** never hardcode `./assets/...`. Either `import url from '../assets/...png'` (Vite
   hashes + fixes base path) or build URLs with `import.meta.env.BASE_URL`. Hardcoded paths 404
   under `/Castlevania97/`. This is the #1 migration footgun.

Commit P0: `git add -A && git commit` (message: why, one sentence per line, **no AI co-author
trailer** per Dean's standards). Stay on `rebuild/ts-engine`.

### Then P1–P9
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
