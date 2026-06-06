import { RPG_CATEGORIES } from "./rpg-categories"

export type WikiMode = "llmwikirpg"

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
      throw new Error("Legacy default llm_wiki projects are no longer supported. Open an llmWikiRPG project instead.")
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
  let parsedProjectMeta: { mode?: string } | null = null
  try {
    parsedProjectMeta = projectMeta ? JSON.parse(projectMeta) as { mode?: string } : null
  } catch {
    if (projectMeta.trim().startsWith("{")) {
      throw new Error("Invalid .llm-wiki/project.json; cannot verify this as an llmWikiRPG project.")
    }
  }

  if (parsedProjectMeta) {
    const metadataMode = parsedProjectMeta.mode ? normalizeWikiModeValue(parsedProjectMeta.mode) : ""
    if (metadataMode === "default") {
      throw new Error("Legacy default llm_wiki projects are no longer supported. Open an llmWikiRPG project instead.")
    }
    if (metadataMode === "rpg" || metadataMode === "llmwikirpg") return "llmwikirpg"
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

  if (matchedRpgDirs.size >= 3) return "llmwikirpg"

  throw new Error("This project is not an llmWikiRPG project. Legacy llm_wiki mode has been removed.")
}
