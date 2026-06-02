import { parseFrontmatter } from "./frontmatter"

type DynamicSectionCategory = "characters" | "player" | "plot-arcs" | "relationships"

const DYNAMIC_SECTION_HEADINGS: Record<DynamicSectionCategory, readonly string[]> = {
  characters: [
    "current state",
    "current status",
    "current condition",
    "current goal",
    "player relevance",
    "toward the player",
    "recent changes",
    "hooks",
    "plot hooks",
    "当前状态",
    "当前状况",
    "当前目标",
    "与玩家相关",
    "对玩家态度",
    "最近变化",
    "剧情钩子",
  ],
  player: [
    "current state",
    "current status",
    "state",
    "inventory",
    "resources",
    "goals",
    "current goals",
    "long-term goals",
    "knowledge",
    "known information",
    "promises",
    "consequences",
    "当前状态",
    "当前状况",
    "状态",
    "装备",
    "背包",
    "资源",
    "目标",
    "当前目标",
    "长期目标",
    "知识",
    "已知信息",
    "承诺",
    "后果",
  ],
  "plot-arcs": [
    "current stage",
    "stage",
    "open questions",
    "unresolved questions",
    "pending conflicts",
    "possible directions",
    "future directions",
    "recommended next developments",
    "next steps",
    "当前阶段",
    "阶段",
    "未解决问题",
    "悬念",
    "待推进冲突",
    "可能发展",
    "未来发展",
    "后续推进建议",
    "下一步建议",
  ],
  relationships: [
    "current relationship",
    "current relationship state",
    "current state",
    "trust",
    "tension",
    "conflict",
    "dependency",
    "future directions",
    "current relationship position",
    "当前关系",
    "当前关系状态",
    "当前状态",
    "信任",
    "张力",
    "冲突",
    "依赖",
    "未来发展",
    "后续方向",
  ],
}

const EVENT_FUTURE_HEADING_MARKERS = [
  "possible directions",
  "future directions",
  "future development",
  "possible development",
  "next steps",
  "recommended next developments",
  "gm advice",
  "possible next move",
  "可能发展",
  "未来发展",
  "下一步建议",
  "后续推进建议",
] as const

interface MarkdownSection {
  heading: string | null
  lines: string[]
}

export interface RpgDynamicWriteValidation {
  allowWrite: boolean
  warnings: string[]
}

export function prepareExistingContentForRpgDynamicMerge(
  relativePath: string,
  existingContent: string | null,
): string | null {
  if (!existingContent) return existingContent

  const categoryId = getRpgCategoryIdFromPath(relativePath)
  if (!categoryId || !(categoryId in DYNAMIC_SECTION_HEADINGS)) {
    return existingContent
  }

  const headings = DYNAMIC_SECTION_HEADINGS[categoryId as DynamicSectionCategory]
  return stripDynamicSections(existingContent, headings)
}

export function validateRpgDynamicWrite(
  relativePath: string,
  content: string,
): RpgDynamicWriteValidation {
  const categoryId = getRpgCategoryIdFromPath(relativePath)
  if (categoryId !== "events") {
    return { allowWrite: true, warnings: [] }
  }

  const forbiddenHeadings = extractNormalizedHeadings(content).filter((heading) =>
    EVENT_FUTURE_HEADING_MARKERS.some((marker) => heading === normalizeHeading(marker)),
  )

  if (forbiddenHeadings.length === 0) {
    return { allowWrite: true, warnings: [] }
  }

  return {
    allowWrite: false,
    warnings: [
      `Skipped "${relativePath}" because wiki/events/ pages must not contain future-planning sections (${forbiddenHeadings.join(", ")}). Move that content to wiki/plot-arcs/ instead.`,
    ],
  }
}

function stripDynamicSections(content: string, targetHeadings: readonly string[]): string {
  const parsed = parseFrontmatter(content)
  const sourceBody = parsed.rawBlock ? parsed.body : content
  const strippedBody = stripBodySections(sourceBody, targetHeadings)
  if (strippedBody === sourceBody) return content
  return parsed.rawBlock ? `${parsed.rawBlock}${strippedBody}` : strippedBody
}

function stripBodySections(body: string, targetHeadings: readonly string[]): string {
  const sections = splitMarkdownSections(body)
  if (sections.length === 0) return body

  const targetSet = new Set(targetHeadings.map(normalizeHeading))
  const kept = sections.filter((section) => {
    if (!section.heading) return true
    return !targetSet.has(normalizeHeading(section.heading))
  })

  const rewritten = kept.map((section) => section.lines.join("\n")).join("\n")
  return rewritten === body ? body : rewritten.trimEnd()
}

function splitMarkdownSections(body: string): MarkdownSection[] {
  const lines = body.split("\n")
  if (lines.length === 0) return []

  const sections: MarkdownSection[] = []
  let current: MarkdownSection = { heading: null, lines: [] }

  for (const line of lines) {
    const heading = parseDynamicHeading(line)
    if (heading) {
      if (current.lines.length > 0) sections.push(current)
      current = { heading, lines: [line] }
      continue
    }
    current.lines.push(line)
  }

  if (current.lines.length > 0) sections.push(current)
  return sections
}

function extractNormalizedHeadings(content: string): string[] {
  const parsed = parseFrontmatter(content)
  const body = parsed.rawBlock ? parsed.body : content
  const headings: string[] = []

  for (const line of body.split("\n")) {
    const heading = parseDynamicHeading(line)
    if (heading) headings.push(normalizeHeading(heading))
  }

  return headings
}

function parseDynamicHeading(line: string): string | null {
  const match = line.match(/^#{2,3}\s+(.+?)\s*$/)
  return match?.[1] ?? null
}

function getRpgCategoryIdFromPath(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
  const match = normalized.match(/^wiki\/([^/]+)(?:\/|$)/)
  return match?.[1] ?? null
}

function normalizeHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_~[\]()<>{}"'.,!?/\\|:;：，。！？（）【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
