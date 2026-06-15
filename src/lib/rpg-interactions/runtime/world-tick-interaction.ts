import type {
  WorldTickInput,
  WorldTickResult,
  WorldTickVisibilityMeta,
} from "../../rpg-runtime/types"
import type {
  RpgGapImpactCandidate,
  RpgHappenedStatus,
  RpgKnowledgeScope,
  RpgKnowledgeSourceKind,
  RpgNarrativeLine,
  RpgRuntimeDeltaRef,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import {
  buildRpgInteractionPromptFromSections,
  createJsonRpgPromptDebugSection,
  createRpgPromptDebugSection,
} from "../prompt-debug"
import {
  formatSoftDraftLooseCoercionStructuredWarning,
  readArrayLoose,
  readStringArrayLoose,
  type SoftDraftLooseCoercion,
} from "./soft-draft-protocol"
import {
  parseSoftSemanticJsonOutput,
  type SoftSemanticJsonParseReport,
} from "./soft-semantic-json"
import { validateWorldTickResult } from "./world-tick-validation"

export type RpgWorldTickPrompt = RpgInteractionPrompt

export const WORLD_TICK_DRAFT_SCHEMA_PROMPT_LINES = [
  "只返回严格 JSON 对象，禁止 markdown 解释、undefined、null、wiki write、玩家叙事、nextActionOptions、Recall Selector 或 outline revision 字段。",
  "输出是 WorldTickDraft，不是内部 canonical WorldTickResult；本地 compiler 会补 ID、空数组、完整 visibility、runtimeDeltaRefs、timeDeltaBasis、pacingUpdate 和 gapState 默认字段。",
  "不要输出 tickId、runtimeDeltaRefs、sourcePath、sourceStage、完整 visibility、timeDeltaBasis、reference envelope、warning envelope 或其他内部追踪 envelope；这些属于本地 compiler 生成的工程字段。",
  "必须保留语义字段：真实发生了什么、影响哪些路径、PC 是否可知、是否产生反应/广播/时钟变化。没有内容的集合可以省略。",
  "可见性用 visibilityPreset，除非确实需要完整 visibility：\"pc_visible\" | \"pc_inferred\" | \"user_visible_pc_unknown\" | \"npc_known\" | \"gm_only\" | \"hidden\"。",
  "枚举只能使用这些字面量：narrativeLine = \"playerVisibleLine\" | \"parallelLine\" | \"tensionLine\"；happenedStatus = \"attempted_not_confirmed\" | \"confirmed_happened\" | \"ongoing\" | \"blocked\" | \"failed\" | \"possible_future\" | \"intention_only\" | \"misunderstanding\"。",
  "WorldTickDraft 结构：",
  "{",
  "  \"timeAdvance\"?: { \"appliedSummary\"?: string, \"clockReasoning\"?: string },",
  "  \"worldDeltas\"?: { \"playerVisibleLine\"?: DraftWorldDelta[], \"parallelLine\"?: DraftWorldDelta[], \"tensionLine\"?: DraftWorldDelta[] },",
  "  \"clockUpdates\"?: DraftClockUpdate[],",
  "  \"settledOngoingEvents\"?: DraftSettledOngoingEvent[],",
  "  \"informationBroadcast\"?: DraftInformationBroadcast[],",
  "  \"reactionQueue\"?: DraftReaction[],",
  "  \"pacingUpdate\"?: DraftPacingUpdate,",
  "  \"gapState\"?: DraftGapState,",
  "  \"referencePaths\"?: string[],",
  "  \"warnings\"?: string[]",
  "}",
  "DraftWorldDelta: { \"summary\": string, \"visibilityPreset\"?: visibilityPreset, \"happenedStatus\"?: happenedStatus, \"affectedPaths\"?: string[], \"deltaId\"?: string, \"narrativeLine\"?: narrativeLine }。",
  "DraftClockUpdate: { \"clockId\"?: string, \"clockName\"?: string, \"summary\"?: string, \"change\"?: \"started\" | \"advanced\" | \"paused\" | \"resolved\" | \"failed\" | \"blocked\" | \"no_change\", \"reason\"?: string, \"visibilityPreset\"?: visibilityPreset, \"affectedPaths\"?: string[] }。",
  "DraftSettledOngoingEvent: { \"eventId\"?: string, \"eventRef\"?: string, \"summary\": string, \"settlementKind\"?: \"advanced\" | \"paused\" | \"triggered\" | \"interrupted\" | \"blocked\" | \"failed\" | \"resolved\" | \"no_change\", \"cause\"?: string, \"participantRefs\"?: string[], \"clockUpdateIds\"?: string[], \"narrativeLine\"?: narrativeLine, \"visibilityPreset\"?: visibilityPreset, \"happenedStatus\"?: happenedStatus, \"affectedPaths\"?: string[] }。",
  "DraftInformationBroadcast: { \"broadcastId\"?: string, \"summary\": string, \"sourceRef\"?: string, \"recipientRefs\"?: string[], \"channel\"?: string, \"visibilityPreset\"?: visibilityPreset, \"happenedStatus\"?: happenedStatus, \"affectedPaths\"?: string[] }。",
  "DraftReaction: { \"reactionId\"?: string, \"source\"?: string, \"targetRef\"?: string, \"summary\": string, \"reactionTiming\"?: \"immediate\" | \"delayed\" | \"queued\" | \"conditional\", \"priority\"?: \"low\" | \"medium\" | \"high\" | \"critical\", \"visibilityPreset\"?: visibilityPreset, \"happenedStatus\"?: happenedStatus, \"affectedPaths\"?: string[] }。",
  "DraftPacingUpdate: { \"summary\"?: string, \"pacingDebt\"?: \"none\" | \"low\" | \"medium\" | \"high\", \"pressureNotes\"?: string[], \"campaignDelta\"?: \"none\" | \"minor\" | \"meaningful\" | \"scene_changing\", \"compensationNeeded\"?: boolean }。",
  "DraftGapState: { \"mode\"?: \"none\" | \"compress\" | \"branch\" | \"major\", \"impactCandidate\"?: \"none\" | \"minor\" | \"branch\" | \"major\", \"summary\"?: string, \"affectedBeatRefs\"?: string[] }。",
  "所有 delta-like 条目统一使用字段名 summary；不要写 settlementSummary、broadcastSummary、reactionSummary、description 或 text 来代替 summary。",
  "Draft delta 通用字段：deltaId/id 可选；summary 必填；narrativeLine、visibilityPreset、happenedStatus、affectedPaths 可省略并由 compiler 补齐。",
  "如果输出 clock/reaction/broadcast/settlement，写上述业务字段即可；timeDeltaBasis、sourcePlayerDeltaIds、visibility、runtimeDeltaRefs 不要输出。",
] as const

export const worldTickInteractionSpec: RpgInteractionSpec<WorldTickInput, WorldTickResult> = {
  kind: "world_tick",
  buildPrompt(input) {
    const systemSections = [
      createRpgPromptDebugSection({
        sectionId: "world-tick-system-fixed-prompt",
        title: "系统固定提示词",
        promptRole: "system",
        sourceKind: "fixed_prompt",
        sourceLabel: "world_tick.systemPrompt",
        contentType: "text",
        content: [
        "你是 llmWikiRPG 的 World Tick + Reaction 交互。",
        "Action Resolver 负责仅限玩家行动本身的裁定。",
        "必须把 ActionResolution.playerActionDelta 当作规范的、仅由玩家行动产生的 delta。",
        "World Tick 必须原样消费 playerActionDelta。",
        "不要重新解释或重新裁定玩家行动。",
        "不要从 directResults 反推规范的玩家事实。",
        "只推进已经裁定出的 timeDelta 时间区间。",
        "在该时间区间内推进世界时钟、进行中的事件、信息传播、NPC 反应、节奏压力和初步 gap signals。",
        "必须把每个 world delta 按本轮 runtime/narration lens target 分类到 playerVisibleLine、parallelLine 或 tensionLine；这是协议字段，不是大纲轴。",
        "不要为了让三条线平等推进而补造 delta；开局或低信息回合允许 playerVisibleLine 很窄，parallelLine / tensionLine 数组为空或只保留审计/压力信号。",
        "parallel line 的展示不等于 PC 已知；除非明确广播给 PC，用户可见的平行线信息必须与 wiki/player/known_information.md 保持分离。",
        "每个有意义变化至少写 summary，并在能确定时写 affectedPaths、visibilityPreset、happenedStatus；重复协议字段由本地 compiler 补齐。",
        "no wiki write",
        "no player-facing narration",
        "no nextActionOptions",
        "no Recall Selector output",
        "no Outline revision",
        "不要输出 proposedUpdates、pendingUpdates、wikiWrites、wikiWriteProposal、targetPath、strategy、narration、playerFacingText、parallelLineText、nextActionOptions、recallSelection、selectedItems、retrievalIndex、recalledMaterials、outlineRevision、outlineRevisionProposal、provisionalOutlinePatch 或 regenerationRequest。",
        "World Tick 不写 wiki、不运行 Recall Selector、不修订 outlines，也不生成玩家可见的叙事正文。",
        "仅返回严格的 WorldTickDraft JSON。",
        "",
        ...WORLD_TICK_DRAFT_SCHEMA_PROMPT_LINES,
        ],
      }),
    ]
    const userSections = [
      createRpgPromptDebugSection({
        sectionId: "world-tick-input-boundary",
        title: "输入边界",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "world_tick.userPrompt.boundary",
        contentType: "markdown",
        content: [
          "# World Tick 输入",
          "",
          "仅使用下方的结构化输入。不要读取 wiki 文件，也不要假设外部状态。",
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-submitted-action",
        title: "已提交行动",
        promptRole: "user",
        sourceKind: "player_input",
        sourceLabel: "submittedAction",
        value: input.submittedAction,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-action-brief",
        title: "行动裁定摘要",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "WorldTickActionBrief",
        value: buildWorldTickActionBrief(input),
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-pre-action-runtime-references",
        title: "行动前 Runtime 引用",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "preActionRefs",
        value: input.preActionRefs,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-post-action-runtime-references",
        title: "行动后 Runtime 引用",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "postActionRefs",
        value: input.postActionRefs,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-active-clocks",
        title: "活动时钟",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "activeClocks",
        value: input.activeClocks,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-ongoing-events",
        title: "进行中的事件",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "ongoingEvents",
        value: input.ongoingEvents,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-pacing-state",
        title: "节奏状态",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "pacingState",
        value: input.pacingState,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-gap-signals",
        title: "Gap 信号",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "gapSignals",
        value: input.gapSignals,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-visibility-policy",
        title: "可见性策略",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "visibilityPolicy",
        value: input.visibilityPolicy,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "world-tick-runtime-delta-refs",
        title: "Runtime Delta 引用",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "runtimeRefs",
        value: input.runtimeRefs,
      }),
      createRpgPromptDebugSection({
        sectionId: "world-tick-return-contract",
        title: "返回契约",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "仅返回 WorldTickDraft JSON",
        contentType: "text",
        content: "仅返回 WorldTickDraft JSON。",
      }),
    ]

    return buildRpgInteractionPromptFromSections({ systemSections, userSections })
  },
  parseOutput(output, input) {
    return parseRpgWorldTickOutput(output, input)
  },
}

export function buildWorldTickPrompt(input: WorldTickInput): RpgWorldTickPrompt {
  return worldTickInteractionSpec.buildPrompt(input)
}

export function buildWorldTickActionBrief(input: WorldTickInput): {
  submittedAction: WorldTickInput["submittedAction"]
  actionOutcome: {
    summary: string
    status: string
    confirmationBasis?: string
    riskSummary: string
    affectedRefs: string[]
  }
  playerActionDelta: WorldTickInput["playerActionDelta"]
  timeDelta: WorldTickInput["timeDelta"]
  directResults: Array<{ summary: string; happenedStatus: string; visibilityScope: string; affectedRefs: string[] }>
  referencePaths: string[]
} {
  return {
    submittedAction: input.submittedAction,
    actionOutcome: {
      summary: input.actionResolution.eventDraft.summary,
      status: input.actionResolution.eventDraft.status,
      confirmationBasis: input.actionResolution.eventDraft.confirmationBasis,
      riskSummary: input.actionResolution.eventDraft.riskSummary,
      affectedRefs: input.actionResolution.eventDraft.affectedRefs,
    },
    playerActionDelta: input.playerActionDelta,
    timeDelta: input.timeDelta,
    directResults: input.actionResolution.directResults.map((result) => ({
      summary: result.summary,
      happenedStatus: result.happenedStatus,
      visibilityScope: result.visibilityScope,
      affectedRefs: result.affectedRefs,
    })),
    referencePaths: input.actionResolution.references.map((reference) => reference.path),
  }
}

export interface ParseRpgWorldTickOutputOptions {
  onJsonParseReport?: (report: SoftSemanticJsonParseReport) => void
}

export function parseRpgWorldTickOutput(
  output: string,
  input?: WorldTickInput,
  options: ParseRpgWorldTickOutputOptions = {},
): WorldTickResult {
  let parsed: unknown
  try {
    const result = parseSoftSemanticJsonOutput(output, { label: "RPG World Tick" })
    parsed = result.parsed as WorldTickResult
    options.onJsonParseReport?.(result.report)
  } catch (error) {
    const report = error instanceof Error && "report" in error
      ? (error as { report?: SoftSemanticJsonParseReport }).report
      : undefined
    if (report) options.onJsonParseReport?.(report)
    throw error
  }

  if (input) {
    try {
      return compileWorldTickDraftOutput(parsed, input)
    } catch (draftError) {
      const draftMessage = draftError instanceof Error ? draftError.message : String(draftError)
      throw new Error(`RPG World Tick 交互收到无效的 WorldTickDraft：draft 编译失败：${draftMessage}`)
    }
  }

  try {
    return validateWorldTickResult(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG World Tick 交互收到无效的 WorldTickResult：${message}`)
  }
}

type JsonRecord = Record<string, unknown>
type VisibilityPreset =
  | "pc_visible"
  | "pc_inferred"
  | "user_visible_pc_unknown"
  | "npc_known"
  | "gm_only"
  | "hidden"

const ALLOWED_NARRATIVE_LINES = new Set<RpgNarrativeLine>(["playerVisibleLine", "parallelLine", "tensionLine"])
const ALLOWED_HAPPENED_STATUSES = new Set<RpgHappenedStatus>([
  "attempted_not_confirmed",
  "confirmed_happened",
  "ongoing",
  "blocked",
  "failed",
  "possible_future",
  "intention_only",
  "misunderstanding",
])
const ALLOWED_VISIBILITY_PRESETS = new Set<VisibilityPreset>([
  "pc_visible",
  "pc_inferred",
  "user_visible_pc_unknown",
  "npc_known",
  "gm_only",
  "hidden",
])
const ALLOWED_CLOCK_KINDS = new Set<WorldTickResult["clockUpdates"][number]["clockKind"]>([
  "worldClock",
  "countdown",
  "pacingDebt",
  "relationshipPressure",
  "investigationClock",
  "combatClock",
  "dangerClock",
  "ongoingEventClock",
])
const ALLOWED_CLOCK_UPDATE_KINDS = new Set<WorldTickResult["clockUpdates"][number]["updateKind"]>([
  "advance",
  "decrease",
  "pause",
  "resume",
  "trigger",
  "interrupt",
  "resolve",
  "reset",
  "create",
  "no_change",
])
const ALLOWED_SETTLEMENT_KINDS = new Set<WorldTickResult["settledOngoingEvents"][number]["settlementKind"]>([
  "advanced",
  "paused",
  "triggered",
  "interrupted",
  "blocked",
  "failed",
  "resolved",
  "no_change",
])
const ALLOWED_REACTION_TIMING = new Set<WorldTickResult["reactionQueue"][number]["reactionTiming"]>([
  "immediate",
  "delayed",
  "parallel",
  "tension",
  "none",
])
const ALLOWED_REACTION_PRIORITY = new Set<WorldTickResult["reactionQueue"][number]["priority"]>([
  "low",
  "medium",
  "high",
  "scene_focus",
])
const ALLOWED_PACING_DEBTS = new Set<WorldTickResult["pacingUpdate"]["previousDebt"]>([
  "none",
  "low",
  "medium",
  "high",
  "critical",
])
const ALLOWED_PRESSURE_CHANGES = new Set<WorldTickResult["pacingUpdate"]["pressureChange"]>([
  "relieved",
  "unchanged",
  "increased",
  "scene_cut_needed",
])
const ALLOWED_GAP_MODES = new Set<WorldTickResult["gapState"]["gapMode"]>([
  "none",
  "skip",
  "compress",
  "parallel_line_tick",
  "relationship_beat",
  "branching_event",
  "major_divergence_event",
])
const ALLOWED_GAP_IMPACTS = new Set<RpgGapImpactCandidate>(["none", "minor", "branch", "major"])
const ALLOWED_BROADCAST_CERTAINTY = new Set<WorldTickResult["informationBroadcast"][number]["certainty"]>([
  "confirmed",
  "partial",
  "misread",
  "unknown",
])
const FORBIDDEN_DRAFT_KEYS = [
  /^(?:proposedUpdates?|proposedWikiUpdates?|pendingUpdates?|wikiWrites?|wikiWriteProposal|writeProposal|targetPath|strategy|applyUpdates?|acceptedUpdates?)$/i,
  /^(?:narrative|narration|playerNarration|playerFacingText|playerFacingNarration|playerFacingOutput|parallelLineText|tensionBriefText|visibleNarration)$/i,
  /^(?:nextActionOptions)$/i,
  /^(?:outlineRevision|outlineRevisionProposal|provisionalOutlinePatch|regenerationRequest|storyOutlineRegeneration)$/i,
  /^(?:recallSelection|selectedItems|retrievalIndex|recalledMaterials|recallCandidates|recallOutput)$/i,
] as const

let activeWorldTickLooseCoercions: SoftDraftLooseCoercion[] | undefined

export function compileWorldTickDraftOutput(value: unknown, input: WorldTickInput): WorldTickResult {
  assertNoForbiddenDraftKeys(value)
  const previousLooseCoercions = activeWorldTickLooseCoercions
  const looseCoercions: SoftDraftLooseCoercion[] = []
  activeWorldTickLooseCoercions = looseCoercions
  try {
  const record = expectRecord(value, "WorldTickDraft")
  const worldDeltasRecord = optionalRecord(record, "worldDeltas", "WorldTickDraft.worldDeltas") ?? {}

  const playerVisibleLine = readOptionalArray(
    worldDeltasRecord,
    "playerVisibleLine",
    "WorldTickDraft.worldDeltas.playerVisibleLine",
  ).map((entry, index) => compileWorldDelta(entry, index, "playerVisibleLine", input))
  const parallelLine = readOptionalArray(
    worldDeltasRecord,
    "parallelLine",
    "WorldTickDraft.worldDeltas.parallelLine",
  ).map((entry, index) => compileWorldDelta(entry, index, "parallelLine", input))
  const tensionLine = readOptionalArray(
    worldDeltasRecord,
    "tensionLine",
    "WorldTickDraft.worldDeltas.tensionLine",
  ).map((entry, index) => compileWorldDelta(entry, index, "tensionLine", input))

  const clockUpdates = readOptionalArray(record, "clockUpdates", "WorldTickDraft.clockUpdates").map((entry, index) =>
    compileClockUpdate(entry, index, input),
  )
  const settledOngoingEvents = readOptionalArray(
    record,
    "settledOngoingEvents",
    "WorldTickDraft.settledOngoingEvents",
  ).map((entry, index) => compileSettledEvent(entry, index, input))
  const informationBroadcast = readOptionalArray(
    record,
    "informationBroadcast",
    "WorldTickDraft.informationBroadcast",
  ).map((entry, index) => compileInformationBroadcast(entry, index, input))
  const reactionQueue = readOptionalArray(record, "reactionQueue", "WorldTickDraft.reactionQueue").map((entry, index) =>
    compileReaction(entry, index, input),
  )
  const pacingUpdate = compilePacingUpdate(optionalRecord(record, "pacingUpdate", "WorldTickDraft.pacingUpdate"), input)
  const gapState = compileGapState(optionalRecord(record, "gapState", "WorldTickDraft.gapState"), input)
  const compiled: WorldTickResult = {
    tickId: `world-tick-${input.submittedAction.id}`,
    sourceActionResolutionId: input.actionResolution.resolutionId,
    timeAdvance: compileTimeAdvance(optionalRecord(record, "timeAdvance", "WorldTickDraft.timeAdvance"), input),
    worldDeltas: {
      playerVisibleLine,
      parallelLine,
      tensionLine,
    },
    clockUpdates,
    settledOngoingEvents,
    informationBroadcast,
    reactionQueue,
    pacingUpdate,
    gapState,
    runtimeDeltaRefs: dedupeRuntimeDeltaRefs([
      ...playerVisibleLine.flatMap((delta) => delta.runtimeDeltaRefs),
      ...parallelLine.flatMap((delta) => delta.runtimeDeltaRefs),
      ...tensionLine.flatMap((delta) => delta.runtimeDeltaRefs),
      ...clockUpdates.flatMap((delta) => delta.runtimeDeltaRefs),
      ...settledOngoingEvents.flatMap((delta) => delta.runtimeDeltaRefs),
      ...informationBroadcast.flatMap((delta) => delta.runtimeDeltaRefs),
      ...reactionQueue.flatMap((delta) => delta.runtimeDeltaRefs),
      ...pacingUpdate.runtimeDeltaRefs,
      ...gapState.runtimeDeltaRefs,
    ]),
    references: readOptionalStringArray(record, "referencePaths", "WorldTickDraft.referencePaths", []).map((path, index) =>
      compileReferencePath(path, index),
    ),
    warnings: [
      ...readOptionalStringArray(record, "warnings", "WorldTickDraft.warnings", []).map((message, index) =>
        compileWarningMessage(message, index),
      ),
      ...looseCoercions.map(formatSoftDraftLooseCoercionStructuredWarning),
    ],
  }

  return validateWorldTickResult(compiled)
  } finally {
    activeWorldTickLooseCoercions = previousLooseCoercions
  }
}

function compileTimeAdvance(record: JsonRecord | undefined, input: WorldTickInput): WorldTickResult["timeAdvance"] {
  return {
    sourceTimeDelta: input.timeDelta,
    appliedSummary:
      (record ? readOptionalString(record, "appliedSummary", "WorldTickDraft.timeAdvance.appliedSummary") : undefined)
        ?? input.timeDelta.summary,
    clockReasoning:
      (record ? readOptionalString(record, "clockReasoning", "WorldTickDraft.timeAdvance.clockReasoning") : undefined)
        ?? input.timeDelta.reasoning,
  }
}

function compileWorldDelta(
  value: unknown,
  index: number,
  defaultLine: RpgNarrativeLine,
  input: WorldTickInput,
): WorldTickResult["worldDeltas"]["playerVisibleLine"][number] {
  const label = `WorldTickDraft.worldDeltas.${defaultLine}[${index}]`
  const record = expectRecord(value, label)
  const deltaId = readOptionalString(record, "deltaId", `${label}.deltaId`) ??
    readOptionalString(record, "id", `${label}.id`) ??
    `world-delta-${defaultLine}-${index + 1}`
  const summary = readRequiredString(record, "summary", `${label}.summary`)
  const narrativeLine = readOptionalEnum(record, "narrativeLine", ALLOWED_NARRATIVE_LINES, `${label}.narrativeLine`) ??
    defaultLine
  const happenedStatus = readOptionalEnum(
    record,
    "happenedStatus",
    ALLOWED_HAPPENED_STATUSES,
    `${label}.happenedStatus`,
  ) ?? "ongoing"

  return {
    deltaId,
    summary,
    ...compileDeltaBase(record, label, {
      deltaId,
      summary,
      narrativeLine,
      happenedStatus,
      affectedPaths: defaultAffectedPaths(input),
    }),
    sourcePlayerDeltaIds: readOptionalStringArray(record, "sourcePlayerDeltaIds", `${label}.sourcePlayerDeltaIds`, [
      input.playerActionDelta.deltaId,
    ]),
    sourceClockIds: readOptionalStringArray(record, "sourceClockIds", `${label}.sourceClockIds`, []),
    knowledgeEffects: readOptionalStringArray(record, "knowledgeEffects", `${label}.knowledgeEffects`, []),
  }
}

function compileClockUpdate(value: unknown, index: number, input: WorldTickInput): WorldTickResult["clockUpdates"][number] {
  const label = `WorldTickDraft.clockUpdates[${index}]`
  const record = expectRecord(value, label)
  const sourceClock = input.activeClocks[index]
  const clockId = readOptionalString(record, "clockId", `${label}.clockId`) ?? sourceClock?.clockId ?? `clock-${index + 1}`
  const summary = readOptionalString(record, "summary", `${label}.summary`) ??
    readOptionalString(record, "reason", `${label}.reason`) ??
    `Clock ${clockId} updated.`
  const narrativeLine = readOptionalEnum(record, "narrativeLine", ALLOWED_NARRATIVE_LINES, `${label}.narrativeLine`) ??
    sourceClock?.narrativeLine ??
    "playerVisibleLine"
  const happenedStatus = readOptionalEnum(record, "happenedStatus", ALLOWED_HAPPENED_STATUSES, `${label}.happenedStatus`) ??
    "ongoing"

  return {
    clockId,
    clockKind: readOptionalEnum(record, "clockKind", ALLOWED_CLOCK_KINDS, `${label}.clockKind`) ??
      sourceClock?.clockKind ??
      "worldClock",
    updateKind: readOptionalEnum(record, "updateKind", ALLOWED_CLOCK_UPDATE_KINDS, `${label}.updateKind`) ?? "no_change",
    previousState: readOptionalString(record, "previousState", `${label}.previousState`) ??
      sourceClock?.currentState ??
      "No previous clock state provided.",
    nextState: readOptionalString(record, "nextState", `${label}.nextState`) ??
      readOptionalString(record, "previousState", `${label}.previousState`) ??
      sourceClock?.currentState ??
      "No next clock state provided.",
    amount: readOptionalNumber(record, "amount", `${label}.amount`),
    timeDeltaBasis: input.timeDelta,
    reason: readOptionalString(record, "reason", `${label}.reason`) ?? summary,
    sourcePlayerDeltaIds: readOptionalStringArray(record, "sourcePlayerDeltaIds", `${label}.sourcePlayerDeltaIds`, [
      input.playerActionDelta.deltaId,
    ]),
    ...compileDeltaBase(record, label, {
      deltaId: clockId,
      summary,
      narrativeLine,
      happenedStatus,
      affectedPaths: sourceClock?.affectedPaths.length ? sourceClock.affectedPaths : defaultAffectedPaths(input),
    }),
  }
}

function compileSettledEvent(
  value: unknown,
  index: number,
  input: WorldTickInput,
): WorldTickResult["settledOngoingEvents"][number] {
  const label = `WorldTickDraft.settledOngoingEvents[${index}]`
  const record = expectRecord(value, label)
  const sourceEvent = input.ongoingEvents[index]
  const eventId = readOptionalString(record, "eventId", `${label}.eventId`) ?? sourceEvent?.eventId ?? `settled-event-${index + 1}`
  const summary = readRequiredString(record, "summary", `${label}.summary`)
  const narrativeLine = readOptionalEnum(record, "narrativeLine", ALLOWED_NARRATIVE_LINES, `${label}.narrativeLine`) ??
    sourceEvent?.narrativeLine ??
    "playerVisibleLine"
  const happenedStatus = readOptionalEnum(record, "happenedStatus", ALLOWED_HAPPENED_STATUSES, `${label}.happenedStatus`) ??
    "ongoing"

  return {
    eventId,
    eventRef: readOptionalString(record, "eventRef", `${label}.eventRef`),
    settlementKind: readOptionalEnum(record, "settlementKind", ALLOWED_SETTLEMENT_KINDS, `${label}.settlementKind`) ??
      "advanced",
    summary,
    cause: readOptionalString(record, "cause", `${label}.cause`) ?? input.timeDelta.summary,
    participantRefs: readOptionalStringArray(record, "participantRefs", `${label}.participantRefs`, sourceEvent?.participantRefs ?? []),
    clockUpdateIds: readOptionalStringArray(record, "clockUpdateIds", `${label}.clockUpdateIds`, []),
    ...compileDeltaBase(record, label, {
      deltaId: eventId,
      summary,
      narrativeLine,
      happenedStatus,
      affectedPaths: sourceEvent?.affectedPaths.length ? sourceEvent.affectedPaths : defaultAffectedPaths(input),
    }),
  }
}

function compileInformationBroadcast(
  value: unknown,
  index: number,
  input: WorldTickInput,
): WorldTickResult["informationBroadcast"][number] {
  const label = `WorldTickDraft.informationBroadcast[${index}]`
  const record = expectRecord(value, label)
  const broadcastId = readOptionalString(record, "broadcastId", `${label}.broadcastId`) ?? `broadcast-${index + 1}`
  const informationSummary = readOptionalString(record, "informationSummary", `${label}.informationSummary`) ??
    readRequiredString(record, "summary", `${label}.summary`)
  const narrativeLine = readOptionalEnum(record, "narrativeLine", ALLOWED_NARRATIVE_LINES, `${label}.narrativeLine`) ??
    "parallelLine"
  const happenedStatus = readOptionalEnum(record, "happenedStatus", ALLOWED_HAPPENED_STATUSES, `${label}.happenedStatus`) ??
    "confirmed_happened"

  return {
    broadcastId,
    informationRef: readOptionalString(record, "informationRef", `${label}.informationRef`),
    informationSummary,
    sourceActorRefs: readOptionalStringArray(record, "sourceActorRefs", `${label}.sourceActorRefs`, []),
    recipientRefs: readOptionalStringArray(record, "recipientRefs", `${label}.recipientRefs`, []),
    channel: readOptionalString(record, "channel", `${label}.channel`) ?? "unspecified",
    certainty: readOptionalEnum(record, "certainty", ALLOWED_BROADCAST_CERTAINTY, `${label}.certainty`) ?? "partial",
    preventsPcKnowledgeLeak: readOptionalBoolean(record, "preventsPcKnowledgeLeak", `${label}.preventsPcKnowledgeLeak`) ?? true,
    ...compileDeltaBase(record, label, {
      deltaId: broadcastId,
      summary: informationSummary,
      narrativeLine,
      happenedStatus,
      visibilityPreset: "npc_known",
      affectedPaths: defaultAffectedPaths(input),
    }),
  }
}

function compileReaction(value: unknown, index: number, input: WorldTickInput): WorldTickResult["reactionQueue"][number] {
  const label = `WorldTickDraft.reactionQueue[${index}]`
  const record = expectRecord(value, label)
  const reactionId = readOptionalString(record, "reactionId", `${label}.reactionId`) ?? `reaction-${index + 1}`
  const summary = readRequiredString(record, "summary", `${label}.summary`)
  const narrativeLine = readOptionalEnum(record, "narrativeLine", ALLOWED_NARRATIVE_LINES, `${label}.narrativeLine`) ??
    "playerVisibleLine"
  const happenedStatus = readOptionalEnum(record, "happenedStatus", ALLOWED_HAPPENED_STATUSES, `${label}.happenedStatus`) ??
    "confirmed_happened"

  return {
    reactionId,
    actorRef: readOptionalString(record, "actorRef", `${label}.actorRef`) ?? "actor:unknown",
    reactionTiming: readOptionalEnum(record, "reactionTiming", ALLOWED_REACTION_TIMING, `${label}.reactionTiming`) ??
      "immediate",
    summary,
    triggerDeltaIds: readOptionalStringArray(record, "triggerDeltaIds", `${label}.triggerDeltaIds`, []),
    knowledgeBasis: readOptionalStringArray(record, "knowledgeBasis", `${label}.knowledgeBasis`, []),
    priority: readOptionalEnum(record, "priority", ALLOWED_REACTION_PRIORITY, `${label}.priority`) ?? "medium",
    ...compileDeltaBase(record, label, {
      deltaId: reactionId,
      summary,
      narrativeLine,
      happenedStatus,
      affectedPaths: defaultAffectedPaths(input),
    }),
  }
}

function compilePacingUpdate(record: JsonRecord | undefined, input: WorldTickInput): WorldTickResult["pacingUpdate"] {
  const label = "WorldTickDraft.pacingUpdate"
  const updateId = record ? readOptionalString(record, "updateId", `${label}.updateId`) : undefined
  const summary = record ? readOptionalString(record, "summary", `${label}.summary`) : undefined
  const previousDebt = record
    ? readOptionalEnum(record, "previousDebt", ALLOWED_PACING_DEBTS, `${label}.previousDebt`)
    : undefined
  const nextDebt = record ? readOptionalEnum(record, "nextDebt", ALLOWED_PACING_DEBTS, `${label}.nextDebt`) : undefined
  const pressureChange = record
    ? readOptionalEnum(record, "pressureChange", ALLOWED_PRESSURE_CHANGES, `${label}.pressureChange`)
    : undefined

  return {
    updateId: updateId ?? `pacing-${input.submittedAction.id}`,
    previousDebt: previousDebt ?? input.pacingState.pacingDebt,
    nextDebt: nextDebt ?? previousDebt ?? input.pacingState.pacingDebt,
    pressureChange: pressureChange ?? "unchanged",
    campaignDelta:
      (record ? readOptionalString(record, "campaignDelta", `${label}.campaignDelta`) : undefined) ??
      input.pacingState.expectedCampaignDelta ??
      input.pacingState.summary ??
      input.timeDelta.summary,
    compensationNeeded: record
      ? readOptionalBoolean(record, "compensationNeeded", `${label}.compensationNeeded`) ?? false
      : false,
    ...compileDeltaBase(record ?? {}, label, {
      deltaId: updateId ?? `pacing-${input.submittedAction.id}`,
      summary: summary ?? input.pacingState.summary,
      narrativeLine: "tensionLine",
      happenedStatus: "ongoing",
      visibilityPreset: "gm_only",
      affectedPaths: input.pacingState.affectedPaths.length ? input.pacingState.affectedPaths : defaultAffectedPaths(input),
    }),
  }
}

function compileGapState(record: JsonRecord | undefined, input: WorldTickInput): WorldTickResult["gapState"] {
  const label = "WorldTickDraft.gapState"
  const signal = input.gapSignals[0]
  const gapSignalId = record ? readOptionalString(record, "gapSignalId", `${label}.gapSignalId`) : undefined
  const summary = record ? readOptionalString(record, "summary", `${label}.summary`) : undefined
  const gapMode = record ? readOptionalEnum(record, "gapMode", ALLOWED_GAP_MODES, `${label}.gapMode`) : undefined
  const gapImpactCandidate = record
    ? readOptionalEnum(record, "gapImpactCandidate", ALLOWED_GAP_IMPACTS, `${label}.gapImpactCandidate`)
    : undefined

  return {
    gapSignalId: gapSignalId ?? signal?.gapSignalId ?? `gap-${input.submittedAction.id}`,
    gapMode: gapMode ?? signal?.gapMode ?? "none",
    gapImpactCandidate: gapImpactCandidate ?? signal?.gapImpactCandidate ?? "none",
    isPreliminary: true,
    outlineImpactAuthority: "outlineImpactDetector",
    summary: summary ?? signal?.summary ?? "No preliminary gap impact.",
    causalChain: record
      ? readOptionalStringArray(record, "causalChain", `${label}.causalChain`, signal?.causalChain ?? [])
      : signal?.causalChain ?? [],
    affectedBeatRefs: record
      ? readOptionalStringArray(record, "affectedBeatRefs", `${label}.affectedBeatRefs`, signal?.affectedBeatRefs ?? [])
      : signal?.affectedBeatRefs ?? [],
    ...compileDeltaBase(record ?? {}, label, {
      deltaId: gapSignalId ?? signal?.gapSignalId ?? `gap-${input.submittedAction.id}`,
      summary: summary ?? signal?.summary ?? "No preliminary gap impact.",
      narrativeLine: "tensionLine",
      happenedStatus: signal?.happenedStatus ?? "possible_future",
      visibilityPreset: "gm_only",
      affectedPaths: signal?.affectedPaths.length ? signal.affectedPaths : ["wiki/outlines/progress.md"],
    }),
  }
}

function compileReferencePath(path: string, index: number): WorldTickResult["references"][number] {
  return {
    path,
    reason: `Referenced by WorldTickDraft.referencePaths[${index}].`,
    usePurpose: "worldTick",
  }
}

function compileWarningMessage(message: string, index: number): WorldTickResult["warnings"][number] {
  return {
    code: `world_tick_warning_${index + 1}`,
    message,
    severity: "warning",
  }
}

function compileDeltaBase(
  record: JsonRecord,
  label: string,
  defaults: {
    deltaId: string
    summary: string
    narrativeLine: RpgNarrativeLine
    happenedStatus: RpgHappenedStatus
    visibilityPreset?: VisibilityPreset
    affectedPaths: string[]
  },
): Omit<WorldTickResult["pacingUpdate"], "updateId" | "previousDebt" | "nextDebt" | "pressureChange" | "campaignDelta" | "compensationNeeded"> {
  const narrativeLine = readOptionalEnum(record, "narrativeLine", ALLOWED_NARRATIVE_LINES, `${label}.narrativeLine`) ??
    defaults.narrativeLine
  const happenedStatus = readOptionalEnum(record, "happenedStatus", ALLOWED_HAPPENED_STATUSES, `${label}.happenedStatus`) ??
    defaults.happenedStatus
  const visibilityPreset = readOptionalEnum(
    record,
    "visibilityPreset",
    ALLOWED_VISIBILITY_PRESETS,
    `${label}.visibilityPreset`,
  ) ?? defaults.visibilityPreset
  return {
    narrativeLine,
    visibility: compileVisibility(undefined, visibilityPreset, narrativeLine),
    happenedStatus,
    affectedPaths: readOptionalStringArray(record, "affectedPaths", `${label}.affectedPaths`, defaults.affectedPaths),
    runtimeDeltaRefs: [runtimeDeltaRef(defaults.deltaId, defaults.summary, narrativeLine, happenedStatus)],
  }
}

function compileVisibility(
  record: JsonRecord | undefined,
  preset: VisibilityPreset | undefined,
  narrativeLine: RpgNarrativeLine,
): WorldTickVisibilityMeta {
  const base = visibilityFromPreset(preset ?? defaultVisibilityPresetForLine(narrativeLine))
  if (!record) return base

  return {
    visibilityScope: readOptionalString(record, "visibilityScope", "visibility.visibilityScope") as RpgVisibilityScope | undefined ??
      base.visibilityScope,
    knowledgeScope: readOptionalString(record, "knowledgeScope", "visibility.knowledgeScope") as RpgKnowledgeScope | undefined ??
      base.knowledgeScope,
    knowledgeSourceKind: readOptionalString(
      record,
      "knowledgeSourceKind",
      "visibility.knowledgeSourceKind",
    ) as RpgKnowledgeSourceKind | undefined ?? base.knowledgeSourceKind,
    knownBy: readOptionalStringArray(record, "knownBy", "visibility.knownBy", base.knownBy),
    excludedKnowledgeFor: readOptionalStringArray(
      record,
      "excludedKnowledgeFor",
      "visibility.excludedKnowledgeFor",
      base.excludedKnowledgeFor,
    ),
    displayPolicy: readOptionalString(record, "displayPolicy", "visibility.displayPolicy") as WorldTickVisibilityMeta["displayPolicy"] | undefined ??
      base.displayPolicy,
    reason: readOptionalString(record, "reason", "visibility.reason") ?? base.reason,
  }
}

function visibilityFromPreset(preset: VisibilityPreset): WorldTickVisibilityMeta {
  if (preset === "pc_inferred") {
    return {
      visibilityScope: "pc_inferred",
      knowledgeScope: "pc_known",
      knowledgeSourceKind: "inferred",
      knownBy: ["player"],
      excludedKnowledgeFor: [],
      displayPolicy: "player_visible",
      reason: "Compiler-expanded PC-inferred visibility preset.",
    }
  }
  if (preset === "user_visible_pc_unknown") {
    return {
      visibilityScope: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
      knowledgeSourceKind: "parallel_line",
      knownBy: ["user"],
      excludedKnowledgeFor: ["player"],
      displayPolicy: "user_visible_pc_unknown",
      reason: "Compiler-expanded user-visible / PC-unknown visibility preset.",
    }
  }
  if (preset === "npc_known") {
    return {
      visibilityScope: "user_visible_pc_unknown",
      knowledgeScope: "npc_known",
      knowledgeSourceKind: "heard",
      knownBy: ["npc"],
      excludedKnowledgeFor: ["player"],
      displayPolicy: "user_visible_pc_unknown",
      reason: "Compiler-expanded NPC-known visibility preset.",
    }
  }
  if (preset === "gm_only") {
    return {
      visibilityScope: "gm_only",
      knowledgeScope: "gm_only",
      knowledgeSourceKind: "documented",
      knownBy: ["gm"],
      excludedKnowledgeFor: ["player"],
      displayPolicy: "gm_only",
      reason: "Compiler-expanded GM-only visibility preset.",
    }
  }
  if (preset === "hidden") {
    return {
      visibilityScope: "hidden",
      knowledgeScope: "gm_only",
      knowledgeSourceKind: "unknown",
      knownBy: [],
      excludedKnowledgeFor: ["player"],
      displayPolicy: "hidden",
      reason: "Compiler-expanded hidden visibility preset.",
    }
  }
  return {
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    knowledgeSourceKind: "seen",
    knownBy: ["player"],
    excludedKnowledgeFor: [],
    displayPolicy: "player_visible",
    reason: "Compiler-expanded PC-visible visibility preset.",
  }
}

function defaultVisibilityPresetForLine(line: RpgNarrativeLine): VisibilityPreset {
  if (line === "parallelLine") return "user_visible_pc_unknown"
  if (line === "tensionLine") return "gm_only"
  return "pc_visible"
}

function runtimeDeltaRef(
  deltaId: string,
  summary: string,
  narrativeLine: RpgNarrativeLine,
  happenedStatus: RpgHappenedStatus,
): RpgRuntimeDeltaRef {
  return {
    deltaId,
    sourceStage: "worldTick",
    sourcePath: `.llm-wiki/runtime/turns/world-tick/world-tick.json#${deltaId}`,
    summary,
    narrativeLine,
    usePurpose: "worldTick",
    happenedStatus,
  }
}

function defaultAffectedPaths(input: WorldTickInput): string[] {
  const paths = [
    ...input.actionResolution.eventDraft.affectedRefs,
    ...input.actionResolution.directResults.flatMap((result) => result.affectedRefs),
    ...input.pacingState.affectedPaths,
    "wiki/current-scene/scene_state.md",
  ].filter((path, index, all) => path.trim() && all.indexOf(path) === index)
  return paths.length > 0 ? paths : ["wiki/current-scene/scene_state.md"]
}

function dedupeRuntimeDeltaRefs(refs: RpgRuntimeDeltaRef[]): RpgRuntimeDeltaRef[] {
  const seen = new Set<string>()
  const result: RpgRuntimeDeltaRef[] = []
  for (const ref of refs) {
    if (!ref || typeof ref !== "object") {
      result.push(ref)
      continue
    }
    const key = `${ref.deltaId}\u0000${ref.sourceStage}\u0000${ref.sourcePath}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(ref)
  }
  return result
}

function assertNoForbiddenDraftKeys(value: unknown, path = "WorldTickDraft"): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenDraftKeys(entry, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (FORBIDDEN_DRAFT_KEYS.some((pattern) => pattern.test(key))) {
      throw new Error(`Invalid WorldTickDraft: forbidden key ${path}.${key}.`)
    }
    assertNoForbiddenDraftKeys(child, `${path}.${key}`)
  }
}

function expectRecord(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as JsonRecord
}

function optionalRecord(record: JsonRecord, key: string, label: string): JsonRecord | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  return expectRecord(value, label)
}

function readRequiredString(record: JsonRecord, key: string, label: string): string {
  const value = readOptionalString(record, key, label)
  if (!value) throw new Error(`Invalid ${label}: must be a non-empty string.`)
  return value
}

function readOptionalString(record: JsonRecord, key: string, label: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "string") throw new Error(`Invalid ${label}: must be a string when provided.`)
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readOptionalNumber(record: JsonRecord, key: string, label: string): number | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label}: must be a finite number when provided.`)
  }
  return value
}

function readOptionalBoolean(record: JsonRecord, key: string, label: string): boolean | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "boolean") throw new Error(`Invalid ${label}: must be a boolean when provided.`)
  return value
}

function readOptionalArray(
  record: JsonRecord,
  key: string,
  label: string,
  options: { allowSingleObject?: boolean } = {},
): unknown[] {
  return readArrayLoose(record, key, label, {
    allowNullAsEmpty: true,
    allowSingleObject: options.allowSingleObject,
    coercions: activeWorldTickLooseCoercions,
  })
}

function readOptionalStringArray(record: JsonRecord, key: string, label: string, fallback: string[]): string[] {
  const strings = readStringArrayLoose(record, key, label, {
    allowNullAsEmpty: true,
    allowStringAsSingle: true,
    coercions: activeWorldTickLooseCoercions,
  })
  return strings.length > 0 ? strings : fallback
}

function readOptionalEnum<T extends string>(
  record: JsonRecord,
  key: string,
  allowed: ReadonlySet<T>,
  label: string,
): T | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`Invalid ${label}: must be one of ${[...allowed].join(", ")}.`)
  }
  return value as T
}
