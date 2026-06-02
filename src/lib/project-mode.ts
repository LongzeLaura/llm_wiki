import { createDirectory, readFile, writeFile } from "@/commands/fs"
import { normalizePath } from "@/lib/path-utils"

export type ProjectMode = "default" | "llmwikirpg"

export interface ProjectModeOption {
  id: ProjectMode
  label: string
  description: string
}

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

export const PROJECT_MODE_OPTIONS: readonly ProjectModeOption[] = [
  {
    id: "default",
    label: "Default",
    description: "Legacy llm_wiki entities / concepts / sources workflow.",
  },
  {
    id: "llmwikirpg",
    label: "llmWikiRPG",
    description: "RPG wiki directories, prompts, and extraction semantics.",
  },
] as const

const LLMWIKIRPG_EXTRA_DIRS = [
  "wiki/world",
  "wiki/characters",
  "wiki/player",
  "wiki/locations",
  "wiki/factions",
  "wiki/items",
  "wiki/plot-arcs",
  "wiki/events",
  "wiki/current-scene",
  "wiki/relationships",
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
  if (normalized === "default") return "default"
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

export function getProjectModeBootstrap(mode: ProjectMode): ProjectModeBootstrap | null {
  if (mode !== "llmwikirpg") return null

  return {
    schema: [
      "wikiMode: llmwikirpg",
      "",
      "# Wiki Schema - llmWikiRPG",
      "",
      "## Core Extraction Directories",
      "",
      "| Type | Directory | Purpose |",
      "|------|-----------|---------|",
      "| source | wiki/sources/ | Source summaries, imported material provenance, and document-level notes |",
      "| world | wiki/world/ | Stable world facts, lore, history, social rules, and setting systems |",
      "| characters | wiki/characters/ | NPCs and major character profiles plus meaningful current state |",
      "| player | wiki/player/ | Player character identity, abilities, inventory, goals, and accepted state |",
      "| locations | wiki/locations/ | Places, scene locations, spatial relationships, and location state |",
      "| factions | wiki/factions/ | Groups, organizations, agendas, influence, and resources |",
      "| items | wiki/items/ | Important objects, clues, equipment, ownership, and condition |",
      "| plot-arcs | wiki/plot-arcs/ | Ongoing arcs, unresolved conflicts, foreshadowing, and future pressure |",
      "| events | wiki/events/ | Confirmed events that already happened and their consequences |",
      "| current-scene | wiki/current-scene/ | Latest scene snapshot only; overwrite instead of append |",
      "| relationships | wiki/relationships/ | Relationship state, trust, tension, dependency, and change |",
      "| overview | wiki/overview.md | High-level campaign overview |",
      "",
      "## Auxiliary Directories",
      "",
      "| Directory | Purpose |",
      "|-----------|---------|",
      "| wiki/style/ | Tone, narration style, voice, and presentation conventions |",
      "| wiki/rules/ | House rules, system rulings, and play constraints |",
      "| wiki/quests/ | Task lists, mission boards, or explicit objective tracking |",
      "| wiki/memory/ | Working notes, reminders, and temporary campaign memory aids |",
      "",
      "## Dynamic Update Rules",
      "",
      "- `wiki/current-scene/scene_state.md` is a snapshot and should be replaced on each meaningful scene advance.",
      "- `wiki/events/` is append-oriented history for confirmed happened events only.",
      "- `wiki/plot-arcs/` may contain foreshadowing, unresolved questions, and future pressure, but must not invent events as already happened.",
      "- `wiki/player/`, `wiki/characters/`, and `wiki/relationships/` should merge durable facts while updating current state carefully.",
      "- Preserve `sources:` frontmatter provenance on every generated page.",
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
      "- Prefer RPG directories over legacy `entities` / `concepts` for new extracted content.",
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
