import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createFixtureNarrationGeneratorAdapter,
  createFixtureOutlineBriefAdapter,
  createFixtureRecallSelectorAdapter,
  createFixtureRuntimeUpdateInteractionAdapter,
  createFixtureWorldTickAdapter,
  type RpgActionResolverAdapter,
  type RpgNarrationGeneratorAdapter,
} from "./rpg-interactions/runtime"
import {
  classifyRpgRuntimeDebugError,
  createRpgRuntimeDebugSection,
  createRpgRuntimeDebugTraceStore,
  estimatePromptTokens,
  RPG_RUNTIME_DEBUG_STEP_DEFINITIONS,
} from "./rpg-runtime/debug-trace"
import { runRpgRuntimeTurnFlow } from "./rpg-runtime/runtime-controller"
import type { SubmittedAction } from "./rpg-runtime/types"
import { RPG_SCHEMA_SLOTS } from "./rpg-wiki-schema"
import {
  sampleActionResolution,
  sampleOutlineBriefOutput,
  sampleRecallSelection,
  sampleTurnNarration,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import { createTempProject, writeFileRaw } from "@/test-helpers/fs-temp"

vi.mock("@/commands/fs", async () => {
  const { realFs } = await import("@/test-helpers/fs-temp")
  return realFs
})

interface Ctx {
  tmp: { path: string; cleanup: () => Promise<void> }
}

let ctx: Ctx | undefined

afterEach(async () => {
  if (ctx) {
    await ctx.tmp.cleanup()
    ctx = undefined
  }
})

describe("RPG runtime debug trace", () => {
  it("classifies runtime format, semantic, safety, and persistence failures", () => {
    expect(classifyRpgRuntimeDebugError(new Error("RPG Action Resolver 交互无法在 LLM 输出中找到 JSON 对象。"))).toMatchObject({
      phase: "parse",
      origin: "json_extract",
      kind: "json_extract_failed",
      category: "mechanical_format",
    })
    expect(classifyRpgRuntimeDebugError(new Error("RPG Action Resolver 交互解析 ActionResolution JSON 失败：Unexpected token"))).toMatchObject({
      phase: "parse",
      origin: "json_parse",
      kind: "malformed_json",
      category: "mechanical_format",
    })
    expect(classifyRpgRuntimeDebugError(new Error("Invalid ActionResolutionDraft.notes: must be an array."), "validation")).toMatchObject({
      origin: "draft_normalization",
      kind: "loose_scalar_array",
      category: "mechanical_format",
    })
    expect(classifyRpgRuntimeDebugError(new Error("Invalid WorldTickDraft.references: must be an array when provided; received object."), "validation")).toMatchObject({
      kind: "loose_single_object_array",
      category: "mechanical_format",
    })
    expect(classifyRpgRuntimeDebugError(new Error("Invalid WorldTickDraft.warnings: must be an array when provided; received null."), "validation")).toMatchObject({
      kind: "null_optional_field",
      category: "mechanical_format",
    })
    expect(classifyRpgRuntimeDebugError(new Error("Invalid ActionResolutionDraft: forbidden safety key ActionResolutionDraft.wikiWrites."), "validation")).toMatchObject({
      kind: "forbidden_safety_key",
      category: "safety",
    })
    expect(classifyRpgRuntimeDebugError(new Error("Invalid ActionResolutionDraft.eventDraft.summary: must be a non-empty string."), "validation")).toMatchObject({
      kind: "missing_semantic_field",
      category: "semantic_contract",
    })
    expect(classifyRpgRuntimeDebugError(new Error("Invalid ActionResolution.eventDraft.status: must be one of confirmed_happened, attempted_not_confirmed."), "validation")).toMatchObject({
      kind: "invalid_semantic_enum",
      category: "semantic_contract",
    })
    expect(classifyRpgRuntimeDebugError(new Error("Invalid WorldTickResult.worldDeltas.playerVisibleLine[0].affectedPaths: must contain at least one path."), "validation")).toMatchObject({
      origin: "canonical_validation",
      kind: "canonical_validation_failed",
      category: "semantic_contract",
    })
    expect(classifyRpgRuntimeDebugError(new Error("targetPath policy rejected wiki/outlines/main.md"), "persistence")).toMatchObject({
      origin: "persistence_boundary",
      kind: "forbidden_write_target",
      category: "persistence",
    })
  })

  it("estimates prompt tokens for English, Chinese, mixed, empty, and JSON text", () => {
    expect(estimatePromptTokens("hello world")).toEqual({
      chars: 11,
      estimatedTokens: 7,
      method: "mixed-char-estimate-v1",
    })
    expect(estimatePromptTokens("你好世界")).toEqual({
      chars: 4,
      estimatedTokens: 9,
      method: "mixed-char-estimate-v1",
    })
    expect(estimatePromptTokens("你好 world")).toEqual({
      chars: 8,
      estimatedTokens: 8,
      method: "mixed-char-estimate-v1",
    })
    expect(estimatePromptTokens("")).toEqual({
      chars: 0,
      estimatedTokens: 4,
      method: "mixed-char-estimate-v1",
    })
    expect(estimatePromptTokens("{\"a\":1,\"b\":\"test\"}")).toEqual({
      chars: 18,
      estimatedTokens: 9,
      method: "mixed-char-estimate-v1",
    })
  })

  it("keeps runtime debug steps in canonical order while events update statuses", () => {
    const store = createRpgRuntimeDebugTraceStore()
    store.startTrace({ submittedAction: sampleSubmittedAction("order") })
    store.startStep("world_tick")
    store.addStepSection(
      "world_tick",
      "promptSections",
      createRpgRuntimeDebugSection({
        sectionId: "world-prompt",
        title: "用户提示词",
        sourceKind: "runtime_handoff",
        sourceLabel: "test",
        contentType: "text",
        content: "prompt",
      }),
    )
    store.finishStep("world_tick")

    expect(store.getCurrentTrace()?.steps.map((step) => step.stepId)).toEqual(
      RPG_RUNTIME_DEBUG_STEP_DEFINITIONS.map((definition) => definition.stepId),
    )
    expect(store.getCurrentTrace()?.steps.find((step) => step.stepId === "world_tick")?.status).toBe("succeeded")
  })

  it("imports complete trace state snapshots for worker event sync", () => {
    const store = createRpgRuntimeDebugTraceStore()
    const runningTrace = createRpgRuntimeDebugTraceStore()
    runningTrace.startTrace({ submittedAction: sampleSubmittedAction("import-running") })
    runningTrace.startStep("action_resolver")

    store.importState({
      currentTrace: runningTrace.getCurrentTrace(),
      lastTrace: null,
    })

    expect(store.getCurrentTrace()?.traceId).toBe(runningTrace.getCurrentTrace()?.traceId)
    expect(store.getCurrentTrace()?.activeStepId).toBe("action_resolver")
    expect(store.getLastTrace()).toBeNull()

    const completedTrace = {
      ...runningTrace.getCurrentTrace()!,
      status: "succeeded" as const,
      endedAt: "2026-06-13T00:00:01.000Z",
      activeStepId: undefined,
    }
    store.importState({
      currentTrace: null,
      lastTrace: completedTrace,
    })

    expect(store.getCurrentTrace()).toBeNull()
    expect(store.getLastTrace()?.traceId).toBe(completedTrace.traceId)
    expect(store.getLastTrace()?.status).toBe("succeeded")
  })

  it("records all expected steps for a successful mocked runtime turn", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-success") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-success")
    const store = createRpgRuntimeDebugTraceStore()

    await runRpgRuntimeTurnFlow({
      projectPath: ctx.tmp.path,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter(submittedAction),
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
      ),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
      debugTraceSink: store,
    })

    const trace = store.getLastTrace()
    expect(trace?.status).toBe("succeeded")
    expect(trace?.steps.map((step) => step.stepId)).toEqual(
      RPG_RUNTIME_DEBUG_STEP_DEFINITIONS.map((definition) => definition.stepId),
    )
    expect(trace?.steps.find((step) => step.stepId === "story_outline_regenerator")?.status).toBe("skipped")
    expect(trace?.steps.find((step) => step.stepId === "runtime_update_proposal")?.rawOutput?.content).toContain(
      "proposedWikiUpdates",
    )
    expect(trace?.steps.find((step) => step.stepId === "pending_update_persistence")?.status).toBe("succeeded")

    const semanticPromptSteps = [
      "action_resolver",
      "world_tick",
      "recall_selector",
      "outline_brief",
      "narration_generator",
      "runtime_update_proposal",
    ] as const
    for (const stepId of semanticPromptSteps) {
      const step = trace?.steps.find((entry) => entry.stepId === stepId)
      expect(step?.promptSections.length, stepId).toBeGreaterThan(2)
      expect(step?.promptSections[0]).toMatchObject({
        title: "系统固定提示词",
        sourceKind: "fixed_prompt",
      })
      expect(step?.promptSections.every((section) => section.chars > 0 && section.estimatedTokens > 0), stepId).toBe(
        true,
      )
    }

    const actionStep = trace?.steps.find((step) => step.stepId === "action_resolver")
    expect(actionStep?.promptSections.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "已提交行动",
        "行动前快照",
        "相关规则",
        "固定槽位引用",
        "Runtime 引用",
        "返回契约",
      ]),
    )
    expect(actionStep?.promptSections.map((section) => section.title)).not.toEqual(["系统提示词", "用户提示词"])

    const largestActionPromptSection = [...(actionStep?.promptSections ?? [])].sort(
      (a, b) => b.estimatedTokens - a.estimatedTokens,
    )[0]
    expect(largestActionPromptSection).toMatchObject({
      title: expect.any(String),
      chars: expect.any(Number),
      estimatedTokens: expect.any(Number),
    })

    const wikiInputs = actionStep?.inputSections.find((section) => section.title === "Wiki Inputs / Source Paths")
    expect(wikiInputs?.sourceKind).toBe("wiki_file")
    expect(wikiInputs?.content).toContain("wiki/current-scene/scene_state.md")
    expect(wikiInputs?.content).toContain("\"warnings\"")
  })

  it("marks a failed action_resolver step and leaves later steps pending or skipped with raw output visible", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-action-failure") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-action-failure")
    const store = createRpgRuntimeDebugTraceStore()
    const actionResolverAdapter: RpgActionResolverAdapter = {
      resolveAction: vi.fn(async () => sampleActionResolution(submittedAction)),
      resolveActionRawOutput: vi.fn(async () => "{\"resolutionId\":\"bad-action\"}"),
    }

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter,
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
        debugTraceSink: store,
      }),
    ).rejects.toThrow(/invalid|expected|required/i)

    const trace = store.getLastTrace()
    const failedStep = trace?.steps.find((step) => step.stepId === "action_resolver")
    expect(trace?.status).toBe("failed")
    expect(failedStep?.status).toBe("failed")
    expect(failedStep?.promptSections.map((section) => section.title)).toEqual(
      expect.arrayContaining(["系统固定提示词", "已提交行动", "行动前快照", "返回契约"]),
    )
    expect(failedStep?.promptSections.map((section) => section.title)).not.toEqual(["系统提示词", "用户提示词"])
    expect(failedStep?.rawOutput?.content).toContain("bad-action")
    expect(failedStep?.validationSections.some((section) => section.title === "校验错误")).toBe(true)
    expect(trace?.steps.find((step) => step.stepId === "world_tick")?.status).toBe("pending")
    expect(trace?.steps.find((step) => step.stepId === "runtime_update_proposal")?.status).toBe("pending")
  })

  it("records raw output and parser error for runtime update proposal parse failure", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-parse-failure") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-parse-failure")
    const store = createRpgRuntimeDebugTraceStore()

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter: sampleActionResolverAdapter(submittedAction),
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
        updateInteractionAdapter: {
          async generateUpdateProposal() {
            return "not json"
          },
        },
        debugTraceSink: store,
      }),
    ).rejects.toThrow(/json/i)

    const step = store.getLastTrace()?.steps.find((entry) => entry.stepId === "runtime_update_proposal")
    expect(step?.status).toBe("failed")
    expect(step?.rawOutput?.content).toBe("not json")
    expect(step?.error?.phase).toBe("parse")
    expect(step?.validationSections.some((section) => section.title === "解析错误")).toBe(true)
  })

  it("recovers the real trace-derived playerActionDelta.notes string shape and records a warning", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-notes-string") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-notes-string")
    const store = createRpgRuntimeDebugTraceStore()
    const traceDerivedDraft = sampleActionResolution(submittedAction) as unknown as Record<string, unknown>
    traceDerivedDraft.playerActionDelta = {
      ...(traceDerivedDraft.playerActionDelta as Record<string, unknown>),
      notes: "No wiki write, narration, world tick, or reaction queue is included.",
    }
    const actionResolverAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return JSON.stringify(traceDerivedDraft)
      },
    }

    await runRpgRuntimeTurnFlow({
      projectPath: ctx.tmp.path,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter,
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
      ),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
      debugTraceSink: store,
    })

    const step = store.getLastTrace()?.steps.find((entry) => entry.stepId === "action_resolver")
    expect(store.getLastTrace()?.status).toBe("succeeded")
    expect(step?.status).toBe("succeeded")
    expect(step?.rawOutput?.content).toContain("\"notes\":\"No wiki write")
    expect(step?.parsedOutput?.content).toContain("\"notes\": [")
    expect(step?.warnings.join("\n")).toContain("loose_draft_coercion")
    expect(step?.warnings.join("\n")).toContain("ActionResolutionDraft.playerActionDelta.notes")
    expect(step?.formatRecoveryApplied).toBe(true)
    expect(step?.looseCoercions).toEqual([
      expect.objectContaining({
        label: "ActionResolutionDraft.playerActionDelta.notes",
        message: expect.stringContaining("accepted a string as a single-item string array"),
      }),
    ])
  })

  it("records JSON local repair reports and warnings for recovered soft semantic output", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-json-repair") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-json-repair")
    const store = createRpgRuntimeDebugTraceStore()
    const repairedOutput = `${JSON.stringify(sampleActionResolution(submittedAction), null, 2).replace(/\n}$/, ",\n}")}`
    const actionResolverAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return repairedOutput
      },
    }

    await runRpgRuntimeTurnFlow({
      projectPath: ctx.tmp.path,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter,
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
      ),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
      debugTraceSink: store,
    })

    const step = store.getLastTrace()?.steps.find((entry) => entry.stepId === "action_resolver")
    const report = step?.validationSections.find((section) => section.title === "JSON 提取与本地修复")
    expect(step?.status).toBe("succeeded")
    expect(report?.sourceKind).toBe("validation")
    expect(report?.content).toContain("removed_trailing_commas")
    expect(step?.warnings.join("\n")).toContain("json_format_recovery: removed_trailing_commas")
    expect(step?.formatRecoveryApplied).toBe(true)
    expect(step?.localRepairOperations).toEqual(["removed_trailing_commas"])
  })

  it("records JSON local repair failure reports as mechanical format parse failures", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-json-repair-failure") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-json-repair-failure")
    const store = createRpgRuntimeDebugTraceStore()
    const actionResolverAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return "{\"resolutionId\":\"bad\" \"submittedActionId\":\"missing-comma\"}"
      },
    }

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter,
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
        debugTraceSink: store,
      }),
    ).rejects.toThrow(/解析 JSON 失败/i)

    const step = store.getLastTrace()?.steps.find((entry) => entry.stepId === "action_resolver")
    const report = step?.validationSections.find((section) => section.title === "JSON 提取与本地修复")
    expect(step?.status).toBe("failed")
    expect(step?.error).toMatchObject({
      phase: "parse",
      origin: "json_parse",
      kind: "malformed_json",
      category: "mechanical_format",
    })
    expect(report?.content).toContain("\"parseSucceeded\": false")
    expect(report?.content).toContain("\"failureKind\": \"malformed_json\"")
  })

  it("retries malformed Action Resolver output once when enabled and records repair trace", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-repair-retry-success") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-repair-retry-success")
    const store = createRpgRuntimeDebugTraceStore()
    const repairedOutput = JSON.stringify(sampleActionResolution(submittedAction))
    const malformedOutput = repairedOutput.replace(
      "\"submittedActionId\"",
      "\"submittedActionId_missing_comma\" \"submittedActionId\"",
    )
    const repairActionResolutionRawOutput = vi.fn(async (_prompt: { userPrompt: string }) => repairedOutput)
    const actionResolverAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return malformedOutput
      },
      repairActionResolutionRawOutput,
    }

    await runRpgRuntimeTurnFlow({
      projectPath: ctx.tmp.path,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter,
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
      ),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
      debugTraceSink: store,
      softSemanticRepairRetry: { enabled: true, maxFailedOutputChars: 2000 },
    })

    const step = store.getLastTrace()?.steps.find((entry) => entry.stepId === "action_resolver")
    const initialFailure = step?.validationSections.find((section) => section.title === "修复专用重试初始失败")
    const repairOutput = step?.validationSections.find((section) => section.title === "修复专用重试输出")
    const repairSummary = step?.validationSections.find((section) => section.title === "修复专用重试摘要")
    expect(store.getLastTrace()?.status).toBe("succeeded")
    expect(step?.status).toBe("succeeded")
    expect(repairActionResolutionRawOutput).toHaveBeenCalledTimes(1)
    expect(repairActionResolutionRawOutput.mock.calls[0]?.[0].userPrompt).not.toContain("preActionSnapshot")
    expect(initialFailure?.content).toContain("\"kind\": \"malformed_json\"")
    expect(repairOutput?.sourceKind).toBe("llm_output")
    expect(repairOutput?.content).toContain("\"parsedIntent\"")
    expect(repairSummary?.content).toContain("\"attempted\": true")
    expect(repairSummary?.content).toContain("\"succeeded\": true")
    expect(step?.warnings.join("\n")).toContain("repair_retry_succeeded: action_resolver")
    expect(step?.formatRecoveryApplied).toBe(true)
    expect(step?.repairRetryAttempted).toBe(true)
    expect(step?.repairRetrySucceeded).toBe(true)
    expect(step?.repairRetryFailureSummary).toBeUndefined()
  })

  it("keeps Action Resolver repair retry disabled unless explicitly enabled", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-repair-retry-disabled") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-repair-retry-disabled")
    const store = createRpgRuntimeDebugTraceStore()
    const repairedOutput = JSON.stringify(sampleActionResolution(submittedAction))
    const repairActionResolutionRawOutput = vi.fn(async () => repairedOutput)
    const actionResolverAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return repairedOutput.replace(
          "\"submittedActionId\"",
          "\"submittedActionId_missing_comma\" \"submittedActionId\"",
        )
      },
      repairActionResolutionRawOutput,
    }

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter,
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
        debugTraceSink: store,
      }),
    ).rejects.toThrow(/解析 JSON 失败/i)

    expect(repairActionResolutionRawOutput).not.toHaveBeenCalled()
    const step = store.getLastTrace()?.steps.find((entry) => entry.stepId === "action_resolver")
    expect(step?.validationSections.some((section) => section.title === "修复专用重试摘要")).toBe(false)
  })

  it("does not repair-retry forbidden Action Resolver safety keys or invalid semantic enums", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-repair-retry-gates") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-repair-retry-gates")
    const store = createRpgRuntimeDebugTraceStore()
    const unsafeOutput = {
      ...sampleActionResolution(submittedAction),
      wikiWrites: [{ targetPath: "wiki/events/bad.md" }],
    }
    const repairActionResolutionRawOutput = vi.fn(async () => JSON.stringify(sampleActionResolution(submittedAction)))
    const actionResolverAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return JSON.stringify(unsafeOutput)
      },
      repairActionResolutionRawOutput,
    }

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter,
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
        debugTraceSink: store,
        softSemanticRepairRetry: { enabled: true },
      }),
    ).rejects.toThrow(/wiki write|forbidden/i)

    expect(repairActionResolutionRawOutput).not.toHaveBeenCalled()

    const enumStore = createRpgRuntimeDebugTraceStore()
    const invalidEnumOutput = sampleActionResolution(submittedAction) as unknown as Record<string, unknown>
    invalidEnumOutput.eventDraft = {
      ...(invalidEnumOutput.eventDraft as Record<string, unknown>),
      status: "surely_happened",
    }
    const invalidEnumRepair = vi.fn(async () => JSON.stringify(sampleActionResolution(submittedAction)))
    const invalidEnumAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return JSON.stringify(invalidEnumOutput)
      },
      repairActionResolutionRawOutput: invalidEnumRepair,
    }

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter: invalidEnumAdapter,
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
        debugTraceSink: enumStore,
        softSemanticRepairRetry: { enabled: true },
      }),
    ).rejects.toThrow(/eventDraft\.status/i)

    expect(invalidEnumRepair).not.toHaveBeenCalled()
  })

  it("records repair retry failure after the original Action Resolver parse failure", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-repair-retry-failure") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-repair-retry-failure")
    const store = createRpgRuntimeDebugTraceStore()
    const malformedOutput = "{\"parsedIntent\":{\"intentKind\":\"investigate\" \"actorRef\":\"player:Iven\"}}"
    const repairActionResolutionRawOutput = vi.fn(async () => "{\"still\":\"bad\" \"json\":true}")
    const actionResolverAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return malformedOutput
      },
      repairActionResolutionRawOutput,
    }

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter,
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
        debugTraceSink: store,
        softSemanticRepairRetry: { enabled: true, maxFailedOutputChars: 1000 },
      }),
    ).rejects.toThrow(/解析 JSON 失败/i)

    const step = store.getLastTrace()?.steps.find((entry) => entry.stepId === "action_resolver")
    const initialFailure = step?.validationSections.find((section) => section.title === "修复专用重试初始失败")
    const repairSummary = step?.validationSections.find((section) => section.title === "修复专用重试摘要")
    expect(step?.status).toBe("failed")
    expect(repairActionResolutionRawOutput).toHaveBeenCalledTimes(1)
    expect(initialFailure?.content).toContain("\"kind\": \"malformed_json\"")
    expect(repairSummary?.content).toContain("\"attempted\": true")
    expect(repairSummary?.content).toContain("\"succeeded\": false")
    expect(repairSummary?.content).toContain("\"failureSummary\"")
    expect(step?.validationSections.some((section) => section.title === "修复专用重试输出")).toBe(true)
    expect(step?.repairRetryAttempted).toBe(true)
    expect(step?.repairRetrySucceeded).toBe(false)
    expect(step?.repairRetryFailureSummary).toContain("解析 JSON 失败")
  })

  it("records raw output and validation error when narration output is malformed", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-debug-narration-validation-failure") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("debug-narration-validation-failure")
    const store = createRpgRuntimeDebugTraceStore()
    const malformedNarration = {
      parallelLineText: "Above the canal, a watch captain slows the next sweep.",
      tensionBrief: {
        summary: "Patrol pressure remains active.",
        pressureSignals: [],
        relationshipSignals: [],
        plotArcSignals: [],
        reviewHandoff: "Review only.",
      },
      nextActionOptions: [
        { playerFacingText: "Touch the lantern key to the sigil.", intent: "use_item", riskLevel: "medium", likelyAffectedPaths: ["wiki/current-scene/scene_state.md"] },
        { playerFacingText: "Ask Mira what the click means.", intent: "talk", riskLevel: "low", likelyAffectedPaths: ["wiki/current-scene/scene_state.md"] },
        { playerFacingText: "Wait and listen beyond the canal gate.", intent: "wait", riskLevel: "medium", likelyAffectedPaths: ["wiki/current-scene/scene_state.md"] },
      ],
      warnings: [],
    } as Record<string, unknown>
    delete malformedNarration.playerFacingText
    const narrationAdapter: RpgNarrationGeneratorAdapter = {
      async generateNarration() {
        return sampleTurnNarration()
      },
      async generateNarrationRawOutput() {
        return JSON.stringify(malformedNarration)
      },
    }

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter: sampleActionResolverAdapter(submittedAction),
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter,
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
        debugTraceSink: store,
      }),
    ).rejects.toThrow(/playerFacingText/i)

    const step = store.getLastTrace()?.steps.find((entry) => entry.stepId === "narration_generator")
    expect(step?.status).toBe("failed")
    expect(step?.rawOutput?.content).toContain("nextActionOptions")
    expect(step?.error?.phase).toBe("validation")
    expect(step?.validationSections.some((section) => section.title === "校验错误")).toBe(true)
    expect(step?.validationSections.find((section) => section.title === "校验错误")?.content).toContain(
      "playerFacingText",
    )
  })
})

function sampleSubmittedAction(id: string): SubmittedAction {
  return {
    id,
    text: "Ask Mira to inspect the canal gate sigil before I use the lantern key.",
    source: "freeform",
  }
}

function sampleActionResolverAdapter(submittedAction: SubmittedAction): RpgActionResolverAdapter {
  return {
    async resolveAction() {
      return sampleActionResolution(submittedAction)
    },
  }
}

function sampleEmptyRuntimeUpdateProposalOutput(): string {
  return JSON.stringify({
    proposedWikiUpdates: [],
    outlineRevisionReviewItems: [],
    journalEntries: [],
    skippedDeltas: [],
    pacingUpdateProposal: null,
    warnings: [],
  })
}

async function writeTurnFixture(projectPath: string): Promise<void> {
  await Promise.all(
    RPG_SCHEMA_SLOTS.map((slot) =>
      writeFileRaw(`${projectPath}/${slot.path}`, `# ${slot.slotId}\n\nTest fixture slot.`),
    ),
  )
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    "# Current Scene\n\nIven and Mira are beneath the River Port, facing a locked canal gate.",
  )
  await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nSmuggler-mage carrying a brass lantern key.")
}
