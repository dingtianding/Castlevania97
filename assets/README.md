# Asset Guide

Add source assets here, then import them through `src/assets/manifest.ts`.

Do not reference files with raw paths like `./assets/foo.png` from game code.
GitHub Pages serves the game under `/Castlevania97/`, so Vite imports are what
make URLs safe after production hashing.

Recommended folders:

```txt
assets/
  fighters/
    fighter-id/
      Idle.png
      Run.png
      Jump.png
      Fall.png
      Attack1.png
      Attack2.png
      TakeHit.png
      Death.png
  portraits/
    fighter-id.png
  stages/
    castle/
      bg.png
      mid.png
      fg.png
  vfx/
    effect-name.png
```

Fighter checklist:

1. Add the sprite files under `assets/fighters/<id>/`.
2. Import them in `src/assets/manifest.ts`.
3. Create `src/data/characters/<id>.ts`.
4. Add the `CharacterDef` to `src/data/characters/registry.ts`.
5. Tune in Training Mode with `?hitbox`.
