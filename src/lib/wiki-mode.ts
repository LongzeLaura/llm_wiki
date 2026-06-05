import { RPG_CATEGORIES } from "./rpg-categories"

export type WikiMode = "default" | "llmwikirpg"

export function isRpgWikiMode(mode: WikiMode): mode is "llmwikirpg" {
  return mode === "llmwikirpg"
}

interface DetectWikiModeInput {
  schema?: string
  purpose?: string
  index?: string
  paths?: readonly string[]
  projectMeta?: string
}

const EXPLICIT_WIKI_MODE_REGEX = /\bwiki(?:-|_|\s)?mode\s*[:=]\s*["']?(default|rpg|llmwikirpg)\b/i

const DISTINCTIVE_RPG_DIRS = [
  "world",
  "player",
  "locations",
  "factions",
  "items",
  "plot-arcs",
  "events",
  "current-scene",
  "relationships",
] as const

const ALL_RPG_DIRS = RPG_CATEGORIES.map((category) => category.path.replace(/^wiki\//, ""))

function normalizeWikiModeValue(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase()
}

function containsWikiDir(haystack: string, dir: string): boolean {
  return (
    haystack.includes(`wiki/${dir}/`) ||
    haystack.includes(`/wiki/${dir}/`) ||
    haystack.endsWith(`wiki/${dir}`) ||
    haystack.endsWith(`/wiki/${dir}`)
  )
}

export function detectExplicitWikiMode(...texts: Array<string | undefined>): WikiMode | null {
  for (const text of texts) {
    if (!text) continue
    const match = text.match(EXPLICIT_WIKI_MODE_REGEX)
    if (match?.[1] === "default") {
      return "default"
    }
    if (match?.[1] === "rpg" || match?.[1] === "llmwikirpg") {
      return "llmwikirpg"
    }
  }
  return null
}

export function detectWikiMode({
  schema = "",
  purpose = "",
  index = "",
  paths = [],
  projectMeta = "",
}: DetectWikiModeInput): WikiMode {
  try {
    const parsed = JSON.parse(projectMeta) as { mode?: string }
    const metadataMode = parsed?.mode ? normalizeWikiModeValue(parsed.mode) : ""
    if (metadataMode === "default") return "default"
    if (metadataMode === "rpg" || metadataMode === "llmwikirpg") return "llmwikirpg"
  } catch {
    // Non-JSON text falls through to the existing marker and heuristic logic.
  }

  const explicit = detectExplicitWikiMode(projectMeta, schema, purpose, index)
  if (explicit) return explicit

  const haystacks = [projectMeta, schema, purpose, index, ...paths].map(normalizeWikiModeValue)

  if (haystacks.some((value) => DISTINCTIVE_RPG_DIRS.some((dir) => containsWikiDir(value, dir)))) {
    return "llmwikirpg"
  }

  const matchedRpgDirs = new Set<string>()
  for (const value of haystacks) {
    for (const dir of ALL_RPG_DIRS) {
      if (containsWikiDir(value, dir)) {
        matchedRpgDirs.add(dir)
      }
    }
  }

  return matchedRpgDirs.size >= 3 ? "llmwikirpg" : "default"
}
