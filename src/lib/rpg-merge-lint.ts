import { getRpgMergePolicy, type RpgMergeKind, type RpgMergePolicy } from "./rpg-interactions/merge"

export type RpgMergeLintSeverity = "warning" | "reject"

export interface RpgMergeLintIssue {
  severity: RpgMergeLintSeverity
  code: string
  message: string
  pagePath: string
}

export interface RpgMergeLintResult {
  issues: RpgMergeLintIssue[]
  shouldReject: boolean
}

export interface RpgMergeLintContext {
  pagePath: string
  policy?: RpgMergePolicy
  policyKind?: RpgMergeKind
  existingContent?: string
  incomingContent?: string
}

const RUNTIME_CAPSULE_HEADING_RE = /^##\s+Runtime Capsule\s*$/gim

const RUNTIME_CAPSULE_REQUIRED_CATEGORIES = new Set([
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

const FUTURE_EVENT_MARKERS = [
  "future",
  "possible future",
  "may happen",
  "could happen",
  "foreshadowing",
  "next step",
  "next steps",
  "suggested next",
  "unselected option",
  "unchosen option",
  "optional action",
  "possible action",
  "may later",
  "could later",
  "if the player chooses",
  "if players choose",
  "如果玩家",
  "未来",
  "可能会",
  "也许会",
  "下一步",
  "建议",
  "未选择",
  "可选行动",
  "伏笔",
  "铺垫",
] as const

const PLOT_FUTURE_MARKERS = [
  "possible future",
  "possible development",
  "may happen",
  "could happen",
  "might happen",
  "foreshadowing",
  "future",
  "unresolved",
  "可能发展",
  "未来",
  "可能会",
  "也许会",
  "伏笔",
  "待揭示",
] as const

const CONFIRMED_HAPPENED_MARKERS = [
  "has happened",
  "already happened",
  "confirmed happened",
  "confirmed occurred",
  "occurred",
  "happened",
  "became fact",
  "is now canon",
  "will definitely happen",
  "已经发生",
  "已发生",
  "已确认发生",
  "确认发生",
  "成为事实",
  "必然发生",
] as const

const BASE_RUNTIME_STATE_MARKERS = [
  "current campaign state",
  "currently wounded",
  "currently injured",
  "now located at",
  "current holder",
  "temporary condition",
  "temporary status",
  "this session",
  "last turn",
  "accepted player action",
  "accepted action",
  "current scene",
  "当前战役状态",
  "当前状态",
  "目前受伤",
  "现在位于",
  "当前持有者",
  "临时状态",
  "临时伤势",
  "本次团",
  "本回合",
  "上一回合",
  "已接受玩家行动",
] as const

const CURRENT_SCENE_ACCUMULATION_MARKERS = [
  "complete event timeline",
  "full event timeline",
  "entire timeline",
  "chronology",
  "long history",
  "full biography",
  "complete profile",
  "character profile",
  "route recap",
  "all previous events",
  "完整事件时间线",
  "完整时间线",
  "长期历史",
  "完整人物资料",
  "人物传记",
  "路线复述",
  "全部历史事件",
] as const

export function lintRpgMergedPage(
  content: string,
  context: RpgMergeLintContext,
): RpgMergeLintResult {
  const pagePath = normalizeWikiPath(context.pagePath)
  const policy = context.policy ?? getRpgMergePolicy(pagePath)
  const policyKind = context.policyKind ?? policy.kind
  const categoryId = policy.categoryId ?? getCategoryId(pagePath)
  const text = content.toLowerCase()
  const issues: RpgMergeLintIssue[] = []

  if (requiresRuntimeCapsule(pagePath, categoryId, policyKind) && !RUNTIME_CAPSULE_HEADING_RE.test(content)) {
    issues.push(issue("warning", "missing-runtime-capsule", pagePath, "Runtime-facing RPG page is missing ## Runtime Capsule."))
  }
  RUNTIME_CAPSULE_HEADING_RE.lastIndex = 0

  if (categoryId === "events") {
    const matches = findMarkers(text, FUTURE_EVENT_MARKERS)
    if (matches.length > 0) {
      issues.push(issue("reject", "event-future-or-option-contamination", pagePath, `Event page contains future, next-step, optional-action, foreshadowing, or unchosen-option language: ${matches.join(", ")}.`))
    }
  }

  if (categoryId === "plot-arcs") {
    const futureAsFactLine = findLineWithMarkers(text, PLOT_FUTURE_MARKERS, CONFIRMED_HAPPENED_MARKERS)
    if (futureAsFactLine) {
      issues.push(issue("reject", "plot-arc-future-as-fact", pagePath, `Plot-arc page appears to write possible future material as confirmed fact: ${futureAsFactLine}.`))
    }
    const confirmedFacts = extractMarkdownSection(content, "Confirmed Facts")
    if (confirmedFacts) {
      const confirmedFutureMatches = findMarkers(confirmedFacts.toLowerCase(), PLOT_FUTURE_MARKERS)
      if (confirmedFutureMatches.length > 0) {
        issues.push(issue("reject", "plot-arc-future-in-confirmed-facts", pagePath, `Plot-arc Confirmed Facts contains possible-future language that belongs in Possible Futures: ${confirmedFutureMatches.join(", ")}.`))
      }
    }
  }

  if (isBaseStableObjectPage(pagePath)) {
    const matches = findMarkers(text, BASE_RUNTIME_STATE_MARKERS)
    if (matches.length > 0) {
      issues.push(issue("warning", "base-page-runtime-state-contamination", pagePath, `Base stable page contains runtime-only current-state language that belongs in a runtime overlay: ${matches.join(", ")}.`))
    }
  }

  if (categoryId === "current-scene") {
    const matches = findMarkers(text, CURRENT_SCENE_ACCUMULATION_MARKERS)
    if (matches.length > 0) {
      issues.push(issue("reject", "current-scene-accumulated-history", pagePath, `Current-scene snapshot contains accumulated history, full profiles, or complete timeline language: ${matches.join(", ")}.`))
    }
  }

  return {
    issues,
    shouldReject: issues.some((lintIssue) => lintIssue.severity === "reject"),
  }
}

function issue(
  severity: RpgMergeLintSeverity,
  code: string,
  pagePath: string,
  message: string,
): RpgMergeLintIssue {
  return { severity, code, pagePath, message }
}

function requiresRuntimeCapsule(
  pagePath: string,
  categoryId: string | null,
  policyKind: RpgMergeKind,
): boolean {
  if (!categoryId) return false
  if (policyKind === "source-evidence" || policyKind === "manual-control") return false
  if (isListingOrStructuralPage(pagePath)) return false
  return RUNTIME_CAPSULE_REQUIRED_CATEGORIES.has(categoryId)
}

function isBaseStableObjectPage(pagePath: string): boolean {
  return /^wiki\/(?:characters|locations|factions|items)\/(?!runtime\/)[^/]+\.md$/i.test(pagePath)
}

function isListingOrStructuralPage(pagePath: string): boolean {
  return /\/(?:index|overview|log)\.md$/i.test(pagePath)
}

function getCategoryId(pagePath: string): string | null {
  return pagePath.match(/^wiki\/([^/]+)(?:\/|$)/)?.[1] ?? null
}

function findMarkers(text: string, markers: readonly string[]): string[] {
  return uniqueStrings(markers.filter((marker) => text.includes(marker.toLowerCase())))
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values))
}

function findLineWithMarkers(
  text: string,
  firstMarkers: readonly string[],
  secondMarkers: readonly string[],
): string | null {
  for (const line of text.split(/\r?\n/)) {
    const normalized = line.toLowerCase()
    const hasFirst = firstMarkers.some((marker) => normalized.includes(marker.toLowerCase()))
    const hasSecond = secondMarkers.some((marker) => normalized.includes(marker.toLowerCase()))
    if (hasFirst && hasSecond) return line.trim()
  }
  return null
}

function extractMarkdownSection(content: string, heading: string): string | null {
  const target = heading.trim().toLowerCase()
  const body = content.replace(/\r\n/g, "\n")
  const headingRe = /^##\s+(.+?)\s*$/gm
  const matches = Array.from(body.matchAll(headingRe))
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const normalizedHeading = match[1].trim().replace(/[ \t]+#+$/, "").trim().toLowerCase()
    if (normalizedHeading !== target) continue
    const start = (match.index ?? 0) + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index ?? body.length : body.length
    return body.slice(start, end)
  }
  return null
}

function normalizeWikiPath(pagePath: string): string {
  return pagePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/")
}
