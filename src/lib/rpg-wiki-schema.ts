import { RPG_CATEGORIES, type RpgCategory, type RpgCategoryId, getRpgCategoryById } from "./rpg-categories"

export type RpgWikiUpdateStrategy = "append" | "cautious-merge" | "merge" | "overwrite"

export interface RpgWikiFieldDefinition {
  name: string
  description: string
}

export interface RpgWikiSchemaEntry {
  categoryId: RpgCategoryId
  label: RpgCategory["label"]
  path: RpgCategory["path"]
  extractionGoal: string
  fields: readonly RpgWikiFieldDefinition[]
  exclude: readonly string[]
  updateStrategy: RpgWikiUpdateStrategy
  recommendedGranularity: string
}

const category = (id: RpgCategoryId): RpgCategory => {
  const found = getRpgCategoryById(id)
  if (!found) throw new Error(`Missing RPG category registry entry: ${id}`)
  return found
}

const defineSchema = (
  categoryId: RpgCategoryId,
  schema: Omit<RpgWikiSchemaEntry, "categoryId" | "label" | "path">,
): RpgWikiSchemaEntry => {
  const registered = category(categoryId)
  return {
    categoryId,
    label: registered.label,
    path: registered.path,
    ...schema,
  }
}

export const RPG_WIKI_SCHEMA = [
  defineSchema("sources", {
    extractionGoal: "Track where RPG source material came from and summarize what each source contributes.",
    fields: [
      { name: "sourceName", description: "Name or title of the source material." },
      { name: "sourceType", description: "Character sheet, worldbook, module text, user supplement, history, or similar." },
      { name: "summary", description: "Brief summary of the source content." },
      { name: "affectedCategories", description: "RPG wiki categories influenced by this source." },
      { name: "priority", description: "Reliability, priority, hard-setting status, or conflicts with other sources." },
    ],
    exclude: ["Detailed character state", "Full event history", "Location state as canonical RPG state"],
    updateStrategy: "append",
    recommendedGranularity: "One page per original file, character card, worldbook entry, or important imported text.",
  }),
  defineSchema("world", {
    extractionGoal: "Capture stable or slowly changing setting facts about what the world is like.",
    fields: [
      { name: "background", description: "Core world background, era, geography, history, and public context." },
      { name: "socialRules", description: "Common sense, culture, social organization, and public knowledge." },
      { name: "systems", description: "Major supernatural, technical, mysterious, or setting-level systems." },
      { name: "atmosphere", description: "Overall genre, tone, and world mood." },
    ],
    exclude: ["Specific combat mechanics", "Character personal state", "Ability numbers or player stats"],
    updateStrategy: "cautious-merge",
    recommendedGranularity: "Split by setting topic such as overview, history, common sense, systems, or social structure.",
  }),
  defineSchema("characters", {
    extractionGoal: "Maintain NPC and important character profiles, static facts, and meaningful current state.",
    fields: [
      { name: "identity", description: "Name, role, appearance, species, age, or basic profile details." },
      { name: "staticProfile", description: "Background, personality, values, speech style, abilities, weaknesses, and long-term goals." },
      { name: "currentState", description: "Location, physical state, emotions, current goal, known information, and recent important changes." },
      { name: "playerRelevance", description: "Attitude toward the player, trust, conflict, dependency, or tension." },
      { name: "hooks", description: "Character-specific story hooks that can be advanced later." },
    ],
    exclude: ["Complete event transcripts", "Every short-term action", "Player character profile unless explicitly an NPC-facing note"],
    updateStrategy: "merge",
    recommendedGranularity: "One page per important non-player character.",
  }),
  defineSchema("player", {
    extractionGoal: "Maintain the player character's accepted RPG state, resources, goals, and knowledge.",
    fields: [
      { name: "identity", description: "Player character name, identity, background, and role in the world." },
      { name: "abilities", description: "Abilities, skills, constraints, and current usable powers." },
      { name: "inventory", description: "Equipment, backpack contents, resources, and important possessions." },
      { name: "state", description: "Current location, condition, goals, promises, permissions, and consequences caused by the player." },
      { name: "knowledge", description: "Information the player knows, and asymmetric information relevant to play." },
    ],
    exclude: ["Raw player utterance log", "Ordinary NPC state", "Unaccepted plans that have not affected story state"],
    updateStrategy: "merge",
    recommendedGranularity: "Use one main player page first, optionally split profile, abilities, inventory, goals, and known information.",
  }),
  defineSchema("locations", {
    extractionGoal: "Capture places, scenes, spatial relationships, access conditions, and location state.",
    fields: [
      { name: "identity", description: "Location name, type, parent area, and spatial structure." },
      { name: "connections", description: "Adjacent places, access conditions, and spatial relationships." },
      { name: "contents", description: "Residents, important items, visible clues, and hidden information." },
      { name: "state", description: "Current safety, danger level, atmosphere, and event-caused changes." },
      { name: "hooks", description: "Triggerable scenes or plots connected to the location." },
    ],
    exclude: ["Full plot transcript", "Character full profiles", "Unrelated world history"],
    updateStrategy: "merge",
    recommendedGranularity: "One page per important place; split large locations into sublocation pages when useful.",
  }),
  defineSchema("factions", {
    extractionGoal: "Maintain organizations, groups, agendas, members, resources, influence, and faction relationships.",
    fields: [
      { name: "identity", description: "Faction name, type, role, and influence scope." },
      { name: "agenda", description: "Core goals, operating principles, current actions, and internal conflicts." },
      { name: "members", description: "Important members and their organizational role." },
      { name: "resources", description: "Assets, territories, influence, and capabilities." },
      { name: "relationships", description: "Allies, enemies, and attitude toward the player." },
    ],
    exclude: ["Complete personal details for individual members", "Generic world facts", "Unconfirmed faction plans as events"],
    updateStrategy: "merge",
    recommendedGranularity: "One page per major organization, group, family, institution, army, cult, or faction.",
  }),
  defineSchema("items", {
    extractionGoal: "Track important equipment, clues, key objects, ownership, condition, and plot function.",
    fields: [
      { name: "identity", description: "Item name, type, appearance, and source." },
      { name: "function", description: "Capabilities, use conditions, side effects, and plot role." },
      { name: "state", description: "Current holder, location, condition, consumption, loss, or damage." },
      { name: "history", description: "Past ownership and links to characters, locations, factions, or events." },
      { name: "hooks", description: "Follow-up scenes or conflicts the item can trigger." },
    ],
    exclude: ["Complete character ability sheets", "Ordinary inventory chatter unless state-changing", "Unrelated prop descriptions"],
    updateStrategy: "merge",
    recommendedGranularity: "One page per important item; ordinary items may be grouped into inventory pages.",
  }),
  defineSchema("plot-arcs", {
    extractionGoal: "Maintain story structure, unresolved questions, conflicts, foreshadowing, constraints, and possible development.",
    fields: [
      { name: "arcName", description: "Name and type of the plot line." },
      { name: "stage", description: "Current narrative stage and already established key nodes." },
      { name: "openQuestions", description: "Unresolved mysteries, foreshadowing, and pending conflicts." },
      { name: "dependencies", description: "Key characters, locations, items, factions, and conditions needed to advance." },
      { name: "constraints", description: "Narrative constraints and recommended next developments." },
    ],
    exclude: ["Every happened event detail", "Confirmed timeline facts without plot relevance", "Future suggestions written as if already happened"],
    updateStrategy: "merge",
    recommendedGranularity: "One page per important main arc, side arc, relationship arc, mystery, or conflict.",
  }),
  defineSchema("events", {
    extractionGoal: "Record confirmed events that already happened and their consequences in timeline form.",
    fields: [
      { name: "time", description: "Event time, sequence marker, or approximate timeline position." },
      { name: "place", description: "Where the event happened." },
      { name: "participants", description: "Player and NPC participants and their actions." },
      { name: "summary", description: "Concise summary of what happened." },
      { name: "consequences", description: "State changes, new facts, relationship shifts, and plot impacts caused by the event." },
    ],
    exclude: ["Future plot advice", "Speculation", "Foreshadowing unless recorded as a consequence of a happened event"],
    updateStrategy: "append",
    recommendedGranularity: "Use timeline plus per-turn or per-scene event pages for confirmed happened events.",
  }),
  defineSchema("current-scene", {
    extractionGoal: "Keep only the latest immediate scene snapshot needed for the next RPG turn.",
    fields: [
      { name: "time", description: "Current in-world time or immediate sequence marker." },
      { name: "place", description: "Current location and scene frame." },
      { name: "participants", description: "Characters present, positions, bodies, emotions, and immediate intent." },
      { name: "immediateAction", description: "What is happening now, including the latest player action and NPC response." },
      { name: "nextTurnContext", description: "Atmosphere, dangers, interactive objects, visible clues, narrative focus, and required continuation." },
    ],
    exclude: ["Long-term world lore", "Complete character profiles", "Full event history", "Accumulated previous scene snapshots"],
    updateStrategy: "overwrite",
    recommendedGranularity: "First version should use the exact single scene snapshot file current-scene/scene_state.md; do not invent alternate current-scene filenames.",
  }),
  defineSchema("relationships", {
    extractionGoal: "Track relationship state, trust, tension, conflict, dependency, misunderstandings, and relationship changes.",
    fields: [
      { name: "parties", description: "Relationship participants or group." },
      { name: "type", description: "Alliance, rivalry, romance, teacher-student, master-servant, suspicion, protection, or similar." },
      { name: "state", description: "Current trust, intimacy, conflict, dependency, misunderstandings, and unspoken feelings." },
      { name: "history", description: "Important shared experiences and relationship-change nodes." },
      { name: "constraints", description: "Future directions and changes that require buildup or must not happen abruptly." },
    ],
    exclude: ["Duplicate full character profiles", "One-off interactions with no relationship impact", "Event transcript details better stored in events"],
    updateStrategy: "merge",
    recommendedGranularity: "One page per important pair or relationship group.",
  }),
] as const satisfies readonly RpgWikiSchemaEntry[]

export type RpgWikiSchemaCategoryId = (typeof RPG_WIKI_SCHEMA)[number]["categoryId"]

export function getRpgWikiSchemaEntry(categoryId: string): RpgWikiSchemaEntry | undefined {
  return RPG_WIKI_SCHEMA.find((entry) => entry.categoryId === categoryId)
}

export function rpgSchemaCategoryIdsMatchRegistry(): boolean {
  const schemaIds = RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)
  const categoryIds = RPG_CATEGORIES.map((entry) => entry.id)
  return schemaIds.length === categoryIds.length && schemaIds.every((id, index) => id === categoryIds[index])
}
