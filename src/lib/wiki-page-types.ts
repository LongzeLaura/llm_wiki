import {
  categoryDirectorySegment,
  getCategoryDefinition,
  getAllCategoryDefinitions,
  getGenerationCategoryIds,
  inferRegisteredCategoryFromPath,
} from "@/lib/category-registry"

// Keep the default prompt-visible type list aligned with the legacy profile
// until phase 4 explicitly adapts prompt construction by profile.
export const GENERATION_WIKI_TYPES = getGenerationCategoryIds() as readonly string[]

const REGISTERED_WIKI_LOOKUP_DIRS = getAllCategoryDefinitions()
  .map((definition) => categoryDirectorySegment(definition.directory))
  .filter((directory): directory is string => Boolean(directory))

export function inferWikiTypeFromPath(path: string, fileName?: string): string | null {
  const normalized = path.replace(/\\/g, "/").toLowerCase()
  const name = (fileName ?? normalized.split("/").pop() ?? "").toLowerCase()
  if (name === "overview.md" || normalized.includes("/overview.md")) return "overview"
  const registered = inferRegisteredCategoryFromPath(normalized)
  if (registered) return registered.id
  const customDir = normalized.match(/(?:^|\/)wiki\/([^/.][^/]*)\/[^/]+\.md$/)?.[1]
  if (customDir) return customDir
  return null
}

export function resolveRegisteredWikiPageType(
  type: string | null | undefined,
  path?: string,
): string | null {
  const registered = getCategoryDefinition(type)
  if (registered) return registered.id
  if (type?.trim()) return null
  const inferred = path ? inferRegisteredCategoryFromPath(path) : undefined
  return inferred?.id ?? null
}

export function buildWikiPageLookupCandidates(
  projectPath: string,
  wikiPathOrSlug: string,
): string[] {
  const normalizedProjectPath = projectPath.replace(/\\/g, "/").replace(/\/+$/g, "")
  const normalizedInput = wikiPathOrSlug.trim().replace(/\\/g, "/").replace(/^\/+/g, "")
  const slug = normalizedInput
    .replace(/^wiki\//, "")
    .replace(/\.md$/i, "")
    .split("/")
    .pop()

  if (!slug) return []

  const candidates = new Set<string>()

  if (normalizedInput.startsWith("wiki/")) {
    const relativePath = normalizedInput.endsWith(".md") ? normalizedInput : `${normalizedInput}.md`
    candidates.add(`${normalizedProjectPath}/${relativePath}`)
  }

  for (const directory of REGISTERED_WIKI_LOOKUP_DIRS) {
    candidates.add(`${normalizedProjectPath}/wiki/${directory}/${slug}.md`)
  }

  candidates.add(`${normalizedProjectPath}/wiki/${slug}.md`)
  return [...candidates]
}

export function wikiTypeLabel(type: string): string {
  const definition = getCategoryDefinition(type)
  if (definition) return definition.displayLabel
  return type
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
