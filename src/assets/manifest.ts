// Every asset is imported so Vite content-hashes it and rewrites the URL for
// the '/Castlevania97/' base path. Never reference './assets/...' by string —
// hardcoded paths 404 under the GitHub Pages subpath.

import stageBg from '../../assets/background2.png'
import stageShop from '../../assets/shop.png'

import bgmBattle from '../../assets/heart of fire.mp3'

import mackIdle from '../../assets/samuraiMack/Idle.png'
import mackRun from '../../assets/samuraiMack/Run.png'
import mackJump from '../../assets/samuraiMack/Jump.png'
import mackFall from '../../assets/samuraiMack/Fall.png'
import mackAttack1 from '../../assets/samuraiMack/Attack1.png'
import mackAttack2 from '../../assets/samuraiMack/Attack2.png'
import mackTakeHit from '../../assets/samuraiMack/Take Hit.png'
import mackDeath from '../../assets/samuraiMack/Death.png'

import kenjiIdle from '../../assets/kenji/Idle.png'
import kenjiRun from '../../assets/kenji/Run.png'
import kenjiJump from '../../assets/kenji/Jump.png'
import kenjiFall from '../../assets/kenji/Fall.png'
import kenjiAttack1 from '../../assets/kenji/Attack1.png'
import kenjiAttack2 from '../../assets/kenji/Attack2.png'
import kenjiTakeHit from '../../assets/kenji/Take hit.png'
import kenjiDeath from '../../assets/kenji/Death.png'

import heroIdle from '../../assets/hero/Idle.png'
import heroRun from '../../assets/hero/Run.png'
import heroJump from '../../assets/hero/gothic-hero-jump.png'
import heroAttack from '../../assets/hero/Attack.png'
import heroJumpAttack from '../../assets/hero/gothic-hero-jump-attack.png'
import heroHurt from '../../assets/hero/Hurt.png'

import juliusIdle from '../../assets/julius/julius-idle.png'
import juliusRun from '../../assets/julius/julius-run.png'
import juliusJump from '../../assets/julius/julius-jump.png'
import juliusFall from '../../assets/julius/julius-fall.png'
import juliusWhip from '../../assets/julius/julius-whip.png'
import juliusHurt from '../../assets/julius/julius-hurt.png'
import juliusDeath from '../../assets/julius/julius-death.png'

import zombieIdle from '../../assets/enemies/zombie-idle.png'
import zombieRun from '../../assets/enemies/zombie-run.png'
import zombieAttack from '../../assets/enemies/zombie-attack1.png'
import zombieHurt from '../../assets/enemies/zombie-takeHit.png'
import zombieDeath from '../../assets/enemies/zombie-death.png'
import zombieRoam from '../../assets/enemies/zombie-roam.png'

import skeletonIdle from '../../assets/enemies/skeleton-idle.png'
import skeletonRun from '../../assets/enemies/skeleton-run.png'
import skeletonAttack from '../../assets/enemies/skeleton-attack1.png'
import skeletonHurt from '../../assets/enemies/skeleton-takeHit.png'
import skeletonDeath from '../../assets/enemies/skeleton-death.png'
import skeletonRoam from '../../assets/enemies/skeleton-roam.png'

import demonIdle from '../../assets/demon-Files/demon-idle.png'
import demonAttack from '../../assets/demon-Files/demon-attack-no-breath.png'
import demonBreathFire from '../../assets/demon-Files/breath-fire.png'

/** key -> hashed URL. Keys are stable; AssetManager loads each into an Image. */
export const IMAGE_MANIFEST = {
  'stage.bg': stageBg,
  'stage.shop': stageShop,

  'mack.idle': mackIdle,
  'mack.run': mackRun,
  'mack.jump': mackJump,
  'mack.fall': mackFall,
  'mack.attack1': mackAttack1,
  'mack.attack2': mackAttack2,
  'mack.takeHit': mackTakeHit,
  'mack.death': mackDeath,

  'kenji.idle': kenjiIdle,
  'kenji.run': kenjiRun,
  'kenji.jump': kenjiJump,
  'kenji.fall': kenjiFall,
  'kenji.attack1': kenjiAttack1,
  'kenji.attack2': kenjiAttack2,
  'kenji.takeHit': kenjiTakeHit,
  'kenji.death': kenjiDeath,

  'hero.idle': heroIdle,
  'hero.run': heroRun,
  'hero.jump': heroJump,
  'hero.attack': heroAttack,
  'hero.jumpAttack': heroJumpAttack,
  'hero.hurt': heroHurt,

  'julius.idle': juliusIdle,
  'julius.run': juliusRun,
  'julius.jump': juliusJump,
  'julius.fall': juliusFall,
  'julius.whip': juliusWhip,
  'julius.hurt': juliusHurt,
  'julius.death': juliusDeath,

  'zombie.idle': zombieIdle,
  'zombie.run': zombieRun,
  'zombie.attack': zombieAttack,
  'zombie.hurt': zombieHurt,
  'zombie.death': zombieDeath,
  'zombie.roam': zombieRoam,

  'skeleton.idle': skeletonIdle,
  'skeleton.run': skeletonRun,
  'skeleton.attack': skeletonAttack,
  'skeleton.hurt': skeletonHurt,
  'skeleton.death': skeletonDeath,
  'skeleton.roam': skeletonRoam,

  'demon.idle': demonIdle,
  'demon.attack': demonAttack,
  'demon.breathFire': demonBreathFire,
} as const satisfies Record<string, string>

export type ImageKey = keyof typeof IMAGE_MANIFEST

/** Audio URLs (decoded lazily by AudioManager after the audio context unlocks,
 *  not preloaded as images). */
export const AUDIO_MANIFEST = {
  'bgm.battle': bgmBattle,
} as const satisfies Record<string, string>

export type AudioKey = keyof typeof AUDIO_MANIFEST
