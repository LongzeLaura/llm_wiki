export interface RpgCategory {
  id: string
  label: string
  path: string
  description: string
  dynamic: boolean
  multipleFiles: boolean
  requireSource: boolean
}

export const RPG_CATEGORIES = [
  {
    id: "sources",
    label: "Sources",
    path: "wiki/sources",
    description: "Original RPG source material, import summaries, character sheets, and provenance notes.",
    dynamic: false,
    multipleFiles: true,
    requireSource: false,
  },
  {
    id: "world",
    label: "World",
    path: "wiki/world",
    description: "Stable and semi-stable setting, history, culture, public facts, and world background.",
    dynamic: false,
    multipleFiles: true,
    requireSource: true,
  },
  {
    id: "characters",
    label: "Characters",
    path: "wiki/characters",
    description: "NPC and important character facts, static profile details, and meaningful current state.",
    dynamic: true,
    multipleFiles: true,
    requireSource: true,
  },
  {
    id: "player",
    label: "Player",
    path: "wiki/player",
    description: "Player character identity, abilities, inventory, goals, known information, and current state.",
    dynamic: true,
    multipleFiles: true,
    requireSource: true,
  },
  {
    id: "locations",
    label: "Locations",
    path: "wiki/locations",
    description: "Places, scenes, regions, spatial relationships, access conditions, and location state.",
    dynamic: true,
    multipleFiles: true,
    requireSource: true,
  },
  {
    id: "factions",
    label: "Factions",
    path: "wiki/factions",
    description: "Organizations, groups, agendas, members, resources, influence, and attitudes.",
    dynamic: true,
    multipleFiles: true,
    requireSource: true,
  },
  {
    id: "items",
    label: "Items",
    path: "wiki/items",
    description: "Equipment, clues, key objects, ownership, condition, and plot function.",
    dynamic: true,
    multipleFiles: true,
    requireSource: true,
  },
  {
    id: "plot-arcs",
    label: "Plot Arcs",
    path: "wiki/plot-arcs",
    description: "Main arcs, side arcs, unresolved conflicts, foreshadowing, constraints, and likely developments.",
    dynamic: true,
    multipleFiles: true,
    requireSource: true,
  },
  {
    id: "events",
    label: "Events",
    path: "wiki/events",
    description: "Confirmed events that already happened, their timeline position, and their consequences.",
    dynamic: true,
    multipleFiles: true,
    requireSource: true,
  },
  {
    id: "current-scene",
    label: "Current Scene",
    path: "wiki/current-scene",
    description: "Latest immediate scene snapshot needed for the next RPG turn.",
    dynamic: true,
    multipleFiles: false,
    requireSource: true,
  },
  {
    id: "relationships",
    label: "Relationships",
    path: "wiki/relationships",
    description: "Relationship state, trust, tension, conflicts, misunderstandings, and relationship changes.",
    dynamic: true,
    multipleFiles: true,
    requireSource: true,
  },
] as const satisfies readonly RpgCategory[]

export type RpgCategoryId = (typeof RPG_CATEGORIES)[number]["id"]

export function getRpgCategoryById(id: string): RpgCategory | undefined {
  return RPG_CATEGORIES.find((category) => category.id === id)
}

export function getRpgCategoryByPath(path: string): RpgCategory | undefined {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
  return RPG_CATEGORIES.find((category) => normalized === category.path || normalized.endsWith(`/${category.path}`))
}
