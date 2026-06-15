import {
  RPG_FIXED_PLAYER_SLOT_PATHS,
  RPG_FIXED_WORLD_SLOT_PATHS,
  getRpgSchemaSlotByPath,
  type RpgSchemaSlot,
} from "../../rpg-wiki-schema"

export type RpgMergeKind =
  | "source-evidence"
  | "stable-operating-model"
  | "runtime-state"
  | "relationship-tension"
  | "plot-pressure"
  | "event-history"
  | "current-scene"
  | "manual-control"
  | "generic-rpg"

export interface RpgMergePolicy {
  pagePath: string
  categoryId: string | null
  kind: RpgMergeKind
  schemaSlot?: RpgSchemaSlot
  writePolicy: string
  boundary: string
  bodyShrinkThreshold: number
  promptFragment: string
}

const DEFAULT_BODY_SHRINK_THRESHOLD = 0.7
const COMPRESSIVE_BODY_SHRINK_THRESHOLD = 0.3
const STABLE_MODEL_BODY_SHRINK_THRESHOLD = 0.45

/**
 * Return RPG-aware merge semantics for a target wiki page.
 * Why this exists: RPG pages do not all merge like encyclopedia entries.
 * Current state, relationship tension, plot pressure, and stable setting
 * pages need different staleness and compression rules.
 */
export function getRpgMergePolicy(pagePath: string): RpgMergePolicy {
  const normalizedPath = normalizeWikiPath(pagePath)
  const matchPath = normalizedPath.toLowerCase()
  const categoryId = getRpgCategoryIdFromPath(matchPath)
  const schemaSlot = getRpgSchemaSlotByPath(matchPath)
  const runtimeOverlayKind = getRuntimeOverlayKind(matchPath)

  if (categoryId === "sources") {
    return definePolicy(normalizedPath, categoryId, "source-evidence", DEFAULT_BODY_SHRINK_THRESHOLD, sourceEvidencePrompt(), {
      writePolicy: "merge",
      boundary: "source evidence layer; never current campaign state",
    })
  }

  if (schemaSlot && isFixedWorldSlotPath(schemaSlot.path)) {
    return definePolicy(normalizedPath, categoryId, "stable-operating-model", STABLE_MODEL_BODY_SHRINK_THRESHOLD, fixedWorldSlotPrompt(schemaSlot), {
      schemaSlot,
      writePolicy: schemaSlot.writePolicy,
      boundary: "fixed world slot; source-ingest stable setting only, not runtime state",
    })
  }

  if (schemaSlot && isFixedPlayerSlotPath(schemaSlot.path)) {
    return definePolicy(normalizedPath, categoryId, "runtime-state", COMPRESSIVE_BODY_SHRINK_THRESHOLD, fixedPlayerSlotPrompt(schemaSlot), {
      schemaSlot,
      writePolicy: schemaSlot.writePolicy,
      boundary: "fixed player slot; do not create arbitrary wiki/player/*.md pages",
    })
  }

  if (matchPath === "wiki/current-scene/scene_state.md") {
    return definePolicy(normalizedPath, categoryId, "current-scene", COMPRESSIVE_BODY_SHRINK_THRESHOLD, currentScenePrompt(), {
      schemaSlot,
      writePolicy: schemaSlot?.writePolicy ?? "overwrite",
      boundary: "current scene snapshot; overwrite-only latest runtime state",
    })
  }

  if (categoryId === "events") {
    return definePolicy(normalizedPath, categoryId, "event-history", DEFAULT_BODY_SHRINK_THRESHOLD, eventHistoryPrompt(), {
      writePolicy: "append",
      boundary: "confirmed happened event history; no future/candidate material",
    })
  }

  if (categoryId === "quests" && /^wiki\/quests\/[^/]+\.md$/.test(matchPath)) {
    return definePolicy(normalizedPath, categoryId, "runtime-state", COMPRESSIVE_BODY_SHRINK_THRESHOLD, questPrompt(), {
      writePolicy: "merge",
      boundary: "trackable objective ledger; not PC wishes, TODOs, or plot pressure",
    })
  }

  if (matchPath === "wiki/outlines/progress.md") {
    return definePolicy(normalizedPath, categoryId, "runtime-state", COMPRESSIVE_BODY_SHRINK_THRESHOLD, outlineProgressPrompt(), {
      schemaSlot,
      writePolicy: schemaSlot?.writePolicy ?? "merge",
      boundary: "outline progress slot; runtime-reviewed progress only, not main outline rewrite",
    })
  }

  if (runtimeOverlayKind) {
    return definePolicy(normalizedPath, categoryId, "runtime-state", COMPRESSIVE_BODY_SHRINK_THRESHOLD, runtimeOverlayPrompt(runtimeOverlayKind), {
      writePolicy: "merge",
      boundary: `${runtimeOverlayKind} runtime overlay; accepted campaign changes only, base page remains stable`,
    })
  }

  if (categoryId === "relationships" && /^wiki\/relationships\/(?!runtime\/)[^/]+\.md$/.test(matchPath)) {
    return definePolicy(normalizedPath, categoryId, "relationship-tension", COMPRESSIVE_BODY_SHRINK_THRESHOLD, baseRelationshipPrompt(), {
      writePolicy: "merge",
      boundary: "base relationship page; runtime relationship changes belong in wiki/relationships/runtime/",
    })
  }

  if (categoryId === "plot-arcs" && /^wiki\/plot-arcs\/(?!runtime\/)[^/]+\.md$/.test(matchPath)) {
    return definePolicy(normalizedPath, categoryId, "plot-pressure", COMPRESSIVE_BODY_SHRINK_THRESHOLD, basePlotArcPrompt(), {
      writePolicy: "merge",
      boundary: "base plot-arc page; runtime branch state belongs in wiki/plot-arcs/runtime/",
    })
  }

  if (isStableOperatingModelCategory(categoryId)) {
    if (categoryId === "world") {
      return definePolicy(normalizedPath, categoryId, "generic-rpg", DEFAULT_BODY_SHRINK_THRESHOLD, unsupportedFixedSlotPathPrompt("world", RPG_FIXED_WORLD_SLOT_PATHS), {
        writePolicy: "conservative-generic",
        boundary: "unsupported world path; current schema only allows fixed wiki/world/*.md slots",
      })
    }
    return definePolicy(normalizedPath, categoryId, "stable-operating-model", STABLE_MODEL_BODY_SHRINK_THRESHOLD, stableOperatingModelPrompt(categoryId), {
      writePolicy: "merge",
      boundary: `base ${categoryId} page; runtime changes belong in wiki/${categoryId}/runtime/`,
    })
  }

  if (categoryId === "style" || categoryId === "rules" || categoryId === "memory") {
    return definePolicy(normalizedPath, categoryId, "manual-control", DEFAULT_BODY_SHRINK_THRESHOLD, manualControlPrompt(), {
      schemaSlot,
      writePolicy: schemaSlot?.writePolicy ?? "manual_or_review_only",
      boundary: "manual/control layer; preserve explicit user-authored control text",
    })
  }

  if (categoryId === "player") {
    return definePolicy(normalizedPath, categoryId, "generic-rpg", DEFAULT_BODY_SHRINK_THRESHOLD, unsupportedFixedSlotPathPrompt("player", RPG_FIXED_PLAYER_SLOT_PATHS), {
      writePolicy: "conservative-generic",
      boundary: "unsupported player path; current schema only allows fixed wiki/player/*.md slots",
    })
  }

  return definePolicy(normalizedPath, categoryId, "generic-rpg", DEFAULT_BODY_SHRINK_THRESHOLD, genericRpgPrompt(), {
    schemaSlot,
    writePolicy: schemaSlot?.writePolicy ?? "conservative-generic",
    boundary: "unknown or legacy-like path; do not invent legacy/default behavior",
  })
}

/**
 * Build the production system prompt used by the page merger.
 * The category-specific fragment is intentionally selected from pagePath
 * so merge behavior follows the RPG runtime layer rather than one old
 * encyclopedia-style instruction set.
 */
export function buildRpgMergeSystemPrompt(pagePath: string): string {
  const policy = getRpgMergePolicy(pagePath)
  return [
    "You are not merging an encyclopedia page.",
    "You are compiling one llmWikiRPG runtime wiki page from an existing version and an incoming version.",
    "The highest priority is RPG runtime usefulness, not preserving every factual claim.",
    "Keep source-supported information only when it affects NPC portrayal, player choices, relationship tension, scene hooks, state consequences, action constraints, rules or hard setting boundaries, atmosphere/style, or future pacing.",
    "Do not preserve low-value trivia merely because it is factual.",
    "Do not accumulate route recap, release metadata, fan labels, production trivia, or broad background prose unless it changes play.",
    "Do not turn possible futures into happened events.",
    "Do not merge stale runtime state with newer confirmed state; update or replace stale state when the incoming version clearly supersedes it.",
    "Do not rewrite stable canon/base pages with current campaign changes; current campaign changes belong in runtime overlay or runtime state pages.",
    "Keep Canon Facts, Reasonable Interpretation, inferred_for_play content, and runtime state semantically distinct.",
    "Keep `[[wikilink]]` references intact.",
    "Use concise markdown sections, bullets, and tables where useful.",
    "Prefer a short, actionable Runtime Capsule over a long encyclopedia summary when this is a runtime-facing non-source page.",
    "",
    `Target path: ${policy.pagePath}`,
    `Merge policy: ${policy.kind}`,
    `Schema slot: ${formatSchemaSlot(policy.schemaSlot)}`,
    `Write policy: ${policy.writePolicy}`,
    `Category/base-runtime boundary: ${policy.boundary}`,
    "",
    policy.promptFragment,
    "",
    "Output requirements:",
    "- The FIRST character of your response MUST be `-` (the opening of `---`)",
    "- Output the COMPLETE file: YAML frontmatter + body",
    "- Do not output FILE block fences",
    "- No preamble (no \"Here is the merged version:\"), no analysis prose",
    "- The caller will overwrite `sources`/`tags`/`related`/`updated` with deterministic values -- your job is the body and any other fields",
  ].join("\n")
}

function definePolicy(
  pagePath: string,
  categoryId: string | null,
  kind: RpgMergeKind,
  bodyShrinkThreshold: number,
  promptFragment: string,
  options: {
    schemaSlot?: RpgSchemaSlot
    writePolicy: string
    boundary: string
  },
): RpgMergePolicy {
  return { pagePath, categoryId, kind, bodyShrinkThreshold, promptFragment, ...options }
}

function normalizeWikiPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/")
}

function getRpgCategoryIdFromPath(relativePath: string): string | null {
  const match = relativePath.match(/^wiki\/([^/]+)(?:\/|$)/)
  return match?.[1] ?? null
}

function getRuntimeOverlayKind(path: string): string | null {
  return path.match(/^wiki\/(characters|locations|factions|items|relationships|plot-arcs)\/runtime\/[^/]+\.md$/)?.[1] ?? null
}

function isFixedWorldSlotPath(path: string): boolean {
  const normalized = normalizeWikiPath(path).toLowerCase()
  return RPG_FIXED_WORLD_SLOT_PATHS.some((slotPath) => normalizeWikiPath(slotPath).toLowerCase() === normalized)
}

function isFixedPlayerSlotPath(path: string): boolean {
  const normalized = normalizeWikiPath(path).toLowerCase()
  return RPG_FIXED_PLAYER_SLOT_PATHS.some((slotPath) => normalizeWikiPath(slotPath).toLowerCase() === normalized)
}

function formatSchemaSlot(slot: RpgSchemaSlot | undefined): string {
  if (!slot) return "none"
  return `${slot.slotId} (${slot.path}; owner=${slot.owner}; importPolicy=${slot.importPolicy}; writePolicy=${slot.writePolicy})`
}

function isStableOperatingModelCategory(categoryId: string | null): boolean {
  return categoryId === "world" || categoryId === "characters" || categoryId === "locations" || categoryId === "factions" || categoryId === "items"
}

function sourceEvidencePrompt(): string {
  return [
    "Source/evidence merge:",
    "- Preserve source provenance, source summary, reliability, conflicts, evidence boundaries, and what RPG categories the source can support.",
    "- It is acceptable to keep more factual coverage here than in runtime-facing pages, but do not convert source evidence into current campaign state.",
    "- If two sources conflict, record the conflict and uncertainty instead of silently choosing one as canon.",
  ].join("\n")
}

function stableOperatingModelPrompt(categoryId: string | null): string {
  if (categoryId === "characters") return characterPrompt()
  if (categoryId === "locations") return locationPrompt()
  if (categoryId === "factions") return factionPrompt()
  if (categoryId === "items") return itemPrompt()
  return worldPrompt()
}

function fixedWorldSlotPrompt(slot: RpgSchemaSlot): string {
  return [
    `Fixed world slot merge for ${slot.path}:`,
    "- Merge only the world semantics that belong in this fixed slot; do not create or imply arbitrary wiki/world/<custom>.md pages.",
    "- This is stable source-ingest world material: setting premise, history, common sense, supernatural/tech presence, or social structure depending on the slot.",
    "- Do not write current campaign runtime state, current scene status, quest progress, relationship deltas, or object holder changes into world slots.",
    fixedWorldSlotBoundary(slot.path),
  ].join("\n")
}

function fixedWorldSlotBoundary(path: string): string {
  if (path === "wiki/world/basic_overview.md") return "- Slot boundary: core premise, era, main stage, genre tone, and reusable atmosphere."
  if (path === "wiki/world/history.md") return "- Slot boundary: public past, established history, and background events; not current campaign event logs."
  if (path === "wiki/world/common_sense.md") return "- Slot boundary: default public knowledge, customs, taboos, and everyday assumptions."
  if (path === "wiki/world/supernatural_presence.md") return "- Slot boundary: how supernatural, tech, weird, or mystical forces exist and appear; executable mechanics belong in rules/."
  return "- Slot boundary: social structures, institutions, law, economy, class, and public power; concrete organizations belong in factions/."
}

function fixedPlayerSlotPrompt(slot: RpgSchemaSlot): string {
  return [
    `Fixed player slot merge for ${slot.path}:`,
    "- Merge into this exact fixed player slot only; do not create or imply arbitrary wiki/player/*.md runtime pages.",
    "- Keep accepted PC/player-facing state separate from NPC base character pages, quests, plot pressure, and rules/control pages.",
    fixedPlayerSlotBoundary(slot.path),
  ].join("\n")
}

function fixedPlayerSlotBoundary(path: string): string {
  if (path === "wiki/player/player.md") return "- Slot boundary: PC identity, background, stable setup, and compact current-state summary."
  if (path === "wiki/player/abilities.md") return "- Slot boundary: PC abilities, skills, limits, costs, proficiency, and current availability; do not split personal abilities into rules/."
  if (path === "wiki/player/inventory.md") return "- Slot boundary: current holdings, quantities, equipped/backpack status, acquisition, loss, damage, and consumption; object-level state belongs in items/runtime/."
  if (path === "wiki/player/goals.md") return "- Slot boundary: PC subjective motives, wishes, promises, commitments, and personal priorities; not quest progress, TODO/checklists, candidate actions, or plot pressure."
  return "- Slot boundary: PC-known information, player-visible discoveries, misunderstandings, and asymmetric knowledge; do not grant PC knowledge from hidden narration alone."
}

function characterPrompt(): string {
  return [
    "Stable character merge for wiki/characters/*.md:",
    "- Merge into a roleplay-ready NPC operating model, not a biography.",
    "- Prioritize Runtime Capsule, hard canon constraints that affect portrayal, Psychological Model, Behavior Rules, pressure reactions, Dialogue Style, Relationship Levers, and Evidence and Uncertainty.",
    "- Compress or remove trivia that does not affect portrayal, player interaction, behavior boundaries, choices, tension, or constraints.",
    "- Do not collapse route-specific, ending-specific, epilogue, or years-later states into one universal current-state summary.",
    "- Runtime-only current campaign state belongs in wiki/characters/runtime/ and must not be merged into the base character page.",
  ].join("\n")
}

function locationPrompt(): string {
  return [
    "Stable location merge for wiki/locations/*.md:",
    "- Treat the page as a playable scene card, not a travel guide or lore article.",
    "- Prioritize sensory anchors, entrances/exits, access conditions, dangers, clues, interactable objects, common occupants, and scene hooks.",
    "- Current danger, occupants, damage, clues, access changes, or temporary atmosphere belong in wiki/locations/runtime/ overlays.",
  ].join("\n")
}

function factionPrompt(): string {
  return [
    "Stable faction merge for wiki/factions/*.md:",
    "- Treat the faction as a pressure source, not an organization-history article.",
    "- Prioritize agenda, resources, leverage, reaction thresholds, attitude toward player/NPCs, alliances/conflicts, and consequences when provoked.",
    "- Temporary current moves, stance, resources, or pressure changes belong in wiki/factions/runtime/ overlays.",
  ].join("\n")
}

function itemPrompt(): string {
  return [
    "Stable item merge for wiki/items/*.md:",
    "- Treat the item as usable, risky, costly, evidentiary, symbolic, or plot-functional.",
    "- Prioritize use, cost, limits, owner/holder when source-established, condition, risk, clue value, and plot function.",
    "- Runtime holder, location, condition, consumption, loss, or damage belongs in wiki/items/runtime/ overlays.",
  ].join("\n")
}

function worldPrompt(): string {
  return [
    "Stable world merge for wiki/world/*.md:",
    "- Capture constraints, social rules, taboos, risks, common knowledge, atmosphere, and reusable systems.",
    "- Explain what each rule enables, blocks, costs, or changes for player action.",
    "- Avoid broad setting encyclopedia prose and do not store character-specific current state here.",
  ].join("\n")
}

function questPrompt(): string {
  return [
    "Quest merge for wiki/quests/*.md:",
    "- Record only game-recognized trackable objectives with objective, blockers/progress, completion conditions, failure conditions, and accepted runtime changes.",
    "- A quest is not any PC wish, subjective goal, player TODO/checklist, theme, author intent, or plot pressure.",
    "- Candidate actions, unchosen options, and possible future approaches do not become quest progress until accepted by play.",
  ].join("\n")
}

function outlineProgressPrompt(): string {
  return [
    "Outline progress merge for wiki/outlines/progress.md:",
    "- Merge current progress relative to the outline: active act/beat, completed beats, skipped beats, advanced beats, delayed beats, divergence notes, and next useful beats.",
    "- Do not rewrite wiki/outlines/main.md from this merge and do not move future outline revisions into happened facts.",
    "- Keep future guidance clearly separate from confirmed events; events record what happened, this slot records progress against the plan.",
  ].join("\n")
}

function runtimeOverlayPrompt(kind: string): string {
  if (kind === "relationships") {
    return [
      "Runtime relationship overlay merge for wiki/relationships/runtime/*.md:",
      "- Merge only accepted/reviewed relationship deltas from this campaign: trust, tension, conflict, secrets, misunderstandings, constraints, and pair-specific tone changes.",
      "- Do not duplicate full biographies or stable relationship premises; those belong in base relationships/*.md and character pages.",
      "- Candidate reactions or possible future relationship turns must remain clearly marked as not happened.",
    ].join("\n")
  }
  if (kind === "plot-arcs") {
    return [
      "Runtime plot arc overlay merge for wiki/plot-arcs/runtime/*.md:",
      "- Merge accepted/reviewed runtime branch state, triggered/skipped/advanced/delayed beats, pressure changes, foreshadowing status, reveal pacing, and progression conditions.",
      "- Do not use this as a quest ledger, player TODO/checklist, or base plot-arcs/*.md runtime write.",
      "- Possible futures may remain possible futures; do not promote them into confirmed happened facts.",
    ].join("\n")
  }
  return [
    `Runtime ${kind} overlay merge for wiki/${kind}/runtime/*.md:`,
    "- Merge only accepted/reviewed current campaign changes for this target, not stable canon/base material.",
    "- New confirmed state replaces stale old state; do not keep obsolete locations, attitudes, holders, conditions, or temporary effects unless still consequential.",
    `- Base wiki/${kind}/*.md pages keep stable source-supported structure; runtime changes stay in this overlay.`,
  ].join("\n")
}

function baseRelationshipPrompt(): string {
  return [
    "Base relationship boundary merge for wiki/relationships/*.md:",
    "- Preserve initial/stable relationship structure, long-term tension, source-supported relationship patterns, relationship history, and future-change constraints.",
    "- Runtime trust/conflict/misunderstanding changes, new secrets, recent tone shifts, and accepted campaign deltas belong in wiki/relationships/runtime/.",
    "- Clearly separate confirmed shared history from inferred_for_play interpretation.",
    "- Keep playable tension and leverage points, but do not let current runtime state pollute the base relationship page.",
    "- Do not duplicate full character profiles or one-off interactions with no relationship impact.",
  ].join("\n")
}

function basePlotArcPrompt(): string {
  return [
    "Base plot-arc merge for wiki/plot-arcs/*.md:",
    "- Preserve foreshadowing, conflicts, possible developments, progression conditions, reveal constraints, and stable story-pressure structure.",
    "- Runtime branch state, skipped/advanced/delayed beats, current pressure changes, and accepted campaign divergence belong in wiki/plot-arcs/runtime/.",
    "- Clearly separate confirmed facts from possible futures.",
    "- Possible futures may remain possible futures; do not promote them into confirmed happened facts.",
    "- Do not write possible future developments as already happened and do not resolve conflicts early.",
    "- Link to discrete events for confirmed occurrences instead of duplicating the full event timeline.",
  ].join("\n")
}

function eventHistoryPrompt(): string {
  return [
    "Event-history merge for wiki/events/*.md:",
    "- Keep only discrete, confirmed, already-happened events and their consequences.",
    "- Prioritize time or sequence marker, place, participants, what happened, who knows, and state/relationship/plot consequences.",
    "- attempted_not_confirmed, possible_future, candidate action, future route possibilities, foreshadowing, GM advice, next-step suggestions, and unchosen player options do not enter events.",
    "- If the material is a long route, storyline, timeline, or multi-event overview, keep only the discrete confirmed event here and route overview pressure to plot-arcs conceptually.",
  ].join("\n")
}

function currentScenePrompt(): string {
  return [
    "Current-scene merge for wiki/current-scene/scene_state.md:",
    "- This path is overwrite-only latest snapshot state, not accumulated history.",
    "- Keep only the immediate situation needed for the next turn: time, place, present participants, visible risks, available actions, unresolved prompts, and pending consequences.",
    "- Replace stale previous-scene state instead of preserving it.",
    "- Long-term changes need companion runtime overlay/player/quest/event updates; do not hide them only inside current-scene.",
    "- Do not write long-term lore, full character profiles, full event history, ending summaries, or route recaps here.",
  ].join("\n")
}

function manualControlPrompt(): string {
  return [
    "Manual-control merge for wiki/style/, wiki/rules/, or wiki/memory/:",
    "- These pages may contain user-authored high-priority control text. Preserve explicit user-written rules, memory notes, and variable/control blocks verbatim, especially {{setvar::...}} blocks.",
    "- Do not reinterpret, summarize away, or weaken manual rules.",
    "- Only add incoming material when it is explicitly intended for this manual/control layer and does not conflict with existing user-authored instructions.",
  ].join("\n")
}

function genericRpgPrompt(): string {
  return [
    "Generic RPG merge:",
    "- Apply the RPG runtime utility gate before preserving content.",
    "- Keep actionable, source-supported material and compress low-value encyclopedia prose.",
    "- If the path is not an allowed llmWikiRPG directory, avoid inventing schema or legacy behavior.",
  ].join("\n")
}

function unsupportedFixedSlotPathPrompt(category: "player" | "world", allowedPaths: readonly string[]): string {
  return [
    `Unsupported ${category} path merge:`,
    `- Current llmWikiRPG schema allows only these fixed ${category} slots: ${allowedPaths.join(", ")}.`,
    `- Do not treat this target as a normal ${category} slot and do not invent legacy/default behavior for arbitrary wiki/${category}/*.md pages.`,
    "- If useful content appears here, merge conservatively without expanding the schema or creating sibling paths.",
  ].join("\n")
}
