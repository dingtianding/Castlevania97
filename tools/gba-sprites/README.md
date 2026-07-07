# Character sprite pipeline (parked)

The cast currently uses the existing third-party sprite packs (see
`src/assets/manifest.ts`). When we come back to a distinct art style, the plan
is to use **AI-generated pixel sprites** (original characters — no ripped or
copyrighted game assets), then wire them into the manifest + `CharacterDef`.

## Direction
- **Main character:** an original dhampir swordsman (his own name/design — not a
  copy of any existing game character). Would replace Julius as `CAMPAIGN_HERO`.
- **Julius:** kept as a second, selectable character (needs a small
  character-select before the campaign — not built yet).

## Output spec (for the AI tool)
- **128×128 px per frame**, transparent background, side view, facing **right**.
- Figure fills most of the frame (~110–115 px tall); **feet on the bottom edge**,
  horizontally centered; **same box/baseline across every animation**.
- One horizontal-strip PNG per animation. Animations + frame counts:
  Idle 4, Run 6, Jump 2, Fall 2, Attack 5, Take Hit 2, Death 6.
- Reference images in `reference/`: `ref-frame-64` (proportion/baseline guide —
  scale to 128) and `ref-palette` (moody gothic palette).

## Prompt recipe (single-field tools)
Keep characters **original**; describe the *style*, not a specific game/character.

Style + quality:
> Detailed 2D gothic pixel-art game sprite, dark-fantasy action-platformer style,
> high detail with rich shading and dramatic rim lighting, crisp clean dark
> outlines, moody desaturated gothic palette with crimson and gold accents.

Proportions (stops the chibi/cartoony look):
> Tall, slender, athletic adult, realistic proportions, roughly eight heads tall,
> long legs, small head, elongated silhouette. NOT chibi, no big head, not cute,
> not a cartoon mascot.

Framing:
> Side view, facing right, full body head-to-toe, transparent background, no
> scenery, no text. 128x128, figure ~115 px tall, centered, feet on the bottom
> edge. Consistent single character.

Swap the character line per enemy (skeleton, zombie, ghoul, bone thrower, boss)
and the stance line per animation (standing / mid-stride / sword swing /
recoiling / collapsing).

## Wiring (once sheets exist)
Drop sheets in `assets/<name>/`, then: add manifest keys, build the
`CharacterDef` (sprite keys + frame counts), and tune `visual.anchorX/anchorY/
scale/hurtbox` so the figure's feet sit on the floor at the right size.
