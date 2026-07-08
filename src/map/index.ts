/**
 * Reusable Metroidvania map module — room graph + discovered state + grid
 * renderer. Plug it into a 2D action platformer:
 *
 *   1. Define your world as `MapData` (see sampleMap.ts). Add rooms by editing
 *      data only — no code changes needed.
 *   2. Create a service: `const map = MapService.load(MY_MAP, { saveKey })`.
 *   3. On room entry (edge cross / door / scene load), call
 *      `new RoomTrigger(roomId, map).enter()` or `map.enterRoom(roomId)`.
 *   4. Draw the pause map with `new MapRenderer().draw(ctx, map, view, { pulse })`
 *      and a live minimap with `new MinimapRenderer().draw(ctx, map, box)`.
 *   5. Toggle `map.debugRevealAll = true` to see everything.
 *
 * The graph is the source of truth — do NOT model the world as one big tilemap.
 */
export * from './types.ts'
export { MapState, type SerializedMapState } from './MapState.ts'
export { MapService, type MapServiceOptions } from './MapService.ts'
export { MapRenderer, type MapView, type MapDrawOptions } from './MapRenderer.ts'
export { MinimapRenderer, type MinimapOptions } from './MinimapRenderer.ts'
export { RoomTrigger } from './RoomTrigger.ts'
export { saveMapState, loadMapState, clearMapState } from './SaveData.ts'
export { SAMPLE_MAP, SAMPLE_START_ROOM } from './sampleMap.ts'
