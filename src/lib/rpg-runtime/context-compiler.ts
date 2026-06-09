import { listDirectory, readFile } from "@/commands/fs"
import { getFileStem, normalizePath } from "@/lib/path-utils"
import {
  getRpgSchemaSlot,
  type RpgSchemaSlot,
  type RpgSchemaSlotId,
} from "@/lib/rpg-wiki-schema"
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

interface MarkdownSection {
  heading: string
  lines: string[]
  level: number
  startIndex: number
  endIndex: number
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
  "outlines",
  "style",
  "rules",
  "quests",
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
const MIN_PARTIAL_SECTION_CHARS = 220
const CURRENT_SCENE_SLOT_ID = "current_scene" satisfies RpgSchemaSlotId
const OUTLINE_SLOT_IDS = ["main_outline", "outline_progress"] as const satisfies readonly RpgSchemaSlotId[]
const PLAYER_SLOT_IDS = [
  "player_main",
  "player_abilities",
  "player_inventory",
  "player_goals",
  "player_known_information",
] as const satisfies readonly RpgSchemaSlotId[]
const RULE_SLOT_IDS = ["rules_core", "rules_world", "rules_table"] as const satisfies readonly RpgSchemaSlotId[]
const STYLE_SLOT_IDS = ["style_narration", "style_dialogue", "style_forbidden"] as const satisfies readonly RpgSchemaSlotId[]
const MEMORY_SLOT_IDS = [
  "memory_player_preferences",
  "memory_long_term",
  "memory_session_notes",
] as const satisfies readonly RpgSchemaSlotId[]
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

  const currentScene = await readRequiredSchemaSlot(projectPath, CURRENT_SCENE_SLOT_ID, warnings, references)
  const outlinePages = await readSchemaSlotPages(projectPath, OUTLINE_SLOT_IDS, warnings)
  const playerPages = await readSchemaSlotPages(projectPath, PLAYER_SLOT_IDS, warnings)
  const stylePages = mergeSlotPagesWithDirectoryPages(
    await readSchemaSlotPages(projectPath, STYLE_SLOT_IDS, warnings),
    await readMarkdownDir(projectPath, "style"),
  )
  const rulePages = mergeSlotPagesWithDirectoryPages(
    await readSchemaSlotPages(projectPath, RULE_SLOT_IDS, warnings),
    await readMarkdownDir(projectPath, "rules"),
  )
  const memoryPages = mergeSlotPagesWithDirectoryPages(
    await readSchemaSlotPages(projectPath, MEMORY_SLOT_IDS, warnings),
    await readMarkdownDir(projectPath, "memory"),
  )
  const worldPages = await readMarkdownDir(projectPath, "world")
  const eventPages = await readMarkdownDir(projectPath, "events")
  const questPages = await readMarkdownDir(projectPath, "quests")

  const characterGroups = await readRelevantOverlayGroups(projectPath, "characters", actionTokens)
  const locationGroups = await readRelevantOverlayGroups(projectPath, "locations", actionTokens)
  const factionGroups = await readRelevantOverlayGroups(projectPath, "factions", actionTokens)
  const itemGroups = await readRelevantOverlayGroups(projectPath, "items", actionTokens)
  const relationshipGroups = await readRelevantOverlayGroups(projectPath, "relationships", actionTokens)
  const plotArcGroups = await readRelevantOverlayGroups(projectPath, "plot-arcs", actionTokens)
  const sourcePages = await readMarkdownDir(projectPath, "sources", { referenceOnly: true })

  for (const sourcePage of sourcePages) {
    references.add(sourcePage.relativePath)
  }

  const relevantWorldPages = rankedPages(worldPages, actionTokens, MAX_RELEVANT_PAGES)
  const relevantEventPages = rankedPages(eventPages, actionTokens, MAX_RELEVANT_PAGES)
  const relevantQuestPages = rankedPages(questPages, actionTokens, MAX_RELEVANT_PAGES)

  markPages(references, outlinePages, playerPages, stylePages, rulePages, memoryPages, relevantWorldPages, relevantEventPages, relevantQuestPages)
  markGroups(references, characterGroups, locationGroups, factionGroups, itemGroups, relationshipGroups, plotArcGroups)

  const highPriorityTexts = [...stylePages, ...rulePages, ...memoryPages, currentScene].map((page) => page.content)
  const brief: CompactStoryBrief = {
    submittedAction: input.submittedAction,
    currentScene: compactText(currentScene.content, MAX_SINGLE_TEXT_CHARS),
    playerState: joinPageContents(playerPages, MAX_JOINED_TEXT_CHARS),
    hardFacts: relevantWorldPages.map(formatPageEntry),
    activeConstraints: collectConstraintNotes([...rulePages, ...stylePages]),
    presentCharacters: characterGroups.map(formatGroupEntry),
    relationshipTensions: relationshipGroups.map(formatGroupEntry),
    activePlotPressure: plotArcGroups.map(formatGroupEntry),
    outlineNotes: outlinePages.map(formatPageEntry),
    activeQuests: relevantQuestPages.map(formatPageEntry),
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

async function readRequiredSchemaSlot(
  projectPath: string,
  slotId: RpgSchemaSlotId,
  warnings: string[],
  references: Set<string>,
): Promise<RuntimePage> {
  const slot = requireRpgSchemaSlot(slotId)
  const page = await readSchemaSlotPage(projectPath, slot, warnings)
  if (page) {
    references.add(page.relativePath)
    return page
  }
  return { relativePath: slot.path, path: `${projectPath}/${slot.path}`, content: "" }
}

async function readSchemaSlotPages(
  projectPath: string,
  slotIds: readonly RpgSchemaSlotId[],
  warnings: string[],
): Promise<RuntimePage[]> {
  const pages: RuntimePage[] = []
  for (const slotId of slotIds) {
    const page = await readSchemaSlotPage(projectPath, requireRpgSchemaSlot(slotId), warnings)
    if (page) pages.push(page)
  }
  return pages
}

async function readSchemaSlotPage(
  projectPath: string,
  slot: RpgSchemaSlot,
  warnings: string[],
): Promise<RuntimePage | null> {
  const relativePath = slot.path
  if (!isAllowedWikiRelativePath(relativePath)) {
    warnings.push(`Skipped disallowed RPG runtime path: ${relativePath}`)
    return null
  }

  const path = `${projectPath}/${relativePath}`
  try {
    const content = sanitizeWikiContent(await readFile(path))
    return { relativePath, path, content }
  } catch {
    if (slot.requiredForNewProject) {
      warnings.push(`Missing required RPG schema slot: ${slot.slotId} (${slot.path})`)
    }
    return null
  }
}

function requireRpgSchemaSlot(slotId: RpgSchemaSlotId): RpgSchemaSlot {
  const slot = getRpgSchemaSlot(slotId)
  if (!slot) throw new Error(`Missing RPG schema slot definition: ${slotId}`)
  return slot
}

function mergeSlotPagesWithDirectoryPages(slotPages: RuntimePage[], dirPages: RuntimePage[]): RuntimePage[] {
  const fixedPaths = new Set(slotPages.map((page) => normalizePath(page.relativePath).toLowerCase()))
  const extraPages = dirPages.filter((page) => !fixedPaths.has(normalizePath(page.relativePath).toLowerCase()))
  return [...slotPages, ...extraPages]
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
  dir: "characters" | "locations" | "factions" | "items" | "relationships" | "plot-arcs",
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
  const prefix = `[${page.relativePath}]`
  const selectedContent = selectRuntimeContentForPage(page, MAX_ENTRY_CHARS - prefix.length - 1)
  return compactText(`${prefix}\n${selectedContent}`, MAX_ENTRY_CHARS)
}

function formatGroupEntry(group: RuntimePageGroup): string {
  return compactText(group.pages.map(formatPageEntry).join("\n\n"), MAX_ENTRY_CHARS * 2)
}

function selectRuntimeContentForPage(page: RuntimePage, maxChars: number): string {
  const sections = parseMarkdownSections(page.content)
  const selectedSections = selectRuntimeSections(sections, runtimeSectionPatternsFor(page.relativePath))

  if (selectedSections.length > 0) {
    return compactSections(selectedSections, maxChars)
  }

  return compactText(page.content, maxChars)
}

function parseMarkdownSections(content: string): MarkdownSection[] {
  const lines = content.split("\n")
  const headings = lines.flatMap((line, index) => {
    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (!match) return []
    return [{ index, level: match[1].length, heading: match[2].trim() }]
  })

  return headings.map((heading, index) => {
    const nextBoundary = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)
    const endIndex = nextBoundary?.index ?? lines.length
    return {
      heading: heading.heading,
      lines: lines.slice(heading.index, endIndex),
      level: heading.level,
      startIndex: heading.index,
      endIndex,
    }
  })
}

function selectRuntimeSections(sections: MarkdownSection[], patternGroups: RegExp[][]): MarkdownSection[] {
  const selected: MarkdownSection[] = []

  for (const patterns of patternGroups) {
    for (const section of sections) {
      if (selected.includes(section)) continue
      if (isInsideSelectedSection(section, selected)) continue
      if (!sectionHasBody(section)) continue
      if (!matchesHeading(section.heading, patterns)) continue
      selected.push(section)
    }
  }

  return selected
}

function isInsideSelectedSection(section: MarkdownSection, selected: MarkdownSection[]): boolean {
  return selected.some(
    (selectedSection) =>
      selectedSection !== section &&
      selectedSection.startIndex < section.startIndex &&
      selectedSection.endIndex >= section.endIndex,
  )
}

function compactSections(sections: MarkdownSection[], maxChars: number): string {
  const kept: string[] = []
  let usedChars = 0

  for (const section of sections) {
    const text = section.lines.join("\n").trim()
    if (!text) continue

    const separatorChars = kept.length > 0 ? 2 : 0
    const remaining = maxChars - usedChars - separatorChars
    if (remaining <= 0) break

    if (text.length <= remaining) {
      kept.push(text)
      usedChars += separatorChars + text.length
      continue
    }

    if (kept.length === 0 || remaining >= MIN_PARTIAL_SECTION_CHARS) {
      const compacted = compactText(text, remaining)
      kept.push(compacted)
      usedChars += separatorChars + compacted.length
    }
    break
  }

  return compactText(kept.join("\n\n"), maxChars)
}

function sectionHasBody(section: MarkdownSection): boolean {
  return section.lines.slice(1).some((line) => line.trim().length > 0)
}

function matchesHeading(heading: string, patterns: RegExp[]): boolean {
  const normalized = normalizeHeading(heading)
  return patterns.some((pattern) => pattern.test(normalized))
}

function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[：:]/g, " ")
    .replace(/[\-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function runtimeSectionPatternsFor(relativePath: string): RegExp[][] {
  const category = normalizePath(relativePath).split("/")[1]
  const capsule = runtimeCapsuleSectionPatterns()

  if (category === "characters") {
    return [
      capsule,
      [/\bbehavior rules?\b/, /行为规则/, /行為規則/],
      [/\bdialogue style\b/, /对白风格/, /對白風格/, /说话风格/, /說話風格/],
      [/\brelationship levers?\b/, /关系杠杆/, /關係槓桿/, /关系触发/, /關係觸發/],
      [/\bpsychological model\b/, /心理模型/],
    ]
  }

  if (category === "locations") {
    return [
      capsule,
      [/\bscene hooks?\b/, /场景钩子/, /場景鉤子/],
      [/\binteractables?\b/, /可交互/, /可互动/, /可互動/],
      [/\brisks?\b/, /\bdangers?\b/, /风险/, /風險/, /危险/, /危險/],
      [/\bclues?\b/, /线索/, /線索/],
      [/\bsensory anchors?\b/, /感官锚点/, /感官錨點/],
    ]
  }

  if (category === "relationships") {
    return [
      capsule,
      [/\b(?:current|active) tension\b/, /当前张力/, /當前張力/, /目前张力/, /目前張力/],
      [/\btriggers?\b/, /触发器/, /觸發器/],
      [/\bunresolved questions?\b/, /未解问题/, /未解問題/],
      [/\bprogression conditions?\b/, /\bleverage\b/, /推进条件/, /推進條件/, /杠杆/, /槓桿/],
    ]
  }

  if (category === "plot-arcs") {
    return [
      capsule,
      [/\b(?:current|active) pressure\b/, /\bcurrent stage\b/, /当前压力/, /當前壓力/, /当前阶段/, /當前階段/],
      [/\btriggers?\b/, /触发器/, /觸發器/],
      [/\bunresolved questions?\b/, /未解问题/, /未解問題/],
      [/\bprogression conditions?\b/, /推进条件/, /推進條件/],
    ]
  }

  if (category === "events") {
    return [
      capsule,
      [/\bconfirmed consequences?\b/, /已确认后果/, /已確認後果/],
      [/\bstate changes?\b/, /状态变化/, /狀態變化/],
      [/\bopen fallout\b/, /后续影响/, /後續影響/, /遗留后果/, /遺留後果/],
    ]
  }

  if (category === "player") {
    return [
      capsule,
      [/\bcurrent (?:state|status)\b/, /当前状态/, /當前狀態/],
      [/\bresources?\b/, /资源/, /資源/],
      [/\binjur(?:y|ies)\b/, /\bwounds?\b/, /伤势/, /傷勢/],
      [/\bintent(?:ion)?s?\b/, /意图/, /意圖/],
      [/\blimit(?:s|ations)?\b/, /限制/],
      [/\brelationship status\b/, /关系状态/, /關係狀態/],
    ]
  }

  if (category === "style") {
    return [
      capsule,
      [/\bstyle rules?\b/, /文风规则/, /文風規則/],
      [/\bdialogue rules?\b/, /对白规则/, /對白規則/],
      [/\btone\b/, /基调/, /基調/],
      [/\bforbidden\b/, /禁止/, /禁用/],
    ]
  }

  if (category === "rules") {
    return [
      capsule,
      [/\bhard rules?\b/, /硬规则/, /硬規則/],
      [/\bconstraints?\b/, /约束/, /約束/],
      [/\bcosts?\b/, /代价/, /代價/],
      [/\bsuccess\b.*\bfailure\b/, /成功.*失败/, /成功.*失敗/],
      [/\bforbidden\b/, /禁止/, /禁用/],
    ]
  }

  return [
    capsule,
    [/\bruntime constraints?\b/, /运行时约束/, /運行時約束/],
    [/\bcurrent (?:state|status|goals?)\b/, /当前状态/, /當前狀態/, /当前目标/, /當前目標/],
    [/\baction hooks?\b/, /行动钩子/, /行動鉤子/],
    [/\binteract(?:able|ion|ive)/, /可交互/, /可互动/, /可互動/],
    [/\brisks?\b/, /\bdangers?\b/, /风险/, /風險/, /危险/, /危險/],
    [/\buses?\b/, /\bfunction\b/, /用途/, /用法/],
    [/\bblockers?\b/, /阻碍/, /阻礙/],
    [/\bprogression conditions?\b/, /推进条件/, /推進條件/],
  ]
}

function runtimeCapsuleSectionPatterns(): RegExp[] {
  return [/\bruntime capsule\b/, /运行时摘要/, /運行時摘要/, /运行摘要/, /運行摘要/]
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
  if (maxChars <= 0) return ""
  if (normalized.length <= maxChars) return normalized
  if (maxChars <= 20) return normalized.slice(0, maxChars)
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
