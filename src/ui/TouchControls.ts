import type { TouchControlState } from '../input/TouchSource.ts'

interface ButtonSpec {
  className: string
  label: string
  press: () => void
  release?: () => void
}

export class TouchControls {
  private readonly root: HTMLDivElement
  private readonly activeDirections = new Set<-1 | 1>()

  constructor(
    container: HTMLElement,
    private readonly state: TouchControlState,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'touch-controls'
    this.root.setAttribute('aria-hidden', 'true')

    const dpad = document.createElement('div')
    dpad.className = 'touch-controls__dpad'
    dpad.append(
      this.button({
        className: 'touch-button touch-button--dir',
        label: '<',
        press: () => this.pressDirection(-1),
        release: () => this.releaseDirection(-1),
      }),
      this.button({
        className: 'touch-button touch-button--dir',
        label: '>',
        press: () => this.pressDirection(1),
        release: () => this.releaseDirection(1),
      }),
      this.button({
        className: 'touch-button touch-button--dir',
        label: 'v',
        press: () => {
          this.state.downHeld = true
        },
        release: () => {
          this.state.downHeld = false
        },
      }),
    )

    const actions = document.createElement('div')
    actions.className = 'touch-controls__actions'
    actions.append(
      this.button({
        className: 'touch-button touch-button--jump',
        label: 'J',
        press: () => {
          this.state.jumpHeld = true
          this.state.jumpPressed = true
        },
        release: () => {
          this.state.jumpHeld = false
        },
      }),
      this.button({
        className: 'touch-button',
        label: 'L',
        press: () => {
          this.state.lightPressed = true
        },
      }),
      this.button({
        className: 'touch-button',
        label: 'H',
        press: () => {
          this.state.heavyPressed = true
        },
      }),
      this.button({
        className: 'touch-button touch-button--special',
        label: 'S',
        press: () => {
          this.state.specialPressed = true
        },
      }),
    )

    this.root.append(dpad, actions)
    container.append(this.root)
  }

  dispose(): void {
    this.root.remove()
    this.activeDirections.clear()
    this.state.moveX = 0
    this.state.downHeld = false
    this.state.jumpHeld = false
  }

  private button(spec: ButtonSpec): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = spec.className
    btn.textContent = spec.label
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      btn.setPointerCapture(e.pointerId)
      spec.press()
    })
    const release = (e: PointerEvent): void => {
      e.preventDefault()
      if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId)
      spec.release?.()
    }
    btn.addEventListener('pointerup', release)
    btn.addEventListener('pointercancel', release)
    btn.addEventListener('lostpointercapture', () => spec.release?.())
    return btn
  }

  private pressDirection(dir: -1 | 1): void {
    this.activeDirections.add(dir)
    this.syncDirection()
  }

  private releaseDirection(dir: -1 | 1): void {
    this.activeDirections.delete(dir)
    this.syncDirection()
  }

  private syncDirection(): void {
    if (this.activeDirections.has(-1) === this.activeDirections.has(1)) this.state.moveX = 0
    else this.state.moveX = this.activeDirections.has(1) ? 1 : -1
  }
}
