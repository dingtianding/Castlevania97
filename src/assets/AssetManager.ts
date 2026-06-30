import { IMAGE_MANIFEST, type ImageKey } from './manifest.ts'

export type ProgressCallback = (loaded: number, total: number) => void

function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = url
  // decode() resolves once the bitmap is ready off the main thread, so the
  // first draw never races an undecoded image (the original first-frame bug).
  return img
    .decode()
    .then(() => img)
    .catch(() => {
      // Some browsers reject decode() for edge cases that still render fine;
      // fall back to the load event before giving up.
      return new Promise<HTMLImageElement>((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve(img)
          return
        }
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
      })
    })
}

async function stripLightCheckerboard(img: HTMLImageElement): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return img
  ctx.drawImage(img, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i]!
    const g = pixels.data[i + 1]!
    const b = pixels.data[i + 2]!
    if (r >= 228 && g >= 228 && b >= 228 && Math.max(r, g, b) - Math.min(r, g, b) <= 10) {
      pixels.data[i + 3] = 0
    }
  }
  ctx.putImageData(pixels, 0, 0)
  return loadImage(canvas.toDataURL('image/png'))
}

function needsLightBackgroundCleanup(key: ImageKey): boolean {
  return key.startsWith('zombie.')
}

/** Preloads and holds decoded images keyed by manifest name. */
export class AssetManager {
  private readonly images = new Map<ImageKey, HTMLImageElement>()

  /** Load the whole image manifest, reporting progress as each one decodes. */
  async loadAll(onProgress?: ProgressCallback): Promise<void> {
    const entries = Object.entries(IMAGE_MANIFEST) as [ImageKey, string][]
    let loaded = 0
    await Promise.all(
      entries.map(async ([key, url]) => {
        const image = await loadImage(url)
        this.images.set(key, needsLightBackgroundCleanup(key) ? await stripLightCheckerboard(image) : image)
        loaded += 1
        onProgress?.(loaded, entries.length)
      }),
    )
  }

  image(key: ImageKey): HTMLImageElement {
    const img = this.images.get(key)
    if (!img) throw new Error(`Image not loaded: ${key}`)
    return img
  }
}
