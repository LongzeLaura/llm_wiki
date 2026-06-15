import type {
  RuntimeUpdateProposalInput,
  RuntimeUpdateProposalResult,
} from "../../rpg-runtime/types"
import { getRpgRuntimeCrossDirectorySyncGuidance } from "../../rpg-wiki-schema"
import type { RpgInteractionSpec } from "../interaction-spec"
import {
  buildRpgInteractionPromptFromSections,
  createJsonRpgPromptDebugSection,
  createRpgPromptDebugSection,
} from "../prompt-debug"
import { compileRuntimeUpdateProposalDraftOutput, parseRuntimeUpdateProposalDraftJson } from "./runtime-update-draft-compiler"

export type BuildRuntimeUpdateInteractionInput = RuntimeUpdateProposalInput

export type RuntimeUpdateInteractionResult = RuntimeUpdateProposalResult

export const RUNTIME_UPDATE_PROPOSAL_DRAFT_SCHEMA_PROMPT_LINES = [
  "只输出一个 RuntimeUpdateProposalDraft JSON 对象，顶层结构如下：",
  "{",
  "  \"proposedWikiUpdates\": [",
  "    {",
  "      \"targetPath\": string,",
  "      \"strategy\": \"overwrite\" | \"append\" | \"merge\",",
  "      \"reason\": string,",
  "      \"content\": string,",
  "      \"runtimeDeltaIds\": string[],",
  "      \"sourceRefs\": [{ \"path\"?: string, \"sectionId\"?: string, \"runtimeDeltaId\"?: string, \"reason\": string }],",
  "      \"happenedStatus\": \"attempted_not_confirmed\" | \"confirmed_happened\" | \"ongoing\" | \"blocked\" | \"failed\" | \"possible_future\" | \"intention_only\" | \"misunderstanding\",",
  "      \"confidence\": \"low\" | \"medium\" | \"high\",",
  "      \"riskNotes\": string[]",
  "    }",
  "  ],",
  "  \"outlineRevisionReviewItems\": [{ \"summary\": string, \"proposedRevisionSummary\": string, \"warnings\": string[] }],",
  "  \"journalEntries\": [],",
  "  \"skippedDeltas\": [{ \"runtimeDeltaId\"?: string, \"sourceRef\"?: { \"path\"?: string, \"sectionId\"?: string, \"runtimeDeltaId\"?: string, \"reason\": string }, \"code\": string, \"reason\": string, \"reviewPolicy\": \"pending_review\" | \"manual_review\" | \"review_only\" }],",
  "  \"pacingUpdateProposal\": null | {",
  "    \"sourceRuntimeDeltaIds\": string[],",
  "    \"nextPacingState\": string,",
  "    \"timeDeltaSummary\": string,",
  "    \"campaignDelta\": string,",
  "    \"pacingDebtChange\": \"decreased\" | \"unchanged\" | \"increased\" | \"scene_cut_needed\",",
  "    \"targetPath\": \"wiki/current-scene/scene_state.md\" | \"wiki/outlines/progress.md\" | \"journal_only\",",
  "    \"reviewPolicy\": \"pending_review\" | \"manual_review\" | \"review_only\"",
  "  },",
  "  \"warnings\": []",
  "}",
] as const

export const runtimeUpdateInteractionSpec: RpgInteractionSpec<
  BuildRuntimeUpdateInteractionInput,
  RuntimeUpdateInteractionResult
> = {
  kind: "runtime_update_proposal",
  buildPrompt(input) {
    const proposalInput = input

    const systemSections = [
      createRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-system-fixed-prompt",
        title: "系统固定提示词",
        promptRole: "system",
        sourceKind: "fixed_prompt",
        sourceLabel: "runtime_update_proposal.systemPrompt",
        contentType: "text",
        content: [
        "你是 llmWikiRPG 在 19 步 runtime 流程中使用的 LLM 6 Runtime Update Proposal Draft 交互。",
        "你的任务是把已经稳定下来的当前回合结构转成轻量 RuntimeUpdateProposalDraft JSON；本地 compiler 会补齐 proposal IDs、sourceDeltas、visibility、knowledge metadata、reveal gates、validation hints 和 proposal groups。",
        "主要事实来源是这些压缩后的结构化当前回合输入：PostActionWorkingState 摘要、ActionResolution delta、WorldTickResult delta、WorldTickVisibleSelection、TurnNarration 审阅摘要、consistencyValidation、recall handoff 和 outline handoff。",
        "generatedNarrative 和 playerFacingText 只是展示/证据材料。它们不是唯一事实来源，也不能覆盖已经稳定的结构化 deltas。",
        "在依赖散文式表述之前，应优先使用压缩结构源里的 actionResolution、worldTickResult、visibleSelection、postActionWorkingState、outlineAwareNarrationBrief、outlineImpactReport、recalledMaterials 和 turnNarration。",
        "outlineImpactReport 和 provisionalOutlinePatch 可以解释当前回合的大纲影响和叙事约束，但它们不授权直接写入 main outline。",
        "outlineRevisionProposal 只能变成独立的 outlineRevisionReviewItems。绝不能混入普通 proposedWikiUpdates，也绝不能自动写入 wiki/outlines/main.md。",
        "parallelLineText 和 user_visible_pc_unknown 材料可以作为用户可见证据，但不会自动赋予 PC 知识，也不能自动更新 wiki/player/known_information.md。",
        "lineTarget 只表示当前回合的 narration lens target：playerVisibleLine 是 PC 当前可见/可推断镜头，parallelLine 是用户可见但 PC 未知镜头，tensionLine 是关系/情绪/伏笔/节奏压力信号。",
        "不要把 lineTarget 当成 outline ownership、三条平等主线或必须同步推进的故事轴；写回仍由 visibility、knowledgeScope、knowledgeClaims、happenedStatus 和 targetPath 决定。",
        "不要输出 sourceDeltas、knowledgeClaims、revealGateRefs、validationHints、proposalGroups、lineTarget、visibility、knowledgeScope、sourceTurnId 或 proposal id；这些由本地 compiler 从 draft 和本阶段 input 派生。",
        "Actor Knowledge 元数据仍是最终 canonical 协议，但不由你手写。",
        "wiki/player/known_information.md 只接受 holder 为 pc 且 beliefState 为 known、inferred 或 misunderstood 的 claim；NPC-only、user-only、GM-only 或 parallelLineText 来源必须跳过或写入对应 runtime overlay / journal。",
        "wiki/characters/runtime/<id>.md 中的 NPC 知识/信念 claim 必须提到匹配的 npc:<id>；wiki/factions/runtime/<id>.md 同理使用 faction:<id>。",
        "relationships/runtime 信息差更新必须在 knowledgeClaims 中表达至少一个 holder/non-holder 分离，或两个 actor 的 beliefState 差异。",
        "plot-arcs/runtime 与 outlines/progress 的 reveal progress 更新需要本地 compiler 可派生 revealGateRefs 和 revealState；如果压缩输入没有明确 reveal metadata，不要提出普通 proposedWikiUpdates，改用 skippedDeltas 记录 review_only。",
        "nextActionOptions 是候选未来行动，不是事实。不要把它们当作已发生事件、当前状态、玩家目标、quests 或剧情进度。",
        "attempted_not_confirmed 不能进入已确认事件。只有 confirmed_happened 的 event deltas 才能指向 wiki/events/*.md。",
        "possible_future、intention_only、foreshadowing、未来计划和候选行动都不能写成已确认事实。",
        "你只能提出更新建议。不要声称任何内容已经写入 wiki。",
        "只输出被允许的 runtime 目标路径以及它们要求的策略。",
        "allowedTargets[].pathPattern 是本地匹配规则，不是可原样输出的 targetPath。",
        "proposedWikiUpdates[].targetPath 必须是具体文件路径，不能包含 *、wildcard、glob 或 pathPattern，例如不能输出 wiki/events/*.md。",
        "stable、manual、base 和 legacy 路径一律禁止。",
        "禁止示例包括 wiki/world/、wiki/style/、wiki/rules/、wiki/sources/、base wiki/characters/*.md、base wiki/locations/*.md、base wiki/factions/*.md、base wiki/items/*.md，以及 legacy 的 entities/concepts/queries/comparisons/synthesis/methodology/findings/thesis 路径。",
        "输出前请自检每一条 proposal：在这一次生成中，路径必须与内容语义匹配。",
        "不要输出任何还需要第二轮 LLM 审查、重试或修复的 proposal。本阶段不会再有第二轮 LLM 校验。",
        "events 更新只能包含已确认发生的事件和即时后果；绝不能混入未来计划、候选行动、未选选项、下一步行动、可能的未来或伏笔。",
        "current-scene 只能是紧凑的最新时刻快照；绝不能包含长期 lore、完整角色卡、事件日志、完整时间线或路线回顾。",
        "跨目录同步契约：",
        "current-scene 只是紧凑的最新时刻快照；长期状态不能只存在于 current-scene。",
        "当完成的回合确认了持续性的 NPC 变化时，还应同时提议 wiki/characters/runtime/*.md。",
        "当完成的回合确认了持续性的地点变化时，还应同时提议 wiki/locations/runtime/*.md。",
        "当完成的回合确认了持续性的势力立场/资源/警戒变化时，还应同时提议 wiki/factions/runtime/*.md。",
        "当完成的回合确认了对象级物品状态时，还应同时提议 wiki/items/runtime/*.md。",
        "当完成的回合确认了关系中的信任/张力/冲突/秘密/误解变化时，还应同时提议 wiki/relationships/runtime/*.md。",
        "当完成的回合改变了 plot arc 的非揭示进度 runtime 状态、触发/跳过/延迟/推进的 beats、压力或解决状态时，还应同时提议 wiki/plot-arcs/runtime/*.md；揭示进度缺少 reveal metadata 时只做 skippedDeltas/review_only。",
        "当完成的回合改变了玩家持有物、数量、装备、失去、获得或消耗情况时，应提议 wiki/player/inventory.md。",
        "当完成的回合改变了相对大纲的游玩进度时，应提议 wiki/outlines/progress.md。",
        "第一版 runtime sync 不会自动补造缺失更新；缺少的配套更新只会成为确定性校验器警告或 review 信号。",
        "relationships/runtime 更新必须记录关系 delta、信任、张力、冲突、秘密、误解和约束；不要重复完整传记、外貌表或能力档案。",
        "player/goals.md 用于 PC 主观动机、愿望、承诺和个人优先级；不要在里面存 quest progress、玩家 TODO/清单、候选行动或剧情压力。",
        "quests 是游戏认可的可追踪目标，具有阻碍/进度与完成/失败条件；不要把任何 goal、主观愿望或玩家 TODO/清单当作 quest。",
        "plot-arcs/runtime 更新用于 runtime 故事压力、未解决冲突、伏笔状态、揭示节奏、推进条件、可能发展和 beat 进度；绝不能把它当成玩家 TODO/清单或 quest 台账。",
        "player/inventory.md 只用于当前持有物、数量、装备/背包状态以及消耗/损坏状态；物品定义和对象级 runtime 状态属于 items/runtime/。",
        "禁止的 runtime 目标包括 base wiki/relationships/*.md、base wiki/plot-arcs/*.md、wiki/outlines/main.md、wiki/style/、wiki/rules/、wiki/sources/、wiki/world/，以及 base wiki/characters/*.md、wiki/locations/*.md、wiki/factions/*.md、wiki/items/*.md。",
        "runtime overlay 更新只能保存已接受的 runtime 状态；不要把候选行动、稳定设定页、全局 style 规则或控制规则塞进去。",
        "Narration 负责玩家可见故事和未来行动选项；本交互只负责 runtime update proposal 的审阅材料。",
        "在这个 proposal 步骤之后，pending、apply 和 write policy 仍然是确定性的安全边界。",
        "所有普通 proposedWikiUpdates draft 只包含 targetPath、strategy、reason、content、runtimeDeltaIds、sourceRefs、happenedStatus、confidence、riskNotes。",
        "唯一可接受的输出契约是结构化 JSON。",
        "",
        "代码可读的 runtime 跨目录同步指引：",
        formatRuntimeSyncGuidance(),
        "",
        ...RUNTIME_UPDATE_PROPOSAL_DRAFT_SCHEMA_PROMPT_LINES,
        "",
        "如果不存在安全的普通更新，请返回 proposedWikiUpdates: []。不要返回空文本或非 JSON。",
        ],
      }),
    ]
    const userSections = [
      createRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-input-boundary",
        title: "输入边界",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "runtime_update_proposal.userPrompt.boundary",
        contentType: "markdown",
        content: [
          "# Runtime Update Proposal 输入",
          "",
          "以下方结构化的当前回合来源作为事实边界。散文式字段只是证据和展示材料。",
        ],
      }),
      createRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-submitted-action",
        title: "已提交行动",
        promptRole: "user",
        sourceKind: "player_input",
        sourceLabel: "turnRecord.submittedAction",
        contentType: "markdown",
        content: ["## 已提交行动", formatSubmittedAction(proposalInput)],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-structured-current-turn-sources",
        title: "结构化当前回合来源",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "结构化当前回合来源",
        fenced: false,
        value: buildRuntimeUpdatePromptSources(proposalInput),
      }),
      createRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-display-evidence-text",
        title: "展示 / 证据文本",
        promptRole: "user",
        sourceKind: "runtime_handoff",
        sourceLabel: "turnRecord/generatedNarrative/turnNarration",
        contentType: "markdown",
        content: [
          "## 展示 / 证据文本",
          "generatedNarrative：",
          formatText(proposalInput.turnRecord.generatedNarrative),
          "",
          "playerFacingText：",
          formatText(proposalInput.turnNarration?.playerFacingText ?? ""),
          "",
          "parallelLineText：",
          formatText(proposalInput.turnNarration?.parallelLineText ?? ""),
        ],
      }),
      createRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-references",
        title: "引用",
        promptRole: "user",
        sourceKind: "wiki_file",
        sourceLabel: "turnRecord.references",
        contentType: "markdown",
        content: ["## 引用", formatList(proposalInput.turnRecord.references)],
      }),
      createRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-allowed-runtime-update-target-rules",
        title: "允许的 Runtime 更新目标规则",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "allowedTargets",
        contentType: "markdown",
        content: ["## 允许的 Runtime 更新目标规则", formatAllowedTargets(proposalInput.allowedTargets)],
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-write-policy",
        title: "写入策略",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "writePolicy",
        fenced: false,
        value: proposalInput.writePolicy,
      }),
      createJsonRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-review-policy",
        title: "审阅策略",
        promptRole: "user",
        sourceKind: "fixed_prompt",
        sourceLabel: "reviewPolicy",
        fenced: false,
        value: proposalInput.reviewPolicy,
      }),
      createRpgPromptDebugSection({
        sectionId: "runtime-update-proposal-local-validation-boundary",
        title: "本地校验边界",
        promptRole: "user",
        sourceKind: "validation",
        sourceLabel: "local validation boundary",
        contentType: "markdown",
        content: [
          "## 本地校验边界",
          "这个阶段只负责解析 JSON 并执行结构/边界检查。",
          "不要暂存 pending updates，不要应用更新，不要写 wiki 文件，也不要修改 writer/apply/UI 行为。",
        ],
      }),
    ]

    return buildRpgInteractionPromptFromSections({ systemSections, userSections })
  },
  parseOutput(output, input) {
    const proposalInput = input
    return compileRuntimeUpdateProposalDraftOutput(parseRuntimeUpdateProposalDraftJson(output), proposalInput)
  },
}

function buildRuntimeUpdatePromptSources(input: RuntimeUpdateProposalInput): unknown {
  return {
    postActionWorkingState: {
      submittedActionId: input.postActionWorkingState.submittedAction.id,
      campaignDelta: input.postActionWorkingState.campaignDelta,
      timeState: input.postActionWorkingState.timeState,
      pacingState: compactValue(input.postActionWorkingState.pacingState),
      gapState: compactValue(input.postActionWorkingState.gapState),
      runtimeDeltaRefs: compactRuntimeDeltaRefs(input.postActionWorkingState.runtimeDeltaRefs),
      references: input.postActionWorkingState.references.slice(0, 20),
      warnings: input.postActionWorkingState.warnings.slice(0, 12),
    },
    actionResolution: {
      resolutionId: input.actionResolution.resolutionId,
      parsedIntent: input.actionResolution.parsedIntent,
      eventDraft: compactValue(input.actionResolution.eventDraft),
      feasibility: compactValue(input.actionResolution.feasibility),
      costs: compactValue(input.actionResolution.costs),
      obstacles: compactValue(input.actionResolution.obstacles),
      directResults: input.actionResolution.directResults.map((result) => ({
        resultId: result.resultId,
        summary: result.summary,
        happenedStatus: result.happenedStatus,
        visibilityScope: result.visibilityScope,
        affectedRefs: result.affectedRefs,
      })),
      timeDelta: input.actionResolution.timeDelta,
      progressPotential: input.actionResolution.progressPotential,
      playerActionDelta: compactValue(input.actionResolution.playerActionDelta),
      runtimeDeltaRefs: compactRuntimeDeltaRefs(input.actionResolution.runtimeDeltaRefs),
      referencePaths: input.actionResolution.references.map((reference) => reference.path).slice(0, 20),
      warnings: input.actionResolution.warnings.map((warning) => warning.message).slice(0, 12),
    },
    worldTickResult: {
      tickId: input.worldTickResult.tickId,
      timeAdvance: input.worldTickResult.timeAdvance,
      worldDeltas: Object.fromEntries(
        Object.entries(input.worldTickResult.worldDeltas).map(([line, deltas]) => [
          line,
          deltas.map((delta) => ({
            deltaId: delta.deltaId,
            summary: delta.summary,
            narrativeLine: delta.narrativeLine,
            visibilityScope: delta.visibility.visibilityScope,
            knowledgeScope: delta.visibility.knowledgeScope,
            happenedStatus: delta.happenedStatus,
            affectedPaths: delta.affectedPaths,
            runtimeDeltaRefs: compactRuntimeDeltaRefs(delta.runtimeDeltaRefs),
          })),
        ]),
      ),
      clockUpdates: compactValue(input.worldTickResult.clockUpdates),
      settledOngoingEvents: compactValue(input.worldTickResult.settledOngoingEvents),
      informationBroadcast: compactValue(input.worldTickResult.informationBroadcast),
      reactionQueue: compactValue(input.worldTickResult.reactionQueue),
      pacingUpdate: compactValue(input.worldTickResult.pacingUpdate),
      gapState: compactValue(input.worldTickResult.gapState),
      references: input.worldTickResult.references.map((reference) => reference.path).slice(0, 20),
      warnings: input.worldTickResult.warnings.map((warning) => warning.message).slice(0, 12),
    },
    visibleSelection: input.visibleSelection,
    recallSelection: {
      selectionId: input.recallSelection.selectionId,
      sourceWorkingStateId: input.recallSelection.sourceWorkingStateId,
      selectedItems: input.recallSelection.selectedItems.map((item) => ({
        path: item.path,
        lineTarget: item.lineTarget,
        readMode: item.readMode,
        priority: item.priority,
        reason: item.reason,
        expectedUse: item.expectedUse,
        visibilityScope: item.visibilityScope,
        knowledgeScope: item.knowledgeScope,
        sectionIds: item.sections.map((section) => section.sectionId),
      })),
      exclusions: input.recallSelection.exclusions.slice(0, 12).map((exclusion) => ({
        path: exclusion.path,
        sectionIds: exclusion.sectionIds,
        reason: exclusion.reason,
      })),
      budget: input.recallSelection.recallBudget,
      warnings: input.recallSelection.warnings.slice(0, 12),
    },
    recalledMaterials: input.recalledMaterials.slice(0, 12).map((material) => ({
      path: material.path,
      lineTarget: material.lineTarget,
      readMode: material.readMode,
      priority: material.priority,
      reason: material.reason,
      expectedUse: material.expectedUse,
      visibilityScope: material.visibilityScope,
      knowledgeScope: material.knowledgeScope,
      knowledgeClaims: compactKnowledgeClaims(material.knowledgeClaims),
      outlineControl: compactValue(material.outlineControl),
      sections: material.sections.slice(0, 8).map((section) => ({
        sectionId: section.sectionId,
        readMode: section.readMode,
        priority: section.priority,
        reason: section.reason,
        expectedUse: section.expectedUse,
        contentExcerpt: truncateText(section.content, 360),
        warningCount: section.warnings.length,
      })),
      warnings: material.warnings.slice(0, 8),
    })),
    outlineAwareNarrationBrief: {
      briefId: input.outlineAwareNarrationBrief.briefId,
      sourceWorkingStateId: input.outlineAwareNarrationBrief.sourceWorkingStateId,
      playerFacingBrief: compactValue(input.outlineAwareNarrationBrief.playerFacingBrief),
      parallelLineBrief: compactValue(input.outlineAwareNarrationBrief.parallelLineBrief),
      tensionBriefInput: compactValue(input.outlineAwareNarrationBrief.tensionBriefInput),
      revealPolicies: compactValue(input.outlineAwareNarrationBrief.revealPolicies),
      forbiddenNarrationBoundary: compactValue(input.outlineAwareNarrationBrief.forbiddenNarrationBoundary),
      pacingDirective: compactValue(input.outlineAwareNarrationBrief.pacingDirective),
      campaignDeltaRequirement: compactValue(input.outlineAwareNarrationBrief.campaignDeltaRequirement),
      references: input.outlineAwareNarrationBrief.references.slice(0, 20).map((reference) => ({
        path: reference.path,
        sectionId: reference.sectionId,
        runtimeDeltaId: reference.runtimeDeltaId,
        lineTarget: reference.lineTarget,
        usePurpose: reference.usePurpose,
        visibilityScope: reference.visibilityScope,
        knowledgeScope: reference.knowledgeScope,
        knowledgeClaims: compactKnowledgeClaims(reference.knowledgeClaims),
        reason: reference.reason,
      })),
    },
    outlineImpactReport: input.outlineImpactReport,
    provisionalOutlinePatch: compactValue(input.provisionalOutlinePatch),
    outlineRevisionProposal: compactValue(input.outlineRevisionProposal),
    turnNarration: input.turnNarration
      ? {
          playerFacingText: input.turnNarration.playerFacingText,
          parallelLineText: input.turnNarration.parallelLineText,
          tensionBrief: {
            summary: input.turnNarration.tensionBrief.summary,
            pressureSignals: input.turnNarration.tensionBrief.pressureSignals,
            relationshipSignals: input.turnNarration.tensionBrief.relationshipSignals,
            plotArcSignals: input.turnNarration.tensionBrief.plotArcSignals,
            reviewHandoff: input.turnNarration.tensionBrief.reviewHandoff,
            references: input.turnNarration.tensionBrief.references.slice(0, 12).map((reference) => ({
              path: reference.path,
              sectionId: reference.sectionId,
              runtimeDeltaId: reference.runtimeDeltaId,
              lineTarget: reference.lineTarget,
              usePurpose: reference.usePurpose,
              visibilityScope: reference.visibilityScope,
              knowledgeScope: reference.knowledgeScope,
              knowledgeClaims: compactKnowledgeClaims(reference.knowledgeClaims),
              reason: reference.reason,
            })),
          },
          displayPolicy: input.turnNarration.displayPolicy,
          narrationMeta: input.turnNarration.narrationMeta,
          nextActionOptionCount: input.turnNarration.nextActionOptions.length,
          references: input.turnNarration.references.slice(0, 20).map((reference) => ({
            path: reference.path,
            sectionId: reference.sectionId,
            runtimeDeltaId: reference.runtimeDeltaId,
            lineTarget: reference.lineTarget,
            usePurpose: reference.usePurpose,
            visibilityScope: reference.visibilityScope,
            knowledgeScope: reference.knowledgeScope,
            knowledgeClaims: compactKnowledgeClaims(reference.knowledgeClaims),
            reason: reference.reason,
          })),
          warnings: input.turnNarration.warnings.slice(0, 12),
        }
      : undefined,
    consistencyValidation: input.consistencyValidation,
  }
}

function compactRuntimeDeltaRefs(refs: RuntimeUpdateProposalInput["postActionWorkingState"]["runtimeDeltaRefs"], max = 24) {
  return refs.slice(0, max).map((ref) => ({
    deltaId: ref.deltaId,
    sourceStage: ref.sourceStage,
    sourcePath: ref.sourcePath,
    summary: ref.summary,
    narrativeLine: ref.narrativeLine,
    usePurpose: ref.usePurpose,
    happenedStatus: ref.happenedStatus,
  }))
}

function compactKnowledgeClaims(
  claims: RuntimeUpdateProposalInput["recalledMaterials"][number]["knowledgeClaims"] | undefined,
  max = 8,
) {
  return (claims ?? []).slice(0, max).map((claim) => ({
    claimId: claim.claimId,
    summary: claim.summary,
    truthStatus: claim.truthStatus,
    holders: claim.holders,
    nonHolders: claim.nonHolders,
    beliefStateByActor: claim.beliefStateByActor.map((entry) => ({
      actor: entry.actor,
      beliefState: entry.beliefState,
    })),
    sourcePath: claim.sourcePath,
  }))
}

function compactValue(value: unknown, depth = 4): unknown {
  if (value === undefined || value === null) return value
  if (typeof value === "string") return truncateText(value, 420)
  if (typeof value !== "object") return value
  if (depth <= 0) return "[truncated]"
  if (Array.isArray(value)) {
    const items = value.slice(0, 10).map((entry) => compactValue(entry, depth - 1))
    return value.length > 10 ? [...items, `[${value.length - 10} more omitted]`] : items
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, compactValue(entry, depth - 1)]),
  )
}

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength)}...[truncated ${trimmed.length - maxLength} chars]`
}

function formatSubmittedAction(input: RuntimeUpdateProposalInput): string {
  const action = input.turnRecord.submittedAction
  const lines = [`id: ${formatInline(action.id)}`, `text: ${formatInline(action.text)}`, `source: ${action.source}`]
  if (action.selectedOptionId) {
    lines.push(`selectedOptionId: ${formatInline(action.selectedOptionId)}`)
  }
  return lines.join("\n")
}

function formatAllowedTargets(allowedTargets: readonly RuntimeUpdateProposalInput["allowedTargets"][number][]): string {
  if (allowedTargets.length === 0) return "- 无。不要输出 update blocks。"
  return allowedTargets
    .map((rule) => `- ${rule.pathPattern} | strategy: ${rule.strategy} | ${rule.description}`)
    .join("\n")
}

function formatRuntimeSyncGuidance(): string {
  return getRpgRuntimeCrossDirectorySyncGuidance()
    .map((entry) => {
      const targets = entry.requiredTargets.join(", ")
      const guidance = entry.guidance.map((line) => `  - ${line}`).join("\n")
      return `- ${entry.syncId}: ${entry.trigger} Required targets: ${targets}.\n${guidance}`
    })
    .join("\n")
}

function formatText(value: string): string {
  return value.trim() || "未提供。"
}

function formatList(values: readonly string[]): string {
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  if (cleaned.length === 0) return "- 未提供。"
  return cleaned.map((value) => `- ${value}`).join("\n")
}

function formatInline(value: string): string {
  return JSON.stringify(value)
}
