import { RPG_CATEGORIES, type RpgCategory, type RpgCategoryId, getRpgCategoryById } from "./rpg-categories"

export type RpgWikiUpdateStrategy = "append" | "cautious-merge" | "merge" | "overwrite"
export type RpgSchemaSlotOwner = "source_ingest" | "control_doc" | "campaign_setup" | "runtime"
export type RpgSchemaSlotRuntimePriority = "critical" | "high" | "normal" | "reference"
export type RpgSchemaSlotImportPolicy =
  | "ordinary_ingest"
  | "controlled_canonicalize"
  | "campaign_bootstrap"
  | "runtime_apply"
export type RpgSchemaSlotWritePolicy = "manual_or_review_only" | "merge" | "append" | "overwrite"

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

export interface RpgSchemaSlot {
  slotId: string
  path: string
  owner: RpgSchemaSlotOwner
  requiredForNewProject: boolean
  runtimePriority: RpgSchemaSlotRuntimePriority
  importPolicy: RpgSchemaSlotImportPolicy
  writePolicy: RpgSchemaSlotWritePolicy
}

export type RpgDirectoryBoundaryId =
  | "player_goals"
  | "quests"
  | "plot_arcs"
  | "rules"
  | "world"
  | "style"
  | "characters"
  | "relationships"
  | "items"
  | "player_inventory"

export interface RpgDirectoryBoundaryGuidance {
  boundaryId: RpgDirectoryBoundaryId
  paths: readonly string[]
  include: readonly string[]
  exclude: readonly string[]
  recommendedGranularity: string
}

export interface RpgRuntimeCrossDirectorySyncGuidance {
  syncId: string
  trigger: string
  requiredTargets: readonly string[]
  guidance: readonly string[]
}

export type RpgSourceIngestOtherMode =
  | "control_doc_import"
  | "campaign_setup_import"
  | "runtime_update_apply"
  | "review_only"

export interface RpgSourceIngestForbiddenTarget {
  pathPattern: string
  reason: string
  recommendedMode: RpgSourceIngestOtherMode
}

export interface RpgSourceIngestTargetPolicy {
  ordinaryTargets: readonly string[]
  structuralTargets: readonly string[]
  forbiddenTargets: readonly RpgSourceIngestForbiddenTarget[]
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
    extractionGoal: "Runtime-owned latest immediate scene snapshot needed for the next RPG turn. Ordinary source ingest must not generate or update this category; it is maintained only by the RPG Play/Runtime apply flow.",
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
    recommendedGranularity: "The runtime apply path uses the exact single scene snapshot file current-scene/scene_state.md. Ordinary ingest must route source-described scenes, endings, epilogues, and summaries to events, plot-arcs, locations, characters, relationships, player, world, or sources instead of current-scene.",
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

export const RPG_SCHEMA_SLOTS = [
  {
    slotId: "main_outline",
    path: "wiki/outlines/main.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "outline_progress",
    path: "wiki/outlines/progress.md",
    owner: "runtime",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "runtime_apply",
    writePolicy: "merge",
  },
  {
    slotId: "rules_core",
    path: "wiki/rules/core.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "critical",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "rules_world",
    path: "wiki/rules/world.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "rules_table",
    path: "wiki/rules/table.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "style_narration",
    path: "wiki/style/narration.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "style_dialogue",
    path: "wiki/style/dialogue.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "style_forbidden",
    path: "wiki/style/forbidden.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "critical",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "memory_long_term",
    path: "wiki/memory/long-term.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "normal",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "memory_session_notes",
    path: "wiki/memory/session-notes.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "reference",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "memory_player_preferences",
    path: "wiki/memory/player-preferences.md",
    owner: "control_doc",
    requiredForNewProject: true,
    runtimePriority: "critical",
    importPolicy: "controlled_canonicalize",
    writePolicy: "manual_or_review_only",
  },
  {
    slotId: "current_scene",
    path: "wiki/current-scene/scene_state.md",
    owner: "runtime",
    requiredForNewProject: true,
    runtimePriority: "critical",
    importPolicy: "runtime_apply",
    writePolicy: "overwrite",
  },
  {
    slotId: "player_main",
    path: "wiki/player/player.md",
    owner: "campaign_setup",
    requiredForNewProject: true,
    runtimePriority: "critical",
    importPolicy: "campaign_bootstrap",
    writePolicy: "merge",
  },
  {
    slotId: "player_abilities",
    path: "wiki/player/abilities.md",
    owner: "campaign_setup",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "campaign_bootstrap",
    writePolicy: "merge",
  },
  {
    slotId: "player_inventory",
    path: "wiki/player/inventory.md",
    owner: "campaign_setup",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "campaign_bootstrap",
    writePolicy: "merge",
  },
  {
    slotId: "player_goals",
    path: "wiki/player/goals.md",
    owner: "campaign_setup",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "campaign_bootstrap",
    writePolicy: "merge",
  },
  {
    slotId: "player_known_information",
    path: "wiki/player/known_information.md",
    owner: "campaign_setup",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "campaign_bootstrap",
    writePolicy: "merge",
  },
] as const satisfies readonly RpgSchemaSlot[]

export const RPG_DIRECTORY_BOUNDARY_GUIDANCE = [
  {
    boundaryId: "player_goals",
    paths: ["wiki/player/goals.md"],
    include: ["PC subjective goals, wishes, promises, commitments, personal motives, and changing subjective priorities."],
    exclude: [
      "Quest progress tables, blockers, completion/failure conditions, and objective status tracking.",
      "Plot pressure, unresolved story conflict, foreshadowing, author/GM intent, and dramatic pacing pressure.",
    ],
    recommendedGranularity: "One fixed player slot page for the current PC's subjective motivations; merge updates into wiki/player/goals.md.",
  },
  {
    boundaryId: "quests",
    paths: ["wiki/quests/*.md"],
    include: ["Game-recognized, trackable objectives with objective, blockers/progress, and completion or failure conditions."],
    exclude: [
      "Purely subjective wishes or private motives without an explicit game-recognized task frame.",
      "Story themes, author intent, foreshadowing structures, plot pressure, or ordinary player TODO/checklists.",
    ],
    recommendedGranularity: "One page per active quest/objective only when the source or runtime state makes it trackable.",
  },
  {
    boundaryId: "plot_arcs",
    paths: ["wiki/plot-arcs/*.md", "wiki/plot-arcs/runtime/*.md"],
    include: ["Story pressure, unresolved conflicts, foreshadowing, reveal pacing, progression conditions, and possible developments."],
    exclude: [
      "Player TODO/checklists or quest progress ledgers.",
      "Confirmed happened events presented as current facts without linking to events, or possible futures written as already happened.",
    ],
    recommendedGranularity: "One page per important plot arc, conflict, mystery, or pressure structure; runtime changes belong under plot-arcs/runtime/.",
  },
  {
    boundaryId: "rules",
    paths: ["wiki/rules/core.md", "wiki/rules/world.md", "wiki/rules/table.md", "wiki/rules/*.md"],
    include: ["Executable mechanics, limits, resource costs, checks, allowed/disallowed actions, success/failure boundaries, and hard constraints."],
    exclude: ["Stable background prose, public history, culture, geography, social description, or common knowledge that does not define how actions work."],
    recommendedGranularity: "Use the fixed rules slots for control material; split by mechanism only when an explicit control import or manual edit calls for it.",
  },
  {
    boundaryId: "world",
    paths: ["wiki/world/*.md"],
    include: ["Background, common knowledge, history, society, culture, geography, public perception, and stable setting facts."],
    exclude: ["Executable mechanics, checks, resource costs, hard action limits, or success/failure boundaries that belong in rules/."],
    recommendedGranularity: "One page per stable setting topic such as overview, history, common sense, social structure, or geography.",
  },
  {
    boundaryId: "style",
    paths: ["wiki/style/narration.md", "wiki/style/dialogue.md", "wiki/style/forbidden.md", "wiki/style/*.md"],
    include: ["Global narration, dialogue, formatting, pacing, forbidden-pattern, and style rules that apply across the whole campaign."],
    exclude: [
      "Character-specific voice, catchphrases, address habits, politeness level, avoided topics, or relationship-driven tone changes.",
      "Single-character speech texture promoted into a global writing rule.",
    ],
    recommendedGranularity: "Use the fixed style slots for global writing control; keep character voice in characters/ or relationships/.",
  },
  {
    boundaryId: "characters",
    paths: ["wiki/characters/*.md", "wiki/characters/runtime/*.md"],
    include: ["Stable character identity, behavior patterns, ability limits, usual interaction rules, and character-specific voice."],
    exclude: [
      "Full relationship histories or pair-specific relationship-state changes.",
      "A stage-specific change in one relationship rewritten as permanent character personality.",
    ],
    recommendedGranularity: "One base page per character operating model; campaign-only changes belong in the matching characters/runtime/ overlay.",
  },
  {
    boundaryId: "relationships",
    paths: ["wiki/relationships/*.md", "wiki/relationships/runtime/*.md"],
    include: ["Stable relationship model, tension, trust/hostility, dependency, misunderstandings, secrets, and interaction changes between parties."],
    exclude: ["Duplicate complete character profiles, appearance sheets, ability lists, or general biography material."],
    recommendedGranularity: "One page per important pair or relationship group; runtime relationship changes belong under relationships/runtime/.",
  },
  {
    boundaryId: "items",
    paths: ["wiki/items/*.md", "wiki/items/runtime/*.md"],
    include: ["Item definitions, functions, costs, limits, source/history, plot role, usual holder, and object-level campaign state."],
    exclude: ["The player's current quantity, equipped/backpack status, consumption count, or personal inventory ledger."],
    recommendedGranularity: "One page per important object; campaign-only object-state changes belong in the matching items/runtime/ overlay.",
  },
  {
    boundaryId: "player_inventory",
    paths: ["wiki/player/inventory.md"],
    include: ["Player current holdings, quantity, equipped/backpack location, consumed/damaged state, and inventory availability."],
    exclude: ["Full item definitions, item lore, general functionality, source/history, or plot role that should live in items/."],
    recommendedGranularity: "One fixed player slot page for current PC possessions; item definitions remain in items/.",
  },
] as const satisfies readonly RpgDirectoryBoundaryGuidance[]

export const RPG_RUNTIME_CROSS_DIRECTORY_SYNC_GUIDANCE = [
  {
    syncId: "current_scene_snapshot_not_history",
    trigger: "Runtime Update Apply writes wiki/current-scene/scene_state.md.",
    requiredTargets: ["wiki/current-scene/scene_state.md"],
    guidance: [
      "current-scene is an overwrite-only latest-moment snapshot for the next turn, not an accumulated store of long-term state.",
      "If current-scene mentions visible long-term changes, the same proposal batch should include the matching runtime overlay or dynamic directory update.",
    ],
  },
  {
    syncId: "current_scene_long_term_overlay_targets",
    trigger: "A current-scene snapshot contains persistent NPC, location, faction, item, relationship, plot-arc, or outline-progress changes.",
    requiredTargets: [
      "wiki/characters/runtime/*.md",
      "wiki/locations/runtime/*.md",
      "wiki/factions/runtime/*.md",
      "wiki/items/runtime/*.md",
      "wiki/relationships/runtime/*.md",
      "wiki/plot-arcs/runtime/*.md",
      "wiki/outlines/progress.md",
    ],
    guidance: [
      "NPC injuries, conditions, loyalty, location, or other ongoing state changes belong in characters/runtime/*.md.",
      "Location damage, locks, blocked routes, alarms, alertness, or access changes belong in locations/runtime/*.md.",
      "Faction stance, resources, alert level, pressure, or current moves belong in factions/runtime/*.md.",
      "Relationship trust, tension, conflict, reconciliation, secrets, or misunderstandings belong in relationships/runtime/*.md.",
      "Plot arc runtime state, triggered/skipped/delayed/advanced beats, pressure changes, and resolved/unresolved arc state belong in plot-arcs/runtime/*.md.",
      "Outline-relative play progress, completed/skipped/advanced/delayed beats, act progress, and deviations may update outlines/progress.md through pending/review merge.",
    ],
  },
  {
    syncId: "inventory_and_item_runtime_split",
    trigger: "Runtime changes player holdings or object-level item state.",
    requiredTargets: ["wiki/player/inventory.md", "wiki/items/runtime/*.md"],
    guidance: [
      "Player holdings, quantities, equipped/backpack status, acquisition, loss, and consumption belong in wiki/player/inventory.md.",
      "Object-level item state such as holder transfer, damage, sealing, temporary enhancement, depletion, or condition belongs in wiki/items/runtime/*.md.",
      "If one update changes both player possession and the object itself, propose both inventory and item runtime updates in the same batch.",
    ],
  },
  {
    syncId: "runtime_only_relationships_and_plot_arcs",
    trigger: "Runtime Update Apply wants to record relationship or plot-arc changes from play.",
    requiredTargets: ["wiki/relationships/runtime/*.md", "wiki/plot-arcs/runtime/*.md"],
    guidance: [
      "Runtime relationship changes must target relationships/runtime/*.md; base wiki/relationships/*.md are stable/base pages and are not runtime write targets.",
      "Runtime plot arc changes must target plot-arcs/runtime/*.md; base wiki/plot-arcs/*.md are stable/base pages and are not runtime write targets.",
      "Runtime update must not write outlines/main.md, style, rules, sources, world, memory, or base entity pages.",
    ],
  },
] as const satisfies readonly RpgRuntimeCrossDirectorySyncGuidance[]

export const RPG_SOURCE_INGEST_TARGET_POLICY = {
  ordinaryTargets: [
    "wiki/sources/",
    "wiki/world/",
    "wiki/characters/",
    "wiki/player/player.md",
    "wiki/player/abilities.md",
    "wiki/player/inventory.md",
    "wiki/player/goals.md",
    "wiki/player/known_information.md",
    "wiki/locations/",
    "wiki/factions/",
    "wiki/items/",
    "wiki/plot-arcs/",
    "wiki/events/",
    "wiki/relationships/",
  ],
  structuralTargets: [
    "wiki/index.md",
    "wiki/overview.md",
    "wiki/log.md",
  ],
  forbiddenTargets: [
    {
      pathPattern: "wiki/rules/**",
      reason: "rules/control material belongs to the control document import boundary, not ordinary source ingest.",
      recommendedMode: "control_doc_import",
    },
    {
      pathPattern: "wiki/style/**",
      reason: "global narration/dialogue/forbidden style rules are control documents; character voice should stay in characters or relationships.",
      recommendedMode: "control_doc_import",
    },
    {
      pathPattern: "wiki/memory/**",
      reason: "context memory is a controlled Context Compiler helper layer and should not be filled by lossy source ingest.",
      recommendedMode: "control_doc_import",
    },
    {
      pathPattern: "wiki/outlines/**",
      reason: "outlines are author/GM control material or runtime outline progress, not ordinary source pages.",
      recommendedMode: "control_doc_import",
    },
    {
      pathPattern: "wiki/current-scene/**",
      reason: "current-scene is a runtime-owned latest-moment snapshot or campaign bootstrap target.",
      recommendedMode: "runtime_update_apply",
    },
    {
      pathPattern: "wiki/*/runtime/**",
      reason: "runtime overlays are owned by completed-turn state apply flows, not ordinary source ingest.",
      recommendedMode: "runtime_update_apply",
    },
    {
      pathPattern: "wiki/quests/**",
      reason: "quests are review-only for source ingest until a dedicated campaign/runtime quest flow owns them.",
      recommendedMode: "review_only",
    },
  ],
} as const satisfies RpgSourceIngestTargetPolicy

export const RPG_FIXED_PLAYER_SLOT_PATHS = RPG_SCHEMA_SLOTS
  .filter((slot) => slot.slotId.startsWith("player_"))
  .map((slot) => slot.path)

export type RpgSchemaSlotId = (typeof RPG_SCHEMA_SLOTS)[number]["slotId"]

export type RpgWikiSchemaCategoryId = (typeof RPG_WIKI_SCHEMA)[number]["categoryId"]

export function getRpgWikiSchemaEntry(categoryId: string): RpgWikiSchemaEntry | undefined {
  return RPG_WIKI_SCHEMA.find((entry) => entry.categoryId === categoryId)
}

export function getRpgSchemaSlot(slotId: string): RpgSchemaSlot | undefined {
  return RPG_SCHEMA_SLOTS.find((slot) => slot.slotId === slotId)
}

export function getRpgSchemaSlotByPath(path: string): RpgSchemaSlot | undefined {
  const normalized = normalizeRpgSlotPath(path)
  return RPG_SCHEMA_SLOTS.find((slot) => {
    const slotPath = normalizeRpgSlotPath(slot.path)
    return normalized === slotPath || normalized.endsWith(`/${slotPath}`)
  })
}

export function getRequiredRpgSchemaSlots(): RpgSchemaSlot[] {
  return RPG_SCHEMA_SLOTS.filter((slot) => slot.requiredForNewProject)
}

export function getRpgSchemaSlotsByOwner(owner: RpgSchemaSlotOwner): RpgSchemaSlot[] {
  return RPG_SCHEMA_SLOTS.filter((slot) => slot.owner === owner)
}

export function getRpgDirectoryBoundaryGuidance(
  boundaryId: string,
): RpgDirectoryBoundaryGuidance | undefined {
  return RPG_DIRECTORY_BOUNDARY_GUIDANCE.find((guidance) => guidance.boundaryId === boundaryId)
}

export function getRpgRuntimeCrossDirectorySyncGuidance(): readonly RpgRuntimeCrossDirectorySyncGuidance[] {
  return RPG_RUNTIME_CROSS_DIRECTORY_SYNC_GUIDANCE
}

export function getRpgSourceIngestTargetPolicy(): RpgSourceIngestTargetPolicy {
  return RPG_SOURCE_INGEST_TARGET_POLICY
}

export function getRpgSourceIngestForbiddenTarget(
  path: string,
): RpgSourceIngestForbiddenTarget | undefined {
  const normalized = normalizeRpgSlotPath(path)
  return RPG_SOURCE_INGEST_TARGET_POLICY.forbiddenTargets.find((target) =>
    sourceIngestPathPatternMatches(normalized, target.pathPattern),
  )
}

export function isRpgSourceIngestAllowedTarget(path: string): boolean {
  const normalized = normalizeRpgSlotPath(path)
  if (getRpgSourceIngestForbiddenTarget(normalized)) return false
  return RPG_SOURCE_INGEST_TARGET_POLICY.structuralTargets.some((target) => normalized === target)
    || RPG_SOURCE_INGEST_TARGET_POLICY.ordinaryTargets.some((target) => {
      const normalizedTarget = normalizeRpgSlotPath(target)
      return normalizedTarget.endsWith("/")
        ? normalized.startsWith(normalizedTarget)
        : normalized === normalizedTarget
    })
}

export function isFixedPlayerSlotPath(path: string): boolean {
  const normalized = normalizeRpgSlotPath(path)
  return RPG_FIXED_PLAYER_SLOT_PATHS.some((slotPath) => {
    const normalizedSlotPath = normalizeRpgSlotPath(slotPath)
    return normalized === normalizedSlotPath || normalized.endsWith(`/${normalizedSlotPath}`)
  })
}

export function rpgSchemaCategoryIdsMatchRegistry(): boolean {
  const schemaIds = RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)
  const categoryIds = RPG_CATEGORIES.map((entry) => entry.id)
  return schemaIds.length === categoryIds.length && schemaIds.every((id, index) => id === categoryIds[index])
}

function normalizeRpgSlotPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/").toLowerCase()
}

function sourceIngestPathPatternMatches(path: string, pattern: string): boolean {
  const normalizedPattern = normalizeRpgSlotPath(pattern)
  if (normalizedPattern === "wiki/*/runtime/**") {
    return /^wiki\/[^/]+\/runtime\//.test(path)
  }
  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -2)
    return path.startsWith(prefix)
  }
  return path === normalizedPattern
}
