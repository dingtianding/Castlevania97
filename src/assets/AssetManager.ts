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

/** Preloads and holds decoded images keyed by manifest name. */
export class AssetManager {
  private readonly images = new Map<ImageKey, HTMLImageElement>()

  /** Load the whole image manifest, reporting progress as each one decodes. */
  async loadAll(onProgress?: ProgressCallback): Promise<void> {
    const entries = Object.entries(IMAGE_MANIFEST) as [ImageKey, string][]
    let loaded = 0
    await Promise.all(
      entries.map(async ([key, url]) => {
        this.images.set(key, await loadImage(url))
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
