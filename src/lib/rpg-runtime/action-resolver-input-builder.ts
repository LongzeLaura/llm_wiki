import type { RpgSchemaSlotId } from "@/lib/rpg-wiki-schema"
import type {
  ActionResolverFixedSlotRef,
  ActionResolverInput,
  ActionResolverRuleExcerpt,
  PreActionClockSummary,
  PreActionPendingReaction,
  SubmittedAction,
} from "./types"
import {
  compactText,
  formatGroupEntry,
  formatPageEntry,
  isAllowedReference,
  markGroups,
  markPages,
  normalizeProjectPath,
  rankedPages,
  readMarkdownDir,
  readRelevantOverlayGroups,
  readRequiredSchemaSlot,
  readSchemaSlotPages,
  tokenize,
  type RuntimePage,
  type RuntimePageGroup,
} from "./wiki-readers"

export interface BuildActionResolverInputFromWikiInput {
  projectPath: string
  submittedAction: SubmittedAction
}

export interface BuildActionResolverInputFromWikiResult {
  input: ActionResolverInput
  warnings: string[]
}

const CURRENT_SCENE_SLOT_ID = "current_scene" satisfies RpgSchemaSlotId
const PLAYER_SLOT_IDS = [
  "player_main",
  "player_abilities",
  "player_inventory",
  "player_goals",
  "player_known_information",
] as const satisfies readonly RpgSchemaSlotId[]
const RULE_SLOT_IDS = ["rules_core", "rules_world", "rules_table"] as const satisfies readonly RpgSchemaSlotId[]
const OUTLINE_PROGRESS_SLOT_IDS = ["outline_progress"] as const satisfies readonly RpgSchemaSlotId[]

const MAX_REFERENCE_COUNT = 50
const MAX_RELEVANT_QUESTS = 6
const MAX_LIST_ITEMS = 8
const MAX_SLOT_EXCERPT_CHARS = 1100
const MAX_SCENE_EXCERPT_CHARS = 2600

export async function buildActionResolverInputFromWiki(
  input: BuildActionResolverInputFromWikiInput,
): Promise<BuildActionResolverInputFromWikiResult> {
  const projectPath = normalizeProjectPath(input.projectPath)
  const warnings: string[] = []
  const references = new Set<string>()

  const currentScene = await readRequiredSchemaSlot(projectPath, CURRENT_SCENE_SLOT_ID, warnings, references)
  const actionTokens = tokenize(buildActionResolverQueryText(input.submittedAction, currentScene))
  const playerPages = await readSchemaSlotPages(projectPath, PLAYER_SLOT_IDS, warnings)
  const rulePages = await readSchemaSlotPages(projectPath, RULE_SLOT_IDS, warnings)
  const outlineProgressPages = await readSchemaSlotPages(projectPath, OUTLINE_PROGRESS_SLOT_IDS, warnings)
  const questPages = rankedPages(await readMarkdownDir(projectPath, "quests"), actionTokens, MAX_RELEVANT_QUESTS)
  const characterGroups = await readRelevantOverlayGroups(projectPath, "characters", actionTokens)
  const locationGroups = await readRelevantOverlayGroups(projectPath, "locations", actionTokens)
  const itemGroups = await readRelevantOverlayGroups(projectPath, "items", actionTokens)
  const factionGroups = await readRelevantOverlayGroups(projectPath, "factions", actionTokens)

  markPages(references, playerPages, rulePages, outlineProgressPages, questPages)
  markGroups(references, characterGroups, locationGroups, itemGroups, factionGroups)

  const rulesExcerpts = buildRuleExcerpts(rulePages)
  const fixedSlotRefs = buildFixedSlotRefs(playerPages, rulePages)
  const knownInformationPage = findPage(playerPages, "wiki/player/known_information.md")
  const outlineProgressPage = outlineProgressPages[0]

  return {
    input: {
      submittedAction: input.submittedAction,
      preActionSnapshot: {
        currentScene: {
          path: "wiki/current-scene/scene_state.md",
          summary: summarizePage(currentScene, "No current scene summary was available.", MAX_SCENE_EXCERPT_CHARS),
          currentTime: extractLabeledValue(currentScene.content, [/current\s+time/i, /^time$/i, /当前时间/, /當前時間/]),
          currentLocation: extractLabeledValue(currentScene.content, [
            /current\s+location/i,
            /^location$/i,
            /当前地点/,
            /當前地點/,
          ]),
          visibleSituation: summarizePage(currentScene, "No visible situation was available.", MAX_SCENE_EXCERPT_CHARS),
          presentCharacters: compactList([
            ...extractRelevantLines(currentScene, /present|character|npc|在场|在場|人物|角色/i),
            ...characterGroups.map(formatGroupEntry),
          ]),
          interactableObjects: compactList([
            ...extractRelevantLines(currentScene, /interact|object|item|clue|可交互|可互动|可互動|物品|线索|線索/i),
            ...itemGroups.map(formatGroupEntry),
          ]),
          currentDangers: compactList([
            ...extractRelevantLines(currentScene, /danger|risk|threat|clock|countdown|危险|危險|风险|風險|倒计时|倒計時/i),
            ...factionGroups.map(formatGroupEntry),
          ]),
          locationActionConditions: compactList([
            ...extractRelevantLines(currentScene, /condition|constraint|route|path|block|条件|限制|路径|路徑|阻碍|阻礙/i),
            ...locationGroups.map(formatGroupEntry),
          ]),
          lastTurnSummary: firstMatchingLine(currentScene, /last\s+turn|previous\s+turn|上一轮|上一輪|上回合/i),
        },
        player: {
          stateSummary: summarizePage(
            findPage(playerPages, "wiki/player/player.md"),
            "No player state summary was available.",
            MAX_SLOT_EXCERPT_CHARS,
          ),
          abilities: pageList(findPage(playerPages, "wiki/player/abilities.md")),
          inventory: pageList(findPage(playerPages, "wiki/player/inventory.md")),
          goals: compactList([...pageList(findPage(playerPages, "wiki/player/goals.md")), ...questPages.map(formatPageEntry)]),
          knownInformation: pageList(knownInformationPage),
          knownInformationPath: "wiki/player/known_information.md",
          conditionNotes: compactList([
            ...extractRelevantLines(findPage(playerPages, "wiki/player/player.md"), /condition|status|injur|wound|状态|狀態|伤|傷/i),
            ...rulePages.flatMap((page) => extractRelevantLines(page, /cost|limit|constraint|cannot|can't|代价|代價|限制|不能/i)),
          ]),
        },
        activeClocks: buildClockSummaries(currentScene, /clock|active\s+clock|倒计时|倒計時|计时|計時/i, "clock"),
        countdowns: buildClockSummaries(currentScene, /countdown|deadline|倒计时|倒計時|期限/i, "countdown"),
        pendingReactions: buildPendingReactions(currentScene, characterGroups, factionGroups),
        pacingState: {
          summary: summarizeLines(
            extractRelevantLines(currentScene, /pacing|pace|节奏|節奏|pressure|压力|壓力/i),
            "No explicit pacing state was available from the action resolver wiki reader.",
          ),
          expectedCampaignDelta: questPages[0] ? formatPageEntry(questPages[0]) : undefined,
        },
        outlineProgress: {
          progressPath: "wiki/outlines/progress.md",
          currentBeat: firstMatchingLine(outlineProgressPage, /current\s+stage|current\s+beat|当前|當前/i) ??
            "No current outline beat was read for action resolution.",
          adjacentBeats: pageList(outlineProgressPage).slice(1, 4),
          branchConditions: extractRelevantLines(outlineProgressPage, /branch|condition|分支|条件|條件/i),
          progressSummary: summarizePage(
            outlineProgressPage,
            "No outline progress summary was read for action resolution.",
            MAX_SLOT_EXCERPT_CHARS,
          ),
        },
        rulesExcerpts,
        references: [...references].filter(isAllowedReference).sort().slice(0, MAX_REFERENCE_COUNT),
      },
      relevantRules: rulesExcerpts,
      fixedSlotRefs,
      recentTurnSummary: firstMatchingLine(currentScene, /last\s+turn|previous\s+turn|上一轮|上一輪|上回合/i),
      runtimeRefs: [],
    },
    warnings,
  }
}

function buildActionResolverQueryText(submittedAction: SubmittedAction, currentScene: RuntimePage): string {
  return [
    submittedAction.text,
    extractLabeledValue(currentScene.content, [/current\s+location/i, /^location$/i, /当前地点/, /當前地點/]),
    ...extractSceneAnchorLines(currentScene),
  ].filter(Boolean).join("\n")
}

function extractSceneAnchorLines(currentScene: RuntimePage): string[] {
  return [
    ...extractRelevantLines(currentScene, /current\s+location|当前地点|當前地點/i),
    ...extractRelevantLines(currentScene, /present|character|npc|在场|在場|人物|角色/i),
    ...extractRelevantLines(currentScene, /interact|object|item|clue|可交互|可互动|可互動|物品|线索|線索/i),
    ...extractRelevantLines(currentScene, /danger|risk|threat|clock|countdown|危险|危險|风险|風險|倒计时|倒計時/i),
    ...extractRelevantLines(currentScene, /condition|constraint|route|path|block|条件|限制|路径|路徑|阻碍|阻礙/i),
    ...extractRelevantLines(currentScene, /pending\s+reaction|reaction|will\s+react|待反应|待反應|反应|反應/i),
  ]
}

function buildRuleExcerpts(pages: RuntimePage[]): ActionResolverRuleExcerpt[] {
  return pages.map((page, index) => ({
    ruleId: `action-rule-${index + 1}`,
    path: page.relativePath,
    excerpt: compactText(formatPageEntry(page), MAX_SLOT_EXCERPT_CHARS),
    usePurpose: "ruleCheck",
  }))
}

function buildFixedSlotRefs(playerPages: RuntimePage[], rulePages: RuntimePage[]): ActionResolverFixedSlotRef[] {
  void playerPages
  void rulePages
  return [
    {
      path: "wiki/current-scene/scene_state.md",
      role: "preActionSceneSnapshot",
      summary: "Current scene, visible situation, present characters, interactable objects, dangers, clocks, and pending reactions.",
      required: true,
    },
    ...PLAYER_SLOT_IDS.map((slotId) => {
      const path = slotPath(slotId)
      return {
        path,
        role: playerSlotRole(path),
        summary: playerSlotSummary(path),
        required: true,
      }
    }),
    ...RULE_SLOT_IDS.map((slotId) => {
      const path = slotPath(slotId)
      return {
        path,
        role: "actionAdjudicationRules",
        summary: "Executable action adjudication rules for success, failure, cost, time, distance, perception, stealth, combat, investigation, and hard constraints.",
        required: true,
      }
    }),
  ]
}

function slotPath(slotId: (typeof PLAYER_SLOT_IDS)[number] | (typeof RULE_SLOT_IDS)[number]): string {
  const paths: Record<string, string> = {
    player_main: "wiki/player/player.md",
    player_abilities: "wiki/player/abilities.md",
    player_inventory: "wiki/player/inventory.md",
    player_goals: "wiki/player/goals.md",
    player_known_information: "wiki/player/known_information.md",
    rules_core: "wiki/rules/core.md",
    rules_world: "wiki/rules/world.md",
    rules_table: "wiki/rules/table.md",
  }
  return paths[slotId]
}

function playerSlotRole(path: string): string {
  if (path.endsWith("known_information.md")) return "playerKnowledgeBoundary"
  if (path.endsWith("abilities.md")) return "playerAbilities"
  if (path.endsWith("inventory.md")) return "playerInventory"
  if (path.endsWith("goals.md")) return "playerGoals"
  return "playerState"
}

function playerSlotSummary(path: string): string {
  if (path.endsWith("known_information.md")) return "PC-known or PC-misunderstood information used to keep adjudication inside player knowledge."
  if (path.endsWith("abilities.md")) return "Player abilities, skills, limits, costs, and current availability."
  if (path.endsWith("inventory.md")) return "Player inventory, equipment state, consumables, clues, and carried objects."
  if (path.endsWith("goals.md")) return "Player goals, commitments, motives, and active objectives."
  return "Player identity, background, stable state, and current condition."
}

function findPage(pages: RuntimePage[], relativePath: string): RuntimePage | undefined {
  return pages.find((page) => page.relativePath === relativePath)
}

function summarizePage(page: RuntimePage | undefined, fallback: string, maxChars: number): string {
  if (!page?.content.trim()) return fallback
  return compactText(formatPageEntry(page), maxChars)
}

function pageList(page: RuntimePage | undefined): string[] {
  if (!page?.content.trim()) return []
  return compactList(
    page.content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line !== "---")
      .map((line) => compactText(`[${page.relativePath}] ${line.replace(/^[-*]\s+/, "")}`, 360)),
  )
}

function extractRelevantLines(page: RuntimePage | undefined, pattern: RegExp): string[] {
  if (!page?.content.trim()) return []
  return compactList(
    page.content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && pattern.test(line))
      .map((line) => compactText(`[${page.relativePath}] ${line.replace(/^[-*]\s+/, "")}`, 360)),
  )
}

function firstMatchingLine(page: RuntimePage | undefined, pattern: RegExp): string | undefined {
  return extractRelevantLines(page, pattern)[0]
}

function extractLabeledValue(content: string, labels: RegExp[]): string | undefined {
  for (const line of content.split("\n")) {
    const trimmed = line.trim().replace(/^[-*]\s+/, "")
    const separatorIndex = trimmed.search(/[:：]/)
    if (separatorIndex < 0) continue
    const label = trimmed.slice(0, separatorIndex).replace(/^#+\s*/, "").trim()
    if (!labels.some((pattern) => pattern.test(label))) continue
    const value = trimmed.slice(separatorIndex + 1).trim()
    if (value) return compactText(value, 180)
  }
  return undefined
}

function buildClockSummaries(page: RuntimePage, pattern: RegExp, kind: "clock" | "countdown"): PreActionClockSummary[] {
  return extractRelevantLines(page, pattern).slice(0, 4).map((summary, index) => ({
    clockId: `wiki-${kind}-${index + 1}`,
    label: `${kind} ${index + 1}`,
    summary,
    urgency: inferUrgency(summary),
    narrativeLine: "playerVisibleLine",
  }))
}

function inferUrgency(text: string): PreActionClockSummary["urgency"] {
  if (/critical|immediate|now|致命|立刻|马上|馬上/i.test(text)) return "critical"
  if (/high|urgent|soon|危险|危險|紧急|緊急/i.test(text)) return "high"
  if (/medium|pressure|risk|风险|風險|压力|壓力/i.test(text)) return "medium"
  return "low"
}

function buildPendingReactions(
  currentScene: RuntimePage,
  characterGroups: RuntimePageGroup[],
  factionGroups: RuntimePageGroup[],
): PreActionPendingReaction[] {
  const sceneReactions = extractRelevantLines(currentScene, /pending\s+reaction|reaction|will\s+react|待反应|待反應|反应|反應/i)
  const groupReactions = [...characterGroups, ...factionGroups]
    .map(formatGroupEntry)
    .filter((entry) => /reaction|trigger|响应|反应|反應|触发|觸發/i.test(entry))

  return compactList([...sceneReactions, ...groupReactions]).map((summary, index) => ({
    reactionId: `wiki-pending-reaction-${index + 1}`,
    actorRef: "wiki:pre-action-reader",
    summary,
    visibilityScope: "pc_visible",
  }))
}

function summarizeLines(lines: string[], fallback: string): string {
  if (lines.length === 0) return fallback
  return compactText(lines.join("\n"), MAX_SLOT_EXCERPT_CHARS)
}

function compactList(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(compactText(normalized, MAX_SLOT_EXCERPT_CHARS))
    if (result.length >= MAX_LIST_ITEMS) break
  }
  return result
}
