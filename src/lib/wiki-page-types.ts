import { RPG_CATEGORIES, getRpgCategoryById } from "./rpg-categories"

export const GENERATION_WIKI_TYPES = [
  "source",
  ...RPG_CATEGORIES.filter((category) => category.id !== "sources").map((category) => category.id),
] as const

const WIKI_TYPE_DIRS: Array<{ dir: string; type: string }> = [
  { dir: "sources", type: "source" },
  ...RPG_CATEGORIES.filter((category) => category.id !== "sources").map((category) => ({
    dir: category.path.replace(/^wiki\//, ""),
    type: category.id,
  })),
  { dir: "style", type: "style" },
  { dir: "rules", type: "rules" },
  { dir: "quests", type: "quests" },
  { dir: "memory", type: "memory" },
]

export function inferWikiTypeFromPath(path: string, fileName?: string): string | null {
  const normalized = path.replace(/\\/g, "/").toLowerCase()
  for (const { dir, type } of WIKI_TYPE_DIRS) {
    if (normalized.includes(`/wiki/${dir}/`) || normalized.includes(`/${dir}/`) || normalized.startsWith(`wiki/${dir}/`)) {
      return type
    }
  }
  const name = (fileName ?? normalized.split("/").pop() ?? "").toLowerCase()
  if (name === "overview.md" || normalized.includes("/overview.md")) return "overview"
  const customDir = normalized.match(/(?:^|\/)wiki\/([^/.][^/]*)\/[^/]+\.md$/)?.[1]
  if (customDir) return customDir
  return null
}

export function wikiTypeLabel(type: string): string {
  const rpgCategory = getRpgCategoryById(type)
  if (rpgCategory) return rpgCategory.label
  return type
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
