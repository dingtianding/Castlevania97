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

    this.root.append(p1Bar, p2Bar, p1PipRow, p2PipRow, this.timer, this.banner)
    container.appendChild(this.root)
  }

  setRounds(p1Wins: number, p2Wins: number): void {
    this.p1Pips.forEach((pip, i) => pip.classList.toggle('hud-pip--on', i < p1Wins))
    this.p2Pips.forEach((pip, i) => pip.classList.toggle('hud-pip--on', i < p2Wins))
  }

  setHealth(p1Fraction: number, p2Fraction: number): void {
    this.p1Fill.style.width = `${Math.max(0, p1Fraction) * 100}%`
    this.p2Fill.style.width = `${Math.max(0, p2Fraction) * 100}%`
  }

  setTimer(seconds: number): void {
    this.timer.textContent = String(Math.max(0, Math.ceil(seconds)))
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
