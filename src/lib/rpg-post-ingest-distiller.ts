import type { ReviewItem } from "@/stores/review-store"
import { parseFrontmatter } from "./frontmatter"
import type { RpgIngestSignal, RpgIngestSignalKind, RpgIngestUtilityScore } from "./rpg-ingest-signals"
import { getFileStem, normalizePath } from "./path-utils"

export type RpgDistillCategory = "characters" | "locations" | "events" | "plot-arcs" | "relationships" | "sources" | "unsupported"

export interface RpgWikiPageForDistill {
  path: string
  content: string
}

export interface RpgDistillSectionDecision {
  heading: string
  reason: string
  excerpt: string
}

export interface RpgDistillProposal {
  targetPath: string
  category: RpgDistillCategory
  originalLength: number
  hasRuntimeCapsule: boolean
  candidateRuntimeCapsule: string
  roleplaySignals: RpgIngestSignal[]
  keepSections: RpgDistillSectionDecision[]
  compressSections: RpgDistillSectionDecision[]
  moveToEvidenceSections: RpgDistillSectionDecision[]
  needsHumanConfirmation: RpgDistillSectionDecision[]
  proposalMarkdown: string
  warnings: string[]
  skipped?: boolean
}

interface MarkdownSection {
  heading: string
  content: string
}

const SUPPORTED_RUNTIME_CATEGORIES = new Set<RpgDistillCategory>([
  "characters",
  "locations",
  "events",
  "plot-arcs",
  "relationships",
])

const DEFAULT_REVIEW_OPTIONS: ReviewItem["options"] = [
  { label: "Inspect", action: "Inspect" },
  { label: "Dismiss", action: "Dismiss" },
]

const GENERAL_RUNTIME_MARKERS = [
  "action", "hook", "choice", "interact", "interactable", "investigate", "clue", "risk", "danger", "constraint", "cost", "limit", "pressure", "tension", "trust", "secret", "state", "consequence", "trigger", "dialogue", "portrayal", "atmosphere", "sensory", "玩家", "行动", "钩子", "可调查", "可交互", "线索", "风险", "危险", "约束", "代价", "限制", "压力", "张力", "信任", "秘密", "状态", "后果", "触发", "对白", "扮演", "氛围", "感官",
] as const

const LOW_VALUE_METADATA_MARKERS = [
  "release date", "release version", "version", "platform", "voice actor", "voiced by", "cv:", "cv：", "trivia", "fandom", "fan tag", "birthday", "blood type", "height", "weight", "popularity poll", "发售", "发行", "版本", "平台", "声优", "配音", "萌点", "粉丝标签", "生日", "血型", "身高", "体重", "人气投票",
] as const

const EVIDENCE_HEADINGS = [
  "evidence", "source", "sources", "references", "citations", "quotes", "quote dump", "source notes", "uncertainty", "provenance", "来源", "证据", "引用", "出处", "不确定",
] as const

const REPEATED_EVIDENCE_MARKERS = [
  "repeated evidence", "duplicate evidence", "full quote", "quote dump", "citation dump", "raw excerpt", "重复证据", "完整摘录", "原文摘录", "引用堆叠",
] as const

const FUTURE_OR_UNRESOLVED_EVENT_MARKERS = [
  "future", "may later", "might later", "possible development", "foreshadow", "foreshadowing", "plan", "next step", "progression condition", "if the player", "未来", "可能会", "也许", "将会", "伏笔", "铺垫", "计划", "后续", "推进条件", "如果玩家", "可发展",
] as const

const FUTURE_AS_FACT_MARKERS = [
  "already happened", "has happened", "confirmed occurred", "confirmed to happen", "will definitely happen", "must happen", "inevitable", "已经发生", "已确认发生", "必然发生", "注定发生", "确定会发生",
] as const

const CATEGORY_RULES: Record<Exclude<RpgDistillCategory, "sources" | "unsupported">, {
  keepMarkers: readonly string[]
  compressMarkers: readonly string[]
  defaultSignalKind: RpgIngestSignalKind
}> = {
  characters: {
    keepMarkers: [
      "runtime capsule", "psychological model", "behavior rules", "behavior boundary", "dialogue style", "relationship levers", "trigger", "fear", "desire", "vulnerability", "boundary", "refuses", "reaction", "portrayal", "voice", "tone", "trust", "核心张力", "行为边界", "对白", "说话", "触发点", "恐惧", "欲望", "扮演", "反应", "信任",
    ],
    compressMarkers: [
      "biography", "life story", "background", "profile", "appearance", "timeline", "route recap", "full history", "long history", "传记", "生平", "背景介绍", "人物档案", "外貌", "时间线", "路线", "完整经历",
    ],
    defaultSignalKind: "portrayal_rule",
  },
  locations: {
    keepMarkers: [
      "sensory", "atmosphere", "entrance", "exit", "access", "danger", "hazard", "clue", "interactable", "object", "affordance", "occupant", "scene hook", "可交互", "危险", "线索", "感官", "入口", "出口", "进入条件", "在场", "氛围",
    ],
    compressMarkers: [
      "geography", "travel guide", "history", "lore", "architecture history", "full description", "地理介绍", "旅游", "历史沿革", "建筑史", "地点百科",
    ],
    defaultSignalKind: "scene_affordance",
  },
  events: {
    keepMarkers: [
      "confirmed", "occurred", "happened", "what happened", "consequence", "state change", "who knows", "participants", "location", "time", "result", "已发生", "已经发生", "确认发生", "后果", "状态变化", "谁知道", "参与者", "地点", "时间", "结果",
    ],
    compressMarkers: [
      "route", "timeline", "chronology", "storyline", "route recap", "complete recap", "plot summary", "路线", "时间线", "剧情线", "完整经过", "剧情概述",
    ],
    defaultSignalKind: "state_change",
  },
  "plot-arcs": {
    keepMarkers: [
      "unresolved", "question", "pressure", "conflict", "foreshadow", "reveal pacing", "progression condition", "blocker", "dependency", "possible development", "do not reveal", "未解决", "悬念", "压力点", "冲突", "伏笔", "揭示节奏", "推进条件", "阻碍", "可能发展", "暂时不要",
    ],
    compressMarkers: [
      "route recap", "full route", "complete timeline", "full summary", "every event", "路线复述", "完整路线", "完整时间线", "事件流水",
    ],
    defaultSignalKind: "plot_pressure",
  },
  relationships: {
    keepMarkers: [
      "trust", "distrust", "tension", "secret", "misunderstanding", "dependency", "obligation", "fear", "guilt", "control", "trigger", "escalation", "de-escalation", "change trigger", "信任", "不信任", "张力", "秘密", "误解", "依赖", "义务", "恐惧", "愧疚", "控制", "触发器", "升级", "降级",
    ],
    compressMarkers: [
      "character profile", "biography", "who they are", "full background", "full character intro", "角色介绍", "人物介绍", "完整设定", "双方传记", "背景复述",
    ],
    defaultSignalKind: "relationship_tension",
  },
}

export function distillRpgWikiPage(page: RpgWikiPageForDistill): RpgDistillProposal {
  const targetPath = normalizePath(page.path).replace(/^\.\/+/, "")
  const category = categoryFromPath(targetPath)
  const originalLength = page.content.length
  const parsed = parseFrontmatter(page.content)
  const body = parsed.body
  const runtimeCapsule = extractMarkdownSection(body, "Runtime Capsule")
  const hasRuntimeCapsule = runtimeCapsule !== null
  const warnings: string[] = []
  const title = titleFromContent(targetPath, parsed.frontmatter, body)

  if (category === "sources") {
    warnings.push("wiki/sources/ is the evidence layer and is skipped by the runtime-facing post-ingest distiller.")
    return buildSkippedProposal(targetPath, category, originalLength, hasRuntimeCapsule, warnings)
  }

  if (!isSupportedDistillCategory(category)) {
    warnings.push(`Unsupported RPG distill category for path ${targetPath}.`)
    return buildSkippedProposal(targetPath, category, originalLength, hasRuntimeCapsule, warnings)
  }

  const sections = parseMarkdownSections(body)
  const keepSections: RpgDistillSectionDecision[] = []
  const compressSections: RpgDistillSectionDecision[] = []
  const moveToEvidenceSections: RpgDistillSectionDecision[] = []
  const needsHumanConfirmation: RpgDistillSectionDecision[] = []
  const rules = CATEGORY_RULES[category]

  for (const section of sections) {
    const decision = classifySection(section, category, rules)
    if (!decision) continue
    if (decision.bucket === "keep") keepSections.push(decision.item)
    if (decision.bucket === "compress") compressSections.push(decision.item)
    if (decision.bucket === "evidence") moveToEvidenceSections.push(decision.item)
    if (decision.bucket === "confirm") needsHumanConfirmation.push(decision.item)
  }

  if (!hasRuntimeCapsule) warnings.push("Page has no existing ## Runtime Capsule; proposal includes a candidate capsule but does not apply it.")
  if (keepSections.length === 0) warnings.push("No strong runtime-facing keep section was detected by the v0 heuristic; human review is required before compression.")

  const roleplaySignals = createRoleplaySignals({ targetPath, category, title, keepSections, needsHumanConfirmation })
  const candidateRuntimeCapsule = buildCandidateRuntimeCapsule({ title, category, roleplaySignals, keepSections, compressSections, moveToEvidenceSections, needsHumanConfirmation })
  const proposalMarkdown = buildProposalMarkdown({ targetPath, category, originalLength, hasRuntimeCapsule, candidateRuntimeCapsule, roleplaySignals, keepSections, compressSections, moveToEvidenceSections, needsHumanConfirmation, warnings })

  return {
    targetPath,
    category,
    originalLength,
    hasRuntimeCapsule,
    candidateRuntimeCapsule,
    roleplaySignals,
    keepSections,
    compressSections,
    moveToEvidenceSections,
    needsHumanConfirmation,
    proposalMarkdown,
    warnings: uniqueStrings(warnings),
  }
}

export function distillRpgWikiPages(pages: RpgWikiPageForDistill[]): RpgDistillProposal[] {
  return pages.map((page) => distillRpgWikiPage(page))
}

export function createRpgDistillReviewItems(
  proposals: RpgDistillProposal[],
): Omit<ReviewItem, "id" | "resolved" | "createdAt">[] {
  return proposals
    .filter((proposal) => !proposal.skipped)
    .map((proposal) => ({
      type: "suggestion",
      title: `RPG post-ingest distill proposal: ${proposal.targetPath}`,
      description: proposal.proposalMarkdown,
      sourcePath: proposal.targetPath,
      affectedPages: [proposal.targetPath],
      options: DEFAULT_REVIEW_OPTIONS,
    }))
}

function buildSkippedProposal(
  targetPath: string,
  category: RpgDistillCategory,
  originalLength: number,
  hasRuntimeCapsule: boolean,
  warnings: string[],
): RpgDistillProposal {
  const candidateRuntimeCapsule = ""
  const proposalMarkdown = buildProposalMarkdown({
    targetPath,
    category,
    originalLength,
    hasRuntimeCapsule,
    candidateRuntimeCapsule,
    roleplaySignals: [],
    keepSections: [],
    compressSections: [],
    moveToEvidenceSections: [],
    needsHumanConfirmation: [],
    warnings,
  })
  return {
    targetPath,
    category,
    originalLength,
    hasRuntimeCapsule,
    candidateRuntimeCapsule,
    roleplaySignals: [],
    keepSections: [],
    compressSections: [],
    moveToEvidenceSections: [],
    needsHumanConfirmation: [],
    proposalMarkdown,
    warnings,
    skipped: true,
  }
}

function categoryFromPath(path: string): RpgDistillCategory {
  const match = normalizePath(path).match(/^wiki\/([^/]+)(?:\/|$)/)
  const category = match?.[1]
  if (category === "sources") return "sources"
  if (category === "characters" || category === "locations" || category === "events" || category === "plot-arcs" || category === "relationships") return category
  return "unsupported"
}

function isSupportedDistillCategory(category: RpgDistillCategory): category is Exclude<RpgDistillCategory, "sources" | "unsupported"> {
  return SUPPORTED_RUNTIME_CATEGORIES.has(category)
}

function parseMarkdownSections(body: string): MarkdownSection[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n")
  const sections: MarkdownSection[] = []
  let heading = "Lead"
  let collected: string[] = []

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/)
    if (match) {
      pushSection(sections, heading, collected)
      heading = match[1].trim()
      collected = []
      continue
    }
    collected.push(line)
  }
  pushSection(sections, heading, collected)
  return sections.length > 0 ? sections : [{ heading: "Body", content: body }]
}

function pushSection(sections: MarkdownSection[], heading: string, lines: string[]): void {
  const content = stripH1(lines.join("\n")).trim()
  if (!content && heading === "Lead") return
  if (!content && sections.length === 0) return
  sections.push({ heading, content })
}

function stripH1(text: string): string {
  return text.replace(/^#\s+.+?(?:\r?\n|$)/, "").trim()
}

function extractMarkdownSection(body: string, heading: string): string | null {
  const target = heading.trim().toLowerCase()
  for (const section of parseMarkdownSections(body)) {
    if (section.heading.toLowerCase() === target) return section.content
  }
  return null
}

function titleFromContent(targetPath: string, frontmatter: Record<string, unknown> | null, body: string): string {
  const title = typeof frontmatter?.title === "string" ? frontmatter.title.trim() : ""
  if (title) return title
  const h1 = /^#\s+(.+?)\s*$/m.exec(body)?.[1]?.trim()
  return h1 || getFileStem(targetPath)
}

function classifySection(
  section: MarkdownSection,
  category: Exclude<RpgDistillCategory, "sources" | "unsupported">,
  rules: typeof CATEGORY_RULES[Exclude<RpgDistillCategory, "sources" | "unsupported">],
): { bucket: "keep" | "compress" | "evidence" | "confirm"; item: RpgDistillSectionDecision } | null {
  const text = `${section.heading}\n${section.content}`
  const excerpt = excerptForSection(section)
  const heading = section.heading

  if (section.heading.toLowerCase() === "runtime capsule") {
    return { bucket: "keep", item: { heading, reason: "Existing user-facing Runtime Capsule should be preserved unless a reviewer explicitly replaces it.", excerpt } }
  }

  if (category === "events" && hasAnyMarker(text, FUTURE_OR_UNRESOLVED_EVENT_MARKERS)) {
    return { bucket: "confirm", item: { heading, reason: "Future plans, foreshadowing, possible developments, or progression conditions do not belong in event history without human routing to plot-arcs or review.", excerpt } }
  }

  if (category === "plot-arcs" && hasAnyMarker(text, FUTURE_OR_UNRESOLVED_EVENT_MARKERS) && hasAnyMarker(text, FUTURE_AS_FACT_MARKERS)) {
    return { bucket: "confirm", item: { heading, reason: "Plot-arcs may hold future pressure, but this section risks writing a possible future as an already-confirmed event.", excerpt } }
  }

  if (hasAnyMarker(section.heading, EVIDENCE_HEADINGS) || hasAnyMarker(text, REPEATED_EVIDENCE_MARKERS)) {
    return { bucket: "evidence", item: { heading, reason: "Source details, quotes, uncertainty, or repeated evidence should be reviewed as evidence material instead of default runtime context.", excerpt } }
  }

  if (hasAnyMarker(text, LOW_VALUE_METADATA_MARKERS)) {
    return { bucket: "compress", item: { heading, reason: "Low-value encyclopedia metadata or trivia has no default runtime use; keep only if a reviewer finds an RP consequence.", excerpt } }
  }

  if (hasAnyMarker(text, rules.compressMarkers) || isLongLowSignalSection(section, rules.keepMarkers)) {
    return { bucket: "compress", item: { heading, reason: "This looks like biography, route recap, timeline, or broad background material and should be compressed for runtime use.", excerpt } }
  }

  if (hasAnyMarker(text, rules.keepMarkers) || hasAnyMarker(text, GENERAL_RUNTIME_MARKERS)) {
    return { bucket: "keep", item: { heading, reason: runtimeKeepReason(category), excerpt } }
  }

  return null
}

function isLongLowSignalSection(section: MarkdownSection, keepMarkers: readonly string[]): boolean {
  if (section.content.length < 900) return false
  return !hasAnyMarker(section.content, keepMarkers) && !hasAnyMarker(section.content, GENERAL_RUNTIME_MARKERS)
}

function runtimeKeepReason(category: Exclude<RpgDistillCategory, "sources" | "unsupported">): string {
  if (category === "characters") return "Roleplay-facing character operating material: portrayal, boundary, dialogue, trigger, or relationship lever."
  if (category === "locations") return "Playable scene-card material: sensory anchor, affordance, danger, clue, access, or interactable object."
  if (category === "events") return "Confirmed event-history material: happened facts, participants, location/time, consequences, or state changes."
  if (category === "plot-arcs") return "Playable plot-pressure material: unresolved question, conflict, pressure point, reveal pacing, or progression condition."
  return "Relationship runtime material: trust, tension, secret, dependency, misunderstanding, or change trigger."
}

function createRoleplaySignals(input: {
  targetPath: string
  category: Exclude<RpgDistillCategory, "sources" | "unsupported">
  title: string
  keepSections: RpgDistillSectionDecision[]
  needsHumanConfirmation: RpgDistillSectionDecision[]
}): RpgIngestSignal[] {
  const rules = CATEGORY_RULES[input.category]
  const keepSignals = input.keepSections.map((section) => buildSignal(input.targetPath, rules.defaultSignalKind, section, 4, "medium", "canon"))
  const reviewSignals = input.needsHumanConfirmation.map((section) => buildSignal(input.targetPath, rules.defaultSignalKind, section, 2, "low", "uncertain"))
  if (keepSignals.length > 0 || reviewSignals.length > 0) return [...keepSignals, ...reviewSignals]
  return [
    {
      kind: rules.defaultSignalKind,
      targetPath: input.targetPath,
      summary: `${input.title}: no strong v0 runtime signal detected`,
      rpUse: "Keep this page in human review before compressing; the deterministic distiller should not infer missing runtime utility.",
      evidence: "No matching runtime-facing section markers were found.",
      utilityScore: 2,
      confidence: "low",
      canonStatus: "uncertain",
    },
  ]
}

function buildSignal(
  targetPath: string,
  kind: RpgIngestSignalKind,
  section: RpgDistillSectionDecision,
  utilityScore: RpgIngestUtilityScore,
  confidence: RpgIngestSignal["confidence"],
  canonStatus: RpgIngestSignal["canonStatus"],
): RpgIngestSignal {
  return {
    kind,
    targetPath,
    summary: `${section.heading}: ${section.excerpt}`,
    rpUse: section.reason,
    evidence: section.excerpt,
    utilityScore,
    confidence,
    canonStatus,
  }
}

function buildCandidateRuntimeCapsule(input: {
  title: string
  category: Exclude<RpgDistillCategory, "sources" | "unsupported">
  roleplaySignals: RpgIngestSignal[]
  keepSections: RpgDistillSectionDecision[]
  compressSections: RpgDistillSectionDecision[]
  moveToEvidenceSections: RpgDistillSectionDecision[]
  needsHumanConfirmation: RpgDistillSectionDecision[]
}): string {
  const signalSummary = firstStrongSignal(input.roleplaySignals)
  const keepSummary = summarizeDecisions(input.keepSections, "No high-value runtime section detected by v0 heuristics.")
  const constraints = summarizeByMarkers(input.keepSections, ["constraint", "risk", "danger", "limit", "boundary", "cost", "约束", "风险", "危险", "限制", "边界", "代价"], "Review constraints manually before applying any compression.")
  const hooks = summarizeByMarkers(input.keepSections, ["hook", "trigger", "clue", "interact", "pressure", "secret", "钩子", "触发", "线索", "可交互", "压力", "秘密"], keepSummary)
  const portrayal = summarizeByMarkers(input.keepSections, ["dialogue", "portrayal", "atmosphere", "sensory", "tone", "对白", "扮演", "氛围", "感官", "语气"], keepSummary)
  const doNot = [
    input.compressSections.length > 0 ? `Do not keep ${input.compressSections.map((item) => item.heading).slice(0, 3).join(", ")} as default runtime context.` : "Do not expand this page into biography, route recap, or trivia.",
    input.moveToEvidenceSections.length > 0 ? "Source/evidence details need review before moving." : "",
    input.needsHumanConfirmation.length > 0 ? "Human confirmation is required for future/uncertain material." : "",
  ].filter(Boolean).join(" ")

  return [
    "## Runtime Capsule",
    `- One-line position: ${input.title} should be used as ${categoryRuntimeRole(input.category)}. ${signalSummary}`,
    `- Meaning for player action: ${keepSummary}`,
    `- Key constraints: ${constraints}`,
    `- Trigger hooks / pressure points: ${hooks}`,
    `- Portrayal / atmosphere cues: ${portrayal}`,
    `- Do not miswrite as: ${doNot}`,
  ].join("\n")
}

function categoryRuntimeRole(category: Exclude<RpgDistillCategory, "sources" | "unsupported">): string {
  if (category === "characters") return "an NPC operating model, not a biography"
  if (category === "locations") return "a playable scene card, not a travel guide"
  if (category === "events") return "confirmed event history, not a future-plan page"
  if (category === "plot-arcs") return "unresolved plot pressure, not confirmed event history"
  return "relationship tension and change triggers, not duplicate character profiles"
}

function buildProposalMarkdown(input: {
  targetPath: string
  category: RpgDistillCategory
  originalLength: number
  hasRuntimeCapsule: boolean
  candidateRuntimeCapsule: string
  roleplaySignals: RpgIngestSignal[]
  keepSections: RpgDistillSectionDecision[]
  compressSections: RpgDistillSectionDecision[]
  moveToEvidenceSections: RpgDistillSectionDecision[]
  needsHumanConfirmation: RpgDistillSectionDecision[]
  warnings: string[]
}): string {
  return [
    `# Post-Ingest Distill Proposal: ${input.targetPath}`,
    "",
    `- Target path: ${input.targetPath}`,
    `- Category: ${input.category}`,
    `- Original length: ${input.originalLength}`,
    `- Existing Runtime Capsule: ${input.hasRuntimeCapsule ? "yes" : "no"}`,
    "- Safety: REVIEW/proposal only; do not overwrite, delete, accept, reject, apply, or write the original page automatically.",
    "",
    "## Recommended Keep",
    formatDecisions(input.keepSections),
    "",
    "## Recommended Compress",
    formatDecisions(input.compressSections),
    "",
    "## Move to sources/evidence",
    formatDecisions(input.moveToEvidenceSections),
    "",
    "## Needs Human Confirmation",
    formatDecisions(input.needsHumanConfirmation),
    "",
    "## Candidate Runtime Capsule",
    input.candidateRuntimeCapsule || "No candidate capsule because this page was skipped.",
    "",
    "## Roleplay Signals",
    formatSignals(input.roleplaySignals),
    "",
    "## Warnings",
    formatPlainList(uniqueStrings(input.warnings)),
  ].join("\n")
}

function formatDecisions(decisions: RpgDistillSectionDecision[]): string {
  if (decisions.length === 0) return "- None proposed by v0 heuristic."
  return decisions.map((decision) => `- ${decision.heading}: ${decision.reason} Excerpt: ${decision.excerpt}`).join("\n")
}

function formatSignals(signals: RpgIngestSignal[]): string {
  if (signals.length === 0) return "- No roleplay signals generated."
  return signals.map((signal) => `- [${signal.utilityScore}] ${signal.kind} (${signal.confidence}, ${signal.canonStatus}): ${signal.summary}`).join("\n")
}

function formatPlainList(items: string[]): string {
  if (items.length === 0) return "- None."
  return items.map((item) => `- ${item}`).join("\n")
}

function firstStrongSignal(signals: RpgIngestSignal[]): string {
  const signal = signals.find((item) => item.utilityScore >= 4) ?? signals[0]
  return signal ? limitText(signal.summary, 180) : ""
}

function summarizeDecisions(decisions: RpgDistillSectionDecision[], fallback: string): string {
  const decision = decisions.find((item) => item.heading.toLowerCase() !== "runtime capsule") ?? decisions[0]
  return decision ? limitText(decision.excerpt, 220) : fallback
}

function summarizeByMarkers(decisions: RpgDistillSectionDecision[], markers: readonly string[], fallback: string): string {
  const decision = decisions.find((item) => hasAnyMarker(`${item.heading}\n${item.excerpt}`, markers))
  return decision ? limitText(decision.excerpt, 220) : fallback
}

function excerptForSection(section: MarkdownSection): string {
  const cleaned = cleanText(section.content || section.heading)
  return limitText(cleaned || section.heading, 260)
}

function cleanText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[-*]\s+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function hasAnyMarker(text: string, markers: readonly string[]): boolean {
  const haystack = text.toLowerCase()
  return markers.some((marker) => haystack.includes(marker.toLowerCase()))
}

function limitText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}...`
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}
