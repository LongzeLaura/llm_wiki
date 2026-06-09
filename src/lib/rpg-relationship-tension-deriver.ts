import type { ReviewItem } from "@/stores/review-store"
import { parseFrontmatter } from "./frontmatter"
import { getFileStem, normalizePath } from "./path-utils"
import type { RpgIngestCanonStatus, RpgIngestSignal, RpgIngestSignalConfidence, RpgIngestSignalKind } from "./rpg-ingest-signals"

export type RpgRelationshipDerivationTargetKind = "relationship" | "plot_arc" | "review_only"
export type RpgRelationshipDerivationKind =
  | "trust"
  | "tension"
  | "secret"
  | "misunderstanding"
  | "dependency"
  | "conflict_pressure"

export interface RpgRelationshipDeriverPage {
  path: string
  content: string
  category?: string
}

export interface RpgRelationshipSourceNote {
  sourcePath: string
  content: string
}

export interface RpgRelationshipEvidence {
  sourcePath: string
  summary: string
  signalKind?: RpgIngestSignalKind
  sourceCanonStatus?: RpgIngestCanonStatus
}

export interface RpgRelationshipDerivationProposal {
  targetPath: string
  targetKind: RpgRelationshipDerivationTargetKind
  derivationKind: RpgRelationshipDerivationKind
  participants: string[]
  canonStatus: "inferred_for_play" | "uncertain"
  confidence: RpgIngestSignalConfidence
  evidence: RpgRelationshipEvidence[]
  rationale: string
  playerTriggers: string[]
  unresolvedBoundaries: string[]
  mergePatchMarkdown?: string
  proposalMarkdown: string
  warnings: string[]
}

export interface RpgRelationshipDerivationResult {
  proposals: RpgRelationshipDerivationProposal[]
  warnings: string[]
}

export interface DeriveRpgRelationshipTensionsInput {
  pages: RpgRelationshipDeriverPage[]
  signals?: RpgIngestSignal[]
  sourceNotes?: RpgRelationshipSourceNote[]
}

interface ParsedPage {
  path: string
  category: string
  title: string
  body: string
  content: string
}

interface EvidenceCandidate {
  sourcePath: string
  category: string
  summary: string
  participants: string[]
  derivationKind: RpgRelationshipDerivationKind
  confidence: RpgIngestSignalConfidence
  signalKind?: RpgIngestSignalKind
  sourceCanonStatus?: RpgIngestCanonStatus
  warnings: string[]
}

const DEFAULT_REVIEW_OPTIONS: ReviewItem["options"] = [
  { label: "Inspect", action: "Inspect" },
  { label: "Dismiss", action: "Dismiss" },
]

const RELATIONSHIP_SIGNAL_KINDS = new Set<RpgIngestSignalKind>([
  "relationship_tension",
  "dialogue_style",
  "behavior_boundary",
  "state_change",
])

const PLOT_SIGNAL_KINDS = new Set<RpgIngestSignalKind>([
  "plot_pressure",
  "action_hook",
  "state_change",
])

const DERIVATION_MARKERS: Record<RpgRelationshipDerivationKind, readonly string[]> = {
  trust: [
    "trust", "distrust", "faith", "confidence", "信任", "不信任", "信赖", "信赖变化", "信任变化", "trust rises", "trust drops", "信任上升", "信任下降",
  ],
  tension: [
    "tension", "conflict", "betrayal", "betray", "fear", "guilt", "suspect", "pressure", "裂痕", "张力", "冲突", "背叛", "恐惧", "愧疚", "怀疑", "压力", "敌意",
  ],
  secret: [
    "secret", "hide", "hides", "hidden", "conceal", "withheld", "does not reveal", "秘密", "隐瞒", "隐藏", "保密", "不说出", "未说出口", "瞒着",
  ],
  misunderstanding: [
    "misunderstanding", "misread", "wrongly believes", "mistaken", "information asymmetry", "does not know", "who knows", "who does not know", "误解", "误会", "错以为", "信息不对称", "不知道", "谁知道", "谁不知道",
  ],
  dependency: [
    "dependency", "depend", "debt", "owe", "obligation", "protect", "control", "leverage", "依赖", "债", "欠", "义务", "保护", "控制", "把柄", "牵制",
  ],
  conflict_pressure: [
    "unresolved", "pressure", "plot pressure", "progression condition", "do not reveal", "cannot resolve", "reveal pacing", "foreshadow", "未解决", "压力点", "剧情压力", "推进条件", "不能提前", "暂时不要", "揭示节奏", "伏笔",
  ],
}

const PLAYER_TRIGGER_MARKERS = [
  "if the player", "player action", "trigger", "pressures", "protects", "exposes", "helps", "betrays", "investigates", "玩家", "触发", "逼问", "保护", "暴露", "帮助", "背叛", "调查", "选择",
] as const

const UNRESOLVED_BOUNDARY_MARKERS = [
  "unresolved", "do not reveal", "cannot resolve", "needs setup", "only after", "progression condition", "possible", "future", "未解决", "不能提前", "暂时不要", "需要铺垫", "只有在", "推进条件", "可能", "未来",
] as const

export function deriveRpgRelationshipTensions(input: DeriveRpgRelationshipTensionsInput): RpgRelationshipDerivationResult {
  const pages = input.pages.map(parsePage)
  const knownParticipants = collectKnownParticipants(pages, input.signals ?? [])
  const candidates = [
    ...pages.flatMap((page) => extractPageCandidates(page, knownParticipants)),
    ...(input.signals ?? []).flatMap((signal) => extractSignalCandidate(signal, knownParticipants)),
    ...(input.sourceNotes ?? []).flatMap((note) => extractSourceNoteCandidates(note, knownParticipants)),
  ]

  const proposals = buildProposals(candidates)
  const warnings = uniqueStrings([
    ...candidates.flatMap((candidate) => candidate.warnings),
    ...proposals.flatMap((proposal) => proposal.warnings),
  ])

  if (proposals.length === 0) {
    const warning = "Relationship/Tension Deriver v0 found no sufficient relationship or plot-pressure evidence; no target page is proposed."
    const reviewOnly = buildReviewOnlyProposal({
      derivationKind: "tension",
      evidence: [],
      warnings: [warning],
    })
    return {
      proposals: [reviewOnly],
      warnings: [warning],
    }
  }

  return { proposals, warnings }
}

export function createRpgRelationshipDeriverReviewItems(
  result: RpgRelationshipDerivationResult,
): Omit<ReviewItem, "id" | "resolved" | "createdAt">[] {
  return result.proposals.map((proposal) => ({
    type: "suggestion",
    title: `RPG relationship/tension derivation proposal: ${proposal.targetPath}`,
    description: proposal.proposalMarkdown,
    sourcePath: proposal.evidence[0]?.sourcePath,
    affectedPages: uniqueStrings([proposal.targetPath, ...proposal.evidence.map((item) => item.sourcePath)]),
    options: DEFAULT_REVIEW_OPTIONS,
  }))
}

function parsePage(page: RpgRelationshipDeriverPage): ParsedPage {
  const path = normalizePath(page.path).replace(/^\.\/+/, "")
  const { frontmatter, body } = parseFrontmatter(page.content)
  const category = page.category || path.match(/^wiki\/([^/]+)(?:\/|$)/)?.[1] || "unknown"
  const title = typeof frontmatter?.title === "string" && frontmatter.title.trim()
    ? frontmatter.title.trim()
    : /^#\s+(.+?)\s*$/m.exec(body)?.[1]?.trim() || getFileStem(path)
  return {
    path,
    category,
    title,
    body,
    content: page.content,
  }
}

function collectKnownParticipants(pages: ParsedPage[], signals: RpgIngestSignal[]): string[] {
  const names: string[] = []
  for (const page of pages) {
    if (page.category === "characters" || page.category === "player") names.push(page.title)
    names.push(...participantsFromPath(page.path), ...participantsFromText(page.body))
  }
  for (const signal of signals) {
    names.push(...participantsFromPath(signal.targetPath ?? ""))
    names.push(...participantsFromText(`${signal.targetObject ?? ""}\n${signal.summary}\n${signal.evidence}`))
  }
  return uniqueStrings(names.map(cleanParticipant).filter(isUsableParticipant))
}

function extractPageCandidates(page: ParsedPage, knownParticipants: string[]): EvidenceCandidate[] {
  if (!["characters", "events", "plot-arcs", "relationships", "sources"].includes(page.category)) return []

  const chunks = relevantChunks(page.body)
  const pageParticipants = uniqueStrings([
    ...(page.category === "characters" || page.category === "player" ? [page.title] : []),
    ...participantsFromPath(page.path),
    ...participantsFromText(page.body),
  ])

  return chunks.flatMap((chunk) => {
    const kind = classifyDerivationKind(chunk, page.category)
    if (!kind) return []
    const participants = uniqueStrings([
      ...pageParticipants,
      ...knownParticipantsInText(chunk, knownParticipants),
    ])
    return [{
      sourcePath: page.path,
      category: page.category,
      summary: limitText(cleanText(chunk), 320),
      participants,
      derivationKind: kind,
      confidence: page.category === "relationships" ? "medium" : "low",
      warnings: participants.length < 2 && kind !== "conflict_pressure"
        ? [`Insufficient participants for relationship proposal from ${page.path}; emitted as review-only evidence.`]
        : [],
    }]
  })
}

function extractSignalCandidate(signal: RpgIngestSignal, knownParticipants: string[]): EvidenceCandidate[] {
  if (!RELATIONSHIP_SIGNAL_KINDS.has(signal.kind) && !PLOT_SIGNAL_KINDS.has(signal.kind)) return []
  if (signal.utilityScore <= 1) return []

  const text = `${signal.summary}\n${signal.rpUse}\n${signal.evidence}`
  const kind = classifyDerivationKind(text, signal.kind === "plot_pressure" ? "plot-arcs" : "signals")
  if (!kind) return []

  const participants = uniqueStrings([
    ...participantsFromPath(signal.targetPath ?? ""),
    ...participantsFromText(signal.targetObject ?? ""),
    ...participantsFromText(text),
    ...knownParticipantsInText(text, knownParticipants),
  ])

  return [{
    sourcePath: signal.targetPath || signal.sourceChunkId || "structured-rpg-signal",
    category: "signals",
    summary: limitText(cleanText(text), 320),
    participants,
    derivationKind: kind,
    confidence: signal.confidence,
    signalKind: signal.kind,
    sourceCanonStatus: signal.canonStatus,
    warnings: participants.length < 2 && kind !== "conflict_pressure"
      ? ["Structured signal has relationship value but insufficient participants; emitted as review-only evidence."]
      : [],
  }]
}

function extractSourceNoteCandidates(note: RpgRelationshipSourceNote, knownParticipants: string[]): EvidenceCandidate[] {
  const path = normalizePath(note.sourcePath).replace(/^\.\/+/, "")
  return relevantChunks(note.content).flatMap((chunk) => {
    const kind = classifyDerivationKind(chunk, "sources")
    if (!kind) return []
    const participants = uniqueStrings([
      ...participantsFromPath(path),
      ...participantsFromText(chunk),
      ...knownParticipantsInText(chunk, knownParticipants),
    ])
    return [{
      sourcePath: path,
      category: "sources",
      summary: limitText(cleanText(chunk), 320),
      participants,
      derivationKind: kind,
      confidence: "low",
      warnings: participants.length < 2 && kind !== "conflict_pressure"
        ? [`Source note ${path} is evidence only and lacks sufficient participants for a relationship target.`]
        : [],
    }]
  })
}

function buildProposals(candidates: EvidenceCandidate[]): RpgRelationshipDerivationProposal[] {
  const grouped = new Map<string, EvidenceCandidate[]>()

  for (const candidate of candidates) {
    const targetKind = targetKindForCandidate(candidate)
    const targetPath = targetPathForCandidate(candidate, targetKind)
    const key = [
      targetKind,
      targetPath,
      participantKey(candidate.participants),
    ].join("|")
    grouped.set(key, [...(grouped.get(key) ?? []), candidate])
  }

  return [...grouped.values()].map((items) => buildProposal(items)).sort((a, b) => {
    const targetSort = a.targetKind.localeCompare(b.targetKind)
    return targetSort || a.targetPath.localeCompare(b.targetPath) || a.derivationKind.localeCompare(b.derivationKind)
  })
}

function buildProposal(candidates: EvidenceCandidate[]): RpgRelationshipDerivationProposal {
  const primary = candidates[0]
  const targetKind = targetKindForCandidate(primary)
  const targetPath = targetPathForCandidate(primary, targetKind)
  const participants = uniqueStrings(candidates.flatMap((candidate) => candidate.participants)).slice(0, 4)
  const evidence = candidates.map((candidate) => ({
    sourcePath: candidate.sourcePath,
    summary: candidate.summary,
    signalKind: candidate.signalKind,
    sourceCanonStatus: candidate.sourceCanonStatus,
  }))
  const warnings = uniqueStrings(candidates.flatMap((candidate) => candidate.warnings))
  const confidence = maxConfidence(candidates.map((candidate) => candidate.confidence))
  const canonStatus: RpgRelationshipDerivationProposal["canonStatus"] = targetKind === "review_only" ? "uncertain" : "inferred_for_play"
  const rationale = buildRationale(primary.derivationKind, targetKind, evidence)
  const playerTriggers = extractPlayerTriggers(candidates)
  const unresolvedBoundaries = extractUnresolvedBoundaries(candidates, targetKind)
  const mergePatchMarkdown = targetKind === "relationship"
    ? buildRelationshipMergePatch({
      targetPath,
      derivationKind: primary.derivationKind,
      participants,
      canonStatus,
      evidence,
      rationale,
      playerTriggers,
      unresolvedBoundaries,
    })
    : undefined
  const proposalMarkdown = buildProposalMarkdown({
    targetPath,
    targetKind,
    derivationKind: primary.derivationKind,
    participants,
    canonStatus,
    confidence,
    evidence,
    rationale,
    playerTriggers,
    unresolvedBoundaries,
    mergePatchMarkdown,
    warnings,
  })

  return {
    targetPath,
    targetKind,
    derivationKind: primary.derivationKind,
    participants,
    canonStatus,
    confidence,
    evidence,
    rationale,
    playerTriggers,
    unresolvedBoundaries,
    mergePatchMarkdown,
    proposalMarkdown,
    warnings,
  }
}

function buildReviewOnlyProposal(input: {
  derivationKind: RpgRelationshipDerivationKind
  evidence: RpgRelationshipEvidence[]
  warnings: string[]
}): RpgRelationshipDerivationProposal {
  const targetPath = "REVIEW/relationship-tension-deriver"
  const proposalMarkdown = buildProposalMarkdown({
    targetPath,
    targetKind: "review_only",
    derivationKind: input.derivationKind,
    participants: [],
    canonStatus: "uncertain",
    confidence: "low",
    evidence: input.evidence,
    rationale: "The deriver did not have enough participants or evidence to propose a relationship or plot-arc target.",
    playerTriggers: [],
    unresolvedBoundaries: ["Human review must confirm participants and source-backed boundaries before any wiki update is drafted."],
    warnings: input.warnings,
  })
  return {
    targetPath,
    targetKind: "review_only",
    derivationKind: input.derivationKind,
    participants: [],
    canonStatus: "uncertain",
    confidence: "low",
    evidence: input.evidence,
    rationale: "The deriver did not have enough participants or evidence to propose a relationship or plot-arc target.",
    playerTriggers: [],
    unresolvedBoundaries: ["Human review must confirm participants and source-backed boundaries before any wiki update is drafted."],
    proposalMarkdown,
    warnings: input.warnings,
  }
}

function targetKindForCandidate(candidate: EvidenceCandidate): RpgRelationshipDerivationTargetKind {
  if (candidate.derivationKind === "conflict_pressure") return "plot_arc"
  if (candidate.participants.length >= 2) return "relationship"
  return "review_only"
}

function targetPathForCandidate(candidate: EvidenceCandidate, targetKind: RpgRelationshipDerivationTargetKind): string {
  if (targetKind === "relationship") {
    const participants = candidate.participants.slice(0, 2)
    return `wiki/relationships/${participants.map(slugify).join("-")}.md`
  }
  if (targetKind === "plot_arc") {
    if (candidate.sourcePath.startsWith("wiki/plot-arcs/")) return candidate.sourcePath
    const target = candidate.participants.length > 0
      ? `${candidate.participants.slice(0, 2).map(slugify).join("-")}-pressure`
      : `${slugify(getFileStem(candidate.sourcePath))}-pressure`
    return `wiki/plot-arcs/${target}.md`
  }
  return "REVIEW/relationship-tension-deriver"
}

function classifyDerivationKind(text: string, category: string): RpgRelationshipDerivationKind | null {
  const haystack = text.toLowerCase()
  const order: RpgRelationshipDerivationKind[] = category === "plot-arcs"
    ? ["conflict_pressure", "secret", "misunderstanding", "tension", "dependency", "trust"]
    : ["secret", "misunderstanding", "trust", "tension", "dependency", "conflict_pressure"]
  for (const kind of order) {
    if (DERIVATION_MARKERS[kind].some((marker) => haystack.includes(marker.toLowerCase()))) return kind
  }
  return null
}

function relevantChunks(body: string): string[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n")
  const chunks: string[] = []
  let currentHeading = ""
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/)?.[1]?.trim()
    if (heading) {
      currentHeading = heading
      continue
    }
    const cleaned = cleanText(line)
    if (!cleaned) continue
    if (classifyDerivationKind(`${currentHeading}\n${cleaned}`, "chunk")) {
      chunks.push(`${currentHeading ? `${currentHeading}: ` : ""}${cleaned}`)
    }
  }
  if (chunks.length > 0) return uniqueStrings(chunks).slice(0, 24)
  const whole = cleanText(body)
  return classifyDerivationKind(whole, "chunk") ? [limitText(whole, 500)] : []
}

function participantsFromPath(path: string): string[] {
  const normalized = normalizePath(path)
  if (!normalized) return []
  const category = normalized.match(/^wiki\/([^/]+)\//)?.[1]
  const stem = getFileStem(normalized)
  if (!stem || stem === "scene_state") return []
  if (category === "relationships") return stem.split(/[-_+&]+/).map(cleanParticipant).filter(isUsableParticipant)
  return []
}

function participantsFromText(text: string): string[] {
  const matches = Array.from(text.matchAll(/(?:participants?|参与者|相关角色)\s*[:：]\s*([^\n]+)/giu), (match) => match[1])
  return matches.flatMap((line) => line.split(/[,，、/&+;；]| and /giu)).map(cleanParticipant).filter(isUsableParticipant)
}

function knownParticipantsInText(text: string, knownParticipants: string[]): string[] {
  const lower = text.toLowerCase()
  return knownParticipants.filter((name) => {
    const normalized = name.toLowerCase()
    if (/^[a-z0-9][a-z0-9' -]*$/i.test(name)) {
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text)
    }
    return lower.includes(normalized)
  })
}

function cleanParticipant(value: string): string {
  return value
    .replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/^wiki\/[^/]+\//, "")
    .replace(/^#*\s*/, "")
    .trim()
}

function isUsableParticipant(value: string): boolean {
  if (!value || value.length < 2 || value.length > 48) return false
  const lowered = value.toLowerCase()
  return !["relationship", "relationships", "plot arcs", "events", "source", "sources", "unknown"].includes(lowered)
}

function buildRationale(
  derivationKind: RpgRelationshipDerivationKind,
  targetKind: RpgRelationshipDerivationTargetKind,
  evidence: RpgRelationshipEvidence[],
): string {
  const evidenceSummary = evidence[0]?.summary ?? "No direct evidence summary was available."
  if (targetKind === "plot_arc") {
    return `Derive a reviewable ${derivationKind} pressure note from source-backed unresolved conflict cues, without treating possible futures as already happened facts. Main evidence: ${limitText(evidenceSummary, 180)}`
  }
  if (targetKind === "relationship") {
    return `Derive a reviewable ${derivationKind} relationship change from behavior, event consequence, dialogue, or signal evidence. The conclusion is play-facing inference, not canon fact. Main evidence: ${limitText(evidenceSummary, 180)}`
  }
  return `Keep this as review-only because v0 lacks enough participants or target confidence. Evidence summary: ${limitText(evidenceSummary, 180)}`
}

function extractPlayerTriggers(candidates: EvidenceCandidate[]): string[] {
  const matches = candidates
    .map((candidate) => candidate.summary)
    .filter((summary) => hasAnyMarker(summary, PLAYER_TRIGGER_MARKERS))
    .map((summary) => limitText(summary, 220))
  if (matches.length > 0) return uniqueStrings(matches).slice(0, 4)
  return ["Review what player action would pressure, repair, expose, or unlock this relationship before applying any update."]
}

function extractUnresolvedBoundaries(candidates: EvidenceCandidate[], targetKind: RpgRelationshipDerivationTargetKind): string[] {
  const matches = candidates
    .map((candidate) => candidate.summary)
    .filter((summary) => hasAnyMarker(summary, UNRESOLVED_BOUNDARY_MARKERS))
    .map((summary) => limitText(summary, 220))
  if (matches.length > 0) return uniqueStrings(matches).slice(0, 4)
  if (targetKind === "plot_arc") {
    return ["Do not resolve the pressure, reveal hidden causes, or write future developments as already happened events without human confirmation."]
  }
  return ["Do not promote inferred trust, secret, misunderstanding, or dependency changes into canon facts without direct human-reviewed evidence."]
}

function buildRelationshipMergePatch(input: {
  targetPath: string
  derivationKind: RpgRelationshipDerivationKind
  participants: string[]
  canonStatus: RpgRelationshipDerivationProposal["canonStatus"]
  evidence: RpgRelationshipEvidence[]
  rationale: string
  playerTriggers: string[]
  unresolvedBoundaries: string[]
}): string {
  return [
    `## Proposed Relationship Merge Patch (${input.derivationKind})`,
    "",
    "- Safety: REVIEW / proposal-only; merge manually only after human approval.",
    `- Canon status: ${input.canonStatus}`,
    `- Participants: ${formatInlineList(input.participants)}`,
    `- Change: ${input.rationale}`,
    "",
    "### Relationship Delta",
    `- ${input.derivationKind}: inferred_for_play change suggested from evidence; keep this focused on trust, pressure, secret, misunderstanding, dependency, or boundary movement.`,
    "",
    "### Player Triggers",
    formatPlainList(input.playerTriggers),
    "",
    "### Unresolved Boundaries",
    formatPlainList(input.unresolvedBoundaries),
    "",
    "### Evidence Summaries",
    formatEvidence(input.evidence),
  ].join("\n")
}

function buildProposalMarkdown(input: {
  targetPath: string
  targetKind: RpgRelationshipDerivationTargetKind
  derivationKind: RpgRelationshipDerivationKind
  participants: string[]
  canonStatus: RpgRelationshipDerivationProposal["canonStatus"]
  confidence: RpgIngestSignalConfidence
  evidence: RpgRelationshipEvidence[]
  rationale: string
  playerTriggers: string[]
  unresolvedBoundaries: string[]
  mergePatchMarkdown?: string
  warnings: string[]
}): string {
  const plotProposal = input.targetKind === "plot_arc"
    ? [
      "## Plot-Arc Proposal",
      "- Safety: REVIEW / proposal-only; do not write this as a completed event.",
      `- Conflict pressure: ${input.rationale}`,
      "",
      "### Pressure Escalation Conditions",
      formatPlainList(input.playerTriggers),
      "",
      "### Cannot Resolve Early",
      formatPlainList(input.unresolvedBoundaries),
    ].join("\n")
    : ""

  return [
    `# Relationship/Tension Deriver Proposal: ${input.targetPath}`,
    "",
    "- Safety: REVIEW / proposal-only; do not overwrite, append, merge, accept, apply, or write canon facts automatically.",
    `- Target path: ${input.targetPath}`,
    `- Target kind: ${input.targetKind}`,
    `- Derivation kind: ${input.derivationKind}`,
    `- Participants: ${formatInlineList(input.participants)}`,
    `- Canon status: ${input.canonStatus}`,
    `- Confidence: ${input.confidence}`,
    "",
    "## Rationale",
    input.rationale,
    "",
    input.mergePatchMarkdown || plotProposal || "## Review-Only Proposal\n- Keep this as REVIEW / proposal-only until a human confirms participants, target, and evidence boundaries.",
    "",
    "## Evidence",
    formatEvidence(input.evidence),
    "",
    "## Warnings",
    formatPlainList(uniqueStrings(input.warnings)),
  ].join("\n")
}

function formatEvidence(evidence: RpgRelationshipEvidence[]): string {
  if (evidence.length === 0) return "- No evidence summary available."
  return evidence.map((item) => {
    const sourceMeta = [
      item.signalKind ? `signal=${item.signalKind}` : "",
      item.sourceCanonStatus ? `sourceCanonStatus=${item.sourceCanonStatus}` : "",
    ].filter(Boolean).join(", ")
    return `- ${item.sourcePath}${sourceMeta ? ` (${sourceMeta})` : ""}: ${item.summary}`
  }).join("\n")
}

function formatPlainList(items: readonly string[]): string {
  if (items.length === 0) return "- None proposed by v0 heuristic."
  return items.map((item) => `- ${item}`).join("\n")
}

function formatInlineList(items: readonly string[]): string {
  return items.length > 0 ? items.join(", ") : "unresolved"
}

function maxConfidence(values: RpgIngestSignalConfidence[]): RpgIngestSignalConfidence {
  if (values.includes("high")) return "high"
  if (values.includes("medium")) return "medium"
  return "low"
}

function hasAnyMarker(text: string, markers: readonly string[]): boolean {
  const haystack = text.toLowerCase()
  return markers.some((marker) => haystack.includes(marker.toLowerCase()))
}

function participantKey(participants: readonly string[]): string {
  return participants.map((participant) => participant.toLowerCase()).sort().join("+")
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "relationship"
}

function cleanText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^[-*]\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function limitText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}...`
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const cleaned = value.trim()
    const key = cleaned.toLowerCase()
    if (!cleaned || seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
  }
  return out
}
