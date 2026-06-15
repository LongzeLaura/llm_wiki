import type { ActionResolution, ActionResolverInput } from "../../rpg-runtime/types"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import {
  buildRpgInteractionPromptFromSections,
  createJsonRpgPromptDebugSection,
  createRpgPromptDebugSection,
} from "../prompt-debug"
import { compileActionResolutionDraftOutput } from "./action-resolver-draft-compiler"
import { validateActionResolution } from "./action-resolver-validation"
import {
  parseSoftSemanticJsonOutput,
  type SoftSemanticJsonParseReport,
} from "./soft-semantic-json"

export type RpgActionResolverPrompt = RpgInteractionPrompt

const ACTION_RESOLVER_SYSTEM_FIXED_PROMPT_LINES = [
  "你是 llmWikiRPG 的 Action Resolver 交互。",
  "你的唯一职责是把玩家提交的行动解析并裁定为轻量 ActionResolutionDraft JSON；本地 compiler 会补齐 ID、runtimeDeltaRefs、默认数组和引用 envelope。",
  "玩家行动是一种尝试，不是自动成功的既成事件。",
  "除非行动文本或 pre-action snapshot 明确确认事件已经发生，否则 eventDraft.status 默认使用 attempted_not_confirmed。",
  "如果使用 confirmed_happened，必须在 eventDraft.confirmationBasis 中说明明确的确认依据。",
  "可行性、代价、障碍和直接结果必须分开表达。不要把代价或障碍藏进可行性说明里。",
  "只裁定由本次提交的玩家行动直接造成的结果。",
  "不要推进幕后的时钟、平行剧情、NPC 计划，或超出本次行动范围的节奏。",
  "no world tick",
  "no wiki write",
  "no player-facing narration",
  "不要输出 World Tick、Reaction Queue、information broadcast、update proposal、pending update、next action options 或叙事正文。",
  "PlayerActionDelta 只能包含由玩家行动直接引起的变化；不得包含 world tick、wiki write 或玩家可见叙事。",
  "timeDelta 必须根据行动、规则、距离、场景约束和 active clocks 推导，不能偷懒写成泛化的一回合/一分钟默认值。",
  "progressPotential 必须说明该行动是否会推进战役、揭示信息、改变位置、消耗资源，或触发大纲缺口压力。",
  "referencePaths 和 warnings 必须是两个独立的轻量字符串数组；没有内容时省略。",
  "不要输出 resolutionId、eventId、costId、obstacleId、resultId、playerActionDelta.deltaId、runtimeDeltaRefs 或 submittedActionId；这些由本地 compiler 生成。",
  "严格 JSON 规则：可选字段没有值时必须省略整个 key；字符串数组字段没有内容时省略或输出 []；禁止输出 undefined；ActionResolutionDraft 不包含任何允许为 null 的字段，禁止用 null 代替缺失值。",
  "",
  "只返回严格匹配以下 ActionResolutionDraft 结构的 JSON：",
]

export const ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES = [
  "{",
  "  \"parsedIntent\": {",
  "    \"intentKind\": \"attack\" | \"move\" | \"talk\" | \"investigate\" | \"observe\" | \"rescue\" | \"use_item\" | \"wait\" | \"prepare\" | \"mixed\" | \"custom\",",
  "    \"actorRef\": string,",
  "    \"targetRefs\": string[]（可选；仅有内容时输出）,",
  "    \"actionScope\": string,",
  "    \"declaredGoal\": string,",
  "    \"timeJumpSignal\": string（可选；无值时省略 key）,",
  "    \"ambiguityNotes\": string[]（可选；仅有内容时输出）",
  "  },",
  "  \"eventDraft\": {",
  "    \"eventType\": string,",
  "    \"summary\": string,",
  "    \"status\": \"attempted_not_confirmed\" | \"confirmed_happened\" | \"ongoing\" | \"blocked\" | \"failed\" | \"possible_future\" | \"intention_only\" | \"misunderstanding\",",
  "    \"confirmationBasis\": string（可选；仅 confirmed_happened 需要；无值时省略 key）,",
  "    \"actorRefs\": string[]（可选；仅有内容时输出）,",
  "    \"targetRefs\": string[]（可选；仅有内容时输出）,",
  "    \"affectedRefs\": string[]（可选；仅有内容时输出）,",
  "    \"riskSummary\": string,",
  "    \"requiredChecks\": string[]（可选；仅有内容时输出）,",
  "    \"ambiguityNotes\": string[]（可选；仅有内容时输出）",
  "  },",
  "  \"feasibility\": {",
  "    \"status\": \"feasible\" | \"partially_feasible\" | \"requires_cost\" | \"blocked\" | \"uncertain\",",
  "    \"rationale\": string,",
  "    \"limitingFactors\": string[],",
  "    \"requiredChecks\": string[],",
  "    \"alternativeResults\": string[]",
  "  },",
  "  \"costs\": [{ \"kind\": \"time\" | \"resource\" | \"risk\" | \"position\" | \"relationship\" | \"information\" | \"condition\" | \"other\", \"description\": string, \"appliesIf\": string }],",
  "  \"obstacles\": [{ \"severity\": \"minor\" | \"moderate\" | \"major\" | \"hard_block\", \"description\": string, \"bypassHint\": string（可选；无值时省略 key） }],",
  "  \"directResults\": [{ \"summary\": string, \"happenedStatus\": \"attempted_not_confirmed\" | \"confirmed_happened\" | \"ongoing\" | \"blocked\" | \"failed\" | \"possible_future\" | \"intention_only\" | \"misunderstanding\", \"visibilityScope\": \"pc_visible\" | \"pc_inferred\" | \"user_visible_pc_unknown\" | \"gm_only\" | \"hidden\", \"affectedRefs\": string[] }],",
  "  \"timeDelta\": { \"scale\": \"instant\" | \"seconds\" | \"minutes\" | \"tens_of_minutes\" | \"hours\" | \"days\" | \"scene_dependent\", \"unit\": \"seconds\" | \"minutes\" | \"hours\" | \"days\" | \"turns\" | \"scene\", \"min\": number（可选；无值时省略 key）, \"max\": number（可选；无值时省略 key）, \"summary\": string, \"reasoning\": string },",
  "  \"progressPotential\": { \"level\": \"none\" | \"low\" | \"medium\" | \"high\" | \"major\", \"summary\": string, \"possibleUnlocks\": string[], \"gapTriggerPotential\": \"none\" | \"minor\" | \"branch\" | \"major\" },",
  "  \"playerActionDelta\": {",
  "    \"positionChanges\": string[]（可选；仅有内容时输出）,",
  "    \"resourceChanges\": string[]（可选；仅有内容时输出）,",
  "    \"inventoryChanges\": string[]（可选；仅有内容时输出）,",
  "    \"conditionChanges\": string[]（可选；仅有内容时输出）,",
  "    \"knowledgeChanges\": string[]（可选；仅有内容时输出）,",
  "    \"relationshipSignals\": string[]（可选；仅有内容时输出）,",
  "    \"sceneChanges\": string[]（可选；仅有内容时输出）,",
  "    \"interruptedEvents\": string[]（可选；仅有内容时输出）,",
  "    \"exposedInformation\": string[]（可选；仅有内容时输出）,",
  "    \"notes\": string[]（可选；仅有内容时输出）",
  "  },",
  "  \"referencePaths\": string[]（可选；只放输入中实际用到的 wiki path；完整引用 envelope 由本地 compiler 生成）,",
  "  \"warnings\": string[]（可选；只写简短风险或歧义说明）",
  "}",
]

export const actionResolverInteractionSpec: RpgInteractionSpec<ActionResolverInput, ActionResolution> = {
  kind: "action_resolver",
  buildPrompt(input) {
    const systemSections = [
      createRpgPromptDebugSection({
        sectionId: "action-resolver-system-fixed-prompt",
        title: "系统固定提示词",
        promptRole: "system",
        sourceKind: "fixed_prompt",
        sourceLabel: "action_resolver.systemPrompt",
        contentType: "text",
        content: [
          ...ACTION_RESOLVER_SYSTEM_FIXED_PROMPT_LINES,
          ...ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES,
        ],
      }),
    ]
    const userSections = [
      createRpgPromptDebugSection({
        sectionId: "action-resolver-input-boundary",
        title: "输入边界",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "action_resolver.userPrompt.boundary",
        contentType: "markdown",
        content: [
          "# Action Resolver 输入",
          "",
          "仅使用下方的 submitted action 和冻结的 pre-action snapshot。不要读取或假设此输入之外的任何 wiki 状态。",
        ],
      }),
      createRpgPromptDebugSection({
        sectionId: "action-resolver-submitted-action",
        title: "已提交行动",
        promptRole: "user",
        sourceKind: "player_input",
        sourceLabel: "submittedAction",
        contentType: "markdown",
        content: ["## Submitted Action", formatSubmittedAction(input)],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "action-resolver-pre-action-snapshot",
        title: "行动前快照",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "preActionSnapshot",
        value: input.preActionSnapshot,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "action-resolver-relevant-rules",
        title: "相关规则",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "relevantRules",
        value: input.relevantRules,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "action-resolver-fixed-slot-refs",
        title: "固定槽位引用",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "fixedSlotRefs",
        value: input.fixedSlotRefs,
      }),
      createRpgPromptDebugSection({
        sectionId: "action-resolver-recent-turn-summary",
        title: "最近回合摘要",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "recentTurnSummary",
        contentType: "markdown",
        content: ["## 最近回合摘要", input.recentTurnSummary?.trim() || "未提供。"],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "action-resolver-runtime-refs",
        title: "Runtime 引用",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "runtimeRefs",
        value: input.runtimeRefs,
      }),
      createRpgPromptDebugSection({
        sectionId: "action-resolver-return-contract",
        title: "返回契约",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "仅返回 ActionResolutionDraft JSON",
        contentType: "text",
        content: "仅返回 ActionResolutionDraft JSON。",
      }),
    ]

    return buildRpgInteractionPromptFromSections({ systemSections, userSections })
  },
  parseOutput(output, input) {
    return parseRpgActionResolverOutput(output, input)
  },
}

export function buildActionResolverPrompt(input: ActionResolverInput): RpgActionResolverPrompt {
  return actionResolverInteractionSpec.buildPrompt(input)
}

export interface ParseRpgActionResolverOutputOptions {
  onJsonParseReport?: (report: SoftSemanticJsonParseReport) => void
}

export function parseRpgActionResolverOutput(
  output: string,
  input?: ActionResolverInput,
  options: ParseRpgActionResolverOutputOptions = {},
): ActionResolution {
  let parsed: unknown
  try {
    const result = parseSoftSemanticJsonOutput(output, { label: "RPG Action Resolver" })
    parsed = result.parsed
    options.onJsonParseReport?.(result.report)
  } catch (error) {
    const report = error instanceof Error && "report" in error
      ? (error as { report?: SoftSemanticJsonParseReport }).report
      : undefined
    if (report) options.onJsonParseReport?.(report)
    throw error
  }

  try {
    return validateActionResolution(input ? compileActionResolutionDraftOutput(parsed, input) : parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Action Resolver 交互收到无效的 ActionResolution：${message}`)
  }
}

function formatSubmittedAction(input: ActionResolverInput): string {
  const action = input.submittedAction
  const lines = [`id: ${formatInline(action.id)}`, `text: ${formatInline(action.text)}`, `source: ${action.source}`]
  if (action.selectedOptionId) {
    lines.push(`selectedOptionId: ${formatInline(action.selectedOptionId)}`)
  }
  return lines.join("\n")
}

function formatInline(value: string): string {
  return JSON.stringify(value)
}
