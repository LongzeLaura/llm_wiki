import type { ProposedWikiUpdate } from "../../rpg-runtime/state-extractor"
import type { RuntimeProposedWikiUpdate, RuntimeUpdateSourceDelta } from "../../rpg-runtime/types"
import type { RpgKnowledgeActorRef } from "../../rpg-wiki-schema"
import { isConcreteNonPcActorRef } from "../../rpg-runtime/actor-knowledge"

export type RpgRuntimeUpdateValidationSeverity = "warning" | "reject"

export interface RpgRuntimeUpdateValidationIssue {
  severity: RpgRuntimeUpdateValidationSeverity
  code: string
  message: string
  targetPath: string
  updateId: string
}

export interface RejectedRpgRuntimeUpdate {
  update: ProposedWikiUpdate
  issues: RpgRuntimeUpdateValidationIssue[]
}

export interface RpgRuntimeUpdateValidationResult {
  acceptedUpdates: ProposedWikiUpdate[]
  rejectedUpdates: RejectedRpgRuntimeUpdate[]
  issues: RpgRuntimeUpdateValidationIssue[]
  warnings: string[]
}

const FUTURE_CANDIDATE_PATTERN =
  /\b(possible futures?|future plans?|candidate actions?|unchosen options?|unselected options?|next actions?|possible next|foreshadow(?:ing)?|player may|player might|player could|could choose|might choose|may choose|recommended next|option\s*\d+)\b|未选择|候选行动|下一步|后续行动|未来可能|可能发展|伏笔|预示|可选择|玩家可以|玩家可能/iu
const NEGATED_ACTION_STATUS_PATTERN =
  /(?:^|[\n。；;])[^。\n；;]{0,40}(?:尚未|未|没有|并未)[^。\n；;]{0,20}(?:采取|选择|进行|执行|决定|确认)?[^。\n；;]{0,12}(?:下一步(?:行动)?|后续行动)[^。\n；;]{0,20}(?=$|[\n。；;])/giu

const EVENT_FORBIDDEN_HEADING_PATTERN =
  /^#{1,6}\s*(Possible Futures?|Future Plans?|Next Actions?|Candidate Actions?|Foreshadowing|Unchosen Options?|未选择|候选行动|下一步|后续行动|未来可能|可能发展|伏笔|预示)\b/imu

const CURRENT_SCENE_CHARACTER_SYNC_PATTERN =
  /\b(?:injur(?:ed|y)|wounded|bleeding|poisoned|condition changed|status changed|loyalty changed|relocated|moved to|now stationed|stays? at)\b|受伤|负伤|流血|中毒|状态变化|忠诚变化|位置变化|转移/iu
const CURRENT_SCENE_LOCATION_SYNC_PATTERN =
  /\b(?:damaged|broken|locked|blocked|sealed|alerted|alarmed|access changed|opened permanently|closed permanently|flooded)\b|地点损坏|损坏|封锁|锁住|堵塞|警戒|警报|通行变化|永久开启|永久关闭/iu
const CURRENT_SCENE_FACTION_SYNC_PATTERN =
  /\b(?:faction stance|watch stance|guild stance|order stance|clan stance|resources? changed|alert level|became hostile|became allied|became suspicious|patrol alerted)\b|势力态度|阵营态度|资源变化|警戒等级|变为敌对|结盟|巡逻警戒/iu
const CURRENT_SCENE_ITEM_HOLDING_SYNC_PATTERN =
  /\b(?:acquir(?:ed|es?|ing)|picked up|obtained|lost|dropped|equipped|unequipped|consumed|spent|quantity|now carries|inventory)\b|获得|取得|失去|丢下|已装备|装备了|装备中|当前装备|卸下|消耗|数量|背包/iu
const CURRENT_SCENE_ITEM_OBJECT_SYNC_PATTERN =
  /\b(?:item transferred|holder changed|transferred|damaged|broken|sealed|unsealed|enhanced|empowered|depleted|condition changed)\b|物品转移|持有者变化|转移|损坏|破损|封印|解封|强化|耗尽|状态变化/iu
const CURRENT_SCENE_RELATIONSHIP_SYNC_PATTERN =
  /\b(?:relationship|trust|tension|conflict|reconciliation|misunderstanding|secret|betrayal|bond|rivalry)\b|关系|信任|张力|冲突|和解|误会|秘密|背叛|羁绊/iu
const CURRENT_SCENE_PLOT_ARC_SYNC_PATTERN =
  /\b(?:plot arc|arc beat|beat (?:triggered|skipped|delayed|advanced)|pressure escalated|pressure resolved|foreshadowing resolved|reveal (?:progress|state|gate|resolved))\b|剧情弧|剧情线|(?:节点|节拍).{0,16}(?:触发|跳过|延后|提前|推进)|(?:触发|跳过|延后|提前|推进).{0,16}(?:节点|节拍)|压力升级|压力解除|伏笔(?:解决|兑现)|揭示(?:进度|状态|门槛|完成)/iu
const CURRENT_SCENE_OUTLINE_PROGRESS_SYNC_PATTERN =
  /\b(?:outline progress|main plan|advanced into act|deviation from (?:the )?main plan|act\s+\d+|beat (?:advanced|completed|skipped|delayed))\b|(?:大纲|章节|节点|进度|幕).{0,20}(?:偏离|完成|跳过|提前|延后|推进)|(?:偏离|完成|跳过|提前|延后|推进).{0,20}(?:大纲|章节|节点|进度|幕)/iu
const INVENTORY_OBJECT_STATE_SYNC_PATTERN =
  /\b(?:damaged|broken|sealed|unsealed|enhanced|empowered|transferred|holder changed|condition changed|depleted)\b|损坏|破损|封印|解封|强化|转移|持有者变化|状态变化|耗尽/iu
const ITEM_RUNTIME_INVENTORY_SYNC_PATTERN =
  /\b(?:player|pc|iven|inventory|acquir(?:ed|es?|ing)|obtained|lost|dropped|equipped|unequipped|consumed|spent|quantity|now carries)\b|玩家|PC|背包|获得|取得|失去|丢下|装备|卸下|消耗|数量|持有/iu

const CURRENT_SCENE_FORBIDDEN_HEADING_PATTERN =
  /^#{1,6}\s*(World Overview|Lore|Static Setting|Character Profile|Full Character Sheet|Biography|Timeline|Complete Timeline|Event Log|History|Route Recap|Abilities and Limits|世界观|长期设定|静态设定|完整角色卡|角色卡|人物传记|完整时间线|事件流水|历史事件|路线回顾|能力设定)\b/imu

const RELATIONSHIP_FORBIDDEN_HEADING_PATTERN =
  /^#{1,6}\s*(Biography|Character Profile|Full Character Sheet|Background|Appearance|Abilities|Static Setting|人物简介|完整人物简介|角色卡|人物传记|背景经历|外貌|能力设定|静态设定)\b/imu

const STABLE_PAGE_POLLUTION_PATTERN =
  /^#{1,6}\s*(World Overview|Static Setting|Character Profile|Full Character Sheet|Biography|Complete Timeline|Lore|世界观|静态设定|完整角色卡|角色卡|人物传记|完整时间线|设定页)\b|出生于|身高|体重|生日|声优|外貌特征|background biography|full profile/imu

const CONFIRMED_FACTS_HEADING_PATTERN = /^#{1,6}\s*(Confirmed Facts|已确认事实|已发生事实|已发生关键节点)\b/imu
const ANY_HEADING_PATTERN = /^#{1,6}\s+/gmu

export function validateRpgRuntimeUpdateProposals(
  updates: ProposedWikiUpdate[],
): RpgRuntimeUpdateValidationResult {
  const acceptedUpdates: ProposedWikiUpdate[] = []
  const rejectedUpdates: RejectedRpgRuntimeUpdate[] = []
  const issues: RpgRuntimeUpdateValidationIssue[] = []

  for (const update of updates) {
    const updateIssues = validateUpdate(update)
    issues.push(...updateIssues)

    const rejectIssues = updateIssues.filter((issue) => issue.severity === "reject")
    if (rejectIssues.length > 0) {
      rejectedUpdates.push({ update, issues: rejectIssues })
      continue
    }

    acceptedUpdates.push(update)
  }

  issues.push(...validateCrossDirectorySync(acceptedUpdates))

  return {
    acceptedUpdates,
    rejectedUpdates,
    issues,
    warnings: issues.map(formatIssueWarning),
  }
}

function validateUpdate(update: ProposedWikiUpdate): RpgRuntimeUpdateValidationIssue[] {
  const path = normalizeWikiPath(update.targetPath)
  const text = `${update.reason}\n${update.content}`
  const issues: RpgRuntimeUpdateValidationIssue[] = []
  issues.push(...validateActorKnowledgeBoundary(update))

  if (isEventsPath(path)) {
    pushIf(issues, update, "reject", "events_future_candidate_pollution", hasFutureCandidatePollution(text), [
      "events updates may only record confirmed happened events; future plans, candidate actions, unchosen options, next actions, and foreshadowing belong outside events.",
    ])
    pushIf(issues, update, "reject", "events_forbidden_future_heading", EVENT_FORBIDDEN_HEADING_PATTERN.test(update.content), [
      "events content contains a future/candidate/foreshadowing heading and must not enter the pending queue.",
    ])
  } else if (isCurrentScenePath(path)) {
    pushIf(issues, update, "reject", "current_scene_long_term_material", CURRENT_SCENE_FORBIDDEN_HEADING_PATTERN.test(update.content), [
      "current-scene must stay an immediate snapshot, not long-term lore, full character cards, event logs, timelines, or route recaps.",
    ])
    pushIf(issues, update, "reject", "current_scene_snapshot_too_long", isOverlongCurrentSceneSnapshot(update.content), [
      "current-scene snapshot is too long for a latest-scene overwrite and should be compressed before review.",
    ])
    pushIf(issues, update, "reject", "current_scene_event_log_shape", looksLikeEventLog(update.content), [
      "current-scene looks like accumulated event history instead of the current moment.",
    ])
  } else if (isPlotArcsPath(path)) {
    pushIf(
      issues,
      update,
      "reject",
      "plot_arc_future_in_confirmed_facts",
      confirmedFactsSectionContainsFutureCandidate(update.content),
      [
        "plot-arcs may track possible futures and unresolved pressure, but possible/future material cannot be written inside confirmed-happened facts.",
      ],
    )
    pushIf(issues, update, "reject", "plot_arc_unchosen_option_as_fact", unchosenOptionAsHappenedFact(text), [
      "plot-arcs must not turn an unchosen option or candidate action into a confirmed happened fact.",
    ])
  } else if (isRelationshipsPath(path)) {
    pushIf(issues, update, "reject", "relationship_full_profile_pollution", RELATIONSHIP_FORBIDDEN_HEADING_PATTERN.test(update.content), [
      "relationships updates should preserve relationship changes and tension, not repeat full character profiles, biographies, appearance, or ability sheets.",
    ])
    pushIf(issues, update, "reject", "relationship_biography_too_long", looksLikeLongBiography(update.content), [
      "relationships update is dominated by biography/profile material instead of relationship state.",
    ])
  } else if (isPlayerQuestsOrRuntimeOverlayPath(path)) {
    pushIf(issues, update, "reject", "runtime_candidate_action_pollution", hasFutureCandidatePollution(text), [
      "runtime state updates must not store candidate actions, next actions, or unchosen options as accepted state.",
    ])
    pushIf(issues, update, "warning", "runtime_stable_page_pollution", STABLE_PAGE_POLLUTION_PATTERN.test(update.content), [
      "runtime state update looks like stable setting/profile material; keep only accepted runtime state, consequences, objective progress, or overlay changes.",
    ])
  }

  return issues
}

function validateActorKnowledgeBoundary(update: ProposedWikiUpdate): RpgRuntimeUpdateValidationIssue[] {
  const issues: RpgRuntimeUpdateValidationIssue[] = []
  const path = normalizeWikiPath(update.targetPath)
  const runtimeUpdate = update as Partial<RuntimeProposedWikiUpdate>
  const sourceDeltas = runtimeUpdate.sourceDeltas
  if (!Array.isArray(sourceDeltas) || sourceDeltas.length === 0) {
    pushIf(issues, update, "reject", "actor_metadata_missing", true, [
      "runtime update proposals require structured sourceDeltas with actor-level knowledgeClaims before pending staging.",
    ])
    return issues
  }
  if (sourceDeltas.some((delta) => !Array.isArray(delta.knowledgeClaims) || delta.knowledgeClaims.length === 0)) {
    pushIf(issues, update, "reject", "knowledge_claims_missing", true, [
      "every sourceDelta must carry at least one actor-level knowledge claim.",
    ])
  }

  if (path === "wiki/player/known_information.md") {
    pushIf(
      issues,
      update,
      "reject",
      "player_knowledge_claim_boundary",
      !sourceDeltas.every(sourceDeltaHasPcKnowledgeClaim) || sourceDeltas.some(sourceDeltaHasForbiddenPlayerClaim),
      [
        "player known information requires pc holder claims with known, inferred, or misunderstood belief state and no NPC/user/GM-only holder claims.",
      ],
    )
  }

  const characterActor = actorRefFromRuntimePath(path, "characters")
  if (characterActor) {
    pushIf(
      issues,
      update,
      "reject",
      "character_runtime_actor_mismatch",
      sourceDeltas.some(
        (delta) => sourceDeltaAssertsConcreteActorKnowledge(delta) && !sourceDeltaMentionsActor(delta, characterActor),
      ),
      [`characters/runtime knowledge claims must mention the matching actor holder ${characterActor}.`],
    )
  }

  if (isRelationshipsPath(path) && looksLikeInformationGapUpdate(update, sourceDeltas)) {
    pushIf(
      issues,
      update,
      "reject",
      "relationship_information_gap_claim_missing",
      !sourceDeltas.some(sourceDeltaHasInformationGapClaim),
      ["relationships/runtime information-gap updates require holder/non-holder or differing belief-state claims."],
    )
  }

  if (isRevealProgressTarget(path) && looksLikeRevealProgressUpdate(update, sourceDeltas)) {
    pushIf(
      issues,
      update,
      "reject",
      "reveal_progress_metadata_missing",
      !sourceDeltas.some((delta) => (delta.revealGateRefs?.length ?? 0) > 0 && !!delta.revealState),
      ["plot-arc or outline reveal-progress updates require revealGateRefs and revealState metadata."],
    )
  }

  return issues
}

function validateCrossDirectorySync(updates: ProposedWikiUpdate[]): RpgRuntimeUpdateValidationIssue[] {
  const issues: RpgRuntimeUpdateValidationIssue[] = []
  const hasCharacterRuntime = updates.some((update) => isCharactersRuntimePath(normalizeWikiPath(update.targetPath)))
  const hasLocationRuntime = updates.some((update) => isLocationsRuntimePath(normalizeWikiPath(update.targetPath)))
  const hasFactionRuntime = updates.some((update) => isFactionsRuntimePath(normalizeWikiPath(update.targetPath)))
  const hasItemRuntime = updates.some((update) => isItemsRuntimePath(normalizeWikiPath(update.targetPath)))
  const hasRelationshipRuntime = updates.some((update) => isRelationshipsPath(normalizeWikiPath(update.targetPath)))
  const hasPlotArcRuntime = updates.some((update) => isPlotArcsPath(normalizeWikiPath(update.targetPath)))
  const hasOutlineProgress = updates.some((update) => isOutlineProgressPath(normalizeWikiPath(update.targetPath)))
  const hasInventory = updates.some((update) => isPlayerInventoryPath(normalizeWikiPath(update.targetPath)))

  for (const update of updates) {
    const path = normalizeWikiPath(update.targetPath)
    const text = `${update.reason}\n${update.content}`

    if (isCurrentScenePath(path)) {
      pushIf(issues, update, "warning", "current_scene_missing_character_runtime_sync", !hasCharacterRuntime && CURRENT_SCENE_CHARACTER_SYNC_PATTERN.test(text), [
        "current-scene mentions persistent NPC/character state, but this proposal batch does not include a characters/runtime/*.md overlay update.",
      ])
      pushIf(issues, update, "warning", "current_scene_missing_location_runtime_sync", !hasLocationRuntime && CURRENT_SCENE_LOCATION_SYNC_PATTERN.test(text), [
        "current-scene mentions persistent location state, but this proposal batch does not include a locations/runtime/*.md overlay update.",
      ])
      pushIf(issues, update, "warning", "current_scene_missing_faction_runtime_sync", !hasFactionRuntime && CURRENT_SCENE_FACTION_SYNC_PATTERN.test(text), [
        "current-scene mentions persistent faction state, but this proposal batch does not include a factions/runtime/*.md overlay update.",
      ])
      pushIf(
        issues,
        update,
        "warning",
        "current_scene_missing_item_runtime_sync",
        (!hasInventory && CURRENT_SCENE_ITEM_HOLDING_SYNC_PATTERN.test(text)) ||
          (!hasItemRuntime && CURRENT_SCENE_ITEM_OBJECT_SYNC_PATTERN.test(text)),
        [
          "current-scene mentions persistent player holding or object-level item state, but this proposal batch is missing the matching player/inventory.md or items/runtime/*.md update.",
        ],
      )
      pushIf(issues, update, "warning", "current_scene_missing_relationship_runtime_sync", !hasRelationshipRuntime && CURRENT_SCENE_RELATIONSHIP_SYNC_PATTERN.test(text), [
        "current-scene mentions relationship state changes, but this proposal batch does not include a relationships/runtime/*.md overlay update.",
      ])
      pushIf(issues, update, "warning", "current_scene_missing_plot_arc_runtime_sync", !hasPlotArcRuntime && CURRENT_SCENE_PLOT_ARC_SYNC_PATTERN.test(text), [
        "current-scene mentions plot-arc runtime progress, but this proposal batch does not include a plot-arcs/runtime/*.md overlay update.",
      ])
      pushIf(issues, update, "warning", "current_scene_missing_outline_progress_sync", !hasOutlineProgress && CURRENT_SCENE_OUTLINE_PROGRESS_SYNC_PATTERN.test(text), [
        "current-scene mentions outline-relative progress, but this proposal batch does not include wiki/outlines/progress.md.",
      ])
    }

    if (isPlayerInventoryPath(path)) {
      pushIf(issues, update, "warning", "inventory_missing_item_runtime_sync", !hasItemRuntime && INVENTORY_OBJECT_STATE_SYNC_PATTERN.test(text), [
        "player/inventory.md records object-level item state, but this proposal batch does not include an items/runtime/*.md update.",
      ])
    }

    if (isItemsRuntimePath(path)) {
      pushIf(issues, update, "warning", "item_runtime_missing_inventory_sync", !hasInventory && ITEM_RUNTIME_INVENTORY_SYNC_PATTERN.test(text), [
        "items/runtime/*.md records player holding, quantity, equipment, loss, or consumption state, but this proposal batch does not include wiki/player/inventory.md.",
      ])
    }
  }

  return dedupeIssues(issues)
}

function sourceDeltaHasPcKnowledgeClaim(delta: RuntimeUpdateSourceDelta): boolean {
  return delta.knowledgeClaims.some((claim) =>
    claim.holders.includes("pc") &&
    claim.beliefStateByActor.some((belief) =>
      belief.actor === "pc" && ["known", "inferred", "misunderstood"].includes(belief.beliefState)
    )
  )
}

function sourceDeltaHasForbiddenPlayerClaim(delta: RuntimeUpdateSourceDelta): boolean {
  return delta.knowledgeClaims.some((claim) => {
    const pcBelief = claim.beliefStateByActor.find((belief) => belief.actor === "pc")
    if (pcBelief && !["known", "inferred", "misunderstood"].includes(pcBelief.beliefState)) return true
    if (claim.holders.length > 0 && !claim.holders.includes("pc")) return true
    return claim.nonHolders.includes("pc")
  })
}

function sourceDeltaAssertsConcreteActorKnowledge(delta: RuntimeUpdateSourceDelta): boolean {
  if (delta.knowledgeScope === "npc_known") return true
  return delta.knowledgeClaims.some((claim) =>
    claim.holders.some(isConcreteNonPcActorRef) ||
    claim.beliefStateByActor.some((belief) => isConcreteNonPcActorRef(belief.actor))
  )
}

function sourceDeltaMentionsActor(delta: RuntimeUpdateSourceDelta, actor: RpgKnowledgeActorRef): boolean {
  return delta.knowledgeClaims.some((claim) =>
    claim.holders.includes(actor) ||
    claim.nonHolders.includes(actor) ||
    claim.beliefStateByActor.some((belief) => belief.actor === actor)
  )
}

function sourceDeltaHasInformationGapClaim(delta: RuntimeUpdateSourceDelta): boolean {
  return delta.knowledgeClaims.some((claim) => {
    if (claim.holders.length > 0 && claim.nonHolders.length > 0) return true
    const states = new Set(claim.beliefStateByActor.map((belief) => belief.beliefState))
    return claim.beliefStateByActor.length >= 2 && states.size >= 2
  })
}

function actorRefFromRuntimePath(
  path: string,
  category: "characters" | "factions",
): RpgKnowledgeActorRef | undefined {
  const match = new RegExp(`^wiki/${category}/runtime/([^/]+)\\.md$`, "u").exec(path)
  if (!match) return undefined
  return category === "characters" ? `npc:${match[1]}` : `faction:${match[1]}`
}

function isRevealProgressTarget(path: string): boolean {
  return path === "wiki/outlines/progress.md" || isPlotArcsPath(path)
}

function looksLikeInformationGapUpdate(
  update: ProposedWikiUpdate,
  sourceDeltas: readonly RuntimeUpdateSourceDelta[],
): boolean {
  const text = [
    update.reason,
    update.content,
    ...sourceDeltas.map((delta) => delta.summary),
  ].join("\n")
  return /information gap|secret|misunderstanding|misread|knows?|unknown to|belief|信息差|秘密|误解|知道|未知|隐瞒|判断/iu.test(text)
}

function looksLikeRevealProgressUpdate(
  update: ProposedWikiUpdate,
  sourceDeltas: readonly RuntimeUpdateSourceDelta[],
): boolean {
  const text = [
    update.reason,
    update.content,
    ...sourceDeltas.map((delta) => `${delta.summary}\n${delta.revealGateRefs?.join("\n") ?? ""}\n${delta.revealState ?? ""}`),
  ].join("\n")
  return /reveal progress|reveal gate|currentRevealState|revealState|active reveal|gate\.|information boundary|揭示进度|揭示门槛|当前揭示|信息边界/iu.test(text)
}

function pushIf(
  issues: RpgRuntimeUpdateValidationIssue[],
  update: ProposedWikiUpdate,
  severity: RpgRuntimeUpdateValidationSeverity,
  code: string,
  condition: boolean,
  message: [string],
): void {
  if (!condition) return
  issues.push({
    severity,
    code,
    message: message[0],
    targetPath: update.targetPath,
    updateId: update.id,
  })
}

function hasFutureCandidatePollution(text: string): boolean {
  return FUTURE_CANDIDATE_PATTERN.test(stripNegatedActionStatus(text))
}

function stripNegatedActionStatus(text: string): string {
  return text.replace(NEGATED_ACTION_STATUS_PATTERN, "\n")
}

function confirmedFactsSectionContainsFutureCandidate(content: string): boolean {
  const section = extractHeadingSection(content, CONFIRMED_FACTS_HEADING_PATTERN)
  return !!section && hasFutureCandidatePollution(section)
}

function unchosenOptionAsHappenedFact(text: string): boolean {
  return /(?:unchosen|unselected|未选择|候选).{0,80}(?:happened|occurred|confirmed|已发生|成为事实)/iu.test(text)
}

function isOverlongCurrentSceneSnapshot(content: string): boolean {
  const trimmed = content.trim()
  const headingCount = [...trimmed.matchAll(ANY_HEADING_PATTERN)].length
  const lineCount = trimmed.split(/\r?\n/).filter((line) => line.trim()).length
  if (lineCount >= 45) return true
  if (trimmed.length <= 2200) return false
  return headingCount >= 6 || lineCount >= 45 || trimmed.length > 3200
}

function looksLikeEventLog(content: string): boolean {
  const eventLikeLines = content
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*]\s*(Turn|Session|Event|Day|第.+轮|第.+日|事件|回合)\b/iu.test(line)).length
  return eventLikeLines >= 4
}

function looksLikeLongBiography(content: string): boolean {
  if (content.trim().length < 1400) return false
  const biographySignals = [
    /biography|background|appearance|abilities|character profile|full character sheet/iu,
    /人物传记|背景经历|外貌|能力设定|完整人物简介|角色卡/iu,
  ]
  return biographySignals.some((pattern) => pattern.test(content))
}

function extractHeadingSection(content: string, headingPattern: RegExp): string | undefined {
  const match = headingPattern.exec(content)
  if (!match) return undefined

  const start = match.index
  const afterHeading = content.slice(start + match[0].length)
  const nextHeading = afterHeading.search(/\n#{1,6}\s+/)
  return nextHeading < 0 ? content.slice(start) : content.slice(start, start + match[0].length + nextHeading)
}

function formatIssueWarning(issue: RpgRuntimeUpdateValidationIssue): string {
  const prefix = issue.severity === "reject" ? "Rejected" : "Warning for"
  return `${prefix} RPG runtime update ${issue.updateId} (${issue.targetPath}): ${issue.code}: ${issue.message}`
}

function normalizeWikiPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").toLowerCase()
}

function isCurrentScenePath(path: string): boolean {
  return path === "wiki/current-scene/scene_state.md"
}

function isEventsPath(path: string): boolean {
  return /^wiki\/events\/[^/]+\.md$/.test(path)
}

function isPlotArcsPath(path: string): boolean {
  return /^wiki\/plot-arcs\/runtime\/[^/]+\.md$/.test(path)
}

function isRelationshipsPath(path: string): boolean {
  return /^wiki\/relationships\/runtime\/[^/]+\.md$/.test(path)
}

function isPlayerQuestsOrRuntimeOverlayPath(path: string): boolean {
  return (
    isFixedPlayerRuntimePath(path) ||
    /^wiki\/quests\/[^/]+\.md$/.test(path) ||
    isOutlineProgressPath(path) ||
    /^wiki\/(?:characters|locations|factions|items|relationships|plot-arcs)\/runtime\/[^/]+\.md$/.test(path)
  )
}

function isFixedPlayerRuntimePath(path: string): boolean {
  return /^wiki\/player\/(?:player|abilities|inventory|goals|known_information)\.md$/.test(path)
}

function isPlayerInventoryPath(path: string): boolean {
  return path === "wiki/player/inventory.md"
}

function isOutlineProgressPath(path: string): boolean {
  return path === "wiki/outlines/progress.md"
}

function isCharactersRuntimePath(path: string): boolean {
  return /^wiki\/characters\/runtime\/[^/]+\.md$/.test(path)
}

function isLocationsRuntimePath(path: string): boolean {
  return /^wiki\/locations\/runtime\/[^/]+\.md$/.test(path)
}

function isFactionsRuntimePath(path: string): boolean {
  return /^wiki\/factions\/runtime\/[^/]+\.md$/.test(path)
}

function isItemsRuntimePath(path: string): boolean {
  return /^wiki\/items\/runtime\/[^/]+\.md$/.test(path)
}

function dedupeIssues(issues: RpgRuntimeUpdateValidationIssue[]): RpgRuntimeUpdateValidationIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.updateId}\n${issue.targetPath}\n${issue.code}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
