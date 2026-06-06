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
    extractionGoal: "Maintain NPC and important character base pages as roleplay-ready character profiles / character operating models. Preserve not just what the character is, but how they tend to think, speak, justify themselves, react under pressure, and behave in interaction. Keep Canon Facts, Reasonable Interpretation, and RP Usage semantically distinct. Static ingest writes stable, source-supported character material to `wiki/characters/`; runtime agents should write temporary or current campaign status to `wiki/characters/runtime/` overlays instead of continually polluting base pages. Original-work characters, canonical protagonists, POV leads, and game-controllable characters default here unless the source explicitly says they are the current RPG player character. Do not collapse route-specific, timeline-specific, or ending-specific states into one universal present-state summary.",
    fields: [
      { name: "identity", description: "## Identity and Recognizable Traits. Name, aliases, role, appearance, affiliations, and immediately recognizable markers." },
      { name: "roleImpression", description: "## Character Impression. The strongest first-play impression, scene presence, casting energy, and how other characters would immediately read them." },
      { name: "canonFacts", description: "## Canon Facts. Only facts directly supported by the source: history, actions, abilities, constraints, affiliations, explicit emotional states, and stated relationships." },
      { name: "characterModel", description: "## Psychological Model. A grounded character operating model explaining how the character tends to think, decide, self-protect, attach, justify, or escalate. Explain behavior patterns rather than stopping at labels like gentle, tsundere, or strong." },
      { name: "triggersAndReactions", description: "## Triggers and Reactions. Include Trauma / stress sources, Defense patterns, Trigger points, Deep Needs, and characteristic reactions under pressure, shame, attachment, threat, or vulnerability." },
      { name: "behaviorRules", description: "## Behavior Rules. Stable heuristics for what the character usually does, refuses to do, prioritizes, hides, tolerates, or punishes." },
      { name: "dialogueStyle", description: "## Dialogue Style. Vocabulary, sentence rhythm, politeness, evasions, sarcasm, honorifics, favorite topics, forbidden topics, and concrete speech cues." },
      { name: "relationshipDynamics", description: "## Relationship Dynamics. Durable attachment, distrust, rivalry, dependence, manipulation, protection, hierarchy, or testing patterns toward recurring characters or groups. Current campaign shifts belong in relationships pages or character runtime overlays." },
      { name: "routeAndTimelineVariants", description: "## Route and Timeline Variants. Separate route-specific, timeline-specific, faction-specific, ending-specific, or years-later variants instead of collapsing them into one universal present-state summary." },
      { name: "rpgUsage", description: "## RP Usage. Interaction-facing guidance for scene generation: what openings work, what pressure reveals, what pacing fits, what should stay unsaid, and how to portray the character without inventing canon." },
      { name: "evidenceAndUncertainty", description: "## Evidence and Uncertainty. Distinguish direct evidence, reasonable interpretation, contradictory source claims, route dependence, and unsupported but tempting guesses." },
    ],
    exclude: [
      "Complete event transcripts or whole-route recaps",
      "Encyclopedia trivia that is not useful for portrayal or interaction",
      "Current RPG player-character profile when the source explicitly says this is the active PC",
      "Runtime-only current campaign state that should be written to wiki/characters/runtime/ overlay pages",
      "Fate / UBW / HF / ending-specific state collapsed into one universal current-state summary",
      "RP-serving interpretation, convenience assumptions, or play advice written as if they were hard canon facts",
    ],
    updateStrategy: "merge",
    recommendedGranularity: "One base page per important non-player or not-explicitly-PC character, written as a roleplay-ready character card. Prefer sections such as ## Character Impression, ## Identity and Recognizable Traits, ## Canon Facts, ## Reasonable Interpretation, ## Psychological Model, ## Behavior Rules, ## Dialogue Style, ## Relationship Dynamics, ## Route and Timeline Variants, ## RP Usage, and ## Evidence and Uncertainty. Use translated heading equivalents when required by the project output language, but keep the same semantic split. Static ingest should update the base page; runtime/current campaign state should be placed in the matching `wiki/characters/runtime/` overlay.",
  }),
  defineSchema("player", {
    extractionGoal: "Maintain the accepted RPG state, resources, goals, and knowledge of the current player-created or explicitly declared player character only. Unless the source clearly says a role is the current RPG PC, custom character, SI, OC, or user-played character, do not put it here.",
    fields: [
      { name: "identity", description: "Current RPG player character name, identity, background, and role in the world." },
      { name: "abilities", description: "Abilities, skills, constraints, and current usable powers." },
      { name: "inventory", description: "Equipment, backpack contents, resources, and important possessions." },
      { name: "state", description: "Current location, condition, goals, promises, permissions, and consequences caused by the player." },
      { name: "knowledge", description: "Information the player knows, and asymmetric information relevant to play." },
    ],
    exclude: [
      "Raw player utterance log",
      "Ordinary NPC state",
      "Original/canon characters unless the source explicitly says they are the current RPG player character",
      "Original protagonists, POV characters, or game-controllable characters treated as player by default",
      "Unaccepted plans that have not affected story state",
    ],
    updateStrategy: "merge",
    recommendedGranularity: "Use one main player page first, optionally split profile, abilities, inventory, goals, and known information.",
  }),
  defineSchema("locations", {
    extractionGoal: "Capture important or repeatedly referenced base places, scenes, spatial relationships, stable access conditions, and source-supported location facts. Static ingest writes these stable facts to `wiki/locations/`; runtime agents should write temporary danger, occupants, damage, clues, access changes, or current atmosphere to `wiki/locations/runtime/` overlays. After character, event, and relationship extraction, do a secondary scan for plot-relevant locations that were only mentioned indirectly.",
    fields: [
      { name: "identity", description: "Location name, type, parent area, and spatial structure." },
      { name: "connections", description: "Adjacent places, access conditions, and spatial relationships." },
      { name: "contents", description: "Residents, important items, visible clues, and hidden information." },
      { name: "state", description: "Stable or source-established safety, danger, atmosphere, and historical event-caused changes. Current runtime changes belong in the matching runtime/ overlay." },
      { name: "hooks", description: "Triggerable scenes or plots connected to the location." },
    ],
    exclude: ["Full plot transcript", "Character full profiles", "Unrelated world history", "Runtime-only current location state that should be written to wiki/locations/runtime/ overlay pages"],
    updateStrategy: "merge",
    recommendedGranularity: "One base page per important or repeatedly referenced place; split large locations into sublocation pages when useful. If a core location is identifiable but source coverage is thin, a short stub with an explicit limited-source or to-be-expanded note is acceptable. Static ingest should update the base page; runtime/current campaign state should be placed in the matching `wiki/locations/runtime/` overlay.",
  }),
  defineSchema("factions", {
    extractionGoal: "Maintain base organizations, groups, agendas, members, resources, influence, and durable faction relationships. Static ingest writes stable, source-supported faction material to `wiki/factions/`; runtime agents should write temporary stance, resource, pressure, or current-move changes to `wiki/factions/runtime/` overlays. After character, event, and relationship extraction, do a secondary scan for repeatedly mentioned or plot-relevant families, institutions, and factions.",
    fields: [
      { name: "identity", description: "Faction name, type, role, and influence scope." },
      { name: "agenda", description: "Core goals, operating principles, durable agendas, and internal conflicts. Temporary current actions belong in the matching runtime/ overlay." },
      { name: "members", description: "Important members and their organizational role." },
      { name: "resources", description: "Assets, territories, influence, and capabilities." },
      { name: "relationships", description: "Allies, enemies, and attitude toward the player." },
    ],
    exclude: ["Complete personal details for individual members", "Generic world facts", "Unconfirmed faction plans as events", "Runtime-only faction stance, resource, or current-action changes that should be written to wiki/factions/runtime/ overlay pages"],
    updateStrategy: "merge",
    recommendedGranularity: "One base page per major organization, group, family, institution, army, cult, or faction. If a core faction is identifiable but source coverage is thin, a short stub with an explicit limited-source or to-be-expanded note is acceptable. Static ingest should update the base page; runtime/current campaign state should be placed in the matching `wiki/factions/runtime/` overlay.",
  }),
  defineSchema("items", {
    extractionGoal: "Track important base equipment, clues, key objects, capabilities, history, constraints, and plot function. Static ingest writes stable, source-supported item material to `wiki/items/`; runtime agents should write temporary holder, location, condition, consumption, loss, or damage changes to `wiki/items/runtime/` overlays.",
    fields: [
      { name: "identity", description: "Item name, type, appearance, and source." },
      { name: "function", description: "Capabilities, use conditions, side effects, and plot role." },
      { name: "state", description: "Stable/source-established ownership or condition when supported by ingest material. Runtime holder, location, condition, consumption, loss, or damage belongs in the matching runtime/ overlay." },
      { name: "history", description: "Past ownership and links to characters, locations, factions, or events." },
      { name: "hooks", description: "Follow-up scenes or conflicts the item can trigger." },
    ],
    exclude: ["Complete character ability sheets", "Ordinary inventory chatter unless state-changing", "Unrelated prop descriptions", "Runtime-only holder, condition, consumption, loss, or damage changes that should be written to wiki/items/runtime/ overlay pages"],
    updateStrategy: "merge",
    recommendedGranularity: "One base page per important item; ordinary items may be grouped into inventory pages. Static ingest should update the base page; runtime/current campaign state should be placed in the matching `wiki/items/runtime/` overlay.",
  }),
  defineSchema("plot-arcs", {
    extractionGoal: "Maintain story structure, unresolved questions, conflicts, foreshadowing, constraints, and possible development. Multi-event routes, storyline overviews, and long-span timelines belong here unless they are deliberately split into discrete events.",
    fields: [
      { name: "arcName", description: "Name and type of the plot line." },
      { name: "stage", description: "Current narrative stage and already established key nodes." },
      { name: "openQuestions", description: "Unresolved mysteries, foreshadowing, and pending conflicts." },
      { name: "dependencies", description: "Key characters, locations, items, factions, and conditions needed to advance." },
      { name: "constraints", description: "Narrative constraints and recommended next developments." },
    ],
    exclude: ["Every happened event detail", "Confirmed timeline facts without plot relevance", "Future suggestions written as if already happened"],
    updateStrategy: "merge",
    recommendedGranularity: "One page per important main arc, side arc, route, relationship arc, mystery, conflict, or other multi-event narrative structure.",
  }),
  defineSchema("events", {
    extractionGoal: "Record discrete, confirmed events that already happened and their consequences in timeline form.",
    fields: [
      { name: "time", description: "Event time, sequence marker, or approximate timeline position." },
      { name: "place", description: "Where the event happened." },
      { name: "participants", description: "Player and NPC participants and their actions." },
      { name: "summary", description: "Concise summary of what happened." },
      { name: "consequences", description: "State changes, new facts, relationship shifts, and plot impacts caused by the event." },
    ],
    exclude: [
      "Future plot advice",
      "Speculation",
      "Foreshadowing unless recorded as a consequence of a happened event",
      "Route, storyline, timeline, or complete-course pages that span many independent sub-events",
      "Multi-day or multi-year narrative overviews that should be split or stored under plot-arcs",
    ],
    updateStrategy: "append",
    recommendedGranularity: "Use timeline plus one page per discrete happened event. Each event page should include at least a time or relative-time anchor, place, participants, what happened, and consequences/state change. If the material reads like a route, storyline, timeline, or complete course, spans many days or years, or contains 5+ independent sub-events, put it in plot-arcs or split it into multiple events instead of one event page.",
  }),
  defineSchema("current-scene", {
    extractionGoal: "Keep only the latest immediate scene snapshot needed for the next RPG turn. Only generate or update this from explicit live RPG scene input such as current session logs, post-player-action latest state, GM or user-declared current scene, or opening-scene initialization.",
    fields: [
      { name: "time", description: "Current in-world time or immediate sequence marker." },
      { name: "place", description: "Current location and scene frame." },
      { name: "participants", description: "Characters present, positions, bodies, emotions, and immediate intent." },
      { name: "immediateAction", description: "What is happening now, including the latest player action and NPC response." },
      { name: "nextTurnContext", description: "Atmosphere, dangers, interactive objects, visible clues, narrative focus, and required continuation." },
    ],
    exclude: [
      "Long-term world lore",
      "Complete character profiles",
      "Full event history",
      "Accumulated previous scene snapshots",
      "Encyclopedia entries, ending summaries, character biographies, or world-setting explainers treated as if they were the live current scene",
      "Route summaries, flower-viewing ending scenes, or years-later epilogues written into current-scene",
    ],
    updateStrategy: "overwrite",
    recommendedGranularity: "First version should use the exact single scene snapshot file current-scene/scene_state.md; do not invent alternate current-scene filenames. If the source is static lore or summary material, route ending/epilogue snapshots to events, plot-arcs, or character state pages instead of current-scene.",
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
