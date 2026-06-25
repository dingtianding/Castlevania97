import { neutralIntent, type InputSource, type IntentState } from './InputSource.ts'

export interface TouchControlState {
  moveX: -1 | 0 | 1
  downHeld: boolean
  jumpHeld: boolean
  jumpPressed: boolean
  lightPressed: boolean
  heavyPressed: boolean
  specialPressed: boolean
}

export function createTouchControlState(): TouchControlState {
  return {
    moveX: 0,
    downHeld: false,
    jumpHeld: false,
    jumpPressed: false,
    lightPressed: false,
    heavyPressed: false,
    specialPressed: false,
  }
}

export class TouchSource implements InputSource {
  constructor(private readonly state: TouchControlState) {}

  poll(): IntentState {
    const intent = neutralIntent()
    intent.moveX = this.state.moveX
    intent.downHeld = this.state.downHeld
    intent.jumpHeld = this.state.jumpHeld
    intent.jumpPressed = this.state.jumpPressed
    intent.lightPressed = this.state.lightPressed
    intent.heavyPressed = this.state.heavyPressed
    intent.specialPressed = this.state.specialPressed

    this.state.jumpPressed = false
    this.state.lightPressed = false
    this.state.heavyPressed = false
    this.state.specialPressed = false
    return intent
  }
}
