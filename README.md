# Castlevania97

[**▶ Play Castlevania97**](https://dingtianding.github.io/Castlevania97/)

Castlevania97 is a campaign-first action game built around a younger Julius Belmont in 1997. The current build focuses on room-by-room campaign combat, while the Archive keeps the older versus modes available behind the title screen.

## Modes

- **Campaign** - Julius follows a 1997 omen through a node-based route of rooms and chapter transitions.
- **Archive** - legacy versus, training, boss rush, move codices, and records.
- **Settings** - audio, reduce motion, and CPU difficulty.

Audio starts muted by default. Open Settings to raise `MASTER`, `MUSIC`, or `SFX` if you want sound on.

## Controls

| Action | Keyboard |
| --- | --- |
| Move | `A` / `D` |
| Up | `W` |
| Fast fall | `S` |
| Jump / confirm | `J` |
| Light attack / menu back | `K` |
| Switch subweapon | `L` |
| Dash | `;` |
| Use subweapon | `W + K` |

Menus use `J` to confirm and `K` to go back. Gamepad and touch input are also supported, and touch devices get on-screen controls.

## Campaign Notes

- The castle is the final stage, not the starting route.
- Room enemies are tuned for fast reads and quick clears.
- Player hit recovery includes a brief invulnerability window.
- Campaign progress is saved in the browser.
- Current subweapon cycle: dagger, axe, cross, holy water, stopwatch.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

Append `?hitbox` to the URL to show hitbox, hurtbox, and pushbox overlays.

## Tech Stack

- TypeScript, strict mode
- Canvas 2D rendering
- WebAudio for music and effects
- Vite for dev and production builds

## Deployment

The site is deployed to GitHub Pages from `main` through GitHub Actions.
