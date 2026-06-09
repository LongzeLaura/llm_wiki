import type { ReviewItem } from "@/stores/review-store"
import { parseFrontmatter } from "./frontmatter"
import { getFileStem, normalizePath } from "./path-utils"
import { validateRpgDynamicWrite } from "./rpg-dynamic-update"
import {
  getRpgSourceIngestForbiddenTarget,
  isRpgSourceIngestAllowedTarget,
} from "./rpg-wiki-schema"

export interface RpgExtractionValidationBlock {
  path: string
  content: string
}

export interface RpgExtractionValidationContext {
  sourcePath?: string
  sourceText?: string
  existingCategoryPageCounts?: Partial<Record<"player" | "locations" | "factions", number>>
}

export interface RpgExtractionValidationResult {
  warnings: string[]
  reviewItems: Omit<ReviewItem, "id" | "resolved" | "createdAt">[]
}

interface ParsedValidationBlock {
  path: string
  title: string
  body: string
  text: string
}

type RuntimeSignalGroup = {
  label: string
  markers: readonly string[]
}

const DEFAULT_REVIEW_OPTIONS: ReviewItem["options"] = [
  { label: "Inspect", action: "Inspect" },
  { label: "Dismiss", action: "Dismiss" },
]

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

// Small regression fixture list from observed misroutes. This is not meant
// to be a general canon-character database.
const HIGH_RISK_CANON_CHARACTER_TOKENS = [
  "卫宫士郎",
  "远坂凛",
  "间桐樱",
  "saber",
  "archer",
] as const

const EXPLICIT_PC_MARKERS = [
  "当前pc",
  "当前 pc",
  "当前玩家角色",
  "当前玩家扮演",
  "玩家角色",
  "本团pc",
  "本团 pc",
  "pc角色",
  "pc 角色",
  "player character",
  "current pc",
  "the current pc",
  "active pc",
  "as the pc",
  "explicit pc",
  "明确 pc",
  "明确pc",
  "扮演的角色",
  "作为玩家角色",
] as const

const PLAYER_WORDING_MARKERS = [
  "玩家角色",
  "当前pc",
  "当前 pc",
  "玩家（",
  "玩家(",
  "player character",
  "current pc",
  "player relevance",
  "与当前pc交互规则",
  "与当前 pc 交互规则",
  "current pc interaction rules",
] as const

const NO_CURRENT_PC_MARKERS = [
  "未建立当前pc关系",
  "未建立当前 pc 关系",
  "no current pc relationship",
  "omit this section",
  "no current pc is established",
  "没有当前pc",
  "没有当前 pc",
  "尚无当前pc",
  "尚无当前 pc",
] as const

const EVENT_ROUTE_TOKENS = [
  "路线",
  "时间线",
  "剧情线",
  "route",
  "timeline",
  "storyline",
  "chronology",
] as const

const EVENT_FUTURE_OR_UNRESOLVED_TOKENS = [
  "未来",
  "可能会",
  "将会",
  "计划",
  "伏笔",
  "铺垫",
  "如果玩家",
  "可发展",
  "推进条件",
  "future",
  "may later",
  "will",
  "foreshadow",
  "possible development",
] as const

const PLOT_ARC_FUTURE_TOKENS = [
  "未来",
  "可能",
  "也许",
  "伏笔",
  "待揭示",
  "推进条件",
  "possible",
  "future",
  "foreshadow",
  "unresolved",
] as const

const PLOT_ARC_CONFIRMED_FACT_TOKENS = [
  "已经发生",
  "已确认发生",
  "必然发生",
  "注定发生",
  "has happened",
  "confirmed occurred",
  "will definitely happen",
] as const

const RUNTIME_SIGNAL_GROUPS: readonly RuntimeSignalGroup[] = [
  {
    label: "action hook",
    markers: ["行动", "可调查", "可交涉", "可移动", "可使用", "入口", "线索", "选择", "hook", "action", "interactable", "clue"],
  },
  {
    label: "constraint",
    markers: ["约束", "限制", "代价", "风险", "危险", "禁忌", "不能", "失败", "cost", "risk", "constraint", "limit"],
  },
  {
    label: "tension",
    markers: ["张力", "信任", "误解", "秘密", "压力", "冲突", "恐惧", "依赖", "tension", "trust", "secret", "pressure"],
  },
  {
    label: "state impact",
    markers: ["状态", "后果", "已发生", "当前", "影响", "变化", "state", "consequence", "current"],
  },
  {
    label: "portrayal",
    markers: ["扮演", "对白", "语气", "氛围", "感官", "风格", "portrayal", "dialogue", "atmosphere", "style"],
  },
] as const

const LOW_VALUE_ENCYCLOPEDIA_GROUPS: readonly RuntimeSignalGroup[] = [
  {
    label: "release metadata",
    markers: ["发售", "发行", "版本", "平台", "销量", "移植", "release", "released", "version", "platform"],
  },
  {
    label: "voice or production metadata",
    markers: ["声优", "配音", "cv:", "cv：", "voice actor", "voiced by"],
  },
  {
    label: "trivia or fan metadata",
    markers: ["萌点", "粉丝标签", "人气投票", "trivia", "fan tag", "fandom", "生日", "血型", "身高", "体重"],
  },
] as const

const RPG_RUNTIME_DIRS = new Set([
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
  "quests",
  "memory",
])

const LISTING_PAGE_STEMS = new Set(["index", "overview", "log"])

const RPG_PAGE_SOFT_BUDGETS: Record<string, number> = {
  characters: 3000,
  relationships: 1200,
  locations: 1200,
  factions: 1500,
  items: 1000,
  events: 900,
  "plot-arcs": 1500,
}

const DEFAULT_RPG_PAGE_SOFT_BUDGET = 1500
const RUNTIME_CAPSULE_SOFT_BUDGET = 800

const EVENT_TIME_ANCHOR_REGEXES = [
  /\b(?:19|20)\d{2}[-/.年](?:\d{1,2}[-/.月])?(?:\d{1,2}日?)?/gu,
  /\b(?:day|year|chapter|episode)\s+\d+\b/giu,
  /第[一二三四五六七八九十百\d]+(?:天|日|周|月|年|章|幕)/gu,
  /(当天|当夜|次日|第二天|第三天|数日后|一周后|数月后|多年后|later|days later|weeks later|months later|years later)/giu,
] as const

const LOCATION_REGEXES = [
  /([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3}\s+(?:City|Town|Village|School|Academy|Church|Temple|Shrine|Manor|Mansion|Park|Station|Harbor|Port|Tower|Forest|Mountain))/gu,
  /([\u4e00-\u9fffA-Za-z0-9·]{2,24}(?:市|城|镇|村|街|路|站|学园|学校|学院|寺|神殿|宅|公园|图书馆|工房|基地|港|码头|墓地|森林|山|塔|宫殿|教堂))/gu,
] as const

const FACTION_REGEXES = [
  /([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3}\s+(?:Association|Family|Clan|Church|Guild|Order|Agency|Society|Council|Union|Company))/gu,
  /([\u4e00-\u9fffA-Za-z0-9·]{2,24}(?:协会|家族|一族|教会|组织|阵营|帮|团|会|军|队|骑士团|商会|学会))/gu,
] as const

const CANDIDATE_STOPWORDS = new Set([
  "当前场景",
  "当前状态",
  "剧情总结",
  "角色介绍",
  "世界设定",
  "百科词条",
  "玩家角色",
  "当前玩家角色",
])

export function validateRpgExtraction(
  blocks: RpgExtractionValidationBlock[],
  context: RpgExtractionValidationContext = {},
): RpgExtractionValidationResult {
  const parsedBlocks = blocks.map(parseValidationBlock)
  const warnings: string[] = []
  const reviewItems: Omit<ReviewItem, "id" | "resolved" | "createdAt">[] = []
  const reviewKeys = new Set<string>()
  const pushReviewOnce = (
    title: string,
    description: string,
    affectedPages?: string[],
  ) => {
    const key = `${title}::${affectedPages?.join("|") ?? ""}`
    if (reviewKeys.has(key)) return
    reviewKeys.add(key)
    reviewItems.push({
      type: "suggestion",
      title,
      description,
      sourcePath: context.sourcePath,
      affectedPages,
      options: DEFAULT_REVIEW_OPTIONS,
    })
  }

  const sourceText = context.sourceText ?? ""
  const explicitPcExists =
    parsedBlocks.some((block) => isPlayerPath(block.path))
    || (context.existingCategoryPageCounts?.player ?? 0) > 0
    || hasAnyMarker(sourceText, EXPLICIT_PC_MARKERS)

  for (const block of parsedBlocks) {
    const sourceIngestForbiddenTarget = getRpgSourceIngestForbiddenTarget(block.path)
    if (sourceIngestForbiddenTarget) {
      const recommendedModeText = sourceIngestForbiddenTarget.recommendedMode === "review_only"
        ? "review-only until a dedicated mode owns it"
        : sourceIngestForbiddenTarget.recommendedMode
      warnings.push(
        `Source Ingest skipped "${block.path}" because ${sourceIngestForbiddenTarget.reason} Recommended mode: ${recommendedModeText}.`,
      )
      pushReviewOnce(
        `RPG Source Ingest boundary: ${sourceIngestValidationTargetLabel(block.path)} target skipped`,
        `Ordinary Source Ingest must not write ${block.path}. ${sourceIngestForbiddenTarget.reason} Recommended mode: ${recommendedModeText}.`,
        [block.path],
      )
    } else if (!isLegacyWikiPath(block.path) && !isRpgSourceIngestAllowedTarget(block.path)) {
      warnings.push(
        `Source Ingest skipped unsupported target "${block.path}".`,
      )
      pushReviewOnce(
        `RPG Source Ingest boundary: ${sourceIngestValidationTargetLabel(block.path)} target skipped`,
        `Ordinary Source Ingest can write only wiki/sources/, wiki/world/, wiki/characters/, fixed wiki/player/ slots, wiki/locations/, wiki/factions/, wiki/items/, wiki/plot-arcs/, wiki/events/, wiki/relationships/, and structural wiki/index.md, wiki/overview.md, wiki/log.md.`,
        [block.path],
      )
    }

    if (isPlayerPath(block.path)) {
      const canonMatches = findTokens(block.text, HIGH_RISK_CANON_CHARACTER_TOKENS)
      if (canonMatches.length > 0 && !hasAnyMarker(block.text, EXPLICIT_PC_MARKERS) && !hasAnyMarker(sourceText, EXPLICIT_PC_MARKERS)) {
        warnings.push(
          `Suspicious wiki/player page "${block.title}" looks like an original-work character (${canonMatches.join(", ")}) without an explicit current-PC declaration.`,
        )
        pushReviewOnce(
          `RPG extraction lint: suspicious player page ${block.title}`,
          `wiki/player/ should hold only the explicit current PC. This page mentions likely original-work character tokens (${canonMatches.join(", ")}) but the source and generated page do not clearly declare that character as the current PC.`,
          [block.path],
        )
      }
    }

    if (isCharacterPath(block.path)) {
      const usesPlayerWording = hasAnyMarker(block.text, PLAYER_WORDING_MARKERS)
      const hasNoCurrentPcDisclaimer = hasAnyMarker(block.text, NO_CURRENT_PC_MARKERS)
      if (!explicitPcExists && usesPlayerWording && !hasNoCurrentPcDisclaimer) {
        warnings.push(
          `Character page "${block.title}" uses player-facing wording even though no current PC was established in this extraction.`,
        )
        pushReviewOnce(
          `RPG extraction lint: character page uses player wording without current PC`,
          `wiki/characters/ should not talk about "玩家角色", "玩家（...）", or current-PC interaction rules unless the current PC is established. Either move the actual PC into wiki/player/ or replace the player-facing wording with neutral character notes.`,
          [block.path],
        )
      }
    }

    if (isEventPath(block.path)) {
      const routeMatches = findTokens(block.text, EVENT_ROUTE_TOKENS)
      const timeAnchorCount = countDistinctTimeAnchors(block.text)
      if (routeMatches.length > 0 || timeAnchorCount >= 2) {
        const reasons = [
          routeMatches.length > 0 ? `route/timeline wording (${routeMatches.join(", ")})` : "",
          timeAnchorCount >= 2 ? `${timeAnchorCount} distinct time anchors` : "",
        ].filter(Boolean)
        warnings.push(
          `Event page "${block.title}" may be too broad for wiki/events/ because it looks like ${reasons.join(" and ")}.`,
        )
        pushReviewOnce(
          `RPG extraction lint: event page may belong in plot-arcs`,
          `wiki/events/ should stay discrete and historical. "${block.title}" looks route-like or spans multiple periods (${reasons.join(" and ")}). Split it into discrete events or move the overview to wiki/plot-arcs/.`,
          [block.path],
        )
      }

      const futureMatches = findTokens(block.text, EVENT_FUTURE_OR_UNRESOLVED_TOKENS)
      if (futureMatches.length > 0) {
        warnings.push(
          `Event page "${block.title}" contains future, unresolved plot, or progression material (${futureMatches.join(", ")}) that does not belong in wiki/events/.`,
        )
        pushReviewOnce(
          `RPG extraction lint: event contains future or unresolved plot material`,
          `wiki/events/ can only record confirmed occurred events, state changes, who knows, and consequences. Future possibilities, foreshadowing, player-choice suggestions, and progression conditions should go to wiki/plot-arcs/ or REVIEW instead of being written as event history.`,
          [block.path],
        )
      }
    }

    if (isPlotArcPath(block.path)) {
      const futureMatches = findTokens(block.text, PLOT_ARC_FUTURE_TOKENS)
      const confirmedMatches = findTokens(block.text, PLOT_ARC_CONFIRMED_FACT_TOKENS)
      if (futureMatches.length > 0 && confirmedMatches.length > 0) {
        warnings.push(
          `Plot-arc page "${block.title}" may write possible future material as confirmed fact (${futureMatches.join(", ")} / ${confirmedMatches.join(", ")}).`,
        )
        pushReviewOnce(
          `RPG runtime lint: plot-arc future written as fact`,
          `wiki/plot-arcs/ can record unresolved questions, conflict pressure, foreshadowing, possible developments, and progression conditions. It must clearly separate confirmed facts from possible futures and must not disguise future possibilities as events that already happened.`,
          [block.path],
        )
      }
    }

    if (isCurrentScenePath(block.path)) {
      const sceneValidation = validateRpgDynamicWrite(block.path, block.text, {
        sourcePath: context.sourcePath,
        sourceText,
      })
      if (!sceneValidation.allowWrite) {
        warnings.push(...sceneValidation.warnings)
        pushReviewOnce(
          `RPG extraction lint: current-scene generated from static source`,
          `Ordinary ingest must not write wiki/current-scene/. current-scene is a runtime-owned snapshot maintained only by the RPG Play/Runtime apply flow. Route source material to events, plot-arcs, locations, characters, relationships, player, world, or sources as appropriate.`,
          [block.path],
        )
      }
    }

    if (isLegacyWikiPath(block.path)) {
      warnings.push(
        `Legacy llm_wiki path "${block.path}" is not supported in llmWikiRPG mode.`,
      )
      pushReviewOnce(
        `RPG extraction lint: legacy path rejected`,
        `llmWikiRPG no longer writes legacy llm_wiki directories. Move "${block.title}" to an ordinary Source Ingest directory such as wiki/sources/, wiki/world/, wiki/characters/, fixed wiki/player/ slots, wiki/locations/, wiki/factions/, wiki/items/, wiki/plot-arcs/, wiki/events/, or wiki/relationships/. Control, setup, quest, current-scene, and runtime-overlay material should stay REVIEW-only for the matching mode.`,
        [block.path],
      )
    }

    if (isRuntimeFacingRpgPage(block.path)) {
      const runtimeCapsule = extractMarkdownSection(block.body, "Runtime Capsule")
      if (!runtimeCapsule) {
        warnings.push(
          `RPG runtime lint: non-source page "${block.path}" is missing ## Runtime Capsule.`,
        )
        pushReviewOnce(
          `RPG runtime lint: missing Runtime Capsule`,
          `Non-source RPG pages should include ## Runtime Capsule near the top. The capsule should summarize runtime-useful action hooks, constraints, tensions, state impacts, portrayal rules, or atmosphere cues for the next turn. Do not treat an ordinary encyclopedia summary as a runtime capsule.`,
          [block.path],
        )
      } else if (!hasRuntimeSignal(runtimeCapsule)) {
        warnings.push(
          `RPG runtime lint: Runtime Capsule in "${block.path}" looks weak and lacks runtime value signals.`,
        )
        pushReviewOnce(
          `RPG runtime lint: weak Runtime Capsule`,
          `This Runtime Capsule looks like an encyclopedia summary. It should contain at least one runtime value signal such as an action hook, constraint, risk, tension, relationship pressure, state impact, portrayal rule, or atmosphere cue.`,
          [block.path],
        )
      }

      const pageBudget = softBudgetForPath(block.path)
      if (block.body.length > pageBudget) {
        warnings.push(
          `RPG runtime lint: page "${block.path}" exceeds its soft runtime-facing budget (${block.body.length}/${pageBudget} characters).`,
        )
        pushReviewOnce(
          `RPG runtime lint: page exceeds soft budget`,
          `This runtime-facing page is over its soft budget. Compress it toward Runtime Capsule + key evidence, move low-value encyclopedia paragraphs into REVIEW or sources/evidence, and do not silently accept long encyclopedia pages as runtime-facing context.`,
          [block.path],
        )
      }

      if (runtimeCapsule && runtimeCapsule.length > RUNTIME_CAPSULE_SOFT_BUDGET) {
        warnings.push(
          `RPG runtime lint: Runtime Capsule in "${block.path}" exceeds its soft budget (${runtimeCapsule.length}/${RUNTIME_CAPSULE_SOFT_BUDGET} characters).`,
        )
        pushReviewOnce(
          `RPG runtime lint: page exceeds soft budget`,
          `The Runtime Capsule itself is over its soft budget. Compress it to action hooks, constraints, tensions, state impacts, portrayal rules, atmosphere cues, and key evidence rather than a long encyclopedia summary.`,
          [block.path],
        )
      }

      const noiseText = stripEvidenceLikeSections(block.body)
      const noiseMatches = findGroupedTokenMatches(noiseText, LOW_VALUE_ENCYCLOPEDIA_GROUPS)
      if (noiseMatches.totalMatches >= 2 && noiseMatches.groups.length > 0 && !hasRuntimeSignal(noiseText)) {
        warnings.push(
          `RPG runtime lint: page "${block.path}" contains low-value encyclopedia noise (${noiseMatches.matches.join(", ")}) without clear RP utility signals.`,
        )
        pushReviewOnce(
          `RPG runtime lint: low-value encyclopedia noise`,
          `Release/version/platform data, voice actor metadata, fan tags, trivia, and route-recitation material should not enter runtime-facing pages unless they change action, risk, trust, cost, constraints, or portrayal boundaries. Keep them in sources/evidence or REVIEW instead.`,
          [block.path],
        )
      }
    }
  }

  const generatedLocationCount = parsedBlocks.filter((block) => isLocationPath(block.path)).length
  const generatedFactionCount = parsedBlocks.filter((block) => isFactionPath(block.path)).length
  const existingLocationCount = context.existingCategoryPageCounts?.locations ?? 0
  const existingFactionCount = context.existingCategoryPageCounts?.factions ?? 0
  const locationCandidates = extractCandidates(sourceText, LOCATION_REGEXES)
  const factionCandidates = extractCandidates(sourceText, FACTION_REGEXES)

  if (locationCandidates.length > 0 && generatedLocationCount === 0 && existingLocationCount === 0) {
    warnings.push(
      `Source looks like it contains location candidates (${locationCandidates.join(", ")}) but wiki/locations/ remained empty for this extraction.`,
    )
    pushReviewOnce(
      `RPG extraction lint: possible missing locations`,
      `The source contains likely location candidates (${locationCandidates.join(", ")}), but no wiki/locations/ page was generated and the project currently has no location pages. Review whether those places should be extracted as location pages.`,
    )
  }

  if (factionCandidates.length > 0 && generatedFactionCount === 0 && existingFactionCount === 0) {
    warnings.push(
      `Source looks like it contains faction candidates (${factionCandidates.join(", ")}) but wiki/factions/ remained empty for this extraction.`,
    )
    pushReviewOnce(
      `RPG extraction lint: possible missing factions`,
      `The source contains likely organization or faction candidates (${factionCandidates.join(", ")}), but no wiki/factions/ page was generated and the project currently has no faction pages. Review whether those groups should be extracted as faction pages.`,
    )
  }

  return {
    warnings: uniqueStrings(warnings),
    reviewItems,
  }
}

function isRuntimeFacingRpgPage(path: string): boolean {
  const normalized = normalizePath(path)
  if (isSourcePath(normalized) || isListingOrStructuralPage(normalized)) return false
  const match = normalized.match(/^wiki\/([^/]+)\//)
  return match ? RPG_RUNTIME_DIRS.has(match[1]) : false
}

function isSourcePath(path: string): boolean {
  return normalizePath(path).startsWith("wiki/sources/")
}

function isListingOrStructuralPage(path: string): boolean {
  const normalized = normalizePath(path)
  const stem = getFileStem(normalized).toLowerCase()
  return LISTING_PAGE_STEMS.has(stem)
}

function extractMarkdownSection(body: string, heading: string): string | null {
  const lines = body.split(/\r?\n/)
  const target = heading.trim().toLowerCase()
  let collecting = false
  let headingLevel = 0
  const sectionLines: string[] = []
  for (const line of lines) {
    const match = line.match(/^(#{2,6})\s+(.+?)\s*$/)
    if (match) {
      const level = match[1].length
      const name = match[2].trim().toLowerCase()
      if (collecting && level <= headingLevel) break
      if (name === target) {
        collecting = true
        headingLevel = level
        continue
      }
    }
    if (collecting) sectionLines.push(line)
  }
  const section = sectionLines.join("\n").trim()
  return collecting ? section : null
}

function hasRuntimeSignal(text: string): boolean {
  return RUNTIME_SIGNAL_GROUPS.some((group) => hasAnyMarker(text, group.markers))
}

function findGroupedTokenMatches(text: string, groups: readonly RuntimeSignalGroup[]): { groups: string[]; matches: string[]; totalMatches: number } {
  const matchedGroups: string[] = []
  const matches: string[] = []
  for (const group of groups) {
    const groupMatches = findTokens(text, group.markers)
    if (groupMatches.length > 0) {
      matchedGroups.push(group.label)
      matches.push(...groupMatches)
    }
  }
  const uniqueMatches = uniqueStrings(matches)
  return {
    groups: matchedGroups,
    matches: uniqueMatches,
    totalMatches: uniqueMatches.length,
  }
}

function stripEvidenceLikeSections(body: string): string {
  const lines = body.split(/\r?\n/)
  const kept: string[] = []
  let skippingLevel = 0
  for (const line of lines) {
    const match = line.match(/^(#{2,6})\s+(.+?)\s*$/)
    if (match) {
      const level = match[1].length
      const heading = match[2].trim().toLowerCase()
      if (skippingLevel && level <= skippingLevel) skippingLevel = 0
      if (isEvidenceLikeHeading(heading)) {
        skippingLevel = level
        continue
      }
    }
    if (!skippingLevel) kept.push(line)
  }
  return kept.join("\n")
}

function isEvidenceLikeHeading(heading: string): boolean {
  return heading.includes("source")
    || heading.includes("sources")
    || heading.includes("evidence")
    || heading.includes("reference")
    || heading.includes("references")
    || heading.includes("uncertainty")
    || heading.includes("来源")
    || heading.includes("证据")
    || heading.includes("引用")
    || heading.includes("不确定")
}

function softBudgetForPath(path: string): number {
  const match = normalizePath(path).match(/^wiki\/([^/]+)\//)
  if (!match) return DEFAULT_RPG_PAGE_SOFT_BUDGET
  return RPG_PAGE_SOFT_BUDGETS[match[1]] ?? DEFAULT_RPG_PAGE_SOFT_BUDGET
}

function parseValidationBlock(block: RpgExtractionValidationBlock): ParsedValidationBlock {
  const normalizedPath = normalizePath(block.path)
  const { frontmatter, body } = parseFrontmatter(block.content)
  const title = frontmatter?.title?.toString().trim() || getFileStem(normalizedPath)
  const text = `${title}\n${body}`.toLowerCase()
  return {
    path: normalizedPath,
    title,
    body,
    text,
  }
}

function hasAnyMarker(text: string, markers: readonly string[]): boolean {
  const haystack = text.toLowerCase()
  return markers.some((marker) => haystack.includes(marker))
}

function findTokens(text: string, tokens: readonly string[]): string[] {
  const haystack = text.toLowerCase()
  return uniqueStrings(tokens.filter((token) => haystack.includes(token)))
}

function countDistinctTimeAnchors(text: string): number {
  const matches = EVENT_TIME_ANCHOR_REGEXES.flatMap((regex) => {
    const local = new RegExp(regex.source, regex.flags)
    return Array.from(text.matchAll(local), (match) => match[0].toLowerCase())
  })
  return uniqueStrings(matches).length
}

function extractCandidates(text: string, regexes: readonly RegExp[]): string[] {
  if (!text.trim()) return []
  const matches = regexes.flatMap((regex) => {
    const local = new RegExp(regex.source, regex.flags)
    return Array.from(text.matchAll(local), (match) => match[1]?.trim() ?? "")
  })
  return uniqueStrings(
    matches
      .map((match) => match.replace(/\s+/g, " ").trim())
      .filter((match) => match.length >= 2 && !CANDIDATE_STOPWORDS.has(match)),
  ).slice(0, 4)
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function isPlayerPath(path: string): boolean {
  return normalizePath(path).startsWith("wiki/player/")
}

function isCharacterPath(path: string): boolean {
  return normalizePath(path).startsWith("wiki/characters/")
}

function isEventPath(path: string): boolean {
  return normalizePath(path).startsWith("wiki/events/")
}

function isPlotArcPath(path: string): boolean {
  return normalizePath(path).startsWith("wiki/plot-arcs/")
}

function isCurrentScenePath(path: string): boolean {
  return normalizePath(path).startsWith("wiki/current-scene/")
}

function isLegacyWikiPath(path: string): boolean {
  const match = normalizePath(path).match(/^wiki\/([^/]+)(?:\/|$)/)
  return match ? LEGACY_WIKI_DIRS.has(match[1]) : false
}

function isLocationPath(path: string): boolean {
  return normalizePath(path).startsWith("wiki/locations/")
}

function isFactionPath(path: string): boolean {
  return normalizePath(path).startsWith("wiki/factions/")
}

function sourceIngestValidationTargetLabel(path: string): string {
  const match = normalizePath(path).match(/^wiki\/([^/]+)(?:\/([^/]+))?/)
  if (!match) return "unsupported"
  if (match[2] === "runtime") return `${match[1]}/runtime`
  return match[1]
}
