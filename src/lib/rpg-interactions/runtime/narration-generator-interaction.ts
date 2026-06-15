import type { NarrationGeneratorInput, TurnNarration } from "../../rpg-runtime/types"
import { buildTurnSemanticHandoffFromCanonical } from "../../rpg-runtime/turn-semantic-handoff"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import {
  buildRpgInteractionPromptFromSections,
  createJsonRpgPromptDebugSection,
  createRpgPromptDebugSection,
} from "../prompt-debug"
import { compileTurnNarrationDraftOutput } from "./narration-generator-draft-compiler"
import { validateTurnNarration } from "./narration-generator-validation"
import {
  parseSoftSemanticJsonOutput,
  type SoftSemanticJsonParseReport,
} from "./soft-semantic-json"

export type RpgNarrationGeneratorPrompt = RpgInteractionPrompt

export const TURN_NARRATION_DRAFT_SCHEMA_PROMPT_LINES = [
  "{",
  "  \"playerFacingText\": string,",
  "  \"parallelLineText\": string（可选；无值时省略 key）,",
  "  \"tensionBrief\": {",
  "    \"summary\": string,",
  "    \"pressureSignals\": string[]（可选；仅有内容时输出）,",
  "    \"relationshipSignals\": string[]（可选；仅有内容时输出）,",
  "    \"plotArcSignals\": string[]（可选；仅有内容时输出）,",
  "    \"reviewHandoff\": string",
  "  },",
  "  \"narrationSelfReport\"?: {",
  "    \"followedPacingIntent\": \"followed\" | \"partially_followed\" | \"not_applicable\"（可选）,",
  "    \"timeCompression\": \"none\" | \"compressed\" | \"expanded\" | \"scene_cut\"（可选）,",
  "    \"sceneTransition\": \"none\" | \"soft_transition\" | \"hard_cut\" | \"new_scene\"（可选）,",
  "    \"campaignDelta\": \"none\" | \"minor\" | \"meaningful\" | \"scene_changing\"（可选）,",
  "    \"revealBoundary\": \"allowed_now\" | \"hint_only\" | \"delay\" | \"forbid\" | \"parallel_only\" | \"gm_only\"（可选）",
  "  },",
  "  \"nextActionOptions\": [",
  "    {",
      "      \"playerFacingText\": string,",
      "      \"intent\": \"investigate\" | \"talk\" | \"fight\" | \"move\" | \"wait\" | \"use_item\" | \"custom\",",
      "      \"riskLevel\": \"low\" | \"medium\" | \"high\"",
    "    }",
  "  ],",
  "  \"warnings\": string[]",
  "}",
  "",
  "不要输出 displayPolicy、narrationMeta、references、sourceRefs、action option id、optionOnly、happenedStatus 或 likelyAffectedPaths；这些由本地 compiler 生成或默认为空。",
  "nextActionOptions 必须是 3 到 5 个 option-only future actions；未被选中的选项不得成为已发生事实。",
] as const

export const narrationGeneratorInteractionSpec: RpgInteractionSpec<NarrationGeneratorInput, TurnNarration> = {
  kind: "narration_generator",
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
        sectionId: "narration-generator-system-fixed-prompt",
        title: "系统固定提示词",
        promptRole: "system",
        sourceKind: "fixed_prompt",
        sourceLabel: "narration_generator.systemPrompt",
        contentType: "text",
        content: [
        "你是 llmWikiRPG 的 LLM 5 Narration Generator 交互契约。",
        "这里是纯 runtime 的契约层，不负责 wiki writer/apply/UI/orchestrator 接线。",
        "只返回严格匹配 TurnNarrationDraft 的 JSON。",
        "",
        "只能消费以下 runtime 输入：",
        "- TurnSemanticHandoff",
        "- OutlineAwareNarrationBrief",
        "- optional provisionalNarrationHandoff derived from provisionalOutlinePatch.narrationHandoff",
        "- RecallSelection",
        "- recalledMaterials",
        "- style bundle",
        "- forbidden narration constraints",
        "- player knowledge boundary",
        "- references / runtime refs",
        "",
        "TurnNarrationDraft 必须区分 playerFacingText、parallelLineText、tensionBrief、nextActionOptions 和 warnings；narrationSelfReport 可省略。",
        "playerFacingText 不得泄露 parallelLine-only、hidden、gm_only 或 user_visible_pc_unknown 材料。",
        "parallelLineText 可以展示给真实用户，但 parallel line 的展示不等于 PC 已知。",
        "本地 compiler 会根据 parallelLineText 生成 displayPolicy；展示策略不改变事实层。",
        "tensionBrief 是 runtime / review handoff，不是普通事件事实，也不是玩家叙事正文。",
        "narrationSelfReport 只输出 pacing/time/scene/campaign/reveal 自评；完整 narrationMeta 由本地 compiler 生成。",
        "provisionalOutlinePatch.narrationHandoff 仅作为可选硬约束输入。",
        "不要改写 TurnSemanticHandoff；完整 canonical ActionResolution / WorldTickResult / PostActionWorkingState 只供本地校验，不在 prompt 中展开。",
        "outlineRevisionProposal 不是 Narration 的事实材料。",
        "不要输出 wiki writes、普通 runtime updates、ProposedWikiUpdate、outlineRevisionProposal、provisionalOutlinePatch、完整大纲内容或 outlines/main.md 内容。",
        "Style bundle 只控制叙事质感；style 不会变成世界事实、剧情事实、事件事实或 wiki 事实。",
        "未被选中的 nextActionOptions 只是候选未来行动，不能被标记成已发生事实。",
        "",
        "要求的 TurnNarrationDraft JSON 结构：",
        ...TURN_NARRATION_DRAFT_SCHEMA_PROMPT_LINES,
        ],
      }),
    ]
    const userSections = [
      createRpgPromptDebugSection({
        sectionId: "narration-generator-input-boundary",
        title: "输入边界",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "narration_generator.userPrompt.boundary",
        contentType: "markdown",
        content: [
          "# NarrationGeneratorInput",
          "",
          "使用下方结构化的 runtime handoff。仅返回 TurnNarrationDraft JSON。",
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "narration-generator-turn-semantic-handoff",
        title: "TurnSemanticHandoff",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "turnSemanticHandoff",
        value: turnSemanticHandoff,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "narration-generator-outline-aware-narration-brief",
        title: "OutlineAwareNarrationBrief",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "outlineAwareNarrationBrief",
        value: input.outlineAwareNarrationBrief,
      }),
      createRpgPromptDebugSection({
        sectionId: "narration-generator-provisional-narration-handoff",
        title: "provisionalOutlinePatch.narrationHandoff / provisionalNarrationHandoff",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "provisionalNarrationHandoff",
        contentType: "markdown",
        content: [
          "## provisionalOutlinePatch.narrationHandoff / provisionalNarrationHandoff",
          "这里只是可选硬约束。不要输出 provisionalOutlinePatch。",
          input.provisionalNarrationHandoff ? formatJson(input.provisionalNarrationHandoff) : "未提供。",
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "narration-generator-recall-selection",
        title: "RecallSelection",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "recallSelection",
        value: input.recallSelection,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "narration-generator-recalled-materials",
        title: "recalledMaterials",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "recalledMaterials",
        value: input.recalledMaterials,
      }),
      createRpgPromptDebugSection({
        sectionId: "narration-generator-style-bundle",
        title: "style bundle",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "styleBundle",
        contentType: "markdown",
        content: [
          "## style bundle",
          "Style 只控制文风；style 不会变成世界 / 剧情事实。",
          formatJson(input.styleBundle),
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "narration-generator-forbidden-narration-constraints",
        title: "禁止叙事约束",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "forbiddenNarrationConstraints",
        value: input.forbiddenNarrationConstraints,
      }),
      createRpgPromptDebugSection({
        sectionId: "narration-generator-player-knowledge-boundary",
        title: "玩家知识边界",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "playerKnowledgeBoundary",
        contentType: "markdown",
        content: [
          "## 玩家知识边界",
          "parallel line 的展示不等于 PC 已知。",
          formatJson(input.playerKnowledgeBoundary),
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "narration-generator-references-runtime-refs",
        title: "references / runtime refs",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "references/runtimeRefs",
        value: { references: input.references, runtimeRefs: input.runtimeRefs },
      }),
    ]

    return buildRpgInteractionPromptFromSections({ systemSections, userSections })
  },
  parseOutput(output, input) {
    return parseRpgNarrationGeneratorOutput(output, input)
  },
}

export function buildNarrationGeneratorPrompt(input: NarrationGeneratorInput): RpgNarrationGeneratorPrompt {
  return narrationGeneratorInteractionSpec.buildPrompt(input)
}

export interface ParseRpgNarrationGeneratorOutputOptions {
  onJsonParseReport?: (report: SoftSemanticJsonParseReport) => void
}

export function parseRpgNarrationGeneratorOutput(
  output: string,
  input?: NarrationGeneratorInput,
  options: ParseRpgNarrationGeneratorOutputOptions = {},
): TurnNarration {
  let parsed: unknown
  try {
    const result = parseSoftSemanticJsonOutput(output, { label: "RPG Narration Generator" })
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
    return validateTurnNarration(input ? compileTurnNarrationDraftOutput(parsed, input) : parsed, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Narration Generator 交互收到无效的 TurnNarration：${message}`)
  }
}

function formatJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n")
}
