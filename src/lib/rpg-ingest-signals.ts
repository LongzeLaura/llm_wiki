import {
  getRpgSourceIngestForbiddenTarget,
  isRpgSourceIngestAllowedTarget,
} from "./rpg-wiki-schema"

export const RPG_INGEST_SIGNAL_KINDS = [
  "portrayal_rule",
  "dialogue_style",
  "behavior_boundary",
  "scene_affordance",
  "relationship_tension",
  "plot_pressure",
  "world_constraint",
  "action_hook",
  "state_change",
  "style_rule",
  "noise",
] as const

export type RpgIngestSignalKind = typeof RPG_INGEST_SIGNAL_KINDS[number]
export type RpgIngestUtilityScore = 0 | 1 | 2 | 3 | 4 | 5
export type RpgIngestSignalConfidence = "high" | "medium" | "low"
export type RpgIngestCanonStatus = "canon" | "inferred_for_play" | "uncertain"

export interface RpgIngestSignal {
  kind: RpgIngestSignalKind
  targetPath?: string
  targetObject?: string
  summary: string
  rpUse: string
  evidence: string
  utilityScore: RpgIngestUtilityScore
  confidence: RpgIngestSignalConfidence
  canonStatus: RpgIngestCanonStatus
  sourceChunkId?: string
  dedupeKey?: string
  warnings?: string[]
}

const VALID_CONFIDENCE = new Set<RpgIngestSignalConfidence>(["high", "medium", "low"])
const VALID_CANON_STATUS = new Set<RpgIngestCanonStatus>(["canon", "inferred_for_play", "uncertain"])
const VALID_KINDS = new Set<RpgIngestSignalKind>(RPG_INGEST_SIGNAL_KINDS)

const LEGACY_SIGNAL_TARGET_DIRS = new Set([
  "entities",
  "concepts",
  "queries",
  "comparisons",
  "synthesis",
  "methodology",
  "findings",
  "thesis",
])

const STAGE2_CATEGORY_IDS = [
  "world",
  "characters",
  "player",
  "locations",
  "factions",
  "items",
  "plot-arcs",
  "events",
  "relationships",
] as const

type Stage2CategoryId = typeof STAGE2_CATEGORY_IDS[number]

const STAGE2_CATEGORY_SET = new Set<string>(STAGE2_CATEGORY_IDS)

const KIND_CATEGORY_HINTS: Partial<Record<RpgIngestSignalKind, Stage2CategoryId>> = {
  portrayal_rule: "characters",
  dialogue_style: "characters",
  behavior_boundary: "characters",
  scene_affordance: "locations",
  relationship_tension: "relationships",
  plot_pressure: "plot-arcs",
  world_constraint: "world",
  action_hook: "plot-arcs",
  state_change: "events",
}

interface NormalizeSignalOptions {
  sourceChunkId?: string
}

interface BuildSignalContextOptions {
  sourceIdentity?: string
  maxSignalsPerSection?: number
}

interface MergeSignalsOptions {
  maxEvidenceChars?: number
  maxRpUseChars?: number
}

export function parseRpgIngestSignalsFromText(
  text: string,
  options: NormalizeSignalOptions = {},
): RpgIngestSignal[] {
  const jsonText = extractSignalsJson(text)
  if (!jsonText) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return []
  }

  const rawSignals = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.signals)
      ? parsed.signals
      : []

  return rawSignals
    .map((raw) => normalizeRpgIngestSignal(raw, options))
    .filter((signal): signal is RpgIngestSignal => Boolean(signal))
}

export function normalizeRpgIngestSignal(
  raw: unknown,
  options: NormalizeSignalOptions = {},
): RpgIngestSignal | null {
  if (!isRecord(raw)) return null

  const warnings: string[] = []
  const rawKind = readString(raw, ["kind"]).toLowerCase()
  let kind: RpgIngestSignalKind = VALID_KINDS.has(rawKind as RpgIngestSignalKind)
    ? rawKind as RpgIngestSignalKind
    : "noise"
  if (rawKind && kind === "noise" && rawKind !== "noise") {
    warnings.push(`Invalid kind "${rawKind}" normalized to noise.`)
  }

  const summary = cleanInlineText(readString(raw, ["summary", "signal_summary"]))
  const rpUse = cleanInlineText(readString(raw, ["rpUse", "rp_use", "runtimeUse", "runtime_use"]))
  const evidence = cleanInlineText(readString(raw, ["evidence", "evidenceSummary", "evidence_summary"]))
  if (!summary && !evidence) return null

  let utilityScore = parseUtilityScore(readValue(raw, ["utilityScore", "utility_score", "runtime_utility"]))
  let confidence = normalizeConfidence(readString(raw, ["confidence"]))
  let canonStatus = normalizeCanonStatus(readString(raw, ["canonStatus", "canon_status"]))

  const targetCandidate = cleanInlineText(readString(raw, ["targetPath", "target_path", "path"]))
  const targetObject = cleanInlineText(readString(raw, ["targetObject", "target_object", "target", "object", "name"]))
  const targetPathSource = targetCandidate || (targetObject.startsWith("wiki/") ? targetObject : "")
  let targetPath = normalizeSignalTargetPath(targetPathSource)
  if (targetPathSource && !targetPath) {
    warnings.push(`Unsafe targetPath "${targetPathSource}" was cleared.`)
  }
  if (targetPath) {
    const forbiddenTarget = getRpgSourceIngestForbiddenTarget(targetPath)
    if (forbiddenTarget) {
      warnings.push(
        `Source Ingest targetPath "${targetPath}" belongs to ${forbiddenTarget.recommendedMode}; targetPath was cleared for REVIEW.`,
      )
      targetPath = undefined
      if (utilityScore > 2) utilityScore = 2
    }
  }
  if (targetPath && !isRpgSourceIngestAllowedTarget(targetPath)) {
    warnings.push(`Source Ingest targetPath "${targetPath}" is not an allowed Source Ingest target and was cleared for REVIEW.`)
    targetPath = undefined
    if (utilityScore > 2) utilityScore = 2
  }

  if (kind === "style_rule" && utilityScore > 2 && !targetPath) {
    utilityScore = 2
    warnings.push("Global style/control signal was kept review-only for Source Ingest.")
  }

  if (kind !== "noise" && (!summary || !evidence)) {
    kind = "noise"
    utilityScore = clampUtilityScore(Math.min(utilityScore, 1))
    confidence = "low"
    canonStatus = "uncertain"
    warnings.push("Non-noise signal missing summary or evidence was downgraded to noise.")
  }

  if (kind === "noise" && utilityScore > 1) {
    utilityScore = clampUtilityScore(1)
    confidence = "low"
    canonStatus = "uncertain"
    warnings.push("Noise signal utilityScore was capped at 1.")
  }

  const normalized: RpgIngestSignal = {
    kind,
    targetPath,
    targetObject: targetObject && !targetObject.startsWith("wiki/") ? targetObject : undefined,
    summary: summary || evidence,
    rpUse,
    evidence: evidence || summary,
    utilityScore,
    confidence,
    canonStatus,
    sourceChunkId: options.sourceChunkId,
  }
  normalized.dedupeKey = buildRpgIngestSignalDedupeKey(normalized)
  if (warnings.length > 0) normalized.warnings = warnings
  return normalized
}

export function mergeRpgIngestSignals(
  signals: RpgIngestSignal[],
  options: MergeSignalsOptions = {},
): RpgIngestSignal[] {
  const maxEvidenceChars = options.maxEvidenceChars ?? 700
  const maxRpUseChars = options.maxRpUseChars ?? 500
  const merged = new Map<string, RpgIngestSignal>()

  for (const signal of signals) {
    const dedupeKey = signal.dedupeKey || buildRpgIngestSignalDedupeKey(signal)
    const existing = merged.get(dedupeKey)
    if (!existing) {
      merged.set(dedupeKey, {
        ...signal,
        dedupeKey,
        warnings: signal.warnings ? uniqueStrings(signal.warnings) : undefined,
      })
      continue
    }

    merged.set(dedupeKey, {
      ...existing,
      targetPath: existing.targetPath || signal.targetPath,
      targetObject: existing.targetObject || signal.targetObject,
      rpUse: mergeShortText(existing.rpUse, signal.rpUse, maxRpUseChars),
      evidence: mergeShortText(existing.evidence, signal.evidence, maxEvidenceChars),
      utilityScore: maxUtilityScore(existing.utilityScore, signal.utilityScore),
      confidence: maxConfidence(existing.confidence, signal.confidence),
      canonStatus: mergeCanonStatus(existing.canonStatus, signal.canonStatus),
      warnings: uniqueStrings([...(existing.warnings ?? []), ...(signal.warnings ?? [])]),
    })
  }

  return [...merged.values()].sort(compareSignalsForStage2)
}

export function buildStructuredRpgSignalContext(
  signals: RpgIngestSignal[],
  options: BuildSignalContextOptions = {},
): string {
  const merged = mergeRpgIngestSignals(signals)
  const coreSignals = merged.filter((signal) => signal.utilityScore >= 3)
  const reviewSignals = merged.filter((signal) => signal.utilityScore === 2)
  const sourceOnlySignals = merged.filter((signal) => signal.utilityScore <= 1)
  const maxSignals = options.maxSignalsPerSection ?? 24

  return [
    buildSignalSourceProfile(merged),
    "",
    "## Structured RP Runtime Signals",
    options.sourceIdentity ? `Source: ${options.sourceIdentity}` : "",
    "These signals were parsed from long-source chunk outputs and normalized before Stage 2.",
    "Use this section as the long-source utility gate instead of turning raw chunk summaries into encyclopedia pages.",
    "",
    "Signal routing rules:",
    "- utilityScore 3-5: core material allowed only for ordinary Source Ingest page targets.",
    "- utilityScore 4-5: Runtime Capsule priority for the allowed target page.",
    "- utilityScore 2: REVIEW or Evidence and Uncertainty only unless a 3-5 signal supports the same target.",
    "- utilityScore 0-1: source summary / ignored noise only; do not create or update non-source pages from these signals.",
    "- Confirmed discrete events may enter wiki/events/; route recaps, unresolved conflicts, foreshadowing, possible developments, and progression conditions belong in wiki/plot-arcs/ or REVIEW.",
    "- Do not turn a long route/course summary into one long wiki/events/ page.",
    "- PC subjective goals may enter wiki/player/goals.md only for an explicitly declared current PC; wiki/quests/ is REVIEW-only in ordinary Source Ingest.",
    "- Plot pressure, unresolved conflict, foreshadowing, and possible development belong in wiki/plot-arcs/, not wiki/player/goals.md.",
    "- Player TODO/checklists are REVIEW-only unless they are true current-PC subjective goals; never write them as plot-arcs.",
    "- Global writing rules are control_doc_import material for REVIEW; character-specific voice, catchphrases, address habits, politeness level, and relationship-driven tone changes belong with characters or relationships.",
    "- rules/control material is REVIEW-only control_doc_import material; world material is background, common knowledge, history, society, geography, and stable setting facts.",
    "- Cleared targetPath warnings mean the signal pointed at another mode's target and must stay REVIEW/source evidence instead of becoming a FILE path.",
    "",
    "### Core Page Signals (utilityScore 3-5)",
    formatSignalsByTarget(coreSignals.slice(0, maxSignals), { includeCapsulePriority: true }) || "No utilityScore 3-5 signals were extracted. Do not create non-source runtime-facing pages from this long source unless other Stage 1 evidence supports them.",
    coreSignals.length > maxSignals ? `\n[${coreSignals.length - maxSignals} additional core signals trimmed for prompt budget.]` : "",
    "",
    "### Review / Evidence and Uncertainty Signals (utilityScore 2)",
    formatSignalsByTarget(reviewSignals.slice(0, maxSignals), { includeCapsulePriority: false }) || "No utilityScore 2 review signals were extracted.",
    reviewSignals.length > maxSignals ? `\n[${reviewSignals.length - maxSignals} additional review signals trimmed for prompt budget.]` : "",
    "",
    "### Source-only / Ignored Noise Signals (utilityScore 0-1)",
    formatSourceOnlySignals(sourceOnlySignals.slice(0, Math.min(maxSignals, 12))) || "No source-only or ignored-noise signals were extracted.",
    sourceOnlySignals.length > Math.min(maxSignals, 12) ? `\n[${sourceOnlySignals.length - Math.min(maxSignals, 12)} additional low-utility/noise signals trimmed for prompt budget.]` : "",
  ].filter((part) => part !== "").join("\n")
}

export function buildRpgIngestSignalDedupeKey(signal: RpgIngestSignal): string {
  return [
    signal.kind,
    normalizeForKey(signal.targetPath || signal.targetObject || "unknown-target"),
    normalizeForKey(signal.summary),
  ].join("|")
}

function extractSignalsJson(text: string): string {
  const section = extractMarkdownSection(text, "RP Runtime Signals JSON")
  if (section) {
    return extractFencedJson(section) || extractBalancedJson(section)
  }

  const marker = /RP Runtime Signals JSON/i.exec(text)
  if (!marker) return ""
  const rest = text.slice(marker.index)
  return extractFencedJson(rest) || extractBalancedJson(rest)
}

function extractMarkdownSection(text: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i")
  return re.exec(text)?.[1]?.trim() ?? ""
}

function extractFencedJson(text: string): string {
  const match = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  return match?.[1]?.trim() ?? ""
}

function extractBalancedJson(text: string): string {
  const start = text.search(/[\[{]/)
  if (start < 0) return ""
  const opener = text[start]
  const closer = opener === "[" ? "]" : "}"
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === opener) {
      depth += 1
    } else if (char === closer) {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1).trim()
    }
  }
  return ""
}

function buildSignalSourceProfile(signals: RpgIngestSignal[]): string {
  const coreSignals = signals.filter((signal) => signal.utilityScore >= 3)
  const reviewSignals = signals.filter((signal) => signal.utilityScore === 2)
  const sourceOnlySignals = signals.filter((signal) => signal.utilityScore <= 1)
  const categories = inferNeededCategories(coreSignals)
  const recommendedMode = coreSignals.length > 6
    ? "focused_pages"
    : coreSignals.length > 0
      ? "capsule_pages"
      : reviewSignals.length > 0
        ? "review_first"
        : "source_only"
  const noiseRatio = sourceOnlySignals.length > coreSignals.length + reviewSignals.length
    ? "high"
    : sourceOnlySignals.length > 0
      ? "medium"
      : "low"

  return [
    "## Source Profile",
    "- source_kind: mixed",
    `- dominant_focus: ${dominantFocus(signals)}`,
    `- needed_categories: ${categories.length > 0 ? `[${categories.join(", ")}]` : "[]"}`,
    "- suppressed_categories: []",
    `- event_extraction_mode: ${eventExtractionMode(categories)}`,
    `- runtime_utility_focus: ${runtimeUtilityFocus(coreSignals)}`,
    `- noise_ratio: ${noiseRatio}`,
    `- recommended_ingest_mode: ${recommendedMode}`,
    "",
    "## Candidate Objects",
    ...formatCandidateObjects(coreSignals),
  ].join("\n")
}

function inferNeededCategories(
  coreSignals: RpgIngestSignal[],
): Stage2CategoryId[] {
  const categoryScores = new Map<Stage2CategoryId, { score: number; count: number }>()
  for (const signal of coreSignals) {
    const category = categoryFromSignal(signal)
    if (!category) continue
    const existing = categoryScores.get(category) ?? { score: 0, count: 0 }
    categoryScores.set(category, {
      score: Math.max(existing.score, signal.utilityScore),
      count: existing.count + 1,
    })
  }

  return [...categoryScores.entries()]
    .sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count || STAGE2_CATEGORY_IDS.indexOf(a[0]) - STAGE2_CATEGORY_IDS.indexOf(b[0]))
    .slice(0, 4)
    .map(([category]) => category)
}

function categoryFromSignal(signal: RpgIngestSignal): Stage2CategoryId | undefined {
  if (signal.targetPath) {
    const category = /^wiki\/([^/]+)/.exec(signal.targetPath)?.[1]
    if (category && STAGE2_CATEGORY_SET.has(category)) return category as Stage2CategoryId
  }
  return KIND_CATEGORY_HINTS[signal.kind]
}

function eventExtractionMode(categories: Stage2CategoryId[]): string {
  const hasEvents = categories.includes("events")
  const hasPlotArcs = categories.includes("plot-arcs")
  if (hasEvents && hasPlotArcs) return "split_if_possible"
  if (hasPlotArcs) return "plot_arc_preferred"
  if (hasEvents) return "discrete_only"
  return "none"
}

function runtimeUtilityFocus(coreSignals: RpgIngestSignal[]): string {
  if (coreSignals.length === 0) return "low"
  const focuses = new Set(coreSignals.map((signal) => {
    if (["portrayal_rule", "dialogue_style", "behavior_boundary"].includes(signal.kind)) return "npc_portrayal"
    if (["scene_affordance", "action_hook", "world_constraint"].includes(signal.kind)) return "player_action"
    if (["plot_pressure", "relationship_tension"].includes(signal.kind)) return "plot_pressure"
    if (signal.kind === "state_change") return "state_update"
    if (signal.kind === "style_rule") return "atmosphere_style"
    return "low"
  }).filter((focus) => focus !== "low"))
  if (focuses.size === 0) return "low"
  if (focuses.size === 1) return [...focuses][0]
  return "mixed"
}

function dominantFocus(signals: RpgIngestSignal[]): string {
  const focus = runtimeUtilityFocus(signals.filter((signal) => signal.utilityScore >= 3))
  if (focus === "low") return "source summary and ignored low-utility material"
  return `structured long-source ${focus} signals`
}

function formatCandidateObjects(coreSignals: RpgIngestSignal[]): string[] {
  if (coreSignals.length === 0) return ["- Name: source summary only", "  - object_type: source", "  - suggested_route: wiki/sources/", "  - action: create", "  - runtime_utility: 1", "  - runtime_use: Archive source context; no non-source page generation is justified by utilityScore 3-5 signals.", "  - evidence_summary: Structured signal extraction found no core runtime-facing signals.", "  - canon_status: uncertain"]

  const byTarget = groupSignalsByTarget(coreSignals)
  const lines: string[] = []
  for (const [target, targetSignals] of byTarget.slice(0, 8)) {
    const topSignal = targetSignals[0]
    lines.push(`- Name: ${target}`)
    lines.push(`  - object_type: ${objectTypeForSignal(topSignal)}`)
    lines.push(`  - suggested_route: ${topSignal.targetPath || "merge-target"}`)
    lines.push("  - action: create | update | merge-into")
    lines.push(`  - runtime_utility: ${topSignal.utilityScore}`)
    lines.push(`  - runtime_use: ${limitText(topSignal.rpUse || topSignal.summary, 220)}`)
    lines.push(`  - evidence_summary: ${limitText(topSignal.evidence, 220)}`)
    lines.push(`  - canon_status: ${topSignal.canonStatus}`)
  }
  return lines
}

function objectTypeForSignal(signal: RpgIngestSignal): string {
  const category = categoryFromSignal(signal)
  if (category === "characters") return "npc_character"
  if (category === "player") return "player_character"
  if (category === "locations") return "location"
  if (category === "factions") return "faction"
  if (category === "items") return "item"
  if (category === "plot-arcs") return "plot_arc"
  if (category === "events") return "discrete_event"
  if (category === "relationships") return "relationship"
  if (category === "world") return "world_fact"
  return "source"
}

function formatSignalsByTarget(
  signals: RpgIngestSignal[],
  options: { includeCapsulePriority: boolean },
): string {
  const groups = groupSignalsByTarget(signals)
  return groups.map(([target, targetSignals]) => [
    `#### ${target}`,
    ...targetSignals.map((signal) => formatSignalBullet(signal, options.includeCapsulePriority)),
  ].join("\n")).join("\n\n")
}

function groupSignalsByTarget(signals: RpgIngestSignal[]): Array<[string, RpgIngestSignal[]]> {
  const grouped = new Map<string, RpgIngestSignal[]>()
  for (const signal of signals) {
    const target = signal.targetPath || signal.targetObject || "unresolved target"
    const existing = grouped.get(target) ?? []
    existing.push(signal)
    grouped.set(target, existing)
  }
  return [...grouped.entries()].map(([target, targetSignals]) => [target, targetSignals.sort(compareSignalsForStage2)] as [string, RpgIngestSignal[]])
}

function formatSignalBullet(signal: RpgIngestSignal, includeCapsulePriority: boolean): string {
  return [
    `- [${signal.utilityScore}] ${signal.kind} (${signal.confidence}, ${signal.canonStatus}) ${limitText(signal.summary, 260)}`,
    signal.rpUse ? `  RP use: ${limitText(signal.rpUse, 260)}` : "",
    `  Evidence: ${limitText(signal.evidence, 300)}`,
    includeCapsulePriority && signal.utilityScore >= 4 ? "  Runtime Capsule priority: yes" : "",
  ].filter(Boolean).join("\n")
}

function formatSourceOnlySignals(signals: RpgIngestSignal[]): string {
  return signals.map((signal) => `- [${signal.utilityScore}] ${signal.kind}: ${limitText(signal.summary, 220)}${signal.evidence ? ` Evidence/source note: ${limitText(signal.evidence, 220)}` : ""}`).join("\n")
}

function compareSignalsForStage2(a: RpgIngestSignal, b: RpgIngestSignal): number {
  return b.utilityScore - a.utilityScore
    || confidenceRank(b.confidence) - confidenceRank(a.confidence)
    || canonRank(a.canonStatus) - canonRank(b.canonStatus)
    || (a.targetPath || a.targetObject || "").localeCompare(b.targetPath || b.targetObject || "")
    || a.summary.localeCompare(b.summary)
}

function readValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return undefined
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  const value = readValue(record, keys)
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function parseUtilityScore(value: unknown): RpgIngestUtilityScore {
  if (typeof value === "number") return clampUtilityScore(value)
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/)
    if (match) return clampUtilityScore(Number(match[0]))
  }
  return 0
}

function clampUtilityScore(value: number): RpgIngestUtilityScore {
  const clamped = Math.max(0, Math.min(5, Math.round(Number.isFinite(value) ? value : 0)))
  return clamped as RpgIngestUtilityScore
}

function maxUtilityScore(a: RpgIngestUtilityScore, b: RpgIngestUtilityScore): RpgIngestUtilityScore {
  return clampUtilityScore(Math.max(a, b))
}

function normalizeConfidence(value: string): RpgIngestSignalConfidence {
  const normalized = value.toLowerCase().trim()
  return VALID_CONFIDENCE.has(normalized as RpgIngestSignalConfidence)
    ? normalized as RpgIngestSignalConfidence
    : "low"
}

function normalizeCanonStatus(value: string): RpgIngestCanonStatus {
  const normalized = value.toLowerCase().trim()
  return VALID_CANON_STATUS.has(normalized as RpgIngestCanonStatus)
    ? normalized as RpgIngestCanonStatus
    : "uncertain"
}

function maxConfidence(a: RpgIngestSignalConfidence, b: RpgIngestSignalConfidence): RpgIngestSignalConfidence {
  return confidenceRank(a) >= confidenceRank(b) ? a : b
}

function mergeCanonStatus(a: RpgIngestCanonStatus, b: RpgIngestCanonStatus): RpgIngestCanonStatus {
  if (a === "uncertain" || b === "uncertain") return "uncertain"
  if (a === "inferred_for_play" || b === "inferred_for_play") return "inferred_for_play"
  return "canon"
}

function confidenceRank(confidence: RpgIngestSignalConfidence): number {
  if (confidence === "high") return 2
  if (confidence === "medium") return 1
  return 0
}

function canonRank(status: RpgIngestCanonStatus): number {
  if (status === "canon") return 2
  if (status === "inferred_for_play") return 1
  return 0
}

function normalizeSignalTargetPath(value: string): string | undefined {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\.\/+/, "")
  if (!normalized) return undefined
  if (/^[a-zA-Z]:/.test(normalized) || normalized.startsWith("/") || normalized.startsWith("\\")) return undefined
  if (/[^\S\n]/.test(normalized)) return undefined
  if (/[\x00-\x1f]/.test(normalized)) return undefined
  if (!normalized.startsWith("wiki/")) return undefined
  const segments = normalized.split("/")
  if (segments.some((segment) => segment === "" || segment === ".." || /[<>:"|?*]/.test(segment) || /[ .]$/.test(segment))) return undefined
  if (LEGACY_SIGNAL_TARGET_DIRS.has(segments[1])) return undefined
  return normalized
}

function cleanInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function normalizeForKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s"'“”‘’.,;:!?，。；：！？()[\]{}<>《》、/\\|_-]+/g, " ")
    .trim()
    .slice(0, 180)
}

function mergeShortText(existing: string, incoming: string, maxChars: number): string {
  const snippets = uniqueStrings([existing, incoming].flatMap(splitTextSnippets).filter(Boolean))
  let out = ""
  for (const snippet of snippets) {
    const next = out ? `${out}; ${snippet}` : snippet
    if (next.length > maxChars) break
    out = next
  }
  return out || limitText(existing || incoming, maxChars)
}

function splitTextSnippets(value: string): string[] {
  return value
    .split(/(?:\n+|;|；|\s+\/\s+)/)
    .map(cleanInlineText)
    .filter(Boolean)
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = normalizeForKey(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function limitText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars).trimEnd()}...`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
