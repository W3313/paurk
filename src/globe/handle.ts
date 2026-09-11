import type { GlobeEngine } from './GlobeEngine'

let engine: GlobeEngine | null = null
export function setGlobe(g: GlobeEngine | null) { engine = g }
export function getGlobe() { return engine }
