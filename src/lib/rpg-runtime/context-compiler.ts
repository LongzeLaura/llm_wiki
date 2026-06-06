import { listDirectory, readFile } from "@/commands/fs"
import { getFileStem, normalizePath } from "@/lib/path-utils"
import type { FileNode } from "@/types/wiki"
import type { CompileRpgContextInput, CompactStoryBrief } from "./types"

interface RuntimePage {
  relativePath: string
  path: string
  content: string
}

interface RuntimePageGroup {
  slug: string
  pages: RuntimePage[]
  score: number
}

interface CompileRpgContextResult {
  brief: CompactStoryBrief
  warnings: string[]
}

const ALLOWED_RPG_RUNTIME_DIRS = [
  "sources",
  "world",
  "characters",
  "player",
  "locations",
  "factions",
  "items",
  "plot-arcs",
  "events",
  "current-scene",
  "relationships",
  "style",
  "rules",
  "memory",
] as const

const LEGACY_WIKI_DIRS = new Set([
  "entities",
  "concepts",
  "queries",
  "comparisons",
  "synthesis",
  "methodology",
  "findings",
  "thesis",
])

const MAX_SINGLE_TEXT_CHARS = 3000
const MAX_JOINED_TEXT_CHARS = 5000
const MAX_ENTRY_CHARS = 1400
const MAX_HIGH_PRIORITY_NOTES = 8
const MAX_REFERENCES = 40
const MAX_RELEVANT_PAGES = 6
const ACTION_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "is",
  "are",
  "be",
  "been",
  "from",
  "into",
  "ask",
  "why",
  "she",
  "her",
  "his",
  "him",
  "they",
  "them",
  "their",
  "can",
  "could",
  "would",
  "should",
  "open",
  "show",
  "look",
  "wait",
  "listen",
  "quietly",
])

export async function compileRpgContext(input: CompileRpgContextInput): Promise<CompileRpgContextResult> {
  const projectPath = normalizeProjectPath(input.projectPath)
  const warnings: string[] = []
  const references = new Set<string>()
  const actionTokens = tokenize(input.submittedAction.text)

  const currentScene = await readRequiredPage(projectPath, "wiki/current-scene/scene_state.md", warnings, references)
  const playerPages = await readMarkdownDir(projectPath, "player")
  const stylePages = await readMarkdownDir(projectPath, "style")
  const rulePages = await readMarkdownDir(projectPath, "rules")
  const memoryPages = await readMarkdownDir(projectPath, "memory")
  const worldPages = await readMarkdownDir(projectPath, "world")
  const eventPages = await readMarkdownDir(projectPath, "events")
  const plotArcPages = await readMarkdownDir(projectPath, "plot-arcs")
  const relationshipPages = await readMarkdownDir(projectPath, "relationships")

  const characterGroups = await readRelevantOverlayGroups(projectPath, "characters", actionTokens)
  const locationGroups = await readRelevantOverlayGroups(projectPath, "locations", actionTokens)
  const factionGroups = await readRelevantOverlayGroups(projectPath, "factions", actionTokens)
  const itemGroups = await readRelevantOverlayGroups(projectPath, "items", actionTokens)
  const sourcePages = await readMarkdownDir(projectPath, "sources", { referenceOnly: true })

  for (const sourcePage of sourcePages) {
    references.add(sourcePage.relativePath)
  }

  const relevantWorldPages = rankedPages(worldPages, actionTokens, MAX_RELEVANT_PAGES)
  const relevantEventPages = rankedPages(eventPages, actionTokens, MAX_RELEVANT_PAGES)
  const relevantPlotArcPages = rankedPages(plotArcPages, actionTokens, MAX_RELEVANT_PAGES)
  const relevantRelationshipPages = rankedPages(relationshipPages, actionTokens, MAX_RELEVANT_PAGES)

  markPages(references, playerPages, stylePages, rulePages, memoryPages, relevantWorldPages, relevantEventPages, relevantPlotArcPages, relevantRelationshipPages)
  markGroups(references, characterGroups, locationGroups, factionGroups, itemGroups)

  const highPriorityTexts = [...stylePages, ...rulePages, ...memoryPages, currentScene].map((page) => page.content)
  const brief: CompactStoryBrief = {
    submittedAction: input.submittedAction,
    currentScene: compactText(currentScene.content, MAX_SINGLE_TEXT_CHARS),
    playerState: joinPageContents(playerPages, MAX_JOINED_TEXT_CHARS),
    hardFacts: relevantWorldPages.map(formatPageEntry),
    activeConstraints: collectConstraintNotes([...rulePages, ...stylePages]),
    presentCharacters: characterGroups.map(formatGroupEntry),
    relationshipTensions: relevantRelationshipPages.map(formatPageEntry),
    activePlotPressure: relevantPlotArcPages.map(formatPageEntry),
    relevantLocations: locationGroups.map(formatGroupEntry),
    relevantFactions: factionGroups.map(formatGroupEntry),
    relevantItems: itemGroups.map(formatGroupEntry),
    styleRules: stylePages.slice(0, MAX_HIGH_PRIORITY_NOTES).map(formatPageEntry),
    ruleNotes: rulePages.slice(0, MAX_HIGH_PRIORITY_NOTES).map(formatPageEntry),
    memoryNotes: memoryPages.slice(0, MAX_HIGH_PRIORITY_NOTES).map(formatPageEntry),
    forbiddenContradictions: collectForbiddenContradictions(highPriorityTexts),
    references: [...references].filter(isAllowedReference).sort().slice(0, MAX_REFERENCES),
  }

  const recentEvents = relevantEventPages.map(formatPageEntry)
  brief.hardFacts.push(...recentEvents)

  return { brief, warnings }
}

function normalizeProjectPath(projectPath: string): string {
  return normalizePath(projectPath).replace(/\/+$/, "")
}

async function readRequiredPage(
  projectPath: string,
  relativePath: string,
  warnings: string[],
  references: Set<string>,
): Promise<RuntimePage> {
  if (!isAllowedWikiRelativePath(relativePath)) {
    warnings.push(`Skipped disallowed RPG runtime path: ${relativePath}`)
    return { relativePath, path: `${projectPath}/${relativePath}`, content: "" }
  }

  const path = `${projectPath}/${relativePath}`
  try {
    const content = sanitizeWikiContent(await readFile(path))
    references.add(relativePath)
    return { relativePath, path, content }
  } catch {
    warnings.push(`Missing required RPG runtime page: ${relativePath}`)
    return { relativePath, path, content: "" }
  }
}

async function readMarkdownDir(
  projectPath: string,
  dir: (typeof ALLOWED_RPG_RUNTIME_DIRS)[number],
  options: { referenceOnly?: boolean } = {},
): Promise<RuntimePage[]> {
  if (LEGACY_WIKI_DIRS.has(dir)) return []

  const root = `${projectPath}/wiki/${dir}`
  let tree: FileNode[] = []
  try {
    tree = await listDirectory(root)
  } catch {
    return []
  }

  const pages: RuntimePage[] = []
  for (const node of flattenMarkdownFiles(tree)) {
    const relativePath = toWikiRelativePath(projectPath, node.path)
    if (!isAllowedWikiRelativePath(relativePath)) continue

    if (options.referenceOnly) {
      pages.push({ relativePath, path: node.path, content: "" })
      continue
    }

    try {
      pages.push({
        relativePath,
        path: node.path,
        content: sanitizeWikiContent(await readFile(node.path)),
      })
    } catch {
      // Unreadable optional pages are ignored in v0 to keep compilation deterministic.
    }
  }

  return pages.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

async function readRelevantOverlayGroups(
  projectPath: string,
  dir: "characters" | "locations" | "factions" | "items",
  actionTokens: string[],
): Promise<RuntimePageGroup[]> {
  const pages = await readMarkdownDir(projectPath, dir)
  const groups = new Map<string, RuntimePage[]>()

  for (const page of pages) {
    const slug = overlayBaseSlug(page.relativePath)
    groups.set(slug, [...(groups.get(slug) ?? []), page])
  }

  return [...groups.entries()]
    .map(([slug, groupPages]) => ({
      slug,
      pages: groupPages.sort(compareBaseBeforeOverlay),
      score: Math.max(...groupPages.map((page) => scorePage(page, actionTokens))),
    }))
    .filter((group) => group.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, MAX_RELEVANT_PAGES)
}

function flattenMarkdownFiles(nodes: FileNode[]): FileNode[] {
  const files: FileNode[] = []
  for (const node of [...nodes].sort((a, b) => a.name.localeCompare(b.name))) {
    if (node.is_dir) {
      files.push(...flattenMarkdownFiles(node.children ?? []))
    } else if (node.name.toLowerCase().endsWith(".md")) {
      files.push(node)
    }
  }
  return files
}

function toWikiRelativePath(projectPath: string, absolutePath: string): string {
  const normalizedProject = normalizeProjectPath(projectPath)
  const normalizedPath = normalizePath(absolutePath)
  return normalizedPath.startsWith(`${normalizedProject}/`)
    ? normalizedPath.slice(normalizedProject.length + 1)
    : normalizedPath
}

function isAllowedWikiRelativePath(relativePath: string): boolean {
  const normalized = normalizePath(relativePath).replace(/^\/+/, "")
  const parts = normalized.split("/")
  if (parts[0] !== "wiki") return false
  const dir = parts[1]
  if (!dir || LEGACY_WIKI_DIRS.has(dir)) return false
  return ALLOWED_RPG_RUNTIME_DIRS.includes(dir as (typeof ALLOWED_RPG_RUNTIME_DIRS)[number])
}

function isAllowedReference(relativePath: string): boolean {
  return isAllowedWikiRelativePath(relativePath)
}

function sanitizeWikiContent(content: string): string {
  return stripUnchosenActionOptions(content.replace(/\r\n?/g, "\n")).trim()
}

function stripUnchosenActionOptions(content: string): string {
  const lines = content.split("\n")
  const kept: string[] = []
  let skippingOptions = false

  for (const line of lines) {
    const trimmed = line.trim()
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const headingText = heading[2].toLowerCase()
      if (isActionOptionsLabel(headingText)) {
        skippingOptions = true
        continue
      }
      skippingOptions = false
    }

    if (!heading && isActionOptionsLabel(trimmed.toLowerCase())) {
      skippingOptions = true
      continue
    }

    if (skippingOptions) {
      if (trimmed === "") skippingOptions = false
      continue
    }

    if (/unchosen\s+option|unselected\s+option|未选择|未選択/i.test(trimmed)) continue
    kept.push(line)
  }

  return kept.join("\n")
}

function isActionOptionsLabel(text: string): boolean {
  return /^(?:next\s+)?action\s+options?:?$/.test(text) ||
    /^options?:$/.test(text) ||
    text.includes("next action options") ||
    text.includes("行动选项") ||
    text.includes("候选行动") ||
    text.includes("下一步行动")
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().normalize("NFKC")
  const latinTokens = normalized.match(/[a-z0-9][a-z0-9_-]{1,}/g) ?? []
  const cjkTokens = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu) ?? []
  return [...new Set([...latinTokens, ...cjkTokens])].filter((token) => !ACTION_STOP_WORDS.has(token))
}

function scorePage(page: RuntimePage, actionTokens: string[]): number {
  if (actionTokens.length === 0) return 0

  const haystack = `${page.relativePath}\n${extractTitle(page.content)}\n${page.content}`.toLowerCase().normalize("NFKC")
  return actionTokens.reduce((score, token) => {
    if (!haystack.includes(token)) return score
    const pathBonus = page.relativePath.toLowerCase().includes(token) ? 4 : 0
    const titleBonus = extractTitle(page.content).toLowerCase().includes(token) ? 3 : 0
    return score + 1 + pathBonus + titleBonus
  }, 0)
}

function rankedPages(pages: RuntimePage[], actionTokens: string[], limit: number): RuntimePage[] {
  return pages
    .map((page, index) => ({ page, score: scorePage(page, actionTokens), index }))
    .sort((a, b) => b.score - a.score || a.page.relativePath.localeCompare(b.page.relativePath) || a.index - b.index)
    .slice(0, limit)
    .map(({ page }) => page)
}

function overlayBaseSlug(relativePath: string): string {
  const parts = normalizePath(relativePath).split("/")
  const runtimeIndex = parts.indexOf("runtime")
  if (runtimeIndex >= 0) {
    return getFileStem(parts.slice(runtimeIndex + 1).join("/"))
  }
  return getFileStem(parts.slice(2).join("/"))
}

function compareBaseBeforeOverlay(a: RuntimePage, b: RuntimePage): number {
  const aOverlay = normalizePath(a.relativePath).includes("/runtime/")
  const bOverlay = normalizePath(b.relativePath).includes("/runtime/")
  if (aOverlay !== bOverlay) return aOverlay ? 1 : -1
  return a.relativePath.localeCompare(b.relativePath)
}

function extractTitle(content: string): string {
  const frontmatterTitleMatch = content.match(/^---\n[\s\S]*?^title:\s*["']?(.+?)["']?\s*$/m)
  if (frontmatterTitleMatch) return frontmatterTitleMatch[1].trim()
  const headingMatch = content.match(/^#\s+(.+)$/m)
  return headingMatch?.[1]?.trim() ?? ""
}

function formatPageEntry(page: RuntimePage): string {
  return compactText(`[${page.relativePath}]\n${page.content}`, MAX_ENTRY_CHARS)
}

function formatGroupEntry(group: RuntimePageGroup): string {
  return compactText(group.pages.map(formatPageEntry).join("\n\n"), MAX_ENTRY_CHARS * 2)
}

function markPages(references: Set<string>, ...pageLists: RuntimePage[][]): void {
  for (const page of pageLists.flat()) {
    references.add(page.relativePath)
  }
}

function markGroups(references: Set<string>, ...groupLists: RuntimePageGroup[][]): void {
  for (const group of groupLists.flat()) {
    for (const page of group.pages) {
      references.add(page.relativePath)
    }
  }
}

function joinPageContents(pages: RuntimePage[], maxChars: number): string {
  return compactText(pages.map(formatPageEntry).join("\n\n"), maxChars)
}

function compactText(text: string, maxChars: number): string {
  const normalized = text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars - 20).trimEnd()}\n[truncated]`
}

function collectConstraintNotes(pages: RuntimePage[]): string[] {
  return pages
    .flatMap((page) => extractMatchingLines(page, /must|should|forbid|forbidden|never|cannot|can't|禁止|不能|不得|必须|應|應該/i))
    .slice(0, MAX_HIGH_PRIORITY_NOTES)
}

function collectForbiddenContradictions(texts: string[]): string[] {
  return texts
    .flatMap((text) => text.split("\n").map((line) => line.trim()))
    .filter((line) => /forbid|forbidden|never|cannot|can't|contradiction|禁止|不能|不得|矛盾|禁忌/i.test(line))
    .map((line) => compactText(line, 280))
    .slice(0, MAX_HIGH_PRIORITY_NOTES)
}

function extractMatchingLines(page: RuntimePage, pattern: RegExp): string[] {
  return page.content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && pattern.test(line))
    .map((line) => compactText(`[${page.relativePath}] ${line}`, 320))
}
