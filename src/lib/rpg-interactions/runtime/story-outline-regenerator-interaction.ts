import type {
  StoryOutlineRegeneratorInput,
  StoryOutlineRegeneratorOutput,
} from "../../rpg-runtime/types"
import { buildTurnSemanticHandoffFromCanonical } from "../../rpg-runtime/turn-semantic-handoff"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import {
  buildRpgInteractionPromptFromSections,
  createJsonRpgPromptDebugSection,
  createRpgPromptDebugSection,
} from "../prompt-debug"
import {
  parseSoftSemanticJsonOutput,
  type SoftSemanticJsonParseReport,
} from "./soft-semantic-json"
import { compileStoryOutlineRegeneratorDraftOutput } from "./story-outline-regenerator-validation"

export type RpgStoryOutlineRegeneratorPrompt = RpgInteractionPrompt

export const STORY_OUTLINE_REGENERATOR_DRAFT_SCHEMA_PROMPT_LINES = [
  "{",
  "  \"provisionalOutlinePatch\": {",
  "    \"affectedOutlineRefs\": (stableId string or { \"stableId\": string })[],",
  "    \"suspendedBeatRefs\": (stableId string or { \"stableId\": string })[],",
  "    \"invalidatedBeatRefs\": (stableId string or { \"stableId\": string })[],",
  "    \"preservedConfirmedFacts\": string[],",
  "    \"narrativeLines\": (\"playerVisibleLine\" | \"parallelLine\" | \"tensionLine\")[],",
  "    \"narrationHandoff\": {",
  "      \"mustFollow\": string[],",
  "      \"mustPreserveFacts\": string[],",
  "      \"mustNotReveal\": string[],",
  "      \"invalidatedOldBeats\": string[],",
  "      \"nextSceneDirection\": string,",
  "      \"outlineRefs\": (stableId string or { \"stableId\": string })[]",
  "    }",
  "  },",
  "  \"outlineRevisionProposal\": {",
  "    \"targetOutlineRefs\": (stableId string or { \"stableId\": string })[],",
  "    \"invalidatedAssumptions\": string[],",
  "    \"mustPreserveFacts\": string[],",
  "    \"proposedRevision\": {",
  "      \"summary\": string,",
  "      \"revisedBeats\": string[],",
  "      \"revisedRevealOrder\": string[],",
  "      \"branchAdjustments\": string[]",
  "    }",
  "  },",
  "  \"regenerationSafetyReport\": {",
  "    \"safetyConclusion\": \"safe\",",
  "    \"checkedRuntimeRefs\": string[],",
  "    \"checkedOutlineRefs\": string[],",
  "    \"warnings\": string[]",
  "  },",
  "  \"warnings\": string[]",
  "}",
  "",
  "不要输出 patchId、handoffId、proposalId、sourceRequestId、reviewBoundary、nonPersistenceBoundary、runtimeDeltaRefs、完整 visibilityBoundary 或完整 OutlineStableRef envelope；这些由本地 compiler 从输入 refs 生成。",
] as const

export const storyOutlineRegeneratorInteractionSpec: RpgInteractionSpec<
  StoryOutlineRegeneratorInput,
  StoryOutlineRegeneratorOutput
> = {
  kind: "outline_regeneration",
  buildPrompt(input) {
    const turnSemanticHandoff = input.turnSemanticHandoff ?? buildTurnSemanticHandoffFromCanonical({
      submittedAction: input.postActionWorkingState.submittedAction,
      actionResolution: input.postActionWorkingState.actionResolution,
      worldTickResult: input.postActionWorkingState.worldTickResult,
      visibleSelection: input.postActionWorkingState.visibleSelection,
      postActionWorkingState: input.postActionWorkingState,
    })
    const systemSections = [
      createRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-system-fixed-prompt",
        title: "系统固定提示词",
        promptRole: "system",
        sourceKind: "fixed_prompt",
        sourceLabel: "outline_regeneration.systemPrompt",
        contentType: "text",
        content: [
        "你是 llmWikiRPG 在条件性 Step 14.5 使用的 Story Outline Regenerator。",
        "只有在 Outline-aware Brief Compiler 报告 impactLevel 为 major_rewrite_required 且 requiresRegeneration 为 true 时你才会运行。",
        "你的输入是 runtime/review handoff：OutlineImpactReport、RegenerationRequest、post-action working state、recalled outline slices、plot-arc tension fuel、runtime refs、confirmed fact boundaries 和 forbidden reveal boundaries。",
        "你的输出不是已接受的 wiki 事实状态。",
        "provisionalOutlinePatch 只在当前回合同步使用。它不会写入 wiki/，不会修改 wiki/outlines/main.md，也不表示 wiki/outlines/main.md 已经变更。",
        "provisionalOutlinePatch.narrationHandoff 是给后续 Step 15 Narration 的硬约束，但你不能在这里生成叙事。",
        "outlineRevisionProposal 是一个独立的 pending/review 项，reviewItemKind 为 outlineRevision。",
        "outlineRevisionProposal 不是 ProposedWikiUpdate，不是 runtimeWikiUpdate，不是普通 runtime update，也不能混进普通 runtime update。",
        "不要输出面向玩家的 prose、narration、visible narration、parallel-line prose 或 nextActionOptions。",
        "不要输出 wikiWrites、wikiWriteProposal、proposedUpdates、pendingUpdates、runtimeUpdate、runtimeWikiUpdate 或直接写入目标路径。",
        "不要直接修改 wiki/outlines/main.md，也不要声称它已经被修改。",
        "不要把未来计划、拟议 beat 或可能的修订写入 wiki/events/，也不要把它们标记为 confirmed_happened。",
        "不要重写输入边界中已确认的事实。",
        "不要把 forbidden reveal、hidden、gm_only、parallelLine-only 或 user_visible_pc_unknown 材料泄露为 PC 已知。",
        "所有 refs 都必须来自结构化输入：runtimeDeltaRefs、outline refs、recalled materials、visibility boundaries、hard constraints 或 knownReferences。",
        "所有 outline refs、visibility boundaries、runtime refs、safety checked refs 中的 path/id 必须来自结构化输入。",
        "禁止在 path/sourcePath 中使用 wildcard/glob/category/pathPattern，例如 wiki/sources/*.md；也继续禁止直接写 wiki/outlines/main.md 或 wiki/events/*。",
        "仅返回严格 JSON。",
        "",
        "允许的顶层 StoryOutlineRegeneratorDraft JSON 结构：",
        ...STORY_OUTLINE_REGENERATOR_DRAFT_SCHEMA_PROMPT_LINES,
        ],
      }),
    ]
    const userSections = [
      createRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-input-boundary",
        title: "输入边界",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "outline_regeneration.userPrompt.boundary",
        contentType: "markdown",
        content: [
          "# Story Outline Regenerator 输入",
          "",
          "仅使用这个结构化输入。不要检查文件系统。",
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-outline-impact-report",
        title: "OutlineImpactReport",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "outlineImpactReport",
        value: input.outlineImpactReport,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-regeneration-request",
        title: "RegenerationRequest",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "regenerationRequest",
        value: input.regenerationRequest,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-turn-semantic-handoff",
        title: "TurnSemanticHandoff",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "turnSemanticHandoff",
        value: turnSemanticHandoff,
      }),
      createRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-recalled-materials",
        title: "RecalledMaterials",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "recalledMaterials",
        contentType: "markdown",
        content: [
          "## RecalledMaterials",
          "这些是经过过滤的确定性 handoff 材料，不代表你可以读取或重写完整大纲文件。",
          formatJson(input.recalledMaterials),
        ],
      }),
      createRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-outline-slices",
        title: "大纲切片",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "outlineSlices",
        contentType: "markdown",
        content: [
          "## 大纲切片",
          "只能使用这里出现的稳定 beat/reveal/branch ids。不要把 wiki/outlines/main.md 当作直接修改目标。",
          formatJson(input.outlineSlices.slice(0, 8)),
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-plot-arc-tension-fuel",
        title: "Plot-arc 张力燃料",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "plotArcTensionFuel",
        value: input.plotArcTensionFuel.slice(0, 8),
      }),
      createRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-visibility-boundaries",
        title: "可见性边界",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "visibilityBoundaries",
        contentType: "markdown",
        content: [
          "## 可见性边界",
          "Hidden、gm_only、parallelLine-only 和 user_visible_pc_unknown 材料不得变成 PC 已知。",
          formatJson(input.visibilityBoundaries),
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-hard-constraints",
        title: "硬约束",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "hardConstraints",
        value: input.hardConstraints.slice(0, 8),
      }),
      createRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-confirmed-fact-boundaries",
        title: "已确认事实边界",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "confirmedFacts",
        contentType: "markdown",
        content: [
          "## 已确认事实边界",
          "每一条已确认事实都必须保留，不能被判无效、改写，或挪进只属于未来修订的文本里。",
          formatJson(input.confirmedFacts),
        ],
      }),
      createRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-forbidden-reveal-boundaries",
        title: "禁止揭示边界",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "forbiddenReveals",
        contentType: "markdown",
        content: [
          "## 禁止揭示边界",
          "被禁止的 reveal 只能出现在 mustNotReveal 或 safety refs 之类的保护字段中。",
          formatJson(input.forbiddenReveals),
        ],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-runtime-refs",
        title: "Runtime 引用",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "runtimeRefs",
        value: input.runtimeRefs.slice(0, 20),
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-known-references",
        title: "已知引用",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "knownReferences",
        value: input.knownReferences.slice(0, 20),
      }),
      createRpgPromptDebugSection({
        sectionId: "story-outline-regenerator-return-contract",
        title: "返回契约",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "仅返回 StoryOutlineRegeneratorDraft JSON",
        contentType: "text",
        content: "仅返回 StoryOutlineRegeneratorDraft JSON。",
      }),
    ]

    return buildRpgInteractionPromptFromSections({ systemSections, userSections })
  },
  parseOutput(output, input) {
    return parseRpgStoryOutlineRegeneratorOutput(output, input)
  },
}

export function buildStoryOutlineRegeneratorPrompt(
  input: StoryOutlineRegeneratorInput,
): RpgStoryOutlineRegeneratorPrompt {
  return storyOutlineRegeneratorInteractionSpec.buildPrompt(input)
}

export interface ParseRpgStoryOutlineRegeneratorOutputOptions {
  onJsonParseReport?: (report: SoftSemanticJsonParseReport) => void
}

export function parseRpgStoryOutlineRegeneratorOutput(
  output: string,
  input: StoryOutlineRegeneratorInput,
  options: ParseRpgStoryOutlineRegeneratorOutputOptions = {},
): StoryOutlineRegeneratorOutput {
  let parsed: unknown
  try {
    const result = parseSoftSemanticJsonOutput(output, { label: "RPG Story Outline Regenerator" })
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
    return compileStoryOutlineRegeneratorDraftOutput(parsed, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Story Outline Regenerator 交互收到无效输出：${message}`)
  }
}

function formatJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n")
}
