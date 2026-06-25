/**
 * Health/timer HUD as a DOM overlay (not canvas), so the Press Start 2P font
 * stays crisp and health drain is a cheap CSS width transition — this is what
 * replaces the original GSAP tween.
 */
/** Round pips per side (best-of-3 → first to 2). */
const PIPS_PER_SIDE = 2

export class HUD {
  private readonly root: HTMLElement
  private readonly p1Fill: HTMLElement
  private readonly p2Fill: HTMLElement
  private readonly p1Meter: HTMLElement
  private readonly p2Meter: HTMLElement
  private readonly p1Name: HTMLElement
  private readonly p2Name: HTMLElement
  private readonly timer: HTMLElement
  private readonly banner: HTMLElement
  private readonly p1Pips: HTMLElement[] = []
  private readonly p2Pips: HTMLElement[] = []

  constructor(container: HTMLElement) {
    this.root = el('div', 'hud-root')

    const p1Bar = el('div', 'hud-bar hud-bar--p1')
    this.p1Fill = el('div', 'hud-fill')
    p1Bar.appendChild(this.p1Fill)

    const p2Bar = el('div', 'hud-bar hud-bar--p2')
    this.p2Fill = el('div', 'hud-fill')
    p2Bar.appendChild(this.p2Fill)

    const p1MeterBar = el('div', 'hud-meter hud-meter--p1')
    this.p1Meter = el('div', 'hud-meter-fill')
    p1MeterBar.appendChild(this.p1Meter)

    const p2MeterBar = el('div', 'hud-meter hud-meter--p2')
    this.p2Meter = el('div', 'hud-meter-fill')
    p2MeterBar.appendChild(this.p2Meter)

    this.p1Name = el('div', 'hud-name hud-name--p1')
    this.p2Name = el('div', 'hud-name hud-name--p2')

    const p1PipRow = el('div', 'hud-pips hud-pips--p1')
    const p2PipRow = el('div', 'hud-pips hud-pips--p2')
    for (let i = 0; i < PIPS_PER_SIDE; i += 1) {
      const a = el('div', 'hud-pip')
      const b = el('div', 'hud-pip')
      this.p1Pips.push(a)
      this.p2Pips.push(b)
      p1PipRow.appendChild(a)
      p2PipRow.appendChild(b)
    }

    this.timer = el('div', 'hud-timer')
    this.banner = el('div', 'hud-banner')

    this.root.append(
      p1Bar,
      p2Bar,
      p1MeterBar,
      p2MeterBar,
      this.p1Name,
      this.p2Name,
      p1PipRow,
      p2PipRow,
      this.timer,
      this.banner,
    )
    container.appendChild(this.root)
  }

  setNames(p1: string, p2: string): void {
    this.p1Name.textContent = p1
    this.p2Name.textContent = p2
  }

  setRounds(p1Wins: number, p2Wins: number): void {
    this.p1Pips.forEach((pip, i) => pip.classList.toggle('hud-pip--on', i < p1Wins))
    this.p2Pips.forEach((pip, i) => pip.classList.toggle('hud-pip--on', i < p2Wins))
  }

  setMeter(p1Fraction: number, p2Fraction: number): void {
    this.p1Meter.style.width = `${clamp01(p1Fraction) * 100}%`
    this.p2Meter.style.width = `${clamp01(p2Fraction) * 100}%`
    this.p1Meter.classList.toggle('hud-meter-fill--full', p1Fraction >= 1)
    this.p2Meter.classList.toggle('hud-meter-fill--full', p2Fraction >= 1)
  }

  setHealth(p1Fraction: number, p2Fraction: number): void {
    this.p1Fill.style.width = `${Math.max(0, p1Fraction) * 100}%`
    this.p2Fill.style.width = `${Math.max(0, p2Fraction) * 100}%`
  }

  setTimer(seconds: number | string): void {
    this.timer.textContent = typeof seconds === 'number' ? String(Math.max(0, Math.ceil(seconds))) : seconds
  }

  setBanner(text: string): void {
    this.banner.textContent = text
  }

  dispose(): void {
    this.root.remove()
  }
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
