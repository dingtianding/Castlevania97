/**
 * WebAudio mixer. The browser blocks audio until a user gesture, so the context
 * is created lazily on the first call to unlock(). Music plays through a decoded
 * buffer on a dedicated gain node; SFX are synthesized procedurally (there are
 * no SFX assets — just the two BGM tracks), which keeps the bundle small and
 * gives crisp, latency-free hits.
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private noise: AudioBuffer | null = null

  private bgmUrl: string | null = null
  private bgmBuffer: AudioBuffer | null = null
  private bgmSource: AudioBufferSourceNode | null = null
  private wantBgm = false

  /** Create/resume the context. Safe to call repeatedly; must run inside a
   *  user-gesture handler the first time. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    const ctx = new Ctor()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.connect(ctx.destination)
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0.35
    this.musicGain.connect(this.master)
    this.sfxGain = ctx.createGain()
    this.sfxGain.gain.value = 0.6
    this.sfxGain.connect(this.master)

    void ctx.resume()
    if (this.bgmUrl) void this.ensureBgm()
  }

  /** Request looping battle music; loads on demand and plays once ready. */
  startBgm(url: string): void {
    this.bgmUrl = url
    this.wantBgm = true
    void this.ensureBgm()
  }

  stopBgm(): void {
    this.wantBgm = false
    if (this.bgmSource) {
      try {
        this.bgmSource.stop()
      } catch {
        // already stopped
      }
      this.bgmSource = null
    }
  }

  hit(): void {
    const ctx = this.ctx
    const out = this.sfxGain
    if (!ctx || !out) return
    const t = ctx.currentTime

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900
    bp.Q.value = 0.8
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.9, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    noise.connect(bp).connect(ng).connect(out)
    noise.start(t)
    noise.stop(t + 0.12)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.6, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(og).connect(out)
    osc.start(t)
    osc.stop(t + 0.13)
  }

  swing(): void {
    const ctx = this.ctx
    const out = this.sfxGain
    if (!ctx || !out) return
    const t = ctx.currentTime
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer()
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(600, t)
    hp.frequency.exponentialRampToValueAtTime(2500, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.22, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    noise.connect(hp).connect(g).connect(out)
    noise.start(t)
    noise.stop(t + 0.15)
  }

  private async ensureBgm(): Promise<void> {
    const ctx = this.ctx
    if (!ctx || !this.bgmUrl) return
    if (!this.bgmBuffer) {
      const res = await fetch(this.bgmUrl)
      this.bgmBuffer = await ctx.decodeAudioData(await res.arrayBuffer())
    }
    if (this.wantBgm && !this.bgmSource && this.musicGain) {
      const src = ctx.createBufferSource()
      src.buffer = this.bgmBuffer
      src.loop = true
      src.connect(this.musicGain)
      src.start()
      this.bgmSource = src
    }
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise
    const ctx = this.ctx as AudioContext
    const len = Math.floor(ctx.sampleRate * 0.2)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1
    this.noise = buffer
    return buffer
  }
}
