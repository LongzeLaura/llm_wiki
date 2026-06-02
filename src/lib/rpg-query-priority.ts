import type { SearchResult } from "./search"
import { inferWikiTypeFromPath } from "./wiki-page-types"

const RPG_RETRIEVAL_PRIORITY: Record<string, number> = {
  "current-scene": 100,
  player: 90,
  characters: 80,
  relationships: 75,
  events: 70,
  "plot-arcs": 65,
  world: 55,
  locations: 50,
  factions: 45,
  items: 40,
  source: 20,
}

export interface MandatoryRpgContextDir {
  dir: string
  limit: number
  preferredFiles?: readonly string[]
}

export const MANDATORY_RPG_CONTEXT_DIRS: readonly MandatoryRpgContextDir[] = [
  { dir: "current-scene", limit: 1, preferredFiles: ["scene_state.md"] },
  { dir: "player", limit: 2 },
  { dir: "events", limit: 2, preferredFiles: ["timeline.md"] },
  { dir: "plot-arcs", limit: 2 },
] as const

export function getRpgRetrievalPriority(path: string): number {
  const type = inferWikiTypeFromPath(path)
  if (!type) return 0
  return RPG_RETRIEVAL_PRIORITY[type] ?? 0
}

export function isRpgRelevantPath(path: string): boolean {
  return getRpgRetrievalPriority(path) > 0
}

export function prioritizeChatSearchResults(results: readonly SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => {
    const priorityDelta = getRpgRetrievalPriority(b.path) - getRpgRetrievalPriority(a.path)
    if (priorityDelta !== 0) return priorityDelta

    const titleMatchDelta = Number(b.titleMatch) - Number(a.titleMatch)
    if (titleMatchDelta !== 0) return titleMatchDelta

    return b.score - a.score
  })
}
