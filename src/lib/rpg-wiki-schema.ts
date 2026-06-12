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

export type RpgNarrativeLine = "playerVisibleLine" | "parallelLine" | "tensionLine"
export type RpgUsePurpose =
  | "actionResolution"
  | "worldTick"
  | "recall"
  | "outlineControl"
  | "ruleCheck"
  | "narration"
  | "writeback"
  | "reviewOnly"
  | "journalOnly"
export type RpgVisibilityScope = "pc_visible" | "pc_inferred" | "user_visible_pc_unknown" | "gm_only" | "hidden"
export type RpgKnowledgeScope =
  | "pc_known"
  | "pc_misunderstanding"
  | "npc_known"
  | "user_only"
  | "gm_only"
  | "unknown_to_pc"
export type RpgKnowledgeSourceKind =
  | "seen"
  | "heard"
  | "told"
  | "inferred"
  | "documented"
  | "memory"
  | "parallel_line"
  | "misread"
  | "unknown"
export type RpgHappenedStatus =
  | "attempted_not_confirmed"
  | "confirmed_happened"
  | "ongoing"
  | "blocked"
  | "failed"
  | "possible_future"
  | "intention_only"
  | "misunderstanding"
export type RpgRuntimeDeltaSourceStage =
  | "actionResolution"
  | "worldTick"
  | "recallSelection"
  | "outlineBrief"
  | "outlineRegeneration"
  | "turnNarration"
  | "consistencyValidation"
export type RpgGapImpactCandidate = "none" | "minor" | "branch" | "major"
export type RpgOutlineImpactLevel = "none" | "minor" | "branch" | "major_rewrite_required"
export type RpgReviewItemKind = "runtimeWikiUpdate" | "outlineRevision" | "manualControlChange"
export type RpgRecallReadMode = "summary" | "focusedSection" | "fullPage" | "metadataOnly"

export interface RpgRuntimeDeltaRef {
  deltaId: string
  sourceStage: RpgRuntimeDeltaSourceStage
  sourcePath: string
  summary: string
  narrativeLine: RpgNarrativeLine
  usePurpose: RpgUsePurpose
  happenedStatus: RpgHappenedStatus
}

export interface RpgRecallableSection {
  sectionId: string
  sectionRole: string
  heading: string
  aliases: readonly string[]
  readModes: readonly RpgRecallReadMode[]
  visibilityScope: RpgVisibilityScope
  knowledgeScope?: RpgKnowledgeScope
}

export interface RpgRuntimeSharedSchemaGuidance {
  narrativeLines: readonly RpgNarrativeLine[]
  usePurposes: readonly RpgUsePurpose[]
  visibilityScopes: readonly RpgVisibilityScope[]
  knowledgeScopes: readonly RpgKnowledgeScope[]
  knowledgeSourceKinds: readonly RpgKnowledgeSourceKind[]
  happenedStatuses: readonly RpgHappenedStatus[]
  deltaSourceStages: readonly RpgRuntimeDeltaSourceStage[]
  gapImpactCandidates: readonly RpgGapImpactCandidate[]
  outlineImpactLevels: readonly RpgOutlineImpactLevel[]
  reviewItemKinds: readonly RpgReviewItemKind[]
  guidance: readonly string[]
}

export interface RpgActionResolverSlotSemantic {
  path: string
  role: string
  requiredSemantics: readonly string[]
  exclude: readonly string[]
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

export interface RpgOutlineBriefCompilerGuidance {
  guidance: readonly string[]
  impactRubric: readonly RpgWikiFieldDefinition[]
  briefBoundaryFields: readonly RpgWikiFieldDefinition[]
  stableRefFields: readonly RpgWikiFieldDefinition[]
  tensionFuelFields: readonly RpgWikiFieldDefinition[]
}

export interface RpgStoryOutlineRegeneratorSchemaGuidance {
  provisionalOutlinePatch: readonly RpgWikiFieldDefinition[]
  outlineRevisionProposal: readonly RpgWikiFieldDefinition[]
  outlineRevisionReviewPolicy: readonly string[]
  regenerationSafetyFields: readonly RpgWikiFieldDefinition[]
}

export interface RpgNarrationOutputSchemaGuidance {
  outputFields: readonly RpgWikiFieldDefinition[]
  tensionBriefFields: readonly RpgWikiFieldDefinition[]
  narrationMetaFields: readonly RpgWikiFieldDefinition[]
  actionOptionRuntimeFields: readonly RpgWikiFieldDefinition[]
  knowledgeBoundaryPolicy: readonly string[]
  styleHandoffPolicy: readonly string[]
}

export interface RpgRuntimeUpdateProposalSchemaGuidance {
  inputSchema: readonly RpgWikiFieldDefinition[]
  resultSchema: readonly RpgWikiFieldDefinition[]
  proposedWikiUpdateRuntimeFields: readonly RpgWikiFieldDefinition[]
  sourceDeltaFields: readonly RpgWikiFieldDefinition[]
  skippedRuntimeDeltaFields: readonly RpgWikiFieldDefinition[]
  pacingUpdateProposalFields: readonly RpgWikiFieldDefinition[]
  proposalGroupFields: readonly RpgWikiFieldDefinition[]
  outlineRevisionReviewItemSchema: readonly RpgWikiFieldDefinition[]
  guidance: readonly string[]
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
    extractionGoal: "Capture stable or slowly changing setting facts about what the world is like in the five fixed world slots only. Ordinary source ingest must merge world material into wiki/world/basic_overview.md, wiki/world/history.md, wiki/world/common_sense.md, wiki/world/supernatural_presence.md, or wiki/world/social_structure.md; it must not create arbitrary wiki/world/*.md pages.",
    fields: [
      { name: "basicOverview", description: "wiki/world/basic_overview.md. Core premise, era, primary stage, genre, atmosphere, and broad world background." },
      { name: "history", description: "wiki/world/history.md. Established world history, public past events, eras, and historical background; not current campaign events." },
      { name: "commonSense", description: "wiki/world/common_sense.md. Ordinary public knowledge, daily assumptions, customs, taboos, common beliefs, and what typical inhabitants know." },
      { name: "supernaturalPresence", description: "wiki/world/supernatural_presence.md. How magic, technology, monsters, anomalies, mysteries, or other supernatural/extraordinary elements visibly exist in the setting; executable mechanics belong in rules/." },
      { name: "socialStructure", description: "wiki/world/social_structure.md. Social order, institutions as background, class, law, economy, public power structure, and broad cultural organization; specific organizations belong in factions/." },
    ],
    exclude: [
      "Specific combat mechanics",
      "Character personal state",
      "Ability numbers or player stats",
      "Arbitrary new wiki/world/*.md pages outside the fixed world slot set",
    ],
    updateStrategy: "cautious-merge",
    recommendedGranularity: "Use exactly these fixed world slots: wiki/world/basic_overview.md, wiki/world/history.md, wiki/world/common_sense.md, wiki/world/supernatural_presence.md, and wiki/world/social_structure.md. Extra world subtopics must merge into the nearest fixed slot or be routed to rules/, locations/, factions/, plot-arcs/, or sources/.",
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
    slotId: "world_basic_overview",
    path: "wiki/world/basic_overview.md",
    owner: "source_ingest",
    requiredForNewProject: true,
    runtimePriority: "high",
    importPolicy: "ordinary_ingest",
    writePolicy: "merge",
  },
  {
    slotId: "world_history",
    path: "wiki/world/history.md",
    owner: "source_ingest",
    requiredForNewProject: true,
    runtimePriority: "normal",
    importPolicy: "ordinary_ingest",
    writePolicy: "merge",
  },
  {
    slotId: "world_common_sense",
    path: "wiki/world/common_sense.md",
    owner: "source_ingest",
    requiredForNewProject: true,
    runtimePriority: "normal",
    importPolicy: "ordinary_ingest",
    writePolicy: "merge",
  },
  {
    slotId: "world_supernatural_presence",
    path: "wiki/world/supernatural_presence.md",
    owner: "source_ingest",
    requiredForNewProject: true,
    runtimePriority: "normal",
    importPolicy: "ordinary_ingest",
    writePolicy: "merge",
  },
  {
    slotId: "world_social_structure",
    path: "wiki/world/social_structure.md",
    owner: "source_ingest",
    requiredForNewProject: true,
    runtimePriority: "normal",
    importPolicy: "ordinary_ingest",
    writePolicy: "merge",
  },
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
    paths: [
      "wiki/world/basic_overview.md",
      "wiki/world/history.md",
      "wiki/world/common_sense.md",
      "wiki/world/supernatural_presence.md",
      "wiki/world/social_structure.md",
    ],
    include: ["Background, common knowledge, history, society, culture, geography, public perception, supernatural presence, social structure, and stable setting facts."],
    exclude: ["Executable mechanics, checks, resource costs, hard action limits, or success/failure boundaries that belong in rules/."],
    recommendedGranularity: "Use the five fixed world slots only; do not create arbitrary wiki/world/*.md pages.",
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

const RPG_RUNTIME_NARRATIVE_LINES = [
  "playerVisibleLine",
  "parallelLine",
  "tensionLine",
] as const satisfies readonly RpgNarrativeLine[]

const RPG_RUNTIME_USE_PURPOSES = [
  "actionResolution",
  "worldTick",
  "recall",
  "outlineControl",
  "ruleCheck",
  "narration",
  "writeback",
  "reviewOnly",
  "journalOnly",
] as const satisfies readonly RpgUsePurpose[]

const RPG_RUNTIME_VISIBILITY_SCOPES = [
  "pc_visible",
  "pc_inferred",
  "user_visible_pc_unknown",
  "gm_only",
  "hidden",
] as const satisfies readonly RpgVisibilityScope[]

const RPG_RUNTIME_KNOWLEDGE_SCOPES = [
  "pc_known",
  "pc_misunderstanding",
  "npc_known",
  "user_only",
  "gm_only",
  "unknown_to_pc",
] as const satisfies readonly RpgKnowledgeScope[]

const RPG_RUNTIME_KNOWLEDGE_SOURCE_KINDS = [
  "seen",
  "heard",
  "told",
  "inferred",
  "documented",
  "memory",
  "parallel_line",
  "misread",
  "unknown",
] as const satisfies readonly RpgKnowledgeSourceKind[]

const RPG_RUNTIME_HAPPENED_STATUSES = [
  "attempted_not_confirmed",
  "confirmed_happened",
  "ongoing",
  "blocked",
  "failed",
  "possible_future",
  "intention_only",
  "misunderstanding",
] as const satisfies readonly RpgHappenedStatus[]

const RPG_RUNTIME_DELTA_SOURCE_STAGES = [
  "actionResolution",
  "worldTick",
  "recallSelection",
  "outlineBrief",
  "outlineRegeneration",
  "turnNarration",
  "consistencyValidation",
] as const satisfies readonly RpgRuntimeDeltaSourceStage[]

const RPG_GAP_IMPACT_CANDIDATES = [
  "none",
  "minor",
  "branch",
  "major",
] as const satisfies readonly RpgGapImpactCandidate[]

export const RPG_OUTLINE_IMPACT_LEVELS = [
  "none",
  "minor",
  "branch",
  "major_rewrite_required",
] as const satisfies readonly RpgOutlineImpactLevel[]

const RPG_REVIEW_ITEM_KINDS = [
  "runtimeWikiUpdate",
  "outlineRevision",
  "manualControlChange",
] as const satisfies readonly RpgReviewItemKind[]

export const RPG_RUNTIME_PERSISTENCE_BOUNDARY_GUIDANCE = [
  "`runtime/` is not an ordinary extractable RPG wiki category and must not be added to RPG_CATEGORIES or RPG_WIKI_SCHEMA.",
  "Per-turn intermediate products belong in the turn record, runtime journal, or `.llm-wiki/runtime/` pending runtime metadata boundary, not in `wiki/runtime/`.",
  "`wiki/` stores only accepted and reviewable persistent facts, current snapshots, runtime overlays, and control-layer progress after proposal / pending / review / apply.",
  "`events/` receives only `confirmed_happened` facts and their direct consequences; attempts, possible futures, and unselected options remain in runtime records, review notes, overlays, or skipped deltas.",
  "`player/known_information.md` receives only `pc_known` and `pc_misunderstanding` knowledge; parallel-line, GM-only, and user-visible-but-PC-unknown information must not automatically become PC knowledge.",
] as const

export const RPG_RUNTIME_SHARED_SCHEMA_GUIDANCE = {
  narrativeLines: RPG_RUNTIME_NARRATIVE_LINES,
  usePurposes: RPG_RUNTIME_USE_PURPOSES,
  visibilityScopes: RPG_RUNTIME_VISIBILITY_SCOPES,
  knowledgeScopes: RPG_RUNTIME_KNOWLEDGE_SCOPES,
  knowledgeSourceKinds: RPG_RUNTIME_KNOWLEDGE_SOURCE_KINDS,
  happenedStatuses: RPG_RUNTIME_HAPPENED_STATUSES,
  deltaSourceStages: RPG_RUNTIME_DELTA_SOURCE_STAGES,
  gapImpactCandidates: RPG_GAP_IMPACT_CANDIDATES,
  outlineImpactLevels: RPG_OUTLINE_IMPACT_LEVELS,
  reviewItemKinds: RPG_REVIEW_ITEM_KINDS,
  guidance: [
    "Keep NarrativeLine separate from UsePurpose so outlineControl, ruleCheck, recall, narration, and writeback do not masquerade as story lines.",
    "Use VisibilityScope, KnowledgeScope, and KnowledgeSourceKind together whenever runtime output may affect player knowledge or offscreen visibility.",
    "Treat HappenedStatus as the event writeback gate; only confirmed_happened can create events/ facts.",
    "Attach RuntimeDeltaRef to reusable runtime changes so later writeback can trace structured deltas instead of reverse-engineering facts from prose.",
    "Recallable runtime-facing wiki sections must expose stable sectionId, sectionRole, readModes, and visibility metadata; headings are display labels or aliases only.",
    "World Tick consumes ActionResolution.playerActionDelta as the canonical player-action-only delta and must not re-adjudicate player success from directResults.",
  ],
} as const satisfies RpgRuntimeSharedSchemaGuidance

export const RPG_RUNTIME_VISIBILITY_FIELDS = [
  { name: "visibilityScope", description: "RpgVisibilityScope such as pc_visible, user_visible_pc_unknown, gm_only, or hidden." },
  { name: "knowledgeScope", description: "RpgKnowledgeScope such as pc_known, pc_misunderstanding, user_only, gm_only, or unknown_to_pc." },
  { name: "knowledgeSourceKind", description: "How the knowledge was obtained: seen, heard, told, inferred, documented, memory, parallel_line, misread, or unknown." },
  { name: "knownBy", description: "Explicit actor ids or role ids that know the information; do not infer universal knowledge from user-visible narration." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_RUNTIME_DELTA_REF_FIELDS = [
  { name: "deltaId", description: "Stable id for the runtime delta within the turn record or journal." },
  { name: "sourceStage", description: "Stage that produced the delta: actionResolution, worldTick, recallSelection, outlineBrief, outlineRegeneration, turnNarration, or consistencyValidation." },
  { name: "sourcePath", description: "Path or record pointer for the turn record, journal entry, `.llm-wiki/runtime/` metadata, or wiki source that supports this delta." },
  { name: "summary", description: "Brief human-readable summary of the runtime change." },
  { name: "narrativeLine", description: "Narrative line affected by the delta: playerVisibleLine, parallelLine, or tensionLine." },
  { name: "usePurpose", description: "Why the delta is being consumed: actionResolution, worldTick, recall, outlineControl, ruleCheck, narration, writeback, reviewOnly, or journalOnly." },
  { name: "happenedStatus", description: "Whether the delta is attempted_not_confirmed, confirmed_happened, ongoing, blocked, failed, possible_future, intention_only, or misunderstanding." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_RECALLABLE_SECTION_FIELDS = [
  { name: "sectionId", description: "Stable machine id for retrieval, selection, and local reads; do not use mutable markdown headings as the id." },
  { name: "sectionRole", description: "Controlled semantic role such as behaviorRules, currentRuntimeState, activePressure, or branchConditions." },
  { name: "heading", description: "Human-facing markdown heading for display or alias matching only." },
  { name: "aliases", description: "Alternative headings or labels that can resolve to this sectionId." },
  { name: "readModes", description: "Allowed read modes such as summary, focusedSection, fullPage, or metadataOnly." },
  { name: "visibilityMetadata", description: "visibility metadata including visibilityScope, knowledgeScope, knownBy, temporalScope, and authorityLevel." },
  { name: "summaryPolicy", description: "How this section may be compressed or summarized for recall and context compilation." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_CLOCK_STATE_FIELDS = [
  { name: "clockId", description: "Stable id for a countdown, pressure clock, pacing clock, or ongoing timed process." },
  { name: "clockKind", description: "Countdown, pacingDebt, worldClock, relationshipPressure, investigationClock, combatClock, or equivalent controlled kind." },
  { name: "state", description: "Current visible state, progress, threshold, paused/triggered status, and next-turn summary." },
  { name: "narrativeLine", description: "Line that owns or primarily exposes the clock: playerVisibleLine, parallelLine, or tensionLine." },
  { name: "visibilityScope", description: "Who can perceive or use the clock state." },
  { name: "sourceDeltas", description: "RuntimeDeltaRef ids that changed the clock this turn." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_WORLD_TICK_SCHEMA_GUIDANCE = [
  "World Tick consumes ActionResolution and ActionResolution.playerActionDelta directly; playerActionDelta is the canonical player-action-only delta.",
  "World Tick must not re-adjudicate player action success, reinterpret directResults into player facts, write wiki files, create player-facing narration, generate nextActionOptions, run Recall Selector, run Outline Brief, or connect itself to the orchestrator in this contract stage.",
  "World Tick advances only the resolved timeDelta interval: world clocks/countdowns, ongoing events, information broadcasts, NPC reactions, pacing pressure, and preliminary gap signals.",
  "Parallel-line display is not PC knowledge; every world delta, broadcast, reaction, clock update, and gap signal needs visibility, knowledge, happenedStatus, affectedPaths, and RuntimeDeltaRef metadata.",
  "possible_future, intention_only, and attempted_not_confirmed remain non-event statuses and must not be promoted into confirmed events.",
  "current-scene stores only the next-turn clock/countdown/pacing summary; long-lived clock authority belongs in runtime overlays or the corresponding state layer after pending/review/apply.",
  "Gap signal output is World Tick's first-pass screening only; authoritative outline impact remains with the later Outline Impact Detector.",
] as const

export const RPG_WORLD_TICK_VISIBILITY_META_FIELDS = [
  { name: "visibilityScope", description: "Whether the delta is pc_visible, pc_inferred, user_visible_pc_unknown, gm_only, or hidden." },
  { name: "knowledgeScope", description: "Who can treat the information as knowledge, such as pc_known, npc_known, user_only, gm_only, or unknown_to_pc." },
  { name: "knowledgeSourceKind", description: "Observed, heard, told, inferred, documented, parallel_line, misread, unknown, or equivalent source kind." },
  { name: "knownBy", description: "Actor or role ids that know this information; never infer all actors know it." },
  { name: "excludedKnowledgeFor", description: "Actor or role ids that explicitly do not know it yet." },
  { name: "displayPolicy", description: "How this may be shown to the user without changing PC knowledge." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_WORLD_TICK_CLOCK_FIELDS = [
  { name: "clockId", description: "Stable id for an active clock, countdown, pacing clock, danger clock, or pressure clock." },
  { name: "clockKind", description: "Controlled clock kind such as worldClock, countdown, pacingDebt, relationshipPressure, investigationClock, combatClock, or dangerClock." },
  { name: "updateKind", description: "advance, decrease, pause, resume, trigger, interrupt, resolve, reset, create, or no_change." },
  { name: "previousState", description: "Pre-tick state or value before the resolved timeDelta is applied." },
  { name: "nextState", description: "Post-tick state or next-turn summary; current-scene should store only this summary, not the full clock authority." },
  { name: "timeDeltaBasis", description: "The ActionResolution.timeDelta interval that caused this clock update." },
  { name: "happenedStatus", description: "Status gate for writeback; possible_future, intention_only, and attempted_not_confirmed are not confirmed events." },
  { name: "affectedPaths", description: "Wiki or runtime-overlay paths that may need later proposal/review if the update is accepted." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_WORLD_TICK_ONGOING_EVENT_FIELDS = [
  { name: "eventId", description: "Stable runtime id for a progressing, paused, triggered, interrupted, blocked, or settled ongoing event." },
  { name: "settlementKind", description: "advanced, paused, triggered, interrupted, blocked, failed, resolved, or no_change." },
  { name: "narrativeLine", description: "playerVisibleLine, parallelLine, or tensionLine ownership for the event settlement." },
  { name: "visibility", description: "Visibility and knowledge metadata for who can observe or know the event state." },
  { name: "happenedStatus", description: "ongoing or confirmed_happened only when actually settled; possible futures remain possible_future." },
  { name: "affectedPaths", description: "Candidate current-scene, event, character/runtime, location/runtime, faction/runtime, or plot-arcs/runtime paths." },
  { name: "runtimeDeltaRefs", description: "Structured refs that let later writeback trace the settled event without reading narration prose." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_WORLD_TICK_INFORMATION_BROADCAST_FIELDS = [
  { name: "broadcastId", description: "Stable id for the broadcast of information during the tick interval." },
  { name: "informationSummary", description: "What was learned, sensed, misread, or transmitted." },
  { name: "sourceActorRefs", description: "Who or what produced the information." },
  { name: "recipientRefs", description: "Who receives the information; absence means nobody receives it, not everybody knows it." },
  { name: "channel", description: "Visual, sound, messenger, rumor, magic, sensor, memory, document, or other source channel." },
  { name: "visibility", description: "Visibility and knowledge metadata distinguishing user-visible parallel lines from PC knowledge." },
  { name: "happenedStatus", description: "confirmed_happened for actual broadcasts, misunderstanding for misreads, or possible_future for only-planned leaks." },
  { name: "affectedPaths", description: "Candidate known-information, relationship/runtime, faction/runtime, or journal paths for later review." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_WORLD_TICK_REACTION_QUEUE_FIELDS = [
  { name: "reactionId", description: "Stable id for one actor's core reaction candidate." },
  { name: "actorRef", description: "Actor that owns this reaction; each actor should keep one core reaction to avoid everyone seizing focus." },
  { name: "reactionTiming", description: "immediate, delayed, parallel, tension, or none." },
  { name: "triggerDeltaIds", description: "Player-action or world-tick delta ids that triggered this reaction." },
  { name: "knowledgeBasis", description: "What the actor actually knows or misreads before reacting." },
  { name: "visibility", description: "Visibility and knowledge metadata; parallel reactions do not become PC knowledge by display alone." },
  { name: "happenedStatus", description: "Whether the reaction is confirmed, ongoing, intention_only, possible_future, or no visible reaction." },
  { name: "affectedPaths", description: "Candidate current-scene, character/runtime, relationship/runtime, plot-arcs/runtime, or journal paths." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_WORLD_TICK_PACING_STATE_FIELDS = [
  { name: "previousDebt", description: "Pacing debt before this tick: none, low, medium, high, or critical." },
  { name: "nextDebt", description: "Pacing debt after this tick and before the next narration brief." },
  { name: "pressureChange", description: "relieved, unchanged, increased, or scene_cut_needed." },
  { name: "campaignDelta", description: "Concrete world, clue, reaction, danger, relationship, or clock movement produced by this tick." },
  { name: "compensationNeeded", description: "Whether later brief/narration must compensate for stagnation." },
  { name: "affectedPaths", description: "Candidate current-scene, outline progress, plot-arcs/runtime, or journal paths for later proposal/review." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_WORLD_TICK_GAP_SIGNAL_FIELDS = [
  { name: "gapSignalId", description: "Stable id for World Tick's preliminary gap/vacuum signal." },
  { name: "gapMode", description: "none, skip, compress, parallel_line_tick, relationship_beat, branching_event, or major_divergence_event." },
  { name: "gapImpactCandidate", description: "First-pass none, minor, branch, or major candidate; not the authoritative OutlineImpactLevel." },
  { name: "causalChain", description: "Why this gap signal follows from timeDelta, playerActionDelta, clocks, ongoing events, and actor knowledge." },
  { name: "outlineImpactAuthority", description: "Must remain Outline Impact Detector; World Tick does only preliminary screening." },
  { name: "happenedStatus", description: "Only settled runtime facts can be confirmed_happened; future beats stay possible_future or intention_only." },
  { name: "affectedPaths", description: "Candidate outline progress, plot-arcs/runtime, current-scene, or event paths for later review." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_OUTLINE_BRIEF_COMPILER_GUIDANCE = [
  "Outline-aware Brief Compiler is LLM 4 / Step 14: it compiles a short narration brief and detects outline impact; it does not generate player prose, nextActionOptions, wiki writes, runtime update proposals, outline revisions, or provisional outline patches.",
  "outline beat, reveal, and branch condition refs must carry stable ids plus path and sectionId; natural headings are only display labels.",
  "Each outline slice should expose dependency, invalidation, line target, and reveal policy metadata before it can influence narration guidance.",
  "OutlineImpactLevel uses the rubric none, minor, branch, major_rewrite_required; only major_rewrite_required can request Story Outline Regenerator input.",
  "playerFacingBrief is limited to PC-visible or PC-inferred material and must not convert GM-only, hidden, parallelLine-only, or user_visible_pc_unknown material into PC knowledge.",
  "parallelLineBrief can describe user-visible or GM-only parallel-line pressure, but it must explicitly not grant PC knowledge.",
  "tensionBriefInput is the handoff for relationship pressure, long-running emotional tension, pacing pressure, and plot-arc fuel; it is not player-facing prose.",
  "tensionLine is the long-running relationship/emotional/dramatic pressure line; plot-arcs/runtime material can fuel it without becoming an event or accepted wiki fact.",
  "recalledMaterials are the deterministic Recall Selector handoff, not complete outline authority and not accepted wiki facts.",
] as const

export const RPG_OUTLINE_BRIEF_IMPACT_RUBRIC_FIELDS = [
  { name: "none", description: "No meaningful outline impact; existing adjacent beats and reveal order remain valid." },
  { name: "minor", description: "Small local deviation or pacing shift that can be absorbed by the current outline without regeneration." },
  { name: "branch", description: "A meaningful branch condition or alternate route is active, but existing outline dependencies are still repairable without immediate rewrite." },
  { name: "major_rewrite_required", description: "Core beat, reveal order, cross-line dependency, or causal assumption is invalidated and Step 14.5 may be requested." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_OUTLINE_BRIEF_BOUNDARY_FIELDS = [
  { name: "playerFacingBrief", description: "Only PC-visible or PC-inferred guidance for the later Narration Generator; never GM-only, hidden, parallelLine-only, or user_visible_pc_unknown as PC knowledge." },
  { name: "parallelLineBrief", description: "Parallel-line guidance that may be user-visible or GM-only but must explicitly set grantsPcKnowledge: false." },
  { name: "tensionBriefInput", description: "Structured input for long-running relationship, emotional, pacing, and plot-arc tension; not player-facing prose." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_OUTLINE_BRIEF_STABLE_REF_FIELDS = [
  { name: "stableId", description: "Stable id for an outline beat, reveal, branch condition, plot arc, dependency, or invalidation target." },
  { name: "path", description: "Recall-selected or known runtime path that supplied the ref." },
  { name: "sectionId", description: "Stable section id from the recalled material, outline slice, or runtime reference." },
  { name: "dependency", description: "Stable ids that must remain true for the beat, reveal, or branch to continue making sense." },
  { name: "invalidation", description: "Stable ids or runtime deltas that would invalidate the assumption." },
  { name: "lineTarget", description: "playerVisibleLine, parallelLine, or tensionLine target for the ref." },
  { name: "revealPolicy", description: "allowed_now, hint_only, delay, forbid, parallel_only, or gm_only." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_OUTLINE_BRIEF_TENSION_FUEL_FIELDS = [
  { name: "fuelId", description: "Stable id for plot-arc/runtime material that can fuel the tensionLine." },
  { name: "plotArcId", description: "The plot arc or runtime pressure source this fuel belongs to." },
  { name: "tensionLineTarget", description: "Whether the tension line should advance, hold, reverse, complicate, or resolve." },
  { name: "pressureSources", description: "Relationship, clock, secret, conflict, or consequence sources that can create tension without fabricating events." },
  { name: "forbiddenResolutions", description: "Outcomes that would prematurely resolve a foreshadowing, conflict, or reveal." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_OUTLINE_BRIEF_COMPILER_SCHEMA_GUIDANCE = {
  guidance: RPG_OUTLINE_BRIEF_COMPILER_GUIDANCE,
  impactRubric: RPG_OUTLINE_BRIEF_IMPACT_RUBRIC_FIELDS,
  briefBoundaryFields: RPG_OUTLINE_BRIEF_BOUNDARY_FIELDS,
  stableRefFields: RPG_OUTLINE_BRIEF_STABLE_REF_FIELDS,
  tensionFuelFields: RPG_OUTLINE_BRIEF_TENSION_FUEL_FIELDS,
} as const satisfies RpgOutlineBriefCompilerGuidance

export const RPG_PROVISIONAL_OUTLINE_PATCH_SCHEMA = [
  { name: "patchId", description: "Stable id for the same-turn ProvisionalOutlinePatch stored only in the turn record, runtime journal, or `.llm-wiki/runtime/` audit boundary." },
  { name: "scope", description: "Same-turn temporary scope only; it must not be written back to wiki/ and does not mean wiki/outlines/main.md changed." },
  { name: "narrationHandoff", description: "Hard constraint handoff for Step 15 Narration; narration must obey visibility, knowledge, forbidden reveal, NarrativeLine, and confirmed-fact boundaries." },
  { name: "affectedOutlineRefs", description: "Stable beat, reveal, branch condition, path, and sectionId refs affected by the temporary patch." },
  { name: "runtimeDeltaRefs", description: "RuntimeDeltaRef sources that justify the patch; do not reverse-engineer outline changes from narration prose." },
  { name: "narrativeLines", description: "NarrativeLine targets such as playerVisibleLine, parallelLine, or tensionLine that the patch constrains." },
  { name: "visibilityBoundary", description: "VisibilityScope and KnowledgeScope limits; hidden, gm_only, parallelLine-only, or user_visible_pc_unknown material must not become PC knowledge." },
  { name: "outlineImpactLevel", description: "OutlineImpactLevel that authorized the patch; only major_rewrite_required can lead to Step 14.5 regeneration." },
  { name: "nonPersistenceBoundary", description: "Must state that the patch is not a ProposedWikiUpdate, not an ordinary runtime update, and not permission to edit wiki/outlines/main.md." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_OUTLINE_REVISION_PROPOSAL_SCHEMA = [
  { name: "proposalId", description: "Stable id for an OutlineRevisionProposal independent review/pending item." },
  { name: "reviewItemKind", description: "Must use review item kind outlineRevision, not runtimeWikiUpdate or an ordinary ProposedWikiUpdate." },
  { name: "targetOutlineRefs", description: "Affected outline paths, stable beat/reveal/branch ids, and sectionIds; wiki/outlines/main.md remains manual_or_review_only." },
  { name: "invalidatedAssumptions", description: "Dependencies, causal assumptions, reveal order, or branch conditions invalidated by RuntimeDeltaRef-backed play." },
  { name: "mustPreserveFacts", description: "Confirmed events, player/world state, and accepted runtime facts that the proposal must not rewrite." },
  { name: "proposedRevision", description: "Future outline revision candidate for review; it must not be written to events or treated as confirmed_happened." },
  { name: "visibilityAndKnowledgeScope", description: "VisibilityScope and KnowledgeScope limits for review; forbidden reveals must stay protected." },
  { name: "runtimeDeltaRefs", description: "RuntimeDeltaRef evidence that caused the revision proposal." },
  { name: "reviewBoundary", description: "Independent pending/review boundary; never mix into ordinary runtime update and never auto-write wiki/outlines/main.md." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_OUTLINE_REVISION_REVIEW_POLICY = [
  "OutlineRevisionReviewPolicy defines the review boundary for Step 14.5 outputs; it does not define runtime apply behavior.",
  "OutlineRevisionProposal is an independent review/pending item with reviewItemKind outlineRevision; it is not an ordinary runtime update or ordinary ProposedWikiUpdate.",
  "wiki/outlines/main.md remains manual_or_review_only; ordinary runtime update must never silently modify it.",
  "Review must show RegenerationSafetyReport, affected RuntimeDeltaRef evidence, affected beat/reveal/branch refs, and visibility / knowledge scope boundaries.",
  "Pending or rejected outlineRevisionProposal records may stay in turn record, runtime journal, or `.llm-wiki/runtime/` for audit, but they are not accepted wiki facts.",
  "outlines/progress.md may record major divergence, invalidated beats, provisional patch adoption, and pending proposal refs, but must not turn future outline revisions into happened facts.",
  "plot-arcs/runtime may record post-divergence pressure, conflict, and branch state, but it cannot replace OutlineRevisionProposal.",
] as const

export const RPG_REGENERATION_SAFETY_FIELDS = [
  { name: "reportKind", description: "RegenerationSafetyReport marker for Step 14.5 safety audit; this report is for audit/review, not wiki writeback." },
  { name: "preservesConfirmedFacts", description: "Confirms the patch/proposal does not rewrite accepted events, player/world state, or confirmed_happened RuntimeDeltaRef facts." },
  { name: "futureNotWrittenAsEvent", description: "Confirms future outline plans, possible futures, and revision candidates are not written into events/ or marked confirmed_happened." },
  { name: "forbiddenRevealProtected", description: "Confirms forbidden reveal, hidden, gm_only, parallelLine-only, and user_visible_pc_unknown material does not leak into PC knowledge." },
  { name: "provisionalPatchNonPersistent", description: "Confirms provisionalOutlinePatch is same-turn only, does not write wiki/, and does not modify wiki/outlines/main.md." },
  { name: "proposalReviewBoundary", description: "Confirms outlineRevisionProposal stays independent review/pending and is not mixed into ordinary runtime update." },
  { name: "mainOutlineWritePolicy", description: "Confirms wiki/outlines/main.md remains manual_or_review_only." },
  { name: "ordinaryRuntimeUpdateBoundary", description: "Confirms ordinary runtime update cannot silently modify outlines/main.md or treat outline revisions as accepted facts." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_STORY_OUTLINE_REGENERATOR_SCHEMA_GUIDANCE = {
  provisionalOutlinePatch: RPG_PROVISIONAL_OUTLINE_PATCH_SCHEMA,
  outlineRevisionProposal: RPG_OUTLINE_REVISION_PROPOSAL_SCHEMA,
  outlineRevisionReviewPolicy: RPG_OUTLINE_REVISION_REVIEW_POLICY,
  regenerationSafetyFields: RPG_REGENERATION_SAFETY_FIELDS,
} as const satisfies RpgStoryOutlineRegeneratorSchemaGuidance

export const RPG_NARRATION_OUTPUT_SCHEMA = [
  { name: "NarrationGeneratorInput", description: "Runtime-only LLM 5 input assembled from PostActionWorkingState, ActionResolution, WorldTickResult, visible selection, recalled materials, OutlineAwareNarrationBrief, optional provisionalOutlinePatch.narrationHandoff, styleBundle, forbiddenForNarration, and playerKnowledgeBoundary. It is not a wiki slot." },
  { name: "TurnNarration", description: "Runtime-only LLM 5 output wrapper for player-facing prose, optional parallel-line prose, tension handoff, display policy, narration meta, action options, and references. It describes narration output schema only and does not replace RpgTurnResult in this stage." },
  { name: "playerFacingText", description: "Text the player character can see, hear, feel, or reasonably infer; it must not reveal hidden, gm_only, parallelLine-only, or user_visible_pc_unknown material as PC knowledge." },
  { name: "parallelLineText", description: "Optional user-displayable offscreen or distant lens; display to the real user does not grant player-character knowledge and must not auto-update wiki/player/known_information.md." },
  { name: "tensionBrief", description: "Structured runtime/review handoff for relationship, emotional, pacing, unresolved tension, and plot-arc fuel; it is not ordinary event fact material and should not be directly written to events." },
  { name: "displayPolicy", description: "NarrationDisplayPolicy controlling whether and how player-facing text, parallel line, tension summary, warnings, and meta option labels may be shown; display choices do not change facts or knowledge." },
  { name: "narrationMeta", description: "NarrationMeta records time compression, scene transition, campaign delta, pacing compliance, provisional patch use, reveal boundary, and player knowledge boundary for validation/review." },
  { name: "nextActionOptions", description: "Enhanced RpgActionOption list that may carry runtime hints such as expected time cost, likely clock impact, visibility scope, likely affected paths, and meta-option markers; unselected options are not facts." },
  { name: "references", description: "Paths, runtime refs, section ids, and source refs used by the narration; references support audit and review but do not authorize writeback by themselves." },
  { name: "styleBundle", description: "Narration/style/dialogue handoff controlling expression, voice, pacing, and prose choices only; it must not be promoted into world facts, plot facts, or character facts." },
  { name: "forbiddenForNarration", description: "Hard narration constraints such as forbidden reveals, forbidden words, style bans, player boundaries, and material that must not appear in player-facing prose." },
  { name: "playerKnowledgeBoundary", description: "Boundary describing what the PC knows, misreads, can infer, and explicitly must not learn from parallel-line or user-only display." },
  { name: "pacingCompliance", description: "Validation-facing signal that narration reflected requested timeDelta, pacingIntent, scene_cut/compression, campaignDelta, or anti-stagnation pressure without inventing facts." },
  { name: "provisionalOutlinePatch.narrationHandoff", description: "When present, this same-turn hard handoff has priority over ordinary OutlineAwareNarrationBrief for narration constraints, but it must not rewrite PostActionWorkingState, WorldTickResult, or ActionResolution." },
  { name: "outlineRevisionProposal", description: "Independent review/pending future-outline material; it is not Narration fact material and must not become happened facts, PC knowledge, narration prose, or ordinary runtime update." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_TENSION_BRIEF_FIELDS = [
  { name: "relationshipPressure", description: "Relationship pressure exposed or carried by this turn; this is a runtime/review handoff, not automatically an events/ fact." },
  { name: "emotionalPressure", description: "Emotional pressure, vulnerability, shame, fear, attachment, or restraint that should shape tensionLine handling." },
  { name: "misunderstanding", description: "Active misunderstanding or misread that may affect relationships or player knowledge; it must stay scoped by visibility/knowledge metadata." },
  { name: "trust", description: "Trust gained, damaged, withheld, tested, or left ambiguous during this turn." },
  { name: "unresolvedTension", description: "Tension still open after narration; avoid treating unresolved pressure as a completed event or resolved arc." },
  { name: "usedPlotArcFuel", description: "Plot-arc or runtime pressure material used as tension fuel; use does not make possible futures or foreshadowing confirmed_happened." },
  { name: "carryover", description: "Tension material that should carry into later review, recall, or runtime update proposal without becoming player-facing prose by default." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_NARRATION_META_FIELDS = [
  { name: "timeCompression", description: "Whether narration compressed, skipped, lingered, or expanded the resolved timeDelta." },
  { name: "sceneTransition", description: "Whether narration stayed in scene, cut to a new beat, reframed location, or opened a new actionable situation." },
  { name: "campaignDelta", description: "Concrete campaign movement expressed by narration; it must trace to working state, World Tick, Action Resolution, or accepted handoff rather than new invention." },
  { name: "pacingCompliance", description: "Whether narration obeyed pacingIntent, anti-stagnation pressure, scene_cut requirements, clock pressure, and campaign delta requirements." },
  { name: "provisionalPatchUsage", description: "Whether provisionalOutlinePatch.narrationHandoff was present, prioritized, and obeyed without rewriting state or facts." },
  { name: "revealBoundary", description: "What was revealed, hinted, delayed, forbidden, parallel-only, or kept GM-only." },
  { name: "playerKnowledgeBoundary", description: "What the PC knows, misreads, can infer, or explicitly remains unaware of after this narration." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_ACTION_OPTION_RUNTIME_FIELDS = [
  { name: "expectedTimeCost", description: "Approximate time cost for an action option, used by later Action Resolver / clock reasoning but not a fact until selected and resolved." },
  { name: "likelyClockImpact", description: "Likely clock, countdown, pacing, or danger effect if the option is selected; not a confirmed update." },
  { name: "visibilityScope", description: "Whether the option is pc_visible, pc_inferred, user_visible_pc_unknown, gm_only, hidden, or equivalent display/knowledge scope." },
  { name: "likelyAffectedPaths", description: "Candidate wiki/runtime paths likely relevant if this option is selected and later accepted through proposal/review/apply." },
  { name: "isMetaOption", description: "Marks non-diegetic options such as ask-for-clarification, inspect-state, pause, or choose-display-mode; meta options are not in-world player actions by default." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_NARRATION_KNOWLEDGE_BOUNDARY_POLICY = [
  "playerFacingText may only present PC-visible, PC-inferred, or explicitly PC-known material; it must not leak hidden, gm_only, parallelLine-only, or user_visible_pc_unknown material into PC knowledge.",
  "parallelLineText may be shown to the real user, but parallel line display is not PC knowledge and must not automatically write wiki/player/known_information.md.",
  "tensionBrief is a runtime/review handoff for pressure and carryover, not a direct events/ write and not automatic player knowledge.",
  "provisionalOutlinePatch.narrationHandoff has priority over ordinary OutlineAwareNarrationBrief when present, but it cannot rewrite PostActionWorkingState, WorldTickResult, or ActionResolution.",
  "outlineRevisionProposal is not Narration fact material; do not turn future revisions into happened facts, player knowledge, narration prose, or ordinary runtime update.",
] as const

export const RPG_NARRATION_STYLE_HANDOFF_POLICY = [
  "styleBundle may affect voice, diction, pacing, camera distance, dialogue texture, and presentation only.",
  "styleBundle, style_narration, style_dialogue, and style_forbidden must not be promoted into world facts, plot facts, character facts, or events.",
  "forbiddenForNarration is a hard expression and reveal boundary; obey it without using it as permission to alter working state or wiki facts.",
  "Pacing compliance is an expression/structure check: time compression or scene transition must reflect existing state and handoffs rather than inventing new facts.",
] as const

export const RPG_NARRATION_SCHEMA_GUIDANCE = {
  outputFields: RPG_NARRATION_OUTPUT_SCHEMA,
  tensionBriefFields: RPG_TENSION_BRIEF_FIELDS,
  narrationMetaFields: RPG_NARRATION_META_FIELDS,
  actionOptionRuntimeFields: RPG_ACTION_OPTION_RUNTIME_FIELDS,
  knowledgeBoundaryPolicy: RPG_NARRATION_KNOWLEDGE_BOUNDARY_POLICY,
  styleHandoffPolicy: RPG_NARRATION_STYLE_HANDOFF_POLICY,
} as const satisfies RpgNarrationOutputSchemaGuidance

export const RPG_RUNTIME_UPDATE_PROPOSAL_INPUT_SCHEMA = [
  { name: "RuntimeUpdateProposalInput", description: "Runtime-only LLM 6 input assembled from current-turn structured fact sources; it is not a wiki slot and does not authorize apply." },
  { name: "postActionWorkingState", description: "Primary settled state anchor after ActionResolution, WorldTickResult, visible selection, pacing state, and gap state have been merged." },
  { name: "actionResolution", description: "Structured player-action adjudication including playerActionDelta, directResults, costs, obstacles, timeDelta, and progressPotential; attempted_not_confirmed cannot become a confirmed event." },
  { name: "worldTickResult", description: "Structured world clock, ongoing event settlement, information broadcast, reaction queue, pacing update, gap signal, line target, visibility, knowledgeScope, and happenedStatus facts." },
  { name: "recallAndOutlineHandoff", description: "RecallSelection, recalledMaterials, OutlineAwareNarrationBrief, outlineImpactReport, and outline refs used as context/control handoff, not accepted wiki facts by themselves." },
  { name: "turnNarration", description: "TurnNarration with playerFacingText, parallelLineText, tensionBrief, narrationMeta, displayPolicy, references, and nextActionOptions; structured turn delta has priority over generatedNarrative." },
  { name: "consistencyValidation", description: "Step 16 or minimum local validation handoff proving narration respected working state, visibility, pacing, reveal, and provisional patch boundaries." },
  { name: "outlineRevisionProposal", description: "Optional independent future-outline review source; it must only become an OutlineRevisionReviewItem and never an ordinary ProposedWikiUpdate." },
  { name: "allowedTargets", description: "Local allowed target paths and write policies; LLM 6 cannot expand write authority or add an ordinary wiki/runtime category." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_RUNTIME_UPDATE_PROPOSAL_RESULT_SCHEMA = [
  { name: "RuntimeUpdateProposalResult", description: "Runtime-only LLM 6 result wrapper for review/pending proposal material; it is not an apply command." },
  { name: "proposedWikiUpdates", description: "Ordinary runtime wiki update proposals only; each must include sourceDeltas, lineTarget, visibility, knowledgeScope, happenedStatus, confidence, and validationHints." },
  { name: "outlineRevisionReviewItems", description: "Independent outline revision review items derived from outlineRevisionProposal; they are not ProposedWikiUpdate entries and cannot auto-write wiki/outlines/main.md." },
  { name: "journalEntries", description: "Audit or runtime journal additions; journal entries do not imply wiki writes." },
  { name: "skippedDeltas", description: "Structured list of runtime deltas intentionally skipped from ordinary wiki update with explicit reasons." },
  { name: "pacingUpdateProposal", description: "Clock, pacing debt, campaign delta, stagnation risk, and next-turn pacing proposal for review." },
  { name: "proposalGroups", description: "Cross-directory synchronization groups linking multiple proposed updates that come from the same source deltas." },
  { name: "warnings", description: "Boundary, confidence, missing companion update, insufficient source delta, or validation warning messages." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_PROPOSED_WIKI_UPDATE_RUNTIME_FIELDS = [
  { name: "id", description: "Stable id for an ordinary ProposedWikiUpdate review item." },
  { name: "targetPath", description: "Target wiki path inside allowedTargets and write policy; ordinary runtime update must not target wiki/outlines/main.md." },
  { name: "strategy", description: "Proposed append, merge, overwrite, or review strategy; final behavior belongs to validator/review/apply." },
  { name: "reason", description: "Why this confirmed or reviewable runtime delta should be persisted." },
  { name: "content", description: "Suggested wiki content; must not contain future outline revision plans as happened facts." },
  { name: "sourceTurnId", description: "Turn id that produced the source deltas." },
  { name: "references", description: "Wiki path, sectionId, outline ref, runtime ref, or source ref evidence; references support audit but do not authorize writeback alone." },
  { name: "sourceDeltas", description: "Structured runtime delta evidence from actionResolution, worldTickResult, postActionWorkingState, turnNarration, consistencyValidation, or outline handoff; this has priority over generatedNarrative." },
  { name: "lineTarget", description: "NarrativeLine target such as playerVisibleLine, parallelLine, or tensionLine." },
  { name: "visibility", description: "VisibilityScope such as pc_visible, pc_inferred, user_visible_pc_unknown, gm_only, or hidden; parallelLineText and user_visible_pc_unknown cannot automatically enter PC knowledge." },
  { name: "knowledgeScope", description: "KnowledgeScope such as pc_known, pc_misunderstanding, npc_known, user_only, gm_only, or unknown_to_pc; player known information accepts only PC known or explicit misunderstanding." },
  { name: "happenedStatus", description: "HappenedStatus for the update; events require confirmed_happened and attempted_not_confirmed cannot become confirmed event." },
  { name: "confidence", description: "Confidence score or label used to route low-confidence material to warnings, skipped deltas, or review-only handling." },
  { name: "validationHints", description: "Validator-facing hints for path policy, visibility/knowledge boundary, source delta coverage, companion proposals, and safety checks." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_RUNTIME_UPDATE_SOURCE_DELTA_FIELDS = [
  { name: "deltaId", description: "Stable id of the structured runtime delta being used as evidence." },
  { name: "sourceStage", description: "ActionResolution, WorldTickResult, PostActionWorkingState, TurnNarration, consistencyValidation, outlineBrief, outlineRegeneration, or equivalent stage." },
  { name: "sourcePath", description: "JSON pointer, runtime path, turn record field, or known path to the source delta." },
  { name: "sourceField", description: "Specific source field such as playerActionDelta, directResults, clockUpdates, informationBroadcast, tensionBrief, narrationMeta, playerFacingText, or parallelLineText." },
  { name: "summary", description: "Short factual summary of the delta; do not replace structured metadata with prose only." },
  { name: "lineTarget", description: "playerVisibleLine, parallelLine, or tensionLine source line." },
  { name: "visibility", description: "VisibilityScope carried by the source delta." },
  { name: "knowledgeScope", description: "KnowledgeScope carried by the source delta." },
  { name: "happenedStatus", description: "HappenedStatus carried by the source delta; attempted_not_confirmed and possible_future are not confirmed events." },
  { name: "confidence", description: "Evidence confidence for this source delta." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_SKIPPED_RUNTIME_DELTA_FIELDS = [
  { name: "deltaId", description: "Runtime delta id that LLM 6 intentionally did not convert into an ordinary wiki update." },
  { name: "sourceDeltas", description: "Source delta evidence being skipped or marked journal/review-only." },
  { name: "reason", description: "Short skip reason such as not_pc_known, attempted_not_confirmed, nextActionOption_not_fact, possible_future, outline_revision_review_only, or low_confidence." },
  { name: "notWrittenBecause", description: "Human-readable explanation for why this material must not enter pending wiki update." },
  { name: "lineTarget", description: "NarrativeLine for the skipped material." },
  { name: "visibility", description: "VisibilityScope explaining whether it is PC-visible, user_visible_pc_unknown, gm_only, hidden, or parallel only." },
  { name: "knowledgeScope", description: "KnowledgeScope explaining why PC knowledge boundaries block or limit writeback." },
  { name: "happenedStatus", description: "HappenedStatus explaining why events or confirmed facts are unsafe." },
  { name: "suggestedReview", description: "Optional review/journal destination if the skipped delta still needs human attention." },
  { name: "journalOnly", description: "Whether the delta may be retained only in turn record, runtime journal, or `.llm-wiki/runtime/` audit metadata." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_PACING_UPDATE_PROPOSAL_FIELDS = [
  { name: "timeDelta", description: "Actual resolved time passage for the turn." },
  { name: "campaignDelta", description: "Concrete campaign movement produced by confirmed structured deltas, not invented from pacing pressure." },
  { name: "pacingDebtChange", description: "Increase, decrease, or no-change proposal for pacing debt." },
  { name: "stagnationRisk", description: "Risk level and reason if the turn produced too little durable movement." },
  { name: "activeClockChanges", description: "Clock/countdown changes with sourceDeltas and happenedStatus." },
  { name: "nextTurnPacingHint", description: "Next-turn pacing hint for review/journal or current-scene carryover; not a future event fact." },
  { name: "sourceDeltas", description: "Structured sourceDeltas supporting the pacing proposal." },
  { name: "confidence", description: "Confidence for the pacing proposal." },
  { name: "validationHints", description: "Validator-facing hints for where pacing state may be stored and what must stay journal-only." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_PROPOSAL_GROUP_FIELDS = [
  { name: "groupId", description: "Stable id for a group of related proposals derived from the same runtime fact." },
  { name: "sourceDeltaIds", description: "Source delta ids shared by this proposal group." },
  { name: "targetPaths", description: "Target paths proposed by the group, such as events, current-scene, relationships/runtime, plot-arcs/runtime, or outlines/progress." },
  { name: "reason", description: "Why the proposals belong together causally or operationally." },
  { name: "requiredTogether", description: "Whether review should accept/reject the grouped proposals together to avoid partial-state contradictions." },
  { name: "missingCompanionWarnings", description: "Warnings for expected companion updates that are absent or deliberately skipped." },
  { name: "lineTarget", description: "NarrativeLine primarily served by this group." },
  { name: "validationHints", description: "Validator-facing group consistency hints." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_OUTLINE_REVISION_REVIEW_ITEM_SCHEMA = [
  { name: "proposalId", description: "Stable id of the independent outline revision review item." },
  { name: "reviewItemKind", description: "Must be outlineRevision; never runtimeWikiUpdate and never ordinary ProposedWikiUpdate." },
  { name: "title", description: "Human-readable review title." },
  { name: "proposal", description: "The future outline revision proposal content for review only; it must not be written as happened facts." },
  { name: "sourceTurnId", description: "Turn id that generated or carried the outlineRevisionProposal." },
  { name: "sourceDeltas", description: "Runtime deltas and outline impact evidence that justify opening an independent outline review item." },
  { name: "reviewPolicy", description: "Independent review/pending policy; rejected or pending items are audit records only." },
  { name: "targetPathPolicy", description: "wiki/outlines/main.md remains manual_or_review_only and cannot be auto-written by Runtime Update Proposal." },
  { name: "status", description: "Initial state should be pending." },
  { name: "safetyNotes", description: "Notes proving confirmed facts are preserved, future revisions are not events, and forbidden reveals/PC knowledge boundaries remain intact." },
  { name: "validationHints", description: "Validator-facing hints ensuring the item stays out of ordinary runtime update apply." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_RUNTIME_UPDATE_PROPOSAL_GUIDANCE = [
  "LLM 6 Schema Guidance only defines code-readable schema descriptions; it does not implement runtime types, JSON parser/validator, interaction prompt changes, pending staging, orchestrator wiring, writer/apply, or UI.",
  "RuntimeUpdateProposalInput must prioritize structured fact sources such as PostActionWorkingState, ActionResolution, WorldTickResult, TurnNarration, consistencyValidation, and outline handoff over generatedNarrative.",
  "playerFacingText is display evidence only; structured turn delta and sourceDeltas are the primary fact boundary.",
  "parallelLineText and user_visible_pc_unknown may be visible to the real user but must not automatically enter wiki/player/known_information.md or PC knowledge.",
  "nextActionOptions are candidate future actions and are not facts unless selected, resolved, and confirmed by later structured deltas.",
  "events updates require confirmed_happened sourceDeltas; attempted_not_confirmed cannot enter confirmed event proposals.",
  "outlineRevisionProposal can only become an independent OutlineRevisionReviewItem; it must not be mixed into ordinary ProposedWikiUpdate and must not auto-write wiki/outlines/main.md.",
  "SkippedRuntimeDelta records no-op, journal-only, review-only, future, low-confidence, PC-unknown, or attempted-not-confirmed deltas instead of silently dropping them.",
  "PacingUpdateProposal and ProposalGroup describe reviewable pacing/cross-directory sync intent; they do not authorize apply.",
  "Fenced markdown update blocks may remain as compatibility/manual staging protocol, but the new runtime main flow should not rely on fenced blocks as its only protocol.",
] as const

export const RPG_RUNTIME_UPDATE_PROPOSAL_SCHEMA_GUIDANCE = {
  inputSchema: RPG_RUNTIME_UPDATE_PROPOSAL_INPUT_SCHEMA,
  resultSchema: RPG_RUNTIME_UPDATE_PROPOSAL_RESULT_SCHEMA,
  proposedWikiUpdateRuntimeFields: RPG_PROPOSED_WIKI_UPDATE_RUNTIME_FIELDS,
  sourceDeltaFields: RPG_RUNTIME_UPDATE_SOURCE_DELTA_FIELDS,
  skippedRuntimeDeltaFields: RPG_SKIPPED_RUNTIME_DELTA_FIELDS,
  pacingUpdateProposalFields: RPG_PACING_UPDATE_PROPOSAL_FIELDS,
  proposalGroupFields: RPG_PROPOSAL_GROUP_FIELDS,
  outlineRevisionReviewItemSchema: RPG_OUTLINE_REVISION_REVIEW_ITEM_SCHEMA,
  guidance: RPG_RUNTIME_UPDATE_PROPOSAL_GUIDANCE,
} as const satisfies RpgRuntimeUpdateProposalSchemaGuidance

export const RPG_REVIEW_ITEM_KIND_FIELDS = [
  { name: "runtimeWikiUpdate", description: "Ordinary review item for accepted runtime facts, snapshots, overlays, and progress updates that may apply to wiki/." },
  { name: "outlineRevision", description: "Independent review item for future outline changes; it is not a normal ProposedWikiUpdate and must not silently edit outlines/main.md." },
  { name: "manualControlChange", description: "Manual or GM-controlled change to rules, style, memory, or other control material." },
] as const satisfies readonly RpgWikiFieldDefinition[]

export const RPG_ACTION_RESOLVER_SLOT_SEMANTICS = [
  {
    path: "wiki/current-scene/scene_state.md",
    role: "preActionSceneSnapshot",
    requiredSemantics: [
      "Overwrite-only current snapshot for the next turn, not full scene history.",
      "Must expose current time, location, participants, visible situation, last-turn summary, interactive objects, location action conditions, current dangers, active clocks/countdowns, pending reactions, and pacing state.",
      "Only stores state required by the next Action Resolver and immediate runtime context.",
    ],
    exclude: [
      "Complete event history.",
      "Long-term character, location, faction, or item state that belongs in runtime overlays.",
    ],
  },
  {
    path: "wiki/player/known_information.md",
    role: "playerKnowledgeBoundary",
    requiredSemantics: [
      "Stores only pc_known facts and pc_misunderstanding entries for the current player character.",
      "Each entry should carry information source, confidence or misunderstanding status, and visibility metadata when it matters.",
      "Parallel-line display, GM-only notes, and user_visible_pc_unknown material do not automatically become player-character knowledge.",
    ],
    exclude: [
      "Offscreen parallel-line facts that the PC has not learned.",
      "GM-only control material and user-visible but PC-unknown information.",
    ],
  },
  {
    path: "wiki/outlines/progress.md",
    role: "outlineRelativeProgress",
    requiredSemantics: [
      "Tracks current stage/beat, adjacent useful beats, completed/skipped/advanced/delayed/invalidated beats, branch conditions, divergence notes, and pending outline revision refs.",
      "May record that a provisional outline patch was used this turn, but must not turn future revisions into happened facts.",
      "Supports Action Resolver by describing nearby outline constraints without rewriting outlines/main.md.",
    ],
    exclude: [
      "Future outline changes written as confirmed events.",
      "Silent edits to outlines/main.md or unreviewed outlineRevision content.",
    ],
  },
  {
    path: "wiki/rules/",
    role: "actionAdjudicationRules",
    requiredSemantics: [
      "Defines executable adjudication boundaries for Action Resolver rather than only setting exposition.",
      "Must cover success/failure conditions, resource costs, distance, time, perception, stealth, combat, investigation, capability limits, and hard constraints when applicable.",
      "Player-specific ability availability belongs in wiki/player/abilities.md, while general adjudication constraints stay in rules/.",
    ],
    exclude: [
      "Pure background prose that belongs in world/.",
      "Character-specific current state or inventory ledger.",
    ],
  },
] as const satisfies readonly RpgActionResolverSlotSemantic[]

export const RPG_SOURCE_INGEST_TARGET_POLICY = {
  ordinaryTargets: [
    "wiki/sources/",
    "wiki/world/basic_overview.md",
    "wiki/world/history.md",
    "wiki/world/common_sense.md",
    "wiki/world/supernatural_presence.md",
    "wiki/world/social_structure.md",
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

export const RPG_FIXED_WORLD_SLOT_PATHS = RPG_SCHEMA_SLOTS
  .filter((slot) => slot.slotId.startsWith("world_"))
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

export function getRpgRuntimeSharedSchemaGuidance(): RpgRuntimeSharedSchemaGuidance {
  return RPG_RUNTIME_SHARED_SCHEMA_GUIDANCE
}

export function getRpgRuntimeVisibilityFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_RUNTIME_VISIBILITY_FIELDS
}

export function getRpgRuntimeDeltaRefFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_RUNTIME_DELTA_REF_FIELDS
}

export function getRpgRecallableSectionFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_RECALLABLE_SECTION_FIELDS
}

export function getRpgClockStateFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_CLOCK_STATE_FIELDS
}

export function getRpgWorldTickSchemaGuidance(): readonly string[] {
  return RPG_WORLD_TICK_SCHEMA_GUIDANCE
}

export function getRpgWorldTickVisibilityMetaFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_WORLD_TICK_VISIBILITY_META_FIELDS
}

export function getRpgWorldTickClockFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_WORLD_TICK_CLOCK_FIELDS
}

export function getRpgWorldTickOngoingEventFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_WORLD_TICK_ONGOING_EVENT_FIELDS
}

export function getRpgWorldTickInformationBroadcastFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_WORLD_TICK_INFORMATION_BROADCAST_FIELDS
}

export function getRpgWorldTickReactionQueueFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_WORLD_TICK_REACTION_QUEUE_FIELDS
}

export function getRpgWorldTickPacingStateFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_WORLD_TICK_PACING_STATE_FIELDS
}

export function getRpgWorldTickGapSignalFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_WORLD_TICK_GAP_SIGNAL_FIELDS
}

export function getRpgOutlineBriefCompilerSchemaGuidance(): RpgOutlineBriefCompilerGuidance {
  return RPG_OUTLINE_BRIEF_COMPILER_SCHEMA_GUIDANCE
}

export function getRpgOutlineBriefImpactRubricFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_OUTLINE_BRIEF_IMPACT_RUBRIC_FIELDS
}

export function getRpgOutlineBriefBoundaryFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_OUTLINE_BRIEF_BOUNDARY_FIELDS
}

export function getRpgOutlineBriefStableRefFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_OUTLINE_BRIEF_STABLE_REF_FIELDS
}

export function getRpgOutlineBriefTensionFuelFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_OUTLINE_BRIEF_TENSION_FUEL_FIELDS
}

export function getRpgStoryOutlineRegeneratorSchemaGuidance(): RpgStoryOutlineRegeneratorSchemaGuidance {
  return RPG_STORY_OUTLINE_REGENERATOR_SCHEMA_GUIDANCE
}

export function getRpgProvisionalOutlinePatchSchema(): readonly RpgWikiFieldDefinition[] {
  return RPG_PROVISIONAL_OUTLINE_PATCH_SCHEMA
}

export function getRpgOutlineRevisionProposalSchema(): readonly RpgWikiFieldDefinition[] {
  return RPG_OUTLINE_REVISION_PROPOSAL_SCHEMA
}

export function getRpgOutlineRevisionReviewPolicy(): readonly string[] {
  return RPG_OUTLINE_REVISION_REVIEW_POLICY
}

export function getRpgRegenerationSafetyFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_REGENERATION_SAFETY_FIELDS
}

export function getRpgNarrationOutputSchema(): readonly RpgWikiFieldDefinition[] {
  return RPG_NARRATION_OUTPUT_SCHEMA
}

export function getRpgTensionBriefFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_TENSION_BRIEF_FIELDS
}

export function getRpgNarrationMetaFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_NARRATION_META_FIELDS
}

export function getRpgActionOptionRuntimeFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_ACTION_OPTION_RUNTIME_FIELDS
}

export function getRpgNarrationKnowledgeBoundaryPolicy(): readonly string[] {
  return RPG_NARRATION_KNOWLEDGE_BOUNDARY_POLICY
}

export function getRpgNarrationStyleHandoffPolicy(): readonly string[] {
  return RPG_NARRATION_STYLE_HANDOFF_POLICY
}

export function getRpgRuntimeUpdateProposalSchemaGuidance(): RpgRuntimeUpdateProposalSchemaGuidance {
  return RPG_RUNTIME_UPDATE_PROPOSAL_SCHEMA_GUIDANCE
}

export function getRpgRuntimeUpdateProposalInputSchema(): readonly RpgWikiFieldDefinition[] {
  return RPG_RUNTIME_UPDATE_PROPOSAL_INPUT_SCHEMA
}

export function getRpgRuntimeUpdateProposalResultSchema(): readonly RpgWikiFieldDefinition[] {
  return RPG_RUNTIME_UPDATE_PROPOSAL_RESULT_SCHEMA
}

export function getRpgProposedWikiUpdateRuntimeFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_PROPOSED_WIKI_UPDATE_RUNTIME_FIELDS
}

export function getRpgRuntimeUpdateSourceDeltaFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_RUNTIME_UPDATE_SOURCE_DELTA_FIELDS
}

export function getRpgSkippedRuntimeDeltaFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_SKIPPED_RUNTIME_DELTA_FIELDS
}

export function getRpgPacingUpdateProposalFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_PACING_UPDATE_PROPOSAL_FIELDS
}

export function getRpgProposalGroupFields(): readonly RpgWikiFieldDefinition[] {
  return RPG_PROPOSAL_GROUP_FIELDS
}

export function getRpgOutlineRevisionReviewItemSchema(): readonly RpgWikiFieldDefinition[] {
  return RPG_OUTLINE_REVISION_REVIEW_ITEM_SCHEMA
}

export function getRpgRuntimeUpdateProposalGuidance(): readonly string[] {
  return RPG_RUNTIME_UPDATE_PROPOSAL_GUIDANCE
}

export function getRpgOutlineImpactLevels(): readonly RpgOutlineImpactLevel[] {
  return RPG_OUTLINE_IMPACT_LEVELS
}

export function getRpgReviewItemKinds(): readonly RpgWikiFieldDefinition[] {
  return RPG_REVIEW_ITEM_KIND_FIELDS
}

export function getRpgActionResolverSlotSemantics(): readonly RpgActionResolverSlotSemantic[] {
  return RPG_ACTION_RESOLVER_SLOT_SEMANTICS
}

export function getRpgRuntimePersistenceBoundaryGuidance(): readonly string[] {
  return RPG_RUNTIME_PERSISTENCE_BOUNDARY_GUIDANCE
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
