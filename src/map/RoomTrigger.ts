/**
 * RoomTrigger — the hook between a level/scene and the map. Attach one to each
 * room (or fire it when the level scene loads a room) so the MapService learns
 * the player has arrived. It intentionally holds no geometry: your platformer
 * decides WHEN the player has "entered" (edge crossing, door, scene load) and
 * calls `enter()`.
 */
import type { MapService } from './MapService.ts'

export class RoomTrigger {
  private entered = false

  constructor(
    readonly roomId: string,
    private readonly service: MapService,
    /** Called the first time this room is entered (new discovery). */
    private readonly onFirstDiscover?: (roomId: string) => void,
  ) {}

  /** Call when the player enters this room. Discovers + marks it current. */
  enter(): void {
    const wasNew = this.service.enterRoom(this.roomId)
    if (wasNew && !this.entered) this.onFirstDiscover?.(this.roomId)
    this.entered = true
  }

  /** Reset so re-entering can fire the first-discover callback again. */
  reset(): void {
    this.entered = false
  }
}
