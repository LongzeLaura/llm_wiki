import { describe, expect, it, vi } from "vitest"
import { streamChat } from "./llm-client"
import {
  createFixtureRuntimeUpdateProposalAdapter,
  createLlmRpgRuntimeUpdateProposalAdapter,
  getRpgInteractionRegistryEntry,
  listImplementedRpgInteractionKinds,
  parseAndValidateRuntimeUpdateProposalResult,
  runtimeUpdateInteractionSpec,
  validateRuntimeUpdateProposalResult,
} from "./rpg-interactions"
import {
  buildRuntimeUpdateProposalInputFromTurnRecord,
  buildOutlineBriefCompilerInputFromTurnState,
  createPendingRpgUpdates,
  defaultKnowledgeClaimsForPath,
} from "./rpg-runtime"
import type { RecalledMaterial, RuntimeUpdateProposalResult, SubmittedAction } from "./rpg-runtime"
import {
  sampleTurnNarration,
  sampleTurnRecordRuntimeParts,
} from "./rpg-runtime-test-fixtures"
import type { RpgTurnRecord } from "./rpg-runtime/turn-model"

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(),
}))

const streamChatMock = vi.mocked(streamChat)

describe("LLM 6 Runtime Update Proposal contract", () => {
  it("builds a prompt around structured fact sources and JSON result boundaries", () => {
    const prompt = runtimeUpdateInteractionSpec.buildPrompt(buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord()))
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(runtimeUpdateInteractionSpec.kind).toBe("runtime_update_proposal")
    expect(combined).toContain("RuntimeUpdateProposalDraft JSON")
    expect(combined).toContain("PostActionWorkingState")
    expect(combined).toContain("ActionResolution")
    expect(combined).toContain("WorldTickResult")
    expect(combined).toContain("TurnNarration")
    expect(combined).toContain("consistencyValidation")
    expect(combined).toContain("generatedNarrative 和 playerFacingText 只是展示/证据材料")
    expect(combined).not.toContain("The factual source is strictly submittedAction + generatedNarrative + references")
    expect(combined).toContain("parallelLineText 和 user_visible_pc_unknown 材料")
    expect(combined).toContain("nextActionOptions 是候选未来行动")
    expect(combined).toContain("attempted_not_confirmed 不能进入已确认事件")
    expect(combined).toContain("outlineRevisionProposal 只能变成独立的 outlineRevisionReviewItems")
    expect(combined).toContain("pathPattern 是本地匹配规则")
    expect(combined).toContain("targetPath 必须是具体文件路径")
    expect(combined).toContain("wiki/events/*.md")
    expect(combined).toContain("targetPath、strategy、reason、content、runtimeDeltaIds")
    expect(combined).toContain("lineTarget 只表示当前回合的 narration lens target")
    expect(combined).toContain("playerVisibleLine 是 PC 当前可见/可推断镜头")
    expect(combined).toContain("parallelLine 是用户可见但 PC 未知镜头")
    expect(combined).toContain("tensionLine 是关系/情绪/伏笔/节奏压力信号")
    expect(combined).toContain("不要把 lineTarget 当成 outline ownership")
    expect(combined).toContain("三条平等主线")
    expect(combined).toContain("必须同步推进的故事轴")
    expect(combined).toContain("不要输出 sourceDeltas")
    expect(combined).toContain("Actor Knowledge 元数据仍是最终 canonical 协议")
    expect(combined).toContain("唯一可接受的输出契约是结构化 JSON")
    expect(combined).toContain("如果压缩输入没有明确 reveal metadata")
    expect(combined).toContain("skippedDeltas 记录 review_only")
    expect(combined).toContain('"pacingUpdateProposal": null | {')
    expect(combined).toContain('"nextPacingState": string')
    expect(combined).toContain('"pacingDebtChange": "decreased" | "unchanged" | "increased" | "scene_cut_needed"')
    expect(combined).toContain('"sourceRef"?: { "path"?: string, "sectionId"?: string, "runtimeDeltaId"?: string, "reason": string }')
    expect(combined).not.toContain("fenced ```rpg-wiki-update blocks may still be parsed")
    expect(prompt.debugSections?.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "系统固定提示词",
        "已提交行动",
        "结构化当前回合来源",
        "展示 / 证据文本",
        "引用",
        "允许的 Runtime 更新目标规则",
        "写入策略",
        "审阅策略",
        "本地校验边界",
      ]),
    )
    expectPromptDebugSectionsRecompose(prompt)
  })

  it("uses compact prompt sources for the final update proposal step", () => {
    const prompt = runtimeUpdateInteractionSpec.buildPrompt(buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord()))
    const structuredSection = prompt.debugSections?.find((section) =>
      section.sectionId === "runtime-update-proposal-structured-current-turn-sources"
    )
    expect(structuredSection).toBeDefined()

    const promptSources = JSON.parse(structuredSection!.content.replace(/^## 结构化当前回合来源\r?\n/u, ""))
    const serializedSources = JSON.stringify(promptSources)

    expect(structuredSection!.content.length).toBeLessThan(65000)
    expect(promptSources.postActionWorkingState.actionResolution).toBeUndefined()
    expect(promptSources.postActionWorkingState.worldTickResult).toBeUndefined()
    expect(promptSources.postActionWorkingState.visibleSelection).toBeUndefined()
    expect(promptSources.turnNarration.nextActionOptions).toBeUndefined()
    expect(promptSources.turnNarration.nextActionOptionCount).toBeGreaterThan(0)
    expect(serializedSources).not.toContain("\"content\":")
  })

  it("parses and compiles bare JSON RuntimeUpdateProposalDraft output", () => {
    const turnRecord = sampleTurnRecord()
    const result = runtimeUpdateInteractionSpec.parseOutput(
      JSON.stringify(sampleProposalDraft()),
      buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord),
    )

    expect(result.proposedWikiUpdates).toHaveLength(1)
    expect(result.proposedWikiUpdates[0]).toMatchObject({
      targetPath: "wiki/current-scene/scene_state.md",
      strategy: "overwrite",
      lineTarget: "playerVisibleLine",
      visibility: "pc_visible",
      knowledgeScope: "pc_known",
      happenedStatus: "ongoing",
      confidence: "high",
    })
    expect(result.pacingUpdateProposal).toBeNull()
  })

  it("supports fenced JSON without making markdown update blocks the primary contract", () => {
    const turnRecord = sampleTurnRecord()
    const parsed = parseAndValidateRuntimeUpdateProposalResult(
      ["```json", JSON.stringify(sampleProposalResult(turnRecord)), "```"].join("\n"),
      buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord),
    )

    expect(parsed.proposedWikiUpdates[0].sourceDeltas[0].sourceStage).toBe("postActionWorkingState")
  })

  it("rejects old rpg-wiki-update blocks instead of parsing compatibility fallback", () => {
    const turnRecord = sampleTurnRecord()
    expect(() =>
      runtimeUpdateInteractionSpec.parseOutput(
        [
          "```rpg-wiki-update",
          "targetPath: wiki/events/example.md",
          "strategy: append",
          "reason: Record the completed ward inspection.",
          "---",
          "# Ward Inspection",
          "",
          "Rin confirmed the sigil behaves like a ward.",
          "```",
        ].join("\n"),
        buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord),
      ),
    ).toThrow(/RuntimeUpdateProposalDraft.*JSON/)
  })

  it("rejects empty runtime update proposal output", () => {
    expect(() =>
      runtimeUpdateInteractionSpec.parseOutput("", buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord())),
    ).toThrow(/RuntimeUpdateProposalDraft.*JSON/)
  })

  it("rejects old proposedUpdates alias as the JSON result protocol", () => {
    expect(() =>
      parseAndValidateRuntimeUpdateProposalResult(
        JSON.stringify({ ...sampleProposalResult(sampleTurnRecord()), proposedWikiUpdates: undefined, proposedUpdates: [] }),
      ),
    ).toThrow(/proposedWikiUpdates/)
    expect(() =>
      parseAndValidateRuntimeUpdateProposalResult(
        JSON.stringify({ ...sampleProposalResult(sampleTurnRecord()), proposedUpdates: [] }),
      ),
    ).toThrow(/proposedWikiUpdates/)
  })

  it("rejects ordinary updates without sourceDeltas", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      sourceDeltas: [],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/sourceDeltas/)
  })

  it("rejects attempted_not_confirmed as confirmed event material", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/events/attempt.md",
      strategy: "append",
      happenedStatus: "attempted_not_confirmed",
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/events updates require confirmed_happened/)
  })

  it("rejects event updates sourced from non-confirmed sourceDeltas", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/events/attempt.md",
      strategy: "append",
      happenedStatus: "confirmed_happened",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          affectedPaths: ["wiki/events/attempt.md"],
          happenedStatus: "attempted_not_confirmed",
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/confirmed_happened sourceDeltas/)
  })

  it("rejects wildcard pathPatterns used as concrete targetPath", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/events/*.md",
      strategy: "append",
      happenedStatus: "confirmed_happened",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          affectedPaths: ["wiki/events/scene-001.md"],
          happenedStatus: "confirmed_happened",
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/wildcard|pathPattern|concrete/i)
  })

  it("accepts concrete event target paths", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/events/scene-001.md",
      strategy: "append",
      visibility: "gm_only",
      knowledgeScope: "gm_only",
      happenedStatus: "confirmed_happened",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          affectedPaths: ["wiki/events/scene-001.md"],
          visibility: "gm_only",
          knowledgeScope: "gm_only",
          happenedStatus: "confirmed_happened",
          knowledgeClaims: [gmKnowledgeClaim("claim-event-scene-001", "GM tracks the confirmed scene event.", "wiki/events/scene-001.md")],
        },
      ],
    }

    expect(validateRuntimeUpdateProposalResult(result).proposedWikiUpdates[0].targetPath).toBe(
      "wiki/events/scene-001.md",
    )
  })

  it("rejects parallel-line user-visible material as automatic PC knowledge", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/player/known_information.md",
      strategy: "merge",
      visibility: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/player known information/)
  })

  it("rejects player known information sourced from parallelLineText or PC-unknown sourceDeltas", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/player/known_information.md",
      strategy: "merge",
      visibility: "pc_visible",
      knowledgeScope: "pc_known",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          sourceStage: "turnNarration",
          sourceField: "parallelLineText",
          affectedPaths: ["wiki/player/known_information.md"],
          visibility: "user_visible_pc_unknown",
          knowledgeScope: "user_only",
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/parallel-line or PC-unknown/)
  })

  it("rejects npc_known source deltas without concrete actor holders", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/characters/runtime/rin.md",
      strategy: "merge",
      knowledgeScope: "npc_known",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          knowledgeScope: "npc_known",
          affectedPaths: ["wiki/characters/runtime/rin.md"],
          knowledgeClaims: [pcKnowledgeClaim("claim-bad-npc-known", "PC-only claim cannot satisfy npc_known.")],
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/npc_known|concrete npc/i)
  })

  it("rejects NPC-only or user-only claims written to player known information", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/player/known_information.md",
      strategy: "merge",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          affectedPaths: ["wiki/player/known_information.md"],
          knowledgeClaims: [
            actorKnowledgeClaim("claim-npc-only-player-write", "Rin knows the ward anchor.", "npc:rin", "wiki/player/known_information.md"),
          ],
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/pc holder claims|player known information/i)
  })

  it("accepts valid PC inferred or misunderstood knowledge", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/player/known_information.md",
      strategy: "merge",
      visibility: "pc_inferred",
      knowledgeScope: "pc_misunderstanding",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          visibility: "pc_inferred",
          knowledgeScope: "pc_misunderstanding",
          affectedPaths: ["wiki/player/known_information.md"],
          knowledgeClaims: [
            pcKnowledgeClaim(
              "claim-pc-misunderstands-ward",
              "PC has formed a mistaken inference about the ward.",
              "wiki/player/known_information.md",
              "misunderstood",
            ),
          ],
        },
      ],
    }

    expect(validateRuntimeUpdateProposalResult(result).proposedWikiUpdates[0].targetPath).toBe(
      "wiki/player/known_information.md",
    )
  })

  it("accepts concrete npc knowledge into the matching character runtime overlay", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/characters/runtime/rin.md",
      strategy: "merge",
      visibility: "gm_only",
      knowledgeScope: "npc_known",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          visibility: "gm_only",
          knowledgeScope: "npc_known",
          affectedPaths: ["wiki/characters/runtime/rin.md"],
          knowledgeClaims: [
            actorKnowledgeClaim("claim-rin-knows-ward", "Rin knows the ward anchor is active.", "npc:rin", "wiki/characters/runtime/rin.md"),
          ],
        },
      ],
    }

    expect(validateRuntimeUpdateProposalResult(result).proposedWikiUpdates[0].targetPath).toBe(
      "wiki/characters/runtime/rin.md",
    )
  })

  it("accepts relationship information gaps with holder and non-holder claims", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/relationships/runtime/rin-sakura.md",
      strategy: "merge",
      visibility: "gm_only",
      knowledgeScope: "npc_known",
      reason: "Record an information gap between Rin and Sakura.",
      content: "Rin knows the ward anchor is active, while Sakura does not.",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          visibility: "gm_only",
          knowledgeScope: "npc_known",
          affectedPaths: ["wiki/relationships/runtime/rin-sakura.md"],
          knowledgeClaims: [
            actorKnowledgeGapClaim(
              "claim-rin-sakura-info-gap",
              "Rin knows the ward anchor; Sakura does not.",
              "npc:rin",
              "npc:sakura",
              "wiki/relationships/runtime/rin-sakura.md",
            ),
          ],
        },
      ],
    }

    expect(validateRuntimeUpdateProposalResult(result).proposedWikiUpdates[0].targetPath).toBe(
      "wiki/relationships/runtime/rin-sakura.md",
    )
  })

  it("requires reveal gate metadata for reveal-progress writes", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/plot-arcs/runtime/ward-anchor.md",
      strategy: "merge",
      visibility: "gm_only",
      knowledgeScope: "gm_only",
      reason: "Reveal progress for the ward anchor is now hinted.",
      content: "Reveal progress: the ward anchor has been hinted but not fully revealed.",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          visibility: "gm_only",
          knowledgeScope: "gm_only",
          affectedPaths: ["wiki/plot-arcs/runtime/ward-anchor.md"],
          knowledgeClaims: [
            gmKnowledgeClaim("claim-ward-anchor-reveal", "GM tracks the ward anchor reveal.", "wiki/plot-arcs/runtime/ward-anchor.md"),
          ],
          revealGateRefs: [],
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/revealGateRefs|revealState/)

    result.proposedWikiUpdates[0].sourceDeltas[0].revealGateRefs = ["gate.ward-anchor"]
    result.proposedWikiUpdates[0].sourceDeltas[0].revealState = "hinted"
    expect(validateRuntimeUpdateProposalResult(result).proposedWikiUpdates[0].targetPath).toBe(
      "wiki/plot-arcs/runtime/ward-anchor.md",
    )
  })

  it("rejects runtime overlay updates without sourceDelta affectedPath traceability", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/relationships/runtime/player-rin.md",
      strategy: "merge",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          affectedPaths: ["wiki/current-scene/scene_state.md"],
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/runtime overlay updates require/)
  })

  it("validates proposalGroups and pacing sourceDelta references", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposalGroups[0] = {
      ...result.proposalGroups[0],
      updateIds: ["missing-update"],
    }
    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/unknown update/)

    const pacingResult = sampleProposalResult(sampleTurnRecord())
    pacingResult.pacingUpdateProposal = {
      ...pacingResult.pacingUpdateProposal!,
      sourceDeltaIds: ["missing-source-delta"],
    }
    expect(() => validateRuntimeUpdateProposalResult(pacingResult)).toThrow(/unknown sourceDelta/)
  })

  it("keeps skipped deltas and outline review items out of ordinary pending updates", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates = []
    result.pacingUpdateProposal = null
    result.skippedDeltas = [
      {
        skipId: "skip-parallel-knowledge",
        sourceDelta: {
          ...sampleProposalResult(sampleTurnRecord()).proposedWikiUpdates[0].sourceDeltas[0],
          deltaId: "source-delta-skipped-parallel",
          visibility: "user_visible_pc_unknown",
          knowledgeScope: "user_only",
          affectedPaths: ["wiki/player/known_information.md"],
        },
        code: "pc_unknown_parallel_line",
        reason: "Parallel-line material is review/journal-only for PC knowledge.",
        reviewPolicy: "review_only",
      },
    ]
    result.outlineRevisionReviewItems = [
      {
        reviewItemId: "outline-review-1",
        sourceProposalId: "outline-proposal-1",
        reviewItemKind: "outlineRevision",
        outlineImpactLevel: "major_rewrite_required",
        summary: "Future-only outline revision needs manual review.",
        proposedRevisionSummary: "Revise future reveal order only.",
        targetOutlineRefs: [],
        mustPreserveFacts: [],
        runtimeDeltaRefs: [],
        reviewPolicy: "manual_review",
        ordinaryRuntimeUpdate: false,
        proposedWikiUpdate: false,
        autoWriteMainOutline: false,
        warnings: [],
      },
    ]
    result.proposalGroups = [
      {
        groupId: "group-skipped-outline",
        title: "Skipped and outline review material",
        lineTarget: "parallelLine",
        updateIds: [],
        skippedDeltaIds: ["skip-parallel-knowledge"],
        sourceDeltaIds: ["source-delta-skipped-parallel"],
        reason: "Review-only material must not become ordinary pending.",
        reviewPolicy: "review_only",
      },
    ]

    const validated = validateRuntimeUpdateProposalResult(result)
    expect(createPendingRpgUpdates(validated.proposedWikiUpdates)).toEqual([])
    expect(validated.skippedDeltas).toHaveLength(1)
    expect(validated.outlineRevisionReviewItems).toHaveLength(1)
  })

  it("rejects outline revision material mixed into ordinary proposedWikiUpdates", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      content: "outlineRevisionProposal should update wiki/outlines/main.md",
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/outline revision material/)
  })

  it("adapts fixture output through buildPrompt and parseOutput", async () => {
    const turnRecord = sampleTurnRecord()
    const adapter = createFixtureRuntimeUpdateProposalAdapter(JSON.stringify(sampleProposalDraft()))

    await expect(adapter.generateRuntimeUpdateProposal(buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord))).resolves.toMatchObject({
      proposedWikiUpdates: [expect.objectContaining({ targetPath: "wiki/current-scene/scene_state.md" })],
    })
  })

  it("builds deterministic RuntimeUpdateProposalInput from a turn record", () => {
    const turnRecord = sampleTurnRecord()
    const input = buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord)

    expect(input.turnRecord.submittedAction).toEqual(turnRecord.submittedAction)
    expect(input.postActionWorkingState).toEqual(turnRecord.postActionWorkingState)
    expect(input.actionResolution).toEqual(turnRecord.actionResolution)
    expect(input.worldTickResult).toEqual(turnRecord.worldTickResult)
    expect(input.visibleSelection).toEqual(turnRecord.visibleSelection)
    expect(input.recallSelection).toEqual(turnRecord.recallSelection)
    expect(input.recalledMaterials).toEqual(turnRecord.recalledMaterials)
    expect(input.outlineAwareNarrationBrief).toEqual(turnRecord.outlineAwareNarrationBrief)
    expect(input.outlineImpactReport).toEqual(turnRecord.outlineImpactReport)
    expect(input.turnNarration).toEqual(turnRecord.turnNarration)
    expect(input.consistencyValidation.checkedSources).toEqual(
      expect.arrayContaining(["turnRecord", "postActionWorkingState", "turnNarration"]),
    )
    expect(input.allowedTargets.map((target) => target.pathPattern)).toContain("wiki/current-scene/scene_state.md")
    expect(input.writePolicy.every((rule) => rule.reviewPolicy === "pending_review")).toBe(true)
    expect(input.reviewPolicy.find((rule) => rule.reviewItemKind === "outlineRevision")).toMatchObject({
      ordinaryRuntimeUpdate: false,
      autoApply: false,
    })
  })

  it("preserves actor knowledge metadata from recall through outline and runtime update input", () => {
    const submittedAction: SubmittedAction = {
      id: "turn-actor-handoff",
      text: "Ask Rin what she knows about the ward.",
      source: "freeform",
    }
    const pcClaims = defaultKnowledgeClaimsForPath({
      path: "wiki/player/known_information.md",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      summary: "PC knows the ward is visible.",
    })
    const gmClaims = defaultKnowledgeClaimsForPath({
      path: "wiki/outlines/progress.md",
      visibilityScope: "gm_only",
      knowledgeScope: "gm_only",
      summary: "GM tracks the active reveal gate.",
    })
    const npcClaims = defaultKnowledgeClaimsForPath({
      path: "wiki/characters/runtime/rin.md",
      visibilityScope: "gm_only",
      knowledgeScope: "npc_known",
      summary: "Rin knows the ward anchor.",
    })
    const factionClaims = defaultKnowledgeClaimsForPath({
      path: "wiki/factions/runtime/harbor-watch.md",
      visibilityScope: "gm_only",
      knowledgeScope: "npc_known",
      summary: "The Harbor Watch knows the patrol state.",
    })
    const recalledMaterials = [
      recalledMaterial("wiki/player/known_information.md", "playerKnowledge.current", "playerVisibleLine", "pc_visible", "pc_known", pcClaims),
      recalledMaterial("wiki/outlines/progress.md", "outlineProgress.active_reveal_gates", "tensionLine", "gm_only", "gm_only", gmClaims),
      recalledMaterial("wiki/characters/runtime/rin.md", "characterRuntime.knowledge", "tensionLine", "gm_only", "npc_known", npcClaims),
      recalledMaterial("wiki/factions/runtime/harbor-watch.md", "factionRuntime.knowledge", "tensionLine", "gm_only", "npc_known", factionClaims),
    ]
    const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction, { recalledMaterials })
    const outlineInput = buildOutlineBriefCompilerInputFromTurnState({
      actionResolution: runtimeParts.actionResolution,
      worldTickResult: runtimeParts.worldTickResult,
      visibleSelection: runtimeParts.visibleSelection,
      postActionWorkingState: runtimeParts.postActionWorkingState,
      recallSelection: runtimeParts.recallSelection,
      recalledMaterials,
    })
    const turnNarration = sampleTurnNarration()
    turnNarration.references.push({
      path: "wiki/characters/runtime/rin.md",
      sectionId: "characterRuntime.knowledge",
      lineTarget: "tensionLine",
      usePurpose: "narration",
      visibilityScope: "gm_only",
      knowledgeScope: "npc_known",
      knowledgeClaims: npcClaims,
      reason: "Narration keeps Rin's actor knowledge metadata as handoff only.",
    })

    const proposalInput = buildRuntimeUpdateProposalInputFromTurnRecord({
      submittedAction,
      ...runtimeParts,
      recalledMaterials,
      outlineAwareNarrationBrief: runtimeParts.outlineAwareNarrationBrief,
      outlineImpactReport: runtimeParts.outlineImpactReport,
      turnNarration,
      generatedNarrative: "Rin answers within the current knowledge boundary.",
      references: ["wiki/player/known_information.md", "wiki/characters/runtime/rin.md"],
    })

    expect(recalledMaterials.flatMap((material) => material.knowledgeClaims?.flatMap((claim) => claim.holders) ?? [])).toEqual(
      expect.arrayContaining(["pc", "gm", "npc:rin", "faction:harbor-watch"]),
    )
    expect(outlineInput.outlineSlices.find((slice) => slice.path === "wiki/outlines/progress.md")?.knowledgeClaims?.[0]?.holders).toEqual(["gm"])
    expect(proposalInput.recalledMaterials[2]?.knowledgeClaims?.[0]?.holders).toEqual(["npc:rin"])
    const narrationReferences = proposalInput.turnNarration?.references ?? []
    expect(narrationReferences[narrationReferences.length - 1]?.knowledgeClaims?.[0]?.holders).toEqual(["npc:rin"])
  })

  it("adapts LLM output through buildPrompt and parseOutput", async () => {
    const turnRecord = sampleTurnRecord()
    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken(JSON.stringify(sampleProposalDraft()))
      callbacks.onDone()
    })

    const adapter = createLlmRpgRuntimeUpdateProposalAdapter({
      llmConfig: {
        provider: "openai",
        apiKey: "test-key",
        model: "test-model",
        ollamaUrl: "",
        customEndpoint: "",
        maxContextSize: 10000,
      },
    })

    const result = await adapter.generateRuntimeUpdateProposal(buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord))
    expect(result.proposedWikiUpdates[0].sourceDeltas[0].sourceStage).toBe("turnRecord")
    expect(streamChatMock).toHaveBeenCalled()
  })

  it("registers and exports runtime_update_proposal without changing schema slots or writer/apply", () => {
    expect(listImplementedRpgInteractionKinds()).toContain("runtime_update_proposal")
    const entry = getRpgInteractionRegistryEntry("runtime_update_proposal")
    expect(entry?.stage).toBe("runtime_update")
    expect(entry?.spec).toBe(runtimeUpdateInteractionSpec)
    expect(entry?.notes?.join("\n")).toContain("Does not stage pending updates")
  })
})

function sampleTurnRecord(): RpgTurnRecord {
  const submittedAction: SubmittedAction = {
    id: "turn-69",
    text: "Ask Rin whether the sigil is a ward or a lure.",
    source: "freeform",
  }
  return {
    submittedAction,
    ...sampleTurnRecordRuntimeParts(submittedAction),
    turnNarration: sampleTurnNarration({
      playerFacingText: "Rin kneels by the gate and confirms the sigil is an old ward, not bait.",
    }),
    generatedNarrative: "Rin kneels by the gate and confirms the sigil is an old ward, not bait.",
    references: ["wiki/current-scene/scene_state.md", "wiki/player/known_information.md"],
  }
}

function sampleProposalDraft() {
  return {
    proposedWikiUpdates: [
      {
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Keep the current scene aligned with the settled ward inspection and patrol pressure.",
        content: "# Current Scene\n\nRin has identified the sigil as a ward while patrol lights draw nearer.",
        runtimeDeltaIds: [],
        sourceRefs: [
          {
            path: "wiki/current-scene/scene_state.md",
            reason: "Use the current scene source selected for this turn.",
          },
        ],
        happenedStatus: "ongoing",
        confidence: "high",
        riskNotes: [],
      },
    ],
    outlineRevisionReviewItems: [],
    journalEntries: [],
    skippedDeltas: [],
    pacingUpdateProposal: null,
    warnings: [],
  } as const
}

function sampleProposalResult(turnRecord: RpgTurnRecord): RuntimeUpdateProposalResult {
  const deltaRef = turnRecord.postActionWorkingState.runtimeDeltaRefs[0]
  return {
    proposedWikiUpdates: [
      {
        id: "runtime-update-scene-turn-69",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Keep the current scene aligned with the settled ward inspection and patrol pressure.",
        content: "# Current Scene\n\nRin has identified the sigil as a ward while patrol lights draw nearer.",
        sourceTurnId: turnRecord.submittedAction.id,
        references: ["wiki/current-scene/scene_state.md"],
        sourceDeltas: [
          {
            deltaId: "source-delta-current-scene-turn-69",
            sourceStage: "postActionWorkingState",
            sourceField: "campaignDelta",
            summary: "The patrol pressure and Mira/Rin warning move the gate scene forward.",
            lineTarget: "playerVisibleLine",
            visibility: "pc_visible",
            knowledgeScope: "pc_known",
            happenedStatus: "ongoing",
            usePurpose: "writeback",
            affectedPaths: ["wiki/current-scene/scene_state.md"],
            runtimeDeltaRefs: deltaRef ? [deltaRef] : [],
            knowledgeClaims: [
              pcKnowledgeClaim("claim-current-scene-turn-69", "PC sees the ward inspection and patrol pressure."),
            ],
            revealGateRefs: [],
          },
        ],
        lineTarget: "playerVisibleLine",
        visibility: "pc_visible",
        knowledgeScope: "pc_known",
        happenedStatus: "ongoing",
        confidence: "high",
        validationHints: [
          {
            hintId: "hint-scene-turn-69",
            severity: "info",
            code: "structured_source_delta",
            message: "Grounded in PostActionWorkingState rather than nextActionOptions.",
          },
        ],
      },
    ],
    outlineRevisionReviewItems: [],
    journalEntries: ["Runtime update proposal created from structured current-turn facts."],
    skippedDeltas: [],
    pacingUpdateProposal: {
      proposalId: "pacing-turn-69",
      sourceDeltaIds: ["source-delta-current-scene-turn-69"],
      previousPacingState: "low",
      nextPacingState: "none",
      timeDeltaSummary: turnRecord.actionResolution.timeDelta.summary,
      campaignDelta: turnRecord.postActionWorkingState.campaignDelta,
      pacingDebtChange: "decreased",
      targetPath: "wiki/current-scene/scene_state.md",
      reviewPolicy: "pending_review",
    },
    proposalGroups: [
      {
        groupId: "group-player-visible-turn-69",
        title: "Player-visible scene state",
        lineTarget: "playerVisibleLine",
        updateIds: ["runtime-update-scene-turn-69"],
        skippedDeltaIds: [],
        sourceDeltaIds: ["source-delta-current-scene-turn-69"],
        reason: "Current scene snapshot update.",
        reviewPolicy: "pending_review",
      },
    ],
    warnings: [],
  }
}

function recalledMaterial(
  path: string,
  sectionId: string,
  lineTarget: RecalledMaterial["lineTarget"],
  visibilityScope: RecalledMaterial["visibilityScope"],
  knowledgeScope: RecalledMaterial["knowledgeScope"],
  knowledgeClaims: NonNullable<RecalledMaterial["knowledgeClaims"]>,
): RecalledMaterial {
  return {
    path,
    lineTarget,
    readMode: "focusedSection",
    priority: "high",
    reason: `Recall ${path} for actor-knowledge handoff.`,
    expectedUse: "Preserve actor-level knowledge metadata through runtime handoffs.",
    visibilityScope,
    knowledgeScope,
    knowledgeClaims,
    sections: [
      {
        sectionId,
        readMode: "focusedSection",
        priority: "high",
        reason: `Read ${sectionId}.`,
        expectedUse: "Actor-knowledge handoff fixture.",
        content: "Fixture content for actor-knowledge handoff.",
        warnings: [],
      },
    ],
    warnings: [],
  }
}

function pcKnowledgeClaim(
  claimId: string,
  summary: string,
  sourcePath = "wiki/current-scene/scene_state.md",
  beliefState: "known" | "inferred" | "misunderstood" = "known",
) {
  return {
    claimId,
    summary,
    truthStatus: beliefState === "misunderstood" ? "false" as const : "unknown" as const,
    holders: ["pc" as const],
    nonHolders: [],
    beliefStateByActor: [
      {
        actor: "pc" as const,
        beliefState,
        reason: "PC-facing evidence supports this claim.",
      },
    ],
    sourcePath,
  }
}

function gmKnowledgeClaim(claimId: string, summary: string, sourcePath: string) {
  return {
    claimId,
    summary,
    truthStatus: "unknown" as const,
    holders: ["gm" as const],
    nonHolders: ["pc" as const],
    beliefStateByActor: [
      {
        actor: "gm" as const,
        beliefState: "known" as const,
        reason: "GM control or review material tracks this claim.",
      },
      {
        actor: "pc" as const,
        beliefState: "unknown" as const,
        reason: "This claim has not entered PC knowledge.",
      },
    ],
    sourcePath,
  }
}

function actorKnowledgeClaim(
  claimId: string,
  summary: string,
  actor: `npc:${string}` | `faction:${string}` | `group:${string}`,
  sourcePath: string,
) {
  return {
    claimId,
    summary,
    truthStatus: "unknown" as const,
    holders: [actor],
    nonHolders: ["pc" as const],
    beliefStateByActor: [
      {
        actor,
        beliefState: "known" as const,
        reason: "Actor runtime knowledge tracks this claim.",
      },
      {
        actor: "pc" as const,
        beliefState: "unknown" as const,
        reason: "This claim has not entered PC knowledge.",
      },
    ],
    sourcePath,
  }
}

function actorKnowledgeGapClaim(
  claimId: string,
  summary: string,
  holder: `npc:${string}` | `faction:${string}` | `group:${string}`,
  nonHolder: `npc:${string}` | `faction:${string}` | `group:${string}` | "pc",
  sourcePath: string,
) {
  return {
    ...actorKnowledgeClaim(claimId, summary, holder, sourcePath),
    nonHolders: [nonHolder],
    beliefStateByActor: [
      {
        actor: holder,
        beliefState: "known" as const,
        reason: "Holder knows this relationship-side information.",
      },
      {
        actor: nonHolder,
        beliefState: "unknown" as const,
        reason: "Non-holder does not know this information yet.",
      },
    ],
  }
}

function expectPromptDebugSectionsRecompose(
  prompt: ReturnType<typeof runtimeUpdateInteractionSpec.buildPrompt>,
): void {
  const sections = prompt.debugSections ?? []
  expect(sections.filter((section) => section.promptRole === "system").map((section) => section.content).join("\n\n")).toBe(
    prompt.systemPrompt,
  )
  expect(sections.filter((section) => section.promptRole === "user").map((section) => section.content).join("\n\n")).toBe(
    prompt.userPrompt,
  )
}
