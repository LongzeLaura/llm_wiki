import { createDirectory, readFile, writeFile } from "@/commands/fs"
import { normalizePath } from "@/lib/path-utils"

export type ProjectMode = "llmwikirpg"

export const DEFAULT_PROJECT_MODE: ProjectMode = "llmwikirpg"

export interface ProjectModeBootstrap {
  schema: string
  purpose: string
  index: string
  overview: string
  log: string
  extraDirs: string[]
}

interface ProjectMetadata {
  id?: string
  createdAt?: number
  mode?: string
}

const LLMWIKIRPG_EXTRA_DIRS = [
  "wiki/world",
  "wiki/characters",
  "wiki/characters/runtime",
  "wiki/player",
  "wiki/locations",
  "wiki/locations/runtime",
  "wiki/factions",
  "wiki/factions/runtime",
  "wiki/items",
  "wiki/items/runtime",
  "wiki/outlines",
  "wiki/plot-arcs",
  "wiki/plot-arcs/runtime",
  "wiki/events",
  "wiki/current-scene",
  "wiki/relationships",
  "wiki/relationships/runtime",
  "wiki/style",
  "wiki/rules",
  "wiki/quests",
  "wiki/memory",
] as const

function projectMetadataPath(projectPath: string): string {
  return `${normalizePath(projectPath)}/.llm-wiki/project.json`
}

export function normalizeProjectMode(mode?: string | null): ProjectMode | null {
  if (!mode) return null
  const normalized = mode.trim().toLowerCase()
  if (normalized === "rpg" || normalized === "llmwikirpg") return "llmwikirpg"
  return null
}

export async function readProjectMode(projectPath: string): Promise<ProjectMode | null> {
  try {
    const raw = await readFile(projectMetadataPath(projectPath))
    const parsed = JSON.parse(raw) as ProjectMetadata
    return normalizeProjectMode(parsed.mode)
  } catch {
    return null
  }
}

export async function writeProjectMode(projectPath: string, mode: ProjectMode): Promise<void> {
  const metadataPath = projectMetadataPath(projectPath)
  let existing: ProjectMetadata = {}
  try {
    existing = JSON.parse(await readFile(metadataPath)) as ProjectMetadata
  } catch {
    // Missing metadata is fine; create it below.
  }

  await createDirectory(`${normalizePath(projectPath)}/.llm-wiki`).catch(() => {})
  await writeFile(
    metadataPath,
    JSON.stringify({ ...existing, mode }, null, 2),
  )
}

export function getProjectModeBootstrap(): ProjectModeBootstrap {
  return {
    schema: [
      "wikiMode: llmwikirpg",
      "",
      "# Wiki Schema - llmWikiRPG",
      "",
      "## Project Boundary",
      "",
      "- This project schema supports only `llmwikirpg`.",
      "- Legacy directories rejected: `wiki/entities/`, `wiki/concepts/`, `wiki/queries/`, `wiki/comparisons/`, `wiki/synthesis/`, `wiki/methodology/`, `wiki/findings/`, `wiki/thesis/`.",
      "- Existing legacy files may remain on disk, but they are not valid product schema directories or write targets.",
      "",
      "## Runtime Wiki Directories",
      "",
      "| Path | Layer | Write policy | Contract |",
      "|------|-------|--------------|----------|",
      "| `wiki/sources/` | Evidence | ingest merge/append | Source evidence layer, imported material summaries, provenance, and document-level notes. |",
      "| `wiki/world/` | Stable base | ingest/manual merge; runtime blocked | Stable setting, lore, history, social rules, and world systems. |",
      "| `wiki/characters/` | Stable base | ingest/manual merge; runtime must not rewrite base pages | Base character models, canon facts, portrayal rules, and source-supported stable traits. |",
      "| `wiki/characters/runtime/` | Runtime overlay | runtime merge | Current campaign status overlays for characters: condition, intent, temporary resources, and scene-relevant changes. |",
      "| `wiki/player/` | Runtime/base state | runtime/manual merge | Player character identity, abilities, inventory, goals, knowledge, and accepted state. |",
      "| `wiki/locations/` | Stable base | ingest/manual merge; runtime must not rewrite base pages | Base location setting, layout, access rules, residents, and stable hooks. |",
      "| `wiki/locations/runtime/` | Runtime overlay | runtime merge | Current location status overlays: danger, access, occupants, damage, clues, and temporary atmosphere. |",
      "| `wiki/factions/` | Stable base | ingest/manual merge; runtime must not rewrite base pages | Base faction identity, agenda, members, resources, and durable relationships. |",
      "| `wiki/factions/runtime/` | Runtime overlay | runtime merge | Current faction stance/resource overlays for campaign-time pressure and temporary moves. |",
      "| `wiki/items/` | Stable base | ingest/manual merge; runtime must not rewrite base pages | Base item identity, capabilities, history, constraints, and plot function. |",
      "| `wiki/items/runtime/` | Runtime overlay | runtime merge | Current holder, location, condition, consumption, loss, damage, or other runtime item state. |",
      "| `wiki/outlines/main.md` | Manual control | manual_or_review_only | Author/GM-side main outline, future beats, reveal order, and branch conditions. |",
      "| `wiki/outlines/progress.md` | Runtime progress | runtime merge through pending/review | Current progress relative to the main outline: active beat, completed/skipped beats, and divergence notes. |",
      "| `wiki/plot-arcs/` | Dynamic derived | derivation/runtime merge | Unresolved conflicts, foreshadowing, possible developments, future pressure, and constraints. |",
      "| `wiki/plot-arcs/runtime/` | Runtime overlay | runtime merge | Current campaign changes to plot arcs, triggered/skipped beats, and pressure changes. |",
      "| `wiki/events/` | Timeline | append/create only | Confirmed events that already happened; never store hypothetical future outcomes as history. |",
      "| `wiki/current-scene/scene_state.md` | Snapshot | overwrite | Latest immediate scene snapshot only. |",
      "| `wiki/relationships/` | Dynamic derived | derivation/runtime merge | Relationship state, trust, tension, dependency, conflict, and relationship-change pressure. |",
      "| `wiki/relationships/runtime/` | Runtime overlay | runtime merge | Current campaign relationship deltas, trust changes, recent conflicts, and new misunderstandings. |",
      "| `wiki/style/` | Manual control | manual_or_review_only | Tone, narration style, dialogue style, forbidden patterns, variables, and presentation conventions. |",
      "| `wiki/rules/` | Manual control | manual_or_review_only | Core rules, world operation rules, table rules, safety boundaries, and runtime constraints. |",
      "| `wiki/quests/` | Objective tracking | manual/runtime merge | Goals, missions, tasks, blockers, completion state, and accepted runtime objective changes. |",
      "| `wiki/memory/` | Explicit memory | manual_or_review_only for player preferences; explicit review for other memory | User-approved memory and reminders; do not infer or write automatically. |",
      "| `wiki/overview.md` | Summary | manual/ingest merge | High-level campaign overview. |",
      "| `wiki/index.md` | Navigation | generated/manual refresh | Navigation index for the RPG wiki. |",
      "",
      "## Fixed Schema Slots",
      "",
      "New projects must create these fixed slot files. Missing slots mean the project structure is incomplete, not a legacy project compatibility case.",
      "",
      "| slotId | path | owner | write policy |",
      "|---|---|---|---|",
      "| `main_outline` | `wiki/outlines/main.md` | control_doc | manual_or_review_only |",
      "| `outline_progress` | `wiki/outlines/progress.md` | runtime | merge through pending/review |",
      "| `rules_core` | `wiki/rules/core.md` | control_doc | manual_or_review_only |",
      "| `rules_world` | `wiki/rules/world.md` | control_doc | manual_or_review_only |",
      "| `rules_table` | `wiki/rules/table.md` | control_doc | manual_or_review_only |",
      "| `style_narration` | `wiki/style/narration.md` | control_doc | manual_or_review_only |",
      "| `style_dialogue` | `wiki/style/dialogue.md` | control_doc | manual_or_review_only |",
      "| `style_forbidden` | `wiki/style/forbidden.md` | control_doc | manual_or_review_only |",
      "| `memory_player_preferences` | `wiki/memory/player-preferences.md` | control_doc | manual_or_review_only |",
      "| `memory_long_term` | `wiki/memory/long-term.md` | control_doc | manual_or_review_only |",
      "| `memory_session_notes` | `wiki/memory/session-notes.md` | control_doc | manual_or_review_only |",
      "| `current_scene` | `wiki/current-scene/scene_state.md` | runtime | overwrite |",
      "| `player_main` | `wiki/player/player.md` | campaign_setup | merge |",
      "| `player_abilities` | `wiki/player/abilities.md` | campaign_setup | merge |",
      "| `player_inventory` | `wiki/player/inventory.md` | campaign_setup | merge |",
      "| `player_goals` | `wiki/player/goals.md` | campaign_setup | merge |",
      "| `player_known_information` | `wiki/player/known_information.md` | campaign_setup | merge |",
      "",
      "- `rules/`, `style/`, `wiki/memory/player-preferences.md`, and `wiki/outlines/main.md` are manual_or_review_only control files.",
      "- `wiki/outlines/progress.md` is the runtime outline progress slot; runtime may merge it only inside the pending/review apply boundary.",
      "- `wiki/player/` is a fixed slot set. Do not create arbitrary player files; merge extra player subtopics into the five fixed player slots.",
      "",
      "## Overlay Resolution",
      "",
      "- For `characters`, `locations`, `factions`, and `items`, resolve the base page first, then apply the matching `runtime/` overlay by slug.",
      "- `relationships` and `plot-arcs` also use base plus `runtime/` overlay directories; broad resolver expansion can be refined in a later stage.",
      "- Example: `wiki/characters/rin.md` supplies the stable model; `wiki/characters/runtime/rin.md` supplies current campaign state.",
      "- Runtime agents may merge overlay pages, but base pages are runtime blocked and should only receive ingest/manual stable facts.",
      "- If base and overlay disagree, prefer the overlay for immediate play state and keep the base as the stable/source-supported contract.",
      "",
      "## Dynamic Update Rules",
      "",
      "- Static ingest output for `characters`, `locations`, `factions`, and `items` writes stable facts to base directories; runtime state writes to the matching `runtime/` overlay.",
      "- `wiki/current-scene/scene_state.md` is a snapshot and should be overwritten on each accepted scene advance.",
      "- `wiki/events/` is append/create-only history for confirmed happened events.",
      "- `wiki/plot-arcs/` may contain foreshadowing, unresolved questions, and future pressure, but must not invent events as already happened.",
      "- `wiki/player/` updates must target only fixed player slots.",
      "- `wiki/relationships/`, `wiki/quests/`, `wiki/outlines/progress.md`, and runtime overlays should merge accepted state without treating unchosen options as facts.",
      "- Avoid current-state pollution in historical `events`, and avoid writing unresolved future pressure as completed history.",
      "- Preserve `sources:` frontmatter provenance on every generated page.",
      "",
      "## Derived Content Frontmatter",
      "",
      "```yaml",
      "---",
      "type: relationships",
      "title: \"Rin and Player\"",
      "derived: true",
      "derivation_source: runtime",
      "sources: []",
      "related: []",
      "---",
      "```",
      "",
      "## Generated Page Frontmatter",
      "",
      "```yaml",
      "---",
      "type: characters",
      "title: \"Tohsaka Rin\"",
      "sources: []",
      "related: []",
      "tags: []",
      "---",
      "```",
    ].join("\n"),
    purpose: [
      "# Project Purpose - llmWikiRPG",
      "",
      "## Campaign Goal",
      "",
      "<!-- What campaign, module, setting, or interactive narrative does this wiki track? -->",
      "",
      "## Scope",
      "",
      "**In scope:**",
      "- World facts that matter during play",
      "- Player and NPC state that has become canon",
      "- Confirmed events, active scene state, and unresolved arcs",
      "",
      "**Out of scope:**",
      "- Pure speculation with no narrative support",
      "- Future plans written as if they already happened",
      "- Duplicate notes better stored in existing RPG directories",
      "",
      "## Current Focus",
      "",
      "<!-- Current chapter, scene, party objective, or campaign focus -->",
      "",
      "## Mode Notes",
      "",
      "- This project runs in `llmwikirpg` mode.",
      "- Use RPG runtime directories only; legacy `entities`, `concepts`, and `queries` are not supported.",
    ].join("\n"),
    index: [
      "# Wiki Index",
      "",
      "## Sources",
      "",
      "## World",
      "",
      "## Characters",
      "",
      "## Player",
      "",
      "## Locations",
      "",
      "## Factions",
      "",
      "## Items",
      "",
      "## Outlines",
      "",
      "## Plot Arcs",
      "",
      "## Events",
      "",
      "## Current Scene",
      "",
      "## Relationships",
      "",
      "## Style",
      "",
      "## Rules",
      "",
      "## Quests",
      "",
      "## Memory",
    ].join("\n"),
    overview: [
      "---",
      "type: overview",
      'title: "Campaign Overview"',
      "tags: []",
      "related: []",
      "---",
      "",
      "# Overview",
      "",
      "<!-- Summarize the campaign world, active conflicts, party situation, and current trajectory. -->",
    ].join("\n"),
    log: [
      "# Campaign Log",
      "",
      "## YYYY-MM-DD",
      "",
      "- Project created in llmWikiRPG mode",
    ].join("\n"),
    extraDirs: [...LLMWIKIRPG_EXTRA_DIRS],
  }
}
