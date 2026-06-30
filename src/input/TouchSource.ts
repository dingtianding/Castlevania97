import { neutralIntent, type InputSource, type IntentState } from './InputSource.ts'

export interface TouchControlState {
  moveX: -1 | 0 | 1
  upHeld: boolean
  downHeld: boolean
  jumpHeld: boolean
  jumpPressed: boolean
  lightPressed: boolean
  heavyPressed: boolean
  specialPressed: boolean
  dashPressed: boolean
}

export function createTouchControlState(): TouchControlState {
  return {
    moveX: 0,
    upHeld: false,
    downHeld: false,
    jumpHeld: false,
    jumpPressed: false,
    lightPressed: false,
    heavyPressed: false,
    specialPressed: false,
    dashPressed: false,
  }
}

export class TouchSource implements InputSource {
  constructor(private readonly state: TouchControlState) {}

  poll(): IntentState {
    const intent = neutralIntent()
    intent.moveX = this.state.moveX
    intent.upHeld = this.state.upHeld
    intent.downHeld = this.state.downHeld
    intent.jumpHeld = this.state.jumpHeld
    intent.jumpPressed = this.state.jumpPressed
    intent.lightPressed = this.state.lightPressed
    intent.heavyPressed = this.state.heavyPressed
    intent.specialPressed = this.state.specialPressed
    intent.dashPressed = this.state.dashPressed

    this.state.jumpPressed = false
    this.state.lightPressed = false
    this.state.heavyPressed = false
    this.state.specialPressed = false
    this.state.dashPressed = false
    return intent
  }
}
