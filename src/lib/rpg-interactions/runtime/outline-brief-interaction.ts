import type {
  OutlineBriefCompilerInput,
  OutlineBriefCompilerOutput,
} from "../../rpg-runtime/types"
import { buildTurnSemanticHandoffFromCanonical } from "../../rpg-runtime/turn-semantic-handoff"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import {
  buildRpgInteractionPromptFromSections,
  createJsonRpgPromptDebugSection,
  createRpgPromptDebugSection,
} from "../prompt-debug"
import {
  REGENERATION_REQUEST_AUDIT_ONLY_LINE,
  STORY_OUTLINE_REGENERATOR_NOT_TRIGGERED_LINE,
} from "./llm4-handoff-boundary"
import { compileOutlineBriefDraftOutput } from "./outline-brief-draft-compiler"
import {
  parseSoftSemanticJsonOutput,
  type SoftSemanticJsonParseReport,
} from "./soft-semantic-json"

export type RpgOutlineBriefPrompt = RpgInteractionPrompt

export const OUTLINE_BRIEF_DRAFT_SCHEMA_PROMPT_LINES = [
  "允许的顶层 JSON 结构：",
  "{",
  "  \"playerFacingBrief\": {",
  "    \"summary\": string,",
  "    \"currentSceneFocus\": string,",
  "    \"allowedKnowledgeRefs\": [{ \"path\": string, \"sectionId\"?: string, \"stableId\"?: string, \"runtimeDeltaId\"?: string, \"reason\": string }],",
  "    \"immediateReactions\": string[],",
  "    \"clueDirections\": string[],",
  "    \"mustNotRevealStableIds\": string[]",
  "  },",
  "  \"parallelLineBrief\": {",
  "    \"summary\": string,",
  "    \"allowedParallelRefs\": [{ \"path\": string, \"sectionId\"?: string, \"stableId\"?: string, \"runtimeDeltaId\"?: string, \"reason\": string }],",
  "    \"parallelBeatFocus\": string[],",
  "    \"displayPolicy\": \"user_visible_pc_unknown\" | \"gm_only\" | \"hidden\"",
  "  },",
  "  \"tensionBriefInput\": {",
  "    \"summary\": string,",
  "    \"tensionLineUpdateCandidate\": optional { \"summary\": string, \"sourceFuelIds\"?: string[], \"targetPlotArcIds\"?: string[], \"updateKind\": \"advance\" | \"hold\" | \"reverse\" | \"complicate\" | \"resolve\", \"reason\": string },",
  "    \"relationshipPressure\": string[],",
  "    \"shouldAdvance\": boolean",
  "  },",
  "  \"pacingDirective\": {",
  "    \"intent\": \"hold\" | \"soft_push\" | \"medium\" | \"strong\" | \"scene_cut\",",
  "    \"reason\": string,",
  "    \"requiredMovement\": string[],",
  "    \"avoidStagnation\": boolean",
  "  },",
  "  \"campaignDeltaRequirement\": {",
  "    \"required\": boolean,",
  "    \"minimumDelta\": \"none\" | \"minor\" | \"meaningful\" | \"scene_changing\",",
  "    \"reason\": string,",
  "    \"candidateSources\": string[]",
  "  },",
  "  \"outlineImpactReport\": {",
  "    \"impactLevel\": \"none\" | \"minor\" | \"branch\" | \"major_rewrite_required\",",
  "    \"affected\": {",
  "      \"lines\": (\"playerVisibleLine\" | \"parallelLine\" | \"tensionLine\")[],",
  "      \"beats\": (stableId string or { \"stableId\": string })[],",
  "      \"reveals\": (stableId string or { \"stableId\": string })[],",
  "      \"branchConditions\": (stableId string or { \"stableId\": string })[],",
  "      \"plotArcs\": (stableId string or { \"stableId\": string })[],",
  "      \"tensionLine\": (stableId string or { \"stableId\": string })[]",
  "    },",
  "    \"invalidatedAssumptions\": string[],",
  "    \"reason\": string,",
  "    \"requiresRegeneration\": boolean",
  "  },",
  "  \"warnings\": string[]",
  "}",
  "不要输出 outlineAwareNarrationBrief、OutlineBriefReference、allowedKnowledge、allowedParallelKnowledge、plotArcFuel、briefId、reportId、requestId 或 sourceRefs；这些由本地 compiler 生成。",
] as const

export const outlineBriefInteractionSpec: RpgInteractionSpec<
  OutlineBriefCompilerInput,
  OutlineBriefCompilerOutput
> = {
  kind: "outline_brief",
  buildPrompt(input) {
    const turnSemanticHandoff = input.turnSemanticHandoff ?? buildTurnSemanticHandoffFromCanonical({
      submittedAction: input.postActionWorkingState.submittedAction,
      actionResolution: input.actionResolution,
      worldTickResult: input.worldTickResult,
      visibleSelection: input.visibleSelection,
      postActionWorkingState: input.postActionWorkingState,
    })
    const systemSections = [
      createRpgPromptDebugSection({
        sectionId: "outline-brief-system-fixed-prompt",
        title: "系统固定提示词",
        promptRole: "system",
        sourceKind: "fixed_prompt",
        sourceLabel: "outline_brief.systemPrompt",
        contentType: "text",
        content: [
          "你是 llmWikiRPG 在 LLM 4 / Step 14 使用的 Outline Brief Draft Generator + Outline Impact Detector。",
          "你的职责是输出轻量 OutlineBriefDraft；本地 compiler 会补齐 sourceWorkingStateId、完整引用 envelope、reportId 和 regenerationRequest 协议字段。",
          "输入中的 recalledMaterials 是 Recall Selector 过滤后的 handoff，不是完整的大纲权威来源。",
          "输入中的 outlineSlices 是 GM control / reveal gate / progress marker 切片，不是三条平等推进的大纲轴。",
          "outlineSlices[].lineTarget 和 recalledMaterials[].lineTarget 只是最终 brief 的 narration lens fallback，不表示该切片属于某条大纲线。",
          "必须先读取 outlineControl.controlKind、gmSummary、playerSafeSummary、mustNotRevealTo 和 revealGateRefs，再决定本轮 playerVisibleLine / parallelLine / tensionLine lens 如何使用。",
          "只能使用下方的结构化输入和确定性的 recalledMaterials handoff。",
          "不要直接读取文件；文件读取只发生在前一个确定性 reader 阶段。",
          "不要改写 TurnSemanticHandoff、RecallSelection 或 recalledMaterials。",
          "不要生成面向玩家的叙事正文。",
          "不要生成 nextActionOptions。",
          "不要写 wiki。",
          "不要生成 runtime update proposal 输出。",
          "不要生成 wikiWrites、wikiWriteProposal、proposedUpdates 或 pendingUpdates。",
          "不要生成 outlineRevision、outlineRevisionProposal、provisionalOutlinePatch、fullOutlineText、rawOutline 或 fileContent。",
          `${STORY_OUTLINE_REGENERATOR_NOT_TRIGGERED_LINE} Only output a regenerationRequest when impactLevel is major_rewrite_required and requiresRegeneration is true.`,
          REGENERATION_REQUEST_AUDIT_ONLY_LINE,
          "不要执行 Narration Generator 的三线叙事生成工作。",
          "不要执行 Runtime Update Proposal 的工作。",
          "不要把 GM-only、hidden、parallelLine-only 或 user_visible_pc_unknown 材料转成 PC 已知。",
          "不要把 GM-only truth、delayed reveal、hard constraint 或 user-visible-PC-unknown 内容写入 playerFacingBrief.allowedKnowledge。",
          "playerFacingBrief.allowedKnowledge 只能包含 PC 当前可见、可听、已知、明确误解或可合理推断的材料。",
          "parallelLineBrief 必须明确不能赋予 PC 知识。",
          "parallelLineBrief.grantsPcKnowledge 必须为 false，即使 parallelLineBrief 面向真实用户展示幕后压力。",
          "playerFacingBrief 只能包含 PC 可见或 PC 可推断的引导。",
          "tensionBriefInput 用于关系、情绪、节奏与 plot-arc fuel，不是给玩家看的叙事正文。",
          "tensionBriefInput.tensionLineUpdateCandidate.sourceFuelIds 只能从下方 “Plot-arc 张力燃料” 的 fuelId 原样选择；不要输出 plotArcFuelRefs，plotArcFuel 由本地 compiler 根据 sourceFuelIds 确定性生成。",
          "references 只能使用输入中出现的 paths、sectionIds、stableIds 或 runtimeDeltaIds。",
          "references、allowedKnowledge、allowedParallelKnowledge、plotArcFuel、sourceRefs、affected.* 中的 path/sourcePath/sectionId/stableId/runtimeDeltaId 都必须来自输入 TurnSemanticHandoff、recalledMaterials、recallSelection、outlineSlices、plotArcTensionFuel 或 knownReferences。",
          "禁止在任何 path/sourcePath 中使用 wildcard/glob/category/pathPattern，例如 wiki/sources/*.md。",
          "仅返回严格 JSON。",
          "输出是 OutlineBriefDraft，不是内部 canonical OutlineBriefCompilerOutput。",
          "不要输出 briefId、sourceWorkingStateId、完整 reference envelope、visibility/knowledge metadata、reportId 或 requestId；这些由本地 compiler 生成。",
          "",
          ...OUTLINE_BRIEF_DRAFT_SCHEMA_PROMPT_LINES,
        ],
      }),
    ]
    const userSections = [
      createRpgPromptDebugSection({
        sectionId: "outline-brief-input-boundary",
        title: "输入边界",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "outline_brief.userPrompt.boundary",
        contentType: "markdown",
        content: [
          "# Outline-aware Brief Compiler 输入",
          "",
          "仅使用这个结构化输入。不要检查文件系统。",
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "outline-brief-turn-semantic-handoff",
        title: "TurnSemanticHandoff",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "turnSemanticHandoff",
        value: turnSemanticHandoff,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "outline-brief-recall-selection",
        title: "RecallSelection",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "recallSelection",
        value: input.recallSelection,
      }),
      createRpgPromptDebugSection({
        sectionId: "outline-brief-recalled-materials",
        title: "recalledMaterials",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "recalledMaterials",
        contentType: "markdown",
        content: [
          "## recalledMaterials",
          "These are filtered handoff materials from deterministic local reads, not full outline authority and not accepted wiki facts.",
          formatJson(input.recalledMaterials),
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "outline-brief-pacing-state",
        title: "节奏状态",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "pacingState",
        value: {
          pacingSummary: turnSemanticHandoff.pressureSignals,
          openQuestions: turnSemanticHandoff.openQuestions,
        },
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "outline-brief-visibility-boundaries",
        title: "可见性边界",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "visibilityBoundaries",
        value: input.visibilityBoundaries,
      }),
      createRpgPromptDebugSection({
        sectionId: "outline-brief-outline-slices",
        title: "大纲切片",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "outlineSlices",
        contentType: "markdown",
        content: [
          "## 大纲切片",
          "这些是 GM control / reveal gate / progress marker 切片。先按 outlineControl 处理大纲控制语义，再决定最终 narration lens。",
          "lineTarget 只是 narration lens fallback，不是大纲结构、不是三条平等主线、也不要求同步推进。",
          "gmSummary 可用于 GM 侧一致性与揭示节奏；playerSafeSummary 才可作为 PC 可见 brief 的候选摘要。",
          "mustNotRevealTo 包含 pc 时，相关 truth / delayed reveal / hard constraint 不得进入 playerFacingBrief.allowedKnowledge。",
          "只能使用这些切片中的稳定 beat/reveal/branch condition ids、依赖/失效元数据、outline control metadata、lens fallback 和 reveal policies。",
          formatJson(input.outlineSlices.slice(0, 8)),
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "outline-brief-plot-arc-tension-fuel",
        title: "Plot-arc 张力燃料",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "plotArcTensionFuel",
        value: input.plotArcTensionFuel.slice(0, 8),
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "outline-brief-hard-constraints-metadata",
        title: "硬约束元数据",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "hardConstraints",
        value: input.hardConstraints.slice(0, 8),
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "outline-brief-known-references",
        title: "已知引用",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "knownReferences",
        value: input.knownReferences.slice(0, 20),
      }),
      createRpgPromptDebugSection({
        sectionId: "outline-brief-return-contract",
        title: "返回契约",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "仅返回 OutlineBriefDraft JSON",
        contentType: "text",
        content: "仅返回 OutlineBriefDraft JSON。",
      }),
    ]

    return buildRpgInteractionPromptFromSections({ systemSections, userSections })
  },
  parseOutput(output, input) {
    return parseRpgOutlineBriefOutput(output, input)
  },
}

export function buildOutlineBriefPrompt(input: OutlineBriefCompilerInput): RpgOutlineBriefPrompt {
  return outlineBriefInteractionSpec.buildPrompt(input)
}

export interface ParseRpgOutlineBriefOutputOptions {
  onJsonParseReport?: (report: SoftSemanticJsonParseReport) => void
}

export function parseRpgOutlineBriefOutput(
  output: string,
  input: OutlineBriefCompilerInput,
  options: ParseRpgOutlineBriefOutputOptions = {},
): OutlineBriefCompilerOutput {
  let parsed: unknown
  try {
    const result = parseSoftSemanticJsonOutput(output, { label: "RPG Outline Brief" })
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
    return compileOutlineBriefDraftOutput(parsed, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Outline Brief 交互收到无效的 OutlineBriefDraft：${message}`)
  }
}

function formatJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n")
}
