import type { ReviewItem } from "@/stores/review-store"
import { parseFrontmatter } from "./frontmatter"
import { getFileStem, normalizePath } from "./path-utils"
import { validateRpgDynamicWrite } from "./rpg-dynamic-update"

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
  const pushReview = (
    title: string,
    description: string,
    affectedPages?: string[],
  ) => {
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
    if (isPlayerPath(block.path)) {
      const canonMatches = findTokens(block.text, HIGH_RISK_CANON_CHARACTER_TOKENS)
      if (canonMatches.length > 0 && !hasAnyMarker(block.text, EXPLICIT_PC_MARKERS) && !hasAnyMarker(sourceText, EXPLICIT_PC_MARKERS)) {
        warnings.push(
          `Suspicious wiki/player page "${block.title}" looks like an original-work character (${canonMatches.join(", ")}) without an explicit current-PC declaration.`,
        )
        pushReview(
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
        pushReview(
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
        pushReview(
          `RPG extraction lint: event page may belong in plot-arcs`,
          `wiki/events/ should stay discrete and historical. "${block.title}" looks route-like or spans multiple periods (${reasons.join(" and ")}). Split it into discrete events or move the overview to wiki/plot-arcs/.`,
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
        pushReview(
          `RPG extraction lint: current-scene generated from static source`,
          `wiki/current-scene/ should come only from live RPG runtime input that contains [RPG-LIVE]. The generated current-scene page looks like it came from static lore, route summary, ending material, unmarked current-scene wording, or other non-live source content.`,
          [block.path],
        )
      }
    }

    if (isLegacyWikiPath(block.path)) {
      warnings.push(
        `Legacy llm_wiki path "${block.path}" is not supported in llmWikiRPG mode.`,
      )
      pushReview(
        `RPG extraction lint: legacy path rejected`,
        `llmWikiRPG no longer writes legacy llm_wiki directories. Move "${block.title}" to an RPG runtime directory such as wiki/world/, wiki/characters/, wiki/player/, wiki/locations/, wiki/factions/, wiki/items/, wiki/plot-arcs/, wiki/events/, wiki/current-scene/, wiki/relationships/, wiki/style/, wiki/rules/, wiki/quests/, or wiki/memory/.`,
        [block.path],
      )
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
    pushReview(
      `RPG extraction lint: possible missing locations`,
      `The source contains likely location candidates (${locationCandidates.join(", ")}), but no wiki/locations/ page was generated and the project currently has no location pages. Review whether those places should be extracted as location pages.`,
    )
  }

  if (factionCandidates.length > 0 && generatedFactionCount === 0 && existingFactionCount === 0) {
    warnings.push(
      `Source looks like it contains faction candidates (${factionCandidates.join(", ")}) but wiki/factions/ remained empty for this extraction.`,
    )
    pushReview(
      `RPG extraction lint: possible missing factions`,
      `The source contains likely organization or faction candidates (${factionCandidates.join(", ")}), but no wiki/factions/ page was generated and the project currently has no faction pages. Review whether those groups should be extracted as faction pages.`,
    )
  }

  return {
    warnings: uniqueStrings(warnings),
    reviewItems,
  }
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
