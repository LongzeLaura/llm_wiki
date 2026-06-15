import type { RecallSelection, RecallSelectorInput } from "../../rpg-runtime/types"
import { buildTurnSemanticHandoffFromCanonical } from "../../rpg-runtime/turn-semantic-handoff"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import {
  buildRpgInteractionPromptFromSections,
  createJsonRpgPromptDebugSection,
  createRpgPromptDebugSection,
} from "../prompt-debug"
import { compileRecallSelectionDraftOutput } from "./recall-selector-draft-compiler"
import {
  parseSoftSemanticJsonOutput,
  type SoftSemanticJsonParseReport,
} from "./soft-semantic-json"

export type RpgRecallSelectorPrompt = RpgInteractionPrompt

export const RECALL_SELECTION_DRAFT_SCHEMA_PROMPT_LINES = [
  "RecallSelectionDraft 结构：",
  "{",
  "  \"selectedItems\": [",
  "    {",
  "      \"path\": string,",
  "      \"readMode\": \"summary\" | \"focusedSection\" | \"fullPage\" | \"metadataOnly\",",
  "      \"priority\": \"critical\" | \"high\" | \"medium\" | \"low\",",
  "      \"reason\": string,",
  "      \"expectedUse\": string,",
  "      \"sectionIds\": string[]",
  "    }",
  "  ],",
  "  \"exclusions\": [{ \"path\": string, \"sectionIds\": string[], \"reason\": string }],",
  "}",
] as const

export const recallSelectorInteractionSpec: RpgInteractionSpec<RecallSelectorInput, RecallSelection> = {
  kind: "recall_selector",
  buildPrompt(input) {
    const turnSemanticHandoff = input.turnSemanticHandoff ?? buildTurnSemanticHandoffFromCanonical({
      submittedAction: input.postActionWorkingState.submittedAction,
      actionResolution: input.actionResolution ?? input.postActionWorkingState.actionResolution,
      worldTickResult: input.worldTickResult ?? input.postActionWorkingState.worldTickResult,
      visibleSelection: input.visibleSelection ?? input.postActionWorkingState.visibleSelection,
      postActionWorkingState: input.postActionWorkingState,
    })
    const systemSections = [
      createRpgPromptDebugSection({
        sectionId: "recall-selector-system-fixed-prompt",
        title: "系统固定提示词",
        promptRole: "system",
        sourceKind: "fixed_prompt",
        sourceLabel: "recall_selector.systemPrompt",
        contentType: "text",
        content: [
        "你是 llmWikiRPG 在 LLM 3 / Step 13 使用的 Recall Selector 交互。",
        "Recall Selector 以 compact TurnSemanticHandoff 为基础，而不是展开完整 canonical ActionResolution / WorldTickResult / PostActionWorkingState。",
        "你的唯一职责是输出 recall 计划 / 确定性的文件读取 allowlist 候选。",
        "你不能读取文件。",
        "你不能包含被 recall 文件的正文或完整文本。",
        "你不能生成叙事。",
        "你不能写 wiki。",
        "你不能生成 update proposal 输出。",
        "你不能生成 wikiWrites、wikiWriteProposal、proposedUpdates 或 pendingUpdates。",
        "你不能生成 Outline-aware Brief、Outline Impact、Outline Regeneration、outlineBrief、outlineImpactReport、outlineRevision、outlineRevisionProposal、provisionalOutlinePatch 或 regenerationRequest 输出。",
        "不要进入 LLM 4。",
        "selectedItems[].sectionIds 必须引用 RetrievalIndexEntry.availableSections 中稳定的 sectionId，不能只依赖自然语言标题。",
        "每个 selected item 都必须标注 readMode、priority、reason、expectedUse 和 sectionIds。",
        "不要输出 selectionId、sourceWorkingStateId、recallBudget、recallPolicy、warnings、lineTarget、visibilityScope 或 knowledgeScope；这些由本地 compiler 生成。",
        "lineTarget 是本轮 narration lens target / fallback，不是大纲归属、不是三条平等主线，也不要求每轮同步推进；本地 compiler 会从检索索引和 section metadata 派生。",
        "playerVisibleLine 可以只覆盖当前 PC 可见/可推断信息；parallelLine 只表示用户可见但 PC 未知；tensionLine 只表示关系/情绪/伏笔/节奏压力信号。",
        "Exclusions 必须说明哪些已知路径 / 分节被省略以及原因。",
        "selectedItems[].path 和 exclusions[].path 必须逐字等于 retrievalIndex[].path。",
        "exclusions[].sectionIds 必须来自对应 RetrievalIndexEntry.availableSections。",
        "禁止在 selectedItems[].path 或 exclusions[].path 中使用 wildcard/glob/pathPattern、目录路径或 category path，例如 wiki/sources/*.md。",
        "不要输出类别级“不召回某类材料”的说明；exclusions 只能引用 retrievalIndex 中的具体路径和 sectionIds。",
        "parallelLine 或 user_visible_pc_unknown 材料绝不能被标记为 PC 已知。",
        "仅返回严格的 RecallSelectionDraft JSON。",
        "",
        ...RECALL_SELECTION_DRAFT_SCHEMA_PROMPT_LINES,
        ],
      }),
    ]
    const userSections = [
      createRpgPromptDebugSection({
        sectionId: "recall-selector-input-boundary",
        title: "输入边界",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "recall_selector.userPrompt.boundary",
        contentType: "markdown",
        content: [
          "# Recall Selector 输入",
          "",
          "仅使用这个结构化输入。不要读取 wiki 文件，不要检查文件系统，也不要假设 retrievalIndex 之外的材料。",
        ],
      }),
      createRpgPromptDebugSection({
        sectionId: "recall-selector-turn-semantic-handoff",
        title: "TurnSemanticHandoff",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "turnSemanticHandoff",
        contentType: "markdown",
        content: [
          "## TurnSemanticHandoff",
          "这是世界反应完成后的 compact semantic handoff，也是唯一的 recall 语义锚点；完整 canonical 对象只供本地校验，不在 prompt 中展开。",
          formatJson(turnSemanticHandoff),
        ],
      }),
      createRpgPromptDebugSection({
        sectionId: "recall-selector-retrieval-index",
        title: "检索索引",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "retrievalIndex",
        contentType: "markdown",
        content: [
          "## 检索索引",
          "只能选择这里出现过的路径和 sectionId。selectedItems[].path 和 exclusions[].path 必须逐字等于 retrievalIndex[].path；禁止输出 wildcard/glob/pathPattern、目录路径或 category path。",
          formatJson(input.retrievalIndex),
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "recall-selector-recall-budget",
        title: "Recall 预算",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "recallBudget",
        value: input.recallBudget,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "recall-selector-recall-policy",
        title: "Recall 策略",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "recallPolicy",
        value: input.recallPolicy,
      }),
      createRpgPromptDebugSection({
        sectionId: "recall-selector-return-contract",
        title: "返回契约",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "仅返回 RecallSelectionDraft JSON",
        contentType: "text",
        content: "仅返回 RecallSelectionDraft JSON；不要输出本地 compiler 负责的 protocol / budget / policy / warning / visibility 字段。",
      }),
    ]

    return buildRpgInteractionPromptFromSections({ systemSections, userSections })
  },
  parseOutput(output, input) {
    return parseRpgRecallSelectionOutput(output, input)
  },
}

export function buildRecallSelectorPrompt(input: RecallSelectorInput): RpgRecallSelectorPrompt {
  return recallSelectorInteractionSpec.buildPrompt(input)
}

export interface ParseRpgRecallSelectionOutputOptions {
  onJsonParseReport?: (report: SoftSemanticJsonParseReport) => void
}

export function parseRpgRecallSelectionOutput(
  output: string,
  input: RecallSelectorInput,
  options: ParseRpgRecallSelectionOutputOptions = {},
): RecallSelection {
  let parsed: unknown
  try {
    const result = parseSoftSemanticJsonOutput(output, { label: "RPG Recall Selector" })
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
    return compileRecallSelectionDraftOutput(parsed, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Recall Selector 交互收到无效的 RecallSelectionDraft：${message}`)
  }
}

function formatJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n")
}
