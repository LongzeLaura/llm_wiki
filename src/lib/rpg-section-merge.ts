import { getRpgMergePolicy, type RpgMergeKind, type RpgMergePolicy } from "./rpg-interactions/merge"

export type RpgSectionMergeStrategy =
  | "replace"
  | "append-dedupe"
  | "prefer-llm"
  | "drop-if-low-value"

export interface RpgSectionMergeResult {
  content: string
  warnings: string[]
  appliedStrategies: Array<{ heading: string; strategy: RpgSectionMergeStrategy }>
}

export interface RpgSectionMergeContext {
  pagePath: string
  policy?: RpgMergePolicy
  policyKind?: RpgMergeKind
  existingContent: string
  incomingContent: string
  preserveExistingSections?: boolean
  preserveExistingFrontmatter?: boolean
  preserveExistingBodyPrefix?: boolean
  preserveLowValueSections?: boolean
}

interface MarkdownDocument {
  frontmatter: string
  bodyPrefix: string
  sections: MarkdownSection[]
  trailing: string
}

interface MarkdownSection {
  level: "##" | "###"
  heading: string
  key: string
  body: string
}

const RUNTIME_CAPSULE_KEY = normalizeHeading("Runtime Capsule")
const CURRENT_STATE_KEY = normalizeHeading("Current State")
const EVIDENCE_KEY = normalizeHeading("Evidence and Uncertainty")
const CONFIRMED_FACTS_KEY = normalizeHeading("Confirmed Facts")
const POSSIBLE_FUTURES_KEY = normalizeHeading("Possible Futures")

const APPEND_DEDUPE_KEYS = new Set([EVIDENCE_KEY, CONFIRMED_FACTS_KEY])

const RUNTIME_FACING_CATEGORIES = new Set([
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
  "quests",
])

const LOW_VALUE_HEADING_MARKERS = [
  "trivia",
  "release metadata",
  "voice actor",
  "production notes",
  "fan tags",
  "full biography",
  "biography",
  "character profile",
  "百科信息",
  "发售信息",
  "声优",
  "制作信息",
  "人物传记",
  "角色传记",
  "完整人物资料",
] as const

export function mergeRpgSections(
  llmContent: string,
  context: RpgSectionMergeContext,
): RpgSectionMergeResult {
  const pagePath = normalizeWikiPath(context.pagePath)
  const policy = context.policy ?? getRpgMergePolicy(pagePath)
  const policyKind = context.policyKind ?? policy.kind
  const categoryId = policy.categoryId ?? getCategoryId(pagePath)

  const llmDoc = parseMarkdownDocument(llmContent)
  const existingDoc = parseMarkdownDocument(context.existingContent)
  const incomingDoc = parseMarkdownDocument(context.incomingContent)

  const warnings: string[] = []
  const appliedStrategies: RpgSectionMergeResult["appliedStrategies"] = []
  const outputSections: MarkdownSection[] = []
  const seenKeys = new Set<string>()
  const runtimeFacingNonSource = isRuntimeFacingNonSource(categoryId, policyKind)
  const outputFrontmatter = context.preserveExistingFrontmatter && !llmDoc.frontmatter ? existingDoc.frontmatter : llmDoc.frontmatter
  const outputBodyPrefix =
    context.preserveExistingBodyPrefix && llmDoc.bodyPrefix.trim() === "" && existingDoc.bodyPrefix.trim() !== ""
      ? existingDoc.bodyPrefix
      : llmDoc.bodyPrefix

  for (const section of llmDoc.sections) {
    const strategy = chooseStrategy(section.key, {
      categoryId,
      policyKind,
      runtimeFacingNonSource,
      heading: section.heading,
      preserveLowValueSections: context.preserveLowValueSections === true,
    })
    appliedStrategies.push({ heading: section.heading, strategy })
    seenKeys.add(section.key)

    if (strategy === "drop-if-low-value") {
      continue
    }

    if (strategy === "append-dedupe") {
      const mergedSection = mergeAppendDedupeSection(section, existingDoc, incomingDoc, llmDoc)
      if (mergedSection) outputSections.push(mergedSection)
      continue
    }

    outputSections.push(section)
  }

  const capsule = findFirstSection(incomingDoc, RUNTIME_CAPSULE_KEY) ?? findFirstSection(existingDoc, RUNTIME_CAPSULE_KEY)
  if (!seenKeys.has(RUNTIME_CAPSULE_KEY) && capsule) {
    outputSections.unshift(cloneSection(capsule))
    appliedStrategies.push({ heading: capsule.heading, strategy: "prefer-llm" })
    warnings.push(`Restored existing Runtime Capsule for ${pagePath} because the LLM merge omitted it.`)
    seenKeys.add(RUNTIME_CAPSULE_KEY)
  }

  if (!seenKeys.has(CURRENT_STATE_KEY) && shouldReplaceCurrentState(categoryId, policyKind)) {
    const incomingCurrentState = findFirstSection(incomingDoc, CURRENT_STATE_KEY)
    if (incomingCurrentState) {
      outputSections.push(cloneSection(incomingCurrentState))
      appliedStrategies.push({ heading: incomingCurrentState.heading, strategy: "replace" })
      seenKeys.add(CURRENT_STATE_KEY)
    }
  }

  for (const key of appendDedupeKeysForCategory(categoryId)) {
    if (seenKeys.has(key)) continue
    const merged = mergeAppendDedupeSection(firstAvailableSection(key, existingDoc, incomingDoc, llmDoc), existingDoc, incomingDoc, llmDoc)
    if (merged && merged.body.trim() !== "") {
      outputSections.push(merged)
      appliedStrategies.push({ heading: merged.heading, strategy: "append-dedupe" })
      seenKeys.add(key)
    }
  }

  if (context.preserveExistingSections) {
    for (const section of existingDoc.sections) {
      if (seenKeys.has(section.key)) continue
      if (!context.preserveLowValueSections && runtimeFacingNonSource && isLowValueHeading(section.heading)) {
        appliedStrategies.push({ heading: section.heading, strategy: "drop-if-low-value" })
        seenKeys.add(section.key)
        continue
      }
      outputSections.push(cloneSection(section))
      appliedStrategies.push({ heading: section.heading, strategy: "prefer-llm" })
      seenKeys.add(section.key)
    }
  }

  return {
    content: printMarkdownDocument({
      ...llmDoc,
      frontmatter: outputFrontmatter,
      bodyPrefix: outputBodyPrefix,
      sections: outputSections,
    }),
    warnings,
    appliedStrategies,
  }
}

function chooseStrategy(
  key: string,
  context: {
    categoryId: string | null
    policyKind: RpgMergeKind
    runtimeFacingNonSource: boolean
    heading: string
    preserveLowValueSections: boolean
  },
): RpgSectionMergeStrategy {
  if (!context.preserveLowValueSections && context.runtimeFacingNonSource && isLowValueHeading(context.heading)) return "drop-if-low-value"
  if (key === CURRENT_STATE_KEY && shouldReplaceCurrentState(context.categoryId, context.policyKind)) return "replace"
  if (key === POSSIBLE_FUTURES_KEY && context.categoryId === "plot-arcs") return "append-dedupe"
  if (key === POSSIBLE_FUTURES_KEY && context.categoryId === "events") return "prefer-llm"
  if (APPEND_DEDUPE_KEYS.has(key)) return "append-dedupe"
  return "prefer-llm"
}

function appendDedupeKeysForCategory(categoryId: string | null): string[] {
  if (categoryId === "plot-arcs") return [CONFIRMED_FACTS_KEY, POSSIBLE_FUTURES_KEY, EVIDENCE_KEY]
  return [CONFIRMED_FACTS_KEY, EVIDENCE_KEY]
}

function shouldReplaceCurrentState(categoryId: string | null, policyKind: RpgMergeKind): boolean {
  return policyKind === "runtime-state" || policyKind === "relationship-tension" || policyKind === "current-scene" || categoryId === "relationships" || categoryId === "current-scene"
}

function mergeAppendDedupeSection(
  preferredSection: MarkdownSection | undefined,
  existingDoc: MarkdownDocument,
  incomingDoc: MarkdownDocument,
  llmDoc: MarkdownDocument,
): MarkdownSection | undefined {
  if (!preferredSection) return undefined
  const sections = [
    ...findSections(existingDoc, preferredSection.key),
    ...findSections(incomingDoc, preferredSection.key),
    ...findSections(llmDoc, preferredSection.key),
  ]
  const mergedLines = dedupeListLines(sections.flatMap((section) => extractListLines(section.body)))
  if (mergedLines.length === 0) return cloneSection(preferredSection)
  return {
    ...cloneSection(preferredSection),
    body: `\n\n${mergedLines.join("\n")}`,
  }
}

function dedupeListLines(lines: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const normalized = normalizeListLine(line)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(line.trimEnd())
  }
  return out
}

function extractListLines(body: string): string[] {
  return body.split(/\r?\n/).filter((line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line))
}

function normalizeListLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function firstAvailableSection(
  key: string,
  existingDoc: MarkdownDocument,
  incomingDoc: MarkdownDocument,
  llmDoc: MarkdownDocument,
): MarkdownSection | undefined {
  return findFirstSection(llmDoc, key) ?? findFirstSection(incomingDoc, key) ?? findFirstSection(existingDoc, key)
}

function findFirstSection(doc: MarkdownDocument, key: string): MarkdownSection | undefined {
  return doc.sections.find((section) => section.key === key)
}

function findSections(doc: MarkdownDocument, key: string): MarkdownSection[] {
  return doc.sections.filter((section) => section.key === key)
}

function cloneSection(section: MarkdownSection): MarkdownSection {
  return { ...section }
}

function parseMarkdownDocument(content: string): MarkdownDocument {
  const frontmatterMatch = content.match(/^(---\r?\n[\s\S]*?\r?\n---)(?:[ \t]*\r?\n)?/)
  const frontmatter = frontmatterMatch?.[0] ?? ""
  const body = content.slice(frontmatter.length)
  const headingRe = /^(#{2,3})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm
  const headings = Array.from(body.matchAll(headingRe)).filter((match) => match[1] === "##" || match[1] === "###")

  if (headings.length === 0) {
    return { frontmatter, bodyPrefix: body, sections: [], trailing: "" }
  }

  const bodyPrefix = body.slice(0, headings[0].index)
  const sections = headings.map((match, index): MarkdownSection => {
    const start = match.index ?? 0
    const nextStart = index + 1 < headings.length ? headings[index + 1].index ?? body.length : body.length
    const headingLine = match[0]
    const rawHeading = match[2].trim().replace(/[ \t]+#+$/, "").trim()
    return {
      level: match[1] as "##" | "###",
      heading: rawHeading,
      key: normalizeHeading(rawHeading),
      body: body.slice(start + headingLine.length, nextStart),
    }
  })

  return { frontmatter, bodyPrefix, sections, trailing: "" }
}

function printMarkdownDocument(doc: MarkdownDocument): string {
  const body = [
    doc.bodyPrefix,
    ...doc.sections.map(printMarkdownSection),
    doc.trailing,
  ].join("")
  return `${doc.frontmatter}${body}`
}

function printMarkdownSection(section: MarkdownSection): string {
  const content = `${section.level} ${section.heading}${section.body}`
  return content.endsWith("\n") ? content : `${content}\n\n`
}

function normalizeHeading(heading: string): string {
  return heading.replace(/\s+/g, " ").trim().toLowerCase()
}

function isLowValueHeading(heading: string): boolean {
  const normalized = normalizeHeading(heading)
  return LOW_VALUE_HEADING_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()))
}

function isRuntimeFacingNonSource(categoryId: string | null, policyKind: RpgMergeKind): boolean {
  if (!categoryId) return false
  if (policyKind === "source-evidence" || policyKind === "manual-control") return false
  return RUNTIME_FACING_CATEGORIES.has(categoryId)
}

function getCategoryId(pagePath: string): string | null {
  return pagePath.match(/^wiki\/([^/]+)(?:\/|$)/)?.[1] ?? null
}

function normalizeWikiPath(pagePath: string): string {
  return pagePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/")
}
