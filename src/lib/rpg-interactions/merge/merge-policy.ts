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
  const runtimeOverlay = isRuntimeOverlayPath(matchPath)

  if (categoryId === "sources") {
    return definePolicy(normalizedPath, categoryId, "source-evidence", DEFAULT_BODY_SHRINK_THRESHOLD, sourceEvidencePrompt())
  }

  if (categoryId === "current-scene") {
    return definePolicy(normalizedPath, categoryId, "current-scene", COMPRESSIVE_BODY_SHRINK_THRESHOLD, currentScenePrompt())
  }

  if (categoryId === "events") {
    return definePolicy(normalizedPath, categoryId, "event-history", DEFAULT_BODY_SHRINK_THRESHOLD, eventHistoryPrompt())
  }

  if (categoryId === "relationships") {
    return definePolicy(normalizedPath, categoryId, "relationship-tension", COMPRESSIVE_BODY_SHRINK_THRESHOLD, relationshipTensionPrompt())
  }

  if (categoryId === "plot-arcs") {
    return definePolicy(normalizedPath, categoryId, "plot-pressure", COMPRESSIVE_BODY_SHRINK_THRESHOLD, plotPressurePrompt())
  }

  if (categoryId === "player" || categoryId === "quests" || runtimeOverlay) {
    return definePolicy(normalizedPath, categoryId, "runtime-state", COMPRESSIVE_BODY_SHRINK_THRESHOLD, runtimeStatePrompt())
  }

  if (isStableOperatingModelCategory(categoryId)) {
    return definePolicy(normalizedPath, categoryId, "stable-operating-model", STABLE_MODEL_BODY_SHRINK_THRESHOLD, stableOperatingModelPrompt(categoryId))
  }

  if (categoryId === "style" || categoryId === "rules" || categoryId === "memory") {
    return definePolicy(normalizedPath, categoryId, "manual-control", DEFAULT_BODY_SHRINK_THRESHOLD, manualControlPrompt())
  }

  return definePolicy(normalizedPath, categoryId, "generic-rpg", DEFAULT_BODY_SHRINK_THRESHOLD, genericRpgPrompt())
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
): RpgMergePolicy {
  return { pagePath, categoryId, kind, bodyShrinkThreshold, promptFragment }
}

function normalizeWikiPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/")
}

function getRpgCategoryIdFromPath(relativePath: string): string | null {
  const match = relativePath.match(/^wiki\/([^/]+)(?:\/|$)/)
  return match?.[1] ?? null
}

function isRuntimeOverlayPath(path: string): boolean {
  return /^wiki\/(characters|locations|factions|items)\/runtime\//.test(path)
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

function runtimeStatePrompt(): string {
  return [
    "Runtime state merge:",
    "- Merge accepted current campaign state, not stable canon.",
    "- New confirmed state replaces stale old state; do not keep obsolete locations, attitudes, holders, conditions, goals, or temporary effects unless they still matter as consequences.",
    "- Prioritize next-turn usefulness: current goals, resources, inventory, wounds, obligations, promises, permissions, known information, objective progress, obstacles, and accepted consequences.",
    "- Do not record unchosen options, possible actions, or speculative future plans as accepted state.",
  ].join("\n")
}

function relationshipTensionPrompt(): string {
  return [
    "Relationship/tension merge for wiki/relationships/*.md:",
    "- Merge relationship state as playable tension, not duplicate biographies.",
    "- Prioritize trust, distrust, dependence, obligation, fear, guilt, attraction, rivalry, control, protection, secrets, misunderstandings, leverage points, escalation triggers, and de-escalation triggers.",
    "- Clearly separate confirmed shared history from inferred_for_play interpretation.",
    "- Replace stale current relationship state instead of keeping contradictory old and new states side by side.",
    "- Do not duplicate full character profiles or one-off interactions with no relationship impact.",
  ].join("\n")
}

function plotPressurePrompt(): string {
  return [
    "Plot pressure merge for wiki/plot-arcs/*.md:",
    "- Merge unresolved story pressure, not a route encyclopedia.",
    "- Prioritize unresolved questions, active conflicts, foreshadowing, reveal pacing, blockers, dependencies, possible developments, and conditions for progression.",
    "- Clearly separate confirmed facts from possible futures.",
    "- Do not write possible future developments as already happened and do not resolve conflicts early.",
    "- Link to discrete events for confirmed occurrences instead of duplicating the full event timeline.",
  ].join("\n")
}

function eventHistoryPrompt(): string {
  return [
    "Event-history merge for wiki/events/*.md:",
    "- Keep only discrete, confirmed, already-happened events and their consequences.",
    "- Prioritize time or sequence marker, place, participants, what happened, who knows, and state/relationship/plot consequences.",
    "- Do not include future route possibilities, foreshadowing, GM advice, next-step suggestions, or unchosen player options.",
    "- If the material is a long route, storyline, timeline, or multi-event overview, keep only the discrete confirmed event here and route overview pressure to plot-arcs conceptually.",
  ].join("\n")
}

function currentScenePrompt(): string {
  return [
    "Current-scene merge for wiki/current-scene/scene_state.md:",
    "- This path is a latest scene snapshot, not accumulated history.",
    "- Keep only the immediate situation needed for the next turn: time, place, present participants, visible risks, available actions, unresolved prompts, and pending consequences.",
    "- Replace stale previous-scene state instead of preserving it.",
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
